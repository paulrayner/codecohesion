import { TreeVisualizer } from './TreeVisualizer';
import { RepositorySnapshot, FileNode, DirectoryNode, TreeNode, TimelineData, TimelineDataV2 } from './types';
import { FILE_COLORS, DIRECTORY_COLOR } from './colorScheme';
import { ColorMode, getLegendItems, getColorModeName, getColorForFile, assignAuthorColors, calculateLastModifiedIntervals, calculateLocIntervals, isUsingPercentileIntervals } from './colorModeManager';
import { DeltaReplayController } from './DeltaReplayController';
import { couplingLoader } from './couplingLoader';
import { HierarchicalLayoutStrategy } from './HierarchicalLayoutStrategy';
import { ForceDirectedLayoutStrategy } from './ForceDirectedLayoutStrategy';
import { calculateDirectoryStats, calculateMaxDepth, countDirectories, collectModificationDates, collectLocValues } from './lib/tree-stats';
import { buildCommitIndex, buildPathIndex } from './lib/tree-indexers';
import { findFileInTree } from './lib/tree-utils';
import { getBaseRepoName } from './lib/repo-utils';
import { buildFileDetailsHTML } from './lib/html-builders/file-details';
import { buildDirectoryDetailsHTML } from './lib/html-builders/directory-details';
import {
  buildDirectoryLegendItemHTML,
  buildFileTypeLegendItemHTML,
  buildOtherLegendItemHTML,
  buildIntervalLegendItemHTML,
  buildGenericLegendItemHTML,
  buildAuthorLegendItemHTML,
  buildOverflowMessageHTML,
} from './lib/html-builders/legend';
import { createLegendItem } from './lib/legend-adapter';
import { determineFileToLoad, detectDataFormat, extractSnapshot } from './lib/data-loader';
import { buildVisualizerConfig, SavedPreferences, createLayoutStrategy } from './lib/visualizer-config';
import { applyVisualizerConfig } from './lib/visualizer-adapter';

type BrowserType = 'chrome' | 'firefox' | 'edge' | 'safari' | 'unknown';

const WEBGL_HELP_MESSAGES: Record<BrowserType, string> = {
  chrome: `
    <strong style="color: #ccc;">To fix in Chrome:</strong><br>
    1. Go to <code style="background: #333; padding: 2px 6px; border-radius: 3px;">chrome://settings/system</code><br>
    2. Enable "Use hardware acceleration when available"<br>
    3. Restart Chrome
  `,
  firefox: `
    <strong style="color: #ccc;">To fix in Firefox:</strong><br>
    1. Go to <code style="background: #333; padding: 2px 6px; border-radius: 3px;">about:preferences</code><br>
    2. Scroll to Performance<br>
    3. Enable "Use hardware acceleration when available"<br>
    4. Restart Firefox
  `,
  edge: `
    <strong style="color: #ccc;">To fix in Edge:</strong><br>
    1. Go to <code style="background: #333; padding: 2px 6px; border-radius: 3px;">edge://settings/system</code><br>
    2. Enable "Use hardware acceleration when available"<br>
    3. Restart Edge
  `,
  safari: `
    <strong style="color: #ccc;">To fix in Safari:</strong><br>
    WebGL should be enabled by default. Try restarting Safari or your Mac.<br>
    If the issue persists, check System Settings → Displays for GPU issues.
  `,
  unknown: `
    <strong style="color: #ccc;">To fix:</strong><br>
    Enable hardware acceleration in your browser settings and restart the browser.
  `,
};

function detectBrowser(userAgent: string): BrowserType {
  if (userAgent.includes('Edg')) return 'edge';
  if (userAgent.includes('Chrome')) return 'chrome';
  if (userAgent.includes('Firefox')) return 'firefox';
  if (userAgent.includes('Safari')) return 'safari';
  return 'unknown';
}

function getBrowserSpecificWebGLHelp(): string {
  const browser = detectBrowser(navigator.userAgent);
  return WEBGL_HELP_MESSAGES[browser];
}

/**
 * Get list of available repositories (base names only, no -timeline variants)
 */
async function getAvailableRepos(): Promise<string[]> {
  try {
    const response = await fetch('./data/repos.json');
    if (response.ok) {
      const data = await response.json();
      const repos = data.repos || [];

      // Remove duplicates by stripping -timeline or -timeline-full suffix
      const baseRepos = new Set<string>();
      for (const repo of repos) {
        // Strip -timeline-full or -timeline suffix to get base name
        const baseName = repo.replace(/-timeline(-full)?$/, '');
        baseRepos.add(baseName);
      }

      return Array.from(baseRepos).sort();
    }
  } catch (error) {
    console.warn('Could not load repos list, using default');
  }
  return ['gource']; // Default fallback
}

/**
 * Check if timeline data exists for a repository
 * Checks for both -timeline-full.json and -timeline.json
 */
async function checkTimelineExists(repoName: string): Promise<boolean> {
  // Try -timeline-full.json first (V2 format)
  try {
    const response = await fetch(`./data/${repoName}-timeline-full.json`, { method: 'HEAD' });
    if (response.ok) return true;
  } catch {
    // Fall through to check other variant
  }

  // Try -timeline.json (alternative naming)
  try {
    const response = await fetch(`./data/${repoName}-timeline.json`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load repository data (supports both static and timeline formats)
 */
async function loadData(repoName: string = 'gource'): Promise<RepositorySnapshot | TimelineData> {
  const response = await fetch(`./data/${repoName}.json`);

  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Count generated files in tree
 */
function countGeneratedFiles(tree: DirectoryNode): number {
  let count = 0;

  function countNode(node: TreeNode): void {
    if (node.type === 'file') {
      if (node.isGenerated) {
        count++;
      }
    } else {
      node.children.forEach(child => countNode(child));
    }
  }

  countNode(tree);
  return count;
}

/**
 * Filter tree to exclude generated files
 * Returns a new tree with generated files removed
 */
function filterGeneratedFiles(tree: DirectoryNode): DirectoryNode {
  function filterNode(node: TreeNode): TreeNode | null {
    if (node.type === 'file') {
      // Exclude file if marked as generated
      return node.isGenerated ? null : node;
    } else {
      // Directory: recursively filter children
      const filteredChildren = node.children
        .map(child => filterNode(child))
        .filter((child): child is TreeNode => child !== null);

      // Return directory only if it has children after filtering
      if (filteredChildren.length === 0) {
        return null;
      }

      return {
        ...node,
        children: filteredChildren
      };
    }
  }

  const filtered = filterNode(tree);
  return filtered as DirectoryNode; // Root directory always exists
}

/**
 * Update UI with repository info
 * (Repository name is now shown in dropdown only, no separate display)
 */
function updateHeader(snapshot: RepositorySnapshot) {
  // Repository name removed from header - shown in dropdown instead
}

/**
 * Show file details panel
 * @param file - The file node to show details for
 * @param handleCommitHighlighting - Whether to toggle commit sibling highlighting (default: false for hover, true for click)
 */
function showFileDetails(file: FileNode, handleCommitHighlighting: boolean = false) {
  console.log('🔍 showFileDetails called:', {
    fileName: file.name,
    filePath: file.path,
    handleCommitHighlighting,
    highlightCommitEnabled,
    lastCommitHash: file.lastCommitHash,
    commitIndexSize: commitToFilesIndex.size
  });

  const panel = document.getElementById('info-panel');
  const nameEl = document.getElementById('selected-name');
  const contentEl = document.getElementById('info-content');

  if (!panel || !nameEl || !contentEl) return;

  nameEl.textContent = file.name;

  // Get GitHub link if available
  const baseRepoName = getBaseRepoName(currentRepoBaseName);
  const githubFileUrl = getGitHubFileUrl(baseRepoName, file.path);

  // Prepare commit info for HTML builder
  let commitInfo: { commitHashStr: string; message: string; siblings: FileNode[] } | null = null;

  // Handle commit sibling highlighting with toggle behavior (only on click, not hover)
  if (handleCommitHighlighting && highlightCommitEnabled && file.lastCommitHash) {
    console.log('✅ Commit highlighting conditions met');
    // Check if clicking on a file that's part of the currently highlighted commit
    if (currentHighlightedCommit === file.lastCommitHash) {
      console.log('🔄 Toggling OFF - same commit clicked again');
      // Toggle OFF - clear highlighting
      if (currentVisualizer) {
        currentVisualizer.clearHighlight();
      }
      currentHighlightedCommit = null;
    } else {
      // New commit or first time - show highlighting
      const commitSiblings = commitToFilesIndex.get(file.lastCommitHash) || [];
      const otherFiles = commitSiblings.filter(f => f.path !== file.path);
      console.log('📝 Commit siblings found:', {
        totalSiblings: commitSiblings.length,
        otherFiles: otherFiles.length,
        commitHash: file.lastCommitHash
      });

      // Get commit message if available
      const commitMessage = currentSnapshot?.commitMessages?.[file.lastCommitHash];
      const commitHashStr = file.lastCommitHash.substring(0, 7);

      if (commitMessage || otherFiles.length > 0) {
        commitInfo = {
          commitHashStr,
          message: commitMessage || '',
          siblings: otherFiles,
        };
      }

      // Apply visual highlighting to all files in the commit (including the selected file)
      if (currentVisualizer) {
        const allCommitFiles = commitSiblings.map(f => f.path);
        currentVisualizer.highlightFiles(allCommitFiles);
      }
      currentHighlightedCommit = file.lastCommitHash;
    }
  } else {
    // Clear highlighting if mode is off
    console.log('❌ Commit highlighting skipped:', {
      handleCommitHighlighting,
      highlightCommitEnabled,
      hasCommitHash: !!file.lastCommitHash
    });
    if (currentVisualizer) {
      currentVisualizer.clearHighlight();
    }
    currentHighlightedCommit = null;
  }

  // Prepare clustering info for HTML builder
  let clusterInfo: { cluster: any; topEdges: any[] } | null = null;

  // Add coupling analysis section if in cluster mode and data is loaded
  if (couplingLoader.isLoaded()) {
    const currentColorMode = localStorage.getItem('colorMode') as ColorMode | null;

    if (currentColorMode === 'cluster') {
      const clusterId = couplingLoader.getClusterForFile(file.path);

      if (clusterId !== null) {
        const clusters = couplingLoader.getClusters();
        const cluster = clusters.find(c => c.id === clusterId);

        if (cluster) {
          // Get coupling edges for this file
          const allEdges = couplingLoader.getEdges(0.1); // Minimum 10% coupling
          const fileEdges = allEdges.filter(edge =>
            edge.fileA === file.path || edge.fileB === file.path
          );

          // Sort by coupling strength (descending)
          fileEdges.sort((a, b) => b.coupling - a.coupling);

          // Take top 5
          const topEdges = fileEdges.slice(0, 5);

          clusterInfo = { cluster, topEdges };
        }
      }
    }
  }

  // Build HTML using pure function
  const detailsHtml = buildFileDetailsHTML({
    file,
    githubFileUrl,
    commitInfo,
    clusterInfo,
  });

  contentEl.innerHTML = detailsHtml;

  panel.classList.add('visible');

  // Visual feedback for clicks (flash the panel header)
  if (handleCommitHighlighting && nameEl) {
    nameEl.style.transition = 'background-color 0.3s';
    nameEl.style.backgroundColor = 'rgba(74, 158, 255, 0.3)';
    setTimeout(() => {
      nameEl.style.backgroundColor = '';
    }, 300);
  }
}

/**
 * Show directory details panel
 */
function showDirectoryDetails(dir: DirectoryNode) {
  const panel = document.getElementById('info-panel');
  const nameEl = document.getElementById('selected-name');
  const contentEl = document.getElementById('info-content');

  if (!panel || !nameEl || !contentEl) return;

  nameEl.textContent = dir.name;

  const fileCount = dir.children.filter(c => c.type === 'file').length;
  const dirCount = dir.children.filter(c => c.type === 'directory').length;
  const dirStats = calculateDirectoryStats(dir);

  // Find dominant file type
  let dominantExt = 'none';
  let maxCount = 0;
  for (const [ext, count] of Object.entries(dirStats.filesByExt)) {
    if (count > maxCount) {
      maxCount = count;
      dominantExt = ext;
    }
  }

  const dominantName = FILE_COLORS[dominantExt]?.name || dominantExt;

  // Find most recently modified file in directory
  let mostRecentDate: string | null = null;
  let mostRecentAuthor: string | null = null;
  const findMostRecent = (node: TreeNode) => {
    if (node.type === 'file' && node.lastModified) {
      if (!mostRecentDate || new Date(node.lastModified) > new Date(mostRecentDate)) {
        mostRecentDate = node.lastModified;
        mostRecentAuthor = node.lastAuthor;
      }
    } else if (node.type === 'directory') {
      for (const child of node.children) {
        findMostRecent(child);
      }
    }
  };
  for (const child of dir.children) {
    findMostRecent(child);
  }

  const lastModifiedStr = mostRecentDate
    ? new Date(mostRecentDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Unknown';

  const authorStr = mostRecentAuthor || 'Unknown';

  // Get GitHub link if available
  const baseRepoName = getBaseRepoName(currentRepoBaseName);
  const githubDirUrl = getGitHubDirUrl(baseRepoName, dir.path);

  // Build HTML using pure function
  const detailsHtml = buildDirectoryDetailsHTML({
    dir,
    stats: {
      totalLoc: dirStats.totalLoc,
      fileCount,
      dirCount,
      dominantExt,
      dominantName,
    },
    lastModified: {
      date: lastModifiedStr,
      author: authorStr,
    },
    githubDirUrl,
  });

  contentEl.innerHTML = detailsHtml;

  panel.classList.add('visible');
}

/**
 * Show tooltip on hover
 */
function showTooltip(node: TreeNode | null, event?: MouseEvent) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  if (!node || !event) {
    tooltip.style.display = 'none';
    return;
  }

  if (node.type === 'file') {
    const lastModified = node.lastModified
      ? new Date(node.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Unknown';
    const author = node.lastAuthor || 'Unknown';
    tooltip.textContent = `📄 ${node.name} | ${node.loc} LOC | ${author} | ${lastModified}`;
  } else {
    // Find most recent file in directory
    let mostRecentDate: string | null = null;
    let mostRecentAuthor: string | null = null;
    const findMostRecent = (n: TreeNode) => {
      if (n.type === 'file' && n.lastModified) {
        if (!mostRecentDate || new Date(n.lastModified) > new Date(mostRecentDate)) {
          mostRecentDate = n.lastModified;
          mostRecentAuthor = n.lastAuthor;
        }
      } else if (n.type === 'directory') {
        for (const child of n.children) {
          findMostRecent(child);
        }
      }
    };
    for (const child of node.children) {
      findMostRecent(child);
    }

    const lastModified = mostRecentDate
      ? new Date(mostRecentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Unknown';
    const author = mostRecentAuthor || 'Unknown';
    tooltip.textContent = `📁 ${node.name} | ${node.children.length} items | ${author} | ${lastModified}`;
  }

  tooltip.style.display = 'block';
  tooltip.style.left = `${event.clientX + 15}px`;
  tooltip.style.top = `${event.clientY + 15}px`;
}

/**
 * Count visible files and LOC (respecting current filters)
 */
function countVisibleStats(tree: TreeNode): { files: number; loc: number } {
  if (!currentVisualizer || !currentSnapshot) {
    return { files: 0, loc: 0 };
  }

  const colorMode = (localStorage.getItem('colorMode') as ColorMode) || 'fileType';
  let files = 0;
  let loc = 0;

  const processNode = (node: TreeNode) => {
    if (node.type === 'file') {
      // Check if this file matches the current filter
      if (currentVisualizer!.hasActiveFilters()) {
        // Get file's category and check if it's in active filters
        const activeCategories = currentVisualizer!.getActiveFilterCategories();
        const fileColorInfo = getColorForFile(node, colorMode);
        if (activeCategories.includes(fileColorInfo.name)) {
          files++;
          loc += node.loc;
        }
      } else {
        files++;
        loc += node.loc;
      }
    } else {
      for (const child of node.children) {
        processNode(child);
      }
    }
  };

  processNode(tree);
  return { files, loc };
}

/**
 * Populate statistics panel
 */
function populateStats(snapshot: RepositorySnapshot) {
  updateStatsDisplay(snapshot);
}

/**
 * Update statistics display with filter awareness
 * Called when filters change to update counts
 */
function updateStatsDisplay(snapshot: RepositorySnapshot) {
  // Check if filters are active
  const hasFilters = currentVisualizer?.hasActiveFilters() || false;

  let visibleFiles = snapshot.stats.totalFiles;
  let visibleLoc = snapshot.stats.totalLoc;

  if (hasFilters) {
    // Count only visible files/LOC when filters are active
    const counts = countVisibleStats(snapshot.tree);
    visibleFiles = counts.files;
    visibleLoc = counts.loc;
  }

  // Update file count (with filter indicator if needed)
  const statFilesEl = document.getElementById('stat-files');
  if (statFilesEl) {
    if (hasFilters && visibleFiles < snapshot.stats.totalFiles) {
      statFilesEl.textContent = `${visibleFiles.toLocaleString()} / ${snapshot.stats.totalFiles.toLocaleString()}`;
      statFilesEl.title = `Showing ${visibleFiles} of ${snapshot.stats.totalFiles} files (filtered)`;
    } else {
      statFilesEl.textContent = snapshot.stats.totalFiles.toLocaleString();
      statFilesEl.title = '';
    }
  }

  // Update LOC count (with filter indicator if needed)
  const statLocEl = document.getElementById('stat-loc');
  if (statLocEl) {
    if (hasFilters && visibleLoc < snapshot.stats.totalLoc) {
      statLocEl.textContent = `${visibleLoc.toLocaleString()} / ${snapshot.stats.totalLoc.toLocaleString()}`;
      statLocEl.title = `Showing ${visibleLoc} of ${snapshot.stats.totalLoc} LOC (filtered)`;
    } else {
      statLocEl.textContent = snapshot.stats.totalLoc.toLocaleString();
      statLocEl.title = '';
    }
  }

  document.getElementById('stat-dirs')!.textContent = (countDirectories(snapshot.tree) - 1).toString(); // -1 for root
  document.getElementById('stat-depth')!.textContent = calculateMaxDepth(snapshot.tree).toString();

  // Calculate LOC by language for top languages
  const locByExt: Record<string, { loc: number; name: string; color: string }> = {};

  const processNode = (node: TreeNode) => {
    if (node.type === 'file') {
      const ext = node.extension;
      const colorInfo = FILE_COLORS[ext];
      if (!locByExt[ext]) {
        locByExt[ext] = {
          loc: 0,
          name: colorInfo?.name || ext,
          color: colorInfo?.hex || '#888'
        };
      }
      locByExt[ext].loc += node.loc;
    } else {
      for (const child of node.children) {
        processNode(child);
      }
    }
  };

  processNode(snapshot.tree);

  // Sort by LOC and take top 5
  const topLanguages = Object.values(locByExt)
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 5);

  const totalLoc = snapshot.stats.totalLoc;
  const langBreakdown = document.getElementById('lang-breakdown')!;
  langBreakdown.innerHTML = '<div style="margin-top: 10px; font-size: 10px; color: #888;">Top Languages:</div>';

  for (const lang of topLanguages) {
    const percentage = (lang.loc / totalLoc) * 100;
    const bar = document.createElement('div');
    bar.className = 'stat-bar';
    bar.innerHTML = `
      <div class="stat-bar-label">${lang.name}</div>
      <div class="stat-bar-fill">
        <div class="stat-bar-fill-inner" style="width: ${percentage}%; background: ${lang.color};">
          <span class="stat-bar-text">${percentage.toFixed(1)}%</span>
        </div>
      </div>
    `;
    langBreakdown.appendChild(bar);
  }

}

/**
 * Update "Hide generated files" checkbox label with count
 */
function updateHideGeneratedCheckbox(snapshot: RepositorySnapshot) {
  const generatedCount = countGeneratedFiles(snapshot.tree);
  const checkbox = document.getElementById('hide-generated-checkbox') as HTMLInputElement;
  const toggleLabel = checkbox?.closest('.toggle-label');
  const labelSpan = toggleLabel?.querySelector('span:not(.toggle-slider)');

  if (labelSpan) {
    if (generatedCount > 0) {
      labelSpan.textContent = `Hide generated files (${generatedCount} found)`;
    } else {
      labelSpan.textContent = 'Hide generated files';
    }
  }

  // Disable checkbox if no generated files
  if (checkbox) {
    checkbox.disabled = generatedCount === 0;
    if (generatedCount === 0) {
      checkbox.checked = false;
    }
  }
}

/**
 * Apply generated file filter based on checkbox state
 * Call this after loading a repository to visualize with or without generated files
 */
function applyGeneratedFileFilter() {
  if (!currentSnapshot || !currentVisualizer) return;

  const checkbox = document.getElementById('hide-generated-checkbox') as HTMLInputElement;
  const shouldHide = checkbox && checkbox.checked;

  const generatedCount = countGeneratedFiles(currentSnapshot.tree);

  if (shouldHide && generatedCount > 0) {
    console.log(`Hiding ${generatedCount} generated files`);
    const filteredTree = filterGeneratedFiles(currentSnapshot.tree);
    currentVisualizer.visualize(filteredTree);

    // Update stats to reflect filtered tree
    populateStatsForFilteredTree(filteredTree);
  } else {
    console.log(`Showing all files (${generatedCount} generated files present)`);
    currentVisualizer.visualize(currentSnapshot.tree);

    // Restore original stats
    populateStats(currentSnapshot);
  }
}

/**
 * Update statistics for filtered tree (when hiding generated files)
 */
function populateStatsForFilteredTree(tree: DirectoryNode) {
  // Count files and LOC in filtered tree
  let totalFiles = 0;
  let totalLoc = 0;

  function countInTree(node: TreeNode) {
    if (node.type === 'file') {
      totalFiles++;
      totalLoc += node.loc;
    } else {
      node.children.forEach(child => countInTree(child));
    }
  }

  countInTree(tree);

  // Update stats display
  const filesEl = document.getElementById('stat-files');
  const locEl = document.getElementById('stat-loc');

  if (filesEl) filesEl.textContent = totalFiles.toLocaleString();
  if (locEl) locEl.textContent = totalLoc.toLocaleString();
}

/**
 * Update statistics panel from tree (for Timeline where we don't have a full snapshot)
 */
function updateStatsForTree(tree: DirectoryNode, commitIndex?: number, totalCommits?: number) {
  // Count files and calculate total LOC
  let totalFiles = 0;
  let totalLoc = 0;
  const locByExt: Record<string, { loc: number; name: string; color: string }> = {};

  const processNode = (node: TreeNode) => {
    if (node.type === 'file') {
      totalFiles++;
      totalLoc += node.loc;

      const ext = node.extension;
      const colorInfo = FILE_COLORS[ext];
      if (!locByExt[ext]) {
        locByExt[ext] = {
          loc: 0,
          name: colorInfo?.name || ext,
          color: colorInfo?.hex || '#888'
        };
      }
      locByExt[ext].loc += node.loc;
    } else {
      for (const child of node.children) {
        processNode(child);
      }
    }
  };

  processNode(tree);

  // Update stats panel
  document.getElementById('stat-files')!.textContent = totalFiles.toLocaleString();
  document.getElementById('stat-loc')!.textContent = totalLoc.toLocaleString();
  document.getElementById('stat-dirs')!.textContent = (countDirectories(tree) - 1).toString(); // -1 for root
  document.getElementById('stat-depth')!.textContent = calculateMaxDepth(tree).toString();

  // Update stats panel title to show we're in timeline mode
  const statsHeader = document.querySelector('#stats-panel h3');
  if (statsHeader && commitIndex !== undefined && totalCommits !== undefined) {
    statsHeader.textContent = `Repository Stats (Commit ${commitIndex + 1} of ${totalCommits})`;
  }

  // Sort by LOC and take top 5
  const topLanguages = Object.values(locByExt)
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 5);

  const langBreakdown = document.getElementById('lang-breakdown')!;
  langBreakdown.innerHTML = '<div style="margin-top: 10px; font-size: 10px; color: #888;">Top Languages:</div>';

  for (const lang of topLanguages) {
    const percentage = (lang.loc / totalLoc) * 100;
    const bar = document.createElement('div');
    bar.className = 'stat-bar';
    bar.innerHTML = `
      <div class="stat-bar-label">${lang.name}</div>
      <div class="stat-bar-fill">
        <div class="stat-bar-fill-inner" style="width: ${percentage}%; background: ${lang.color};">
          <span class="stat-bar-text">${percentage.toFixed(1)}%</span>
        </div>
      </div>
    `;
    langBreakdown.appendChild(bar);
  }
}

/**
 * Populate legend with file extension colors
 * See viewer/docs/color-scheme.md for design rationale
 */
function populateLegend(snapshot: RepositorySnapshot) {
  const legendContent = document.getElementById('legend-content');
  const legendTitle = document.getElementById('legend-title');
  if (!legendContent) return;

  // Update legend title for file type mode
  if (legendTitle) {
    legendTitle.textContent = 'File Type';
  }

  // Clear previous legend content
  legendContent.innerHTML = '';

  // Get unique extensions present in this repo
  const extensions = Object.keys(snapshot.stats.filesByExtension);
  const presentExtensions = extensions
    .filter(ext => FILE_COLORS[ext])
    .sort((a, b) => snapshot.stats.filesByExtension[b] - snapshot.stats.filesByExtension[a]);

  // Add directory entry first (no checkbox - directories always visible)
  const dirItem = document.createElement('div');
  dirItem.className = 'legend-item';
  dirItem.innerHTML = buildDirectoryLegendItemHTML(DIRECTORY_COLOR);
  legendContent.appendChild(dirItem);

  // Add present extensions with checkboxes for filtering
  for (const ext of presentExtensions) {
    const info = FILE_COLORS[ext];
    const count = snapshot.stats.filesByExtension[ext];
    const html = buildFileTypeLegendItemHTML({
      name: info.name,
      hex: info.hex,
      count,
    });
    const item = createLegendItem(html, applyLegendFilters, 'label');
    legendContent.appendChild(item);
  }

  // Add "Other" if there are unknown extensions (with checkbox)
  const unknownCount = extensions
    .filter(ext => !FILE_COLORS[ext])
    .reduce((sum, ext) => sum + snapshot.stats.filesByExtension[ext], 0);

  if (unknownCount > 0) {
    const html = buildOtherLegendItemHTML(unknownCount);
    const item = createLegendItem(html, applyLegendFilters, 'label');
    legendContent.appendChild(item);
  }

  // Show filter controls for file type mode
  showFilterControls();

  // Update button states (all checkboxes start checked, so "All" should be disabled)
  updateFilterControlStates();
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
  }
}

let currentVisualizer: TreeVisualizer | null = null;
let currentSnapshot: RepositorySnapshot | null = null;
let currentTimelineData: TimelineData | null = null; // Timeline V1 format if loaded
let currentDeltaController: DeltaReplayController | null = null; // Timeline controller
let commitToFilesIndex: Map<string, FileNode[]> = new Map();
let highlightCommitEnabled: boolean = true;
let currentHighlightedCommit: string | null = null;

// Track clicked (selected) nodes to persist details panel
let lastClickedFile: FileNode | null = null;
let lastClickedDir: DirectoryNode | null = null;

// Mode switcher state
let currentRepoBaseName: string = '';
let timelineAvailable: boolean = false;

// Timeline playback state
let timelineIndex: number = 0;
let timelinePlaying: boolean = false;
let timelineIntervalId: number | null = null;
let timelineSpeed: number = 1; // 1x speed

// GitHub repository URL mapping
const REPO_GITHUB_URLS: Record<string, { owner: string; repo: string; url: string }> = {
  'gource': { owner: 'acaudwell', repo: 'Gource', url: 'https://github.com/acaudwell/Gource' },
  'cbioportal': { owner: 'cBioPortal', repo: 'cbioportal', url: 'https://github.com/cBioPortal/cbioportal' },
  'cbioportal-frontend': { owner: 'cBioPortal', repo: 'cbioportal-frontend', url: 'https://github.com/cBioPortal/cbioportal-frontend' },
  'react': { owner: 'facebook', repo: 'react', url: 'https://github.com/facebook/react' },
  'codecohesion': { owner: 'paulrayner', repo: 'codecohesion', url: 'https://github.com/paulrayner/codecohesion' }
};

/**
 * Get GitHub info for a repo
 */
function getGitHubInfo(repoBaseName: string) {
  return REPO_GITHUB_URLS[repoBaseName] || null;
}

/**
 * Build GitHub file URL (HEAD only for now)
 */
function getGitHubFileUrl(repoBaseName: string, filePath: string): string | null {
  const info = getGitHubInfo(repoBaseName);
  if (!info) return null;
  return `${info.url}/blob/HEAD/${filePath}`;
}

/**
 * Build GitHub directory URL (HEAD only)
 */
function getGitHubDirUrl(repoBaseName: string, dirPath: string): string | null {
  const info = getGitHubInfo(repoBaseName);
  if (!info) return null;
  // Root directory case
  if (!dirPath || dirPath === '') return `${info.url}/tree/HEAD`;
  return `${info.url}/tree/HEAD/${dirPath}`;
}

/**
 * Update repo GitHub link element
 */
function updateRepoGitHubLink(repoBaseName: string): void {
  const linkEl = document.getElementById('repo-github-link') as HTMLAnchorElement | null;
  const info = getGitHubInfo(repoBaseName);
  if (linkEl && info) {
    linkEl.href = info.url;
    const spanEl = linkEl.querySelector('span');
    if (spanEl) {
      spanEl.textContent = `${info.owner}/${info.repo}`;
    }
    linkEl.style.display = 'inline-flex';
    linkEl.target = '_blank';
  } else if (linkEl) {
    linkEl.style.display = 'none';
  }
}

let pathToFileIndex: Map<string, FileNode> = new Map();

// Timeline compatible color modes (only modes that work without lifetime analytics)
// Note: 'cluster' mode is HEAD-only since clusters represent current architectural boundaries
const TIMELINE_COMPATIBLE_MODES: ColorMode[] = ['fileType', 'lastModified', 'author'];

// Store original color mode when entering timeline mode
let savedColorModeBeforeTimeline: ColorMode | null = null;

// Store original option text (to avoid appending " (requires HEAD analysis)" multiple times)
const originalColorModeOptionText = new Map<string, string>();

/**
 * Enable Timeline mode UI changes (both V1 and V2)
 */
function enableTimelineMode() {
  // Hide "Highlight Commit" toggle (not applicable in timeline mode)
  const highlightToggle = document.getElementById('highlight-commit-toggle');
  const highlightLabel = highlightToggle?.closest('.toggle-label') as HTMLElement;
  if (highlightLabel) {
    highlightLabel.style.display = 'none';
  }

  // Hide "View Mode" toggle (not applicable in timeline mode - timeline shows all depths)
  const viewModeToggle = document.getElementById('view-mode-toggle');
  const viewModeLabel = viewModeToggle?.closest('.toggle-label') as HTMLElement;
  if (viewModeLabel) {
    viewModeLabel.style.display = 'none';
  }

  // Disable filtering in timeline mode
  disableFiltering();

  // Hide incompatible color modes (remove from dropdown)
  const colorModeSelector = document.getElementById('color-mode-selector') as HTMLSelectElement;
  if (colorModeSelector) {
    // Save current mode
    savedColorModeBeforeTimeline = colorModeSelector.value as ColorMode;

    // Remove incompatible options from dropdown
    const optionsToRemove: HTMLOptionElement[] = [];
    Array.from(colorModeSelector.options).forEach(option => {
      const mode = option.value as ColorMode;

      // Store original option element on first run
      if (!originalColorModeOptionText.has(mode)) {
        originalColorModeOptionText.set(mode, option.outerHTML);
      }

      if (!TIMELINE_COMPATIBLE_MODES.includes(mode)) {
        optionsToRemove.push(option);
      }
    });

    // Remove incompatible options
    optionsToRemove.forEach(option => option.remove());

    // If current mode is incompatible, switch to fileType
    if (!TIMELINE_COMPATIBLE_MODES.includes(savedColorModeBeforeTimeline)) {
      colorModeSelector.value = 'fileType';
      localStorage.setItem('colorMode', 'fileType');
      if (currentVisualizer) {
        currentVisualizer.setColorMode('fileType');
      }
      console.log(`Switched from incompatible mode '${savedColorModeBeforeTimeline}' to 'fileType'`);
    }
  }
}

/**
 * Disable Timeline mode UI changes (restore to static mode)
 */
function disableTimelineMode() {
  // Show "Highlight Commit" toggle
  const highlightToggle = document.getElementById('highlight-commit-toggle');
  const highlightLabel = highlightToggle?.closest('.toggle-label') as HTMLElement;
  if (highlightLabel) {
    highlightLabel.style.display = '';
  }

  // Show "View Mode" toggle
  const viewModeToggle = document.getElementById('view-mode-toggle');
  const viewModeLabel = viewModeToggle?.closest('.toggle-label') as HTMLElement;
  if (viewModeLabel) {
    viewModeLabel.style.display = '';
  }

  // Re-enable filtering in HEAD mode
  enableFiltering();

  // Restore all color modes (re-add removed options)
  const colorModeSelector = document.getElementById('color-mode-selector') as HTMLSelectElement;
  if (colorModeSelector) {
    // Only restore if we actually removed options (i.e., originalColorModeOptionText has data)
    if (originalColorModeOptionText.size > 0) {
      // Get list of all color modes that should exist
      const allModes: ColorMode[] = ['fileType', 'lastModified', 'author', 'churn', 'contributors', 'fileAge', 'recentActivity', 'stability', 'recency'];

      // Clear and rebuild the selector with all options in correct order
      const currentValue = colorModeSelector.value;
      colorModeSelector.innerHTML = '';

      for (const mode of allModes) {
        if (originalColorModeOptionText.has(mode)) {
          // Restore from saved HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = originalColorModeOptionText.get(mode) || '';
          const option = tempDiv.firstChild as HTMLOptionElement;
          if (option) {
            colorModeSelector.appendChild(option);
          }
        }
      }

      // Restore previous color mode if it was changed
      if (savedColorModeBeforeTimeline && !TIMELINE_COMPATIBLE_MODES.includes(savedColorModeBeforeTimeline)) {
        colorModeSelector.value = savedColorModeBeforeTimeline;
        localStorage.setItem('colorMode', savedColorModeBeforeTimeline);
        if (currentVisualizer) {
          currentVisualizer.setColorMode(savedColorModeBeforeTimeline);
        }
        console.log(`Restored color mode to '${savedColorModeBeforeTimeline}'`);
      } else {
        // Keep current value if compatible
        colorModeSelector.value = currentValue;
      }
      savedColorModeBeforeTimeline = null;
    }
  }
}

/**
 * Load Timeline (Full Delta) format
 */
async function loadTimeline(data: TimelineDataV2, repoName: string) {
  const loading = document.getElementById('loading');

  try {
    console.log(`\n=== LOADING TIMELINE ===`);
    console.log(`Repository: ${data.repositoryPath}`);
    console.log(`Total commits: ${data.metadata.totalCommits}`);
    console.log(`Date range: ${data.metadata.dateRange.first.substring(0, 10)} to ${data.metadata.dateRange.last.substring(0, 10)}`);
    console.log(`Tags: ${data.metadata.tags.length}`);

    // Create delta controller
    currentDeltaController = new DeltaReplayController(data);
    currentTimelineData = null; // Clear V1 data

    // Update loading indicator based on keyframe mode
    const mode = currentDeltaController.getKeyframeMode();
    if (loading) {
      loading.innerHTML = `
        <div class="spinner"></div>
        <p>${mode === 'full' ? 'Generating full keyframes...' : 'Generating strategic keyframes...'}</p>
        <p id="progress-text">0 / ${data.metadata.totalCommits}</p>
      `;
    }

    // Generate keyframes (adaptive strategy)
    await currentDeltaController.generateKeyframes((current, total) => {
      const progressText = document.getElementById('progress-text');
      if (progressText) {
        progressText.textContent = `${current} / ${total}`;
      }
    });

    // Log keyframe stats
    const stats = currentDeltaController.getKeyframeStats();
    console.log(`📊 Keyframe strategy: ${stats.mode}`);
    console.log(`   Base keyframes: ${stats.baseKeyframes}`);
    console.log(`   Total commits: ${stats.totalCommits}`);

    // VALIDATION: Try to load static HEAD snapshot for comparison
    const staticName = repoName.replace('-timeline-full', '');
    try {
      console.log(`\n📋 Loading HEAD snapshot for validation: ${staticName}`);
      const headData = await loadData(staticName);

      if ('tree' in headData) {
        const validation = currentDeltaController.validateFinalTree(headData as RepositorySnapshot);

        if (!validation.isValid) {
          console.error(`\n❌ VALIDATION FAILED!`);
          console.error(`Missing files:`, validation.missing.slice(0, 10));
          console.error(`Extra files:`, validation.extra.slice(0, 10));
        }
      }
    } catch (error) {
      console.warn('Could not load HEAD snapshot for validation:', error);
    }

    // Get first commit's tree
    const firstTree = currentDeltaController.getTreeAtCommit(0);
    if (!firstTree) {
      throw new Error('Failed to generate first keyframe');
    }

    // Create a temporary snapshot for initialization
    const tempSnapshot: RepositorySnapshot = {
      repositoryPath: data.repositoryPath,
      commit: data.commits[0].hash,
      timestamp: data.commits[0].date,
      author: data.commits[0].author,
      message: data.commits[0].message,
      tree: firstTree,
      commitMessages: {},
      stats: {
        totalFiles: 0,
        totalLoc: 0,
        filesByExtension: {}
      }
    };

    currentSnapshot = tempSnapshot;

    // Build path index from first tree
    pathToFileIndex = buildPathIndex(firstTree);

    // Initialize visualizer
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    if (!currentVisualizer) {
      currentVisualizer = new TreeVisualizer(canvas);

      // Build configuration from saved preferences
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const preferences: SavedPreferences = {
        labelMode: localStorage.getItem('labelMode') as 'always' | 'hover' | null,
        colorMode: localStorage.getItem('colorMode'),
        viewMode: localStorage.getItem('viewMode') as 'navigate' | 'overview' | null,
        layoutMode: localStorage.getItem('layoutMode'),
      };
      const config = buildVisualizerConfig(currentTheme as 'light' | 'dark', preferences);

      // Apply configuration with event handlers
      applyVisualizerConfig(
        currentVisualizer,
        config,
        couplingLoader.isLoaded() ? couplingLoader : null,
        {
          onFileClick: (file) => {
            // Check if we're about to toggle OFF highlighting (clicking same file twice)
            const wasHighlighted = currentHighlightedCommit === file.lastCommitHash;

            lastClickedFile = file;
            lastClickedDir = null;
            showFileDetails(file, true); // true = handle commit highlighting on click

            // If we toggled OFF highlighting, clear the selection to restore hover mode
            if (wasHighlighted && currentHighlightedCommit === null) {
              lastClickedFile = null;
              lastClickedDir = null;
            }
          },
          onDirClick: (dir) => {
            lastClickedDir = dir;
            lastClickedFile = null;
            showDirectoryDetails(dir);
          },
          onHover: (node, event) => {
            if (!node) {
              // Only hide panel if nothing is currently clicked/selected
              if (!lastClickedFile && !lastClickedDir) {
                const panel = document.getElementById('info-panel');
                if (panel) panel.classList.remove('visible');
              }
              return;
            }

            // Only show hover details if nothing is currently clicked/pinned
            // When a file is clicked, it stays pinned until clicked again
            if (!lastClickedFile && !lastClickedDir) {
              // Show details based on node type (temporary preview, doesn't affect clicked state)
              if (node.type === 'file') {
                // In cluster mode, don't show right panel - cluster card is shown in 3D
                const currentColorMode = localStorage.getItem('colorMode') as ColorMode | null;
                if (currentColorMode !== 'cluster') {
                  showFileDetails(node, false); // false = no commit highlighting (just preview)
                }
              } else {
                showDirectoryDetails(node);
              }
            }
          },
        }
      );

      currentVisualizer.start();
    } else {
      // Update coupling loader if visualizer already exists
      currentVisualizer.setCouplingLoader(couplingLoader.isLoaded() ? couplingLoader : null);
    }

    // Load first tree
    currentVisualizer.visualize(firstTree);
    currentVisualizer.setTimelineMode('delta');

    // Set up V2 playback controls
    setupTimelineControls();

    // Repository name is shown in dropdown only (no separate header element)

    // Display initial commit info (index 0)
    // The onCommit callback only fires on user interaction, not on initial load
    if (currentDeltaController) {
      const initialCommit = currentDeltaController.getCommitAtIndex(0);
      if (initialCommit) {
        const commitInfo = document.getElementById('commit-info');
        if (commitInfo) {
          const dateStr = new Date(initialCommit.date).toLocaleDateString();

          // Build file changes summary with label (only show non-zero counts)
          const added = initialCommit.changes.filesAdded.length;
          const modified = initialCommit.changes.filesModified.length;
          const deleted = initialCommit.changes.filesDeleted?.length || 0;

          const fileChanges = [];
          if (added > 0) fileChanges.push(`<span style="color: #27ae60">+${added}</span>`);
          if (modified > 0) fileChanges.push(`<span style="color: #ffff00">~${modified}</span>`);
          if (deleted > 0) fileChanges.push(`<span style="color: #e74c3c">-${deleted}</span>`);
          const filesSummary = fileChanges.length > 0 ? ` • Files: ${fileChanges.join(' ')}` : '';

          // LOC changes with label (lines of code added/deleted)
          const linesAdded = initialCommit.changes.linesAdded || 0;
          const linesDeleted = initialCommit.changes.linesDeleted || 0;
          const locChanges = [];
          if (linesAdded > 0) locChanges.push(`<span style="color: #27ae60">+${linesAdded}</span>`);
          if (linesDeleted > 0) locChanges.push(`<span style="color: #e74c3c">-${linesDeleted}</span>`);
          const locSummary = locChanges.length > 0 ? ` • LOC: ${locChanges.join(' ')}` : '';

          // Net file count delta (repository growth/shrinkage)
          // Only show when different from additions (i.e., when there are deletions)
          const fileDelta = added - deleted;
          let fileDeltaSummary = '';
          if (fileDelta > 0 && fileDelta !== added) {
            // Has deletions, show net (e.g., +7 -3 = +4 files)
            fileDeltaSummary = ` • <span style="color: #27ae60">+${fileDelta} ${fileDelta === 1 ? 'file' : 'files'}</span>`;
          } else if (fileDelta < 0) {
            // Net negative (more deletions than additions)
            fileDeltaSummary = ` • <span style="color: #e74c3c">${fileDelta} ${Math.abs(fileDelta) === 1 ? 'file' : 'files'}</span>`;
          }
          // Otherwise hide (redundant with Files: +N)

          // Merge commit indicator
          const mergeIndicator = initialCommit.isMergeCommit ? ' <span style="color: #888; font-size: 0.9em;">[MERGE]</span>' : '';

          const tags = initialCommit.tags.length > 0 ? ` 🏷️ ${initialCommit.tags.join(', ')}` : '';
          commitInfo.innerHTML = `${initialCommit.hash.substring(0, 7)} • ${dateStr} • ${initialCommit.author}${mergeIndicator}${filesSummary}${locSummary}${fileDeltaSummary}${tags}`;
        }

        // Highlight files for initial commit
        highlightTimelineCommitFiles(initialCommit, 0);

        // Update repository stats panel with initial tree state
        const totalCommits = currentDeltaController.getTotalCommits();
        updateStatsForTree(firstTree, 0, totalCommits);
      }
    }

    // Show timeline controls
    const timelineControls = document.getElementById('timeline-controls');
    if (timelineControls) {
      timelineControls.style.display = 'flex';
    }

    // Set up tag navigation
    setupTagNavigation();

    // Enable Timeline mode UI
    enableTimelineMode();

    console.log('\n✅ Timeline loaded successfully!\n');

  } catch (error) {
    console.error('Error loading Timeline:', error);
    if (loading) {
      loading.innerHTML = `<p style="color: red;">Error loading timeline: ${error}</p>`;
    }
  } finally {
    if (loading) {
      setTimeout(() => loading.classList.add('hidden'), 500);
    }
  }
}

/**
 * Set up Timeline playback controls
 */
function setupTimelineControls() {
  if (!currentDeltaController) return;

  console.log('Setting up Timeline controls...');

  // Track if this is the first commit (to reset camera only once)
  // Note: Set to false because initial camera reset is handled by visualize(firstTree) call above
  let isFirstCommit = false;

  // Listen for commit changes
  currentDeltaController.on('commit', ({ index, commit, tree }: any) => {
    const perfStart = performance.now();
    const timings: Record<string, number> = {};

    // Get previous tree for ghost rendering
    const prevTree = index > 0 ? currentDeltaController?.getTreeAtCommit(index - 1) : null;

    // Update visualizer with current tree
    if (currentVisualizer && tree) {
      const t0 = performance.now();

      if (isFirstCommit) {
        // First commit: do full visualization with camera reset
        currentVisualizer.visualize(tree, true);
        isFirstCommit = false;
      } else {
        // Subsequent commits: use incremental update to preserve physics state
        currentVisualizer.updateTreeIncremental(
          tree,
          commit.changes.filesAdded,
          commit.changes.filesModified,
          commit.changes.filesDeleted || []
        );
      }

      timings.visualize = performance.now() - t0;

      const t1 = performance.now();
      pathToFileIndex = buildPathIndex(tree);
      timings.pathIndex = performance.now() - t1;

      // Render ghosts for deleted files AFTER visualize (Timeline only)
      if (commit.changes.filesDeleted.length > 0 && prevTree) {
        const t2 = performance.now();
        currentVisualizer.renderDeletedFiles(commit.changes.filesDeleted, prevTree);
        timings.ghosts = performance.now() - t2;
      }

      const t3 = performance.now();
      // Update repository stats panel with current tree state
      const totalCommits = currentDeltaController?.getTotalCommits() || 0;
      updateStatsForTree(tree, index, totalCommits);
      timings.stats = performance.now() - t3;
    }

    // Update commit info
    const commitInfo = document.getElementById('commit-info');
    if (commitInfo) {
      const dateStr = new Date(commit.date).toLocaleDateString();

      // Build file changes summary with label (only show non-zero counts)
      const added = commit.changes.filesAdded.length;
      const modified = commit.changes.filesModified.length;
      const deleted = commit.changes.filesDeleted?.length || 0;

      const fileChanges = [];
      if (added > 0) fileChanges.push(`<span style="color: #27ae60">+${added}</span>`);
      if (modified > 0) fileChanges.push(`<span style="color: #ffff00">~${modified}</span>`);
      if (deleted > 0) fileChanges.push(`<span style="color: #e74c3c">-${deleted}</span>`);
      const filesSummary = fileChanges.length > 0 ? ` • Files: ${fileChanges.join(' ')}` : '';

      // LOC changes with label (lines of code added/deleted)
      const linesAdded = commit.changes.linesAdded || 0;
      const linesDeleted = commit.changes.linesDeleted || 0;
      const locChanges = [];
      if (linesAdded > 0) locChanges.push(`<span style="color: #27ae60">+${linesAdded}</span>`);
      if (linesDeleted > 0) locChanges.push(`<span style="color: #e74c3c">-${linesDeleted}</span>`);
      const locSummary = locChanges.length > 0 ? ` • LOC: ${locChanges.join(' ')}` : '';

      // Net file count delta (repository growth/shrinkage)
      // Only show when different from additions (i.e., when there are deletions)
      const fileDelta = added - deleted;
      let fileDeltaSummary = '';
      if (fileDelta > 0 && fileDelta !== added) {
        // Has deletions, show net (e.g., +7 -3 = +4 files)
        fileDeltaSummary = ` • <span style="color: #27ae60">+${fileDelta} ${fileDelta === 1 ? 'file' : 'files'}</span>`;
      } else if (fileDelta < 0) {
        // Net negative (more deletions than additions)
        fileDeltaSummary = ` • <span style="color: #e74c3c">${fileDelta} ${Math.abs(fileDelta) === 1 ? 'file' : 'files'}</span>`;
      }
      // Otherwise hide (redundant with Files: +N)

      // Merge commit indicator
      const mergeIndicator = commit.isMergeCommit ? ' <span style="color: #888; font-size: 0.9em;">[MERGE]</span>' : '';

      const tags = commit.tags.length > 0 ? ` 🏷️ ${commit.tags.join(', ')}` : '';
      commitInfo.innerHTML = `${commit.hash.substring(0, 7)} • ${dateStr} • ${commit.author}${mergeIndicator}${filesSummary}${locSummary}${fileDeltaSummary}${tags}`;
    }

    // Highlight files changed in this commit
    const t4 = performance.now();
    highlightTimelineCommitFiles(commit, index);
    timings.highlight = performance.now() - t4;

    // Update timeline UI
    const t5 = performance.now();
    updateTimelineUI(index);
    timings.ui = performance.now() - t5;

    // Log performance metrics (only for slow commits)
    const totalTime = performance.now() - perfStart;

    // Warn if commit processing is slow (potential performance issue)
    if (totalTime > 100) {
      timings.total = totalTime;
      const timingStr = Object.entries(timings)
        .map(([key, val]) => `${key}=${val.toFixed(1)}ms`)
        .join(', ');
      console.warn(`⚠️ Slow commit ${index + 1}: ${timingStr}`);
    }
  });

  // Play/pause button
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn) {
    playPauseBtn.onclick = () => {
      currentDeltaController?.togglePlay();
    };
  }

  currentDeltaController.on('playStateChanged', ({ isPlaying }: any) => {
    if (playPauseBtn) {
      playPauseBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    }
  });

  // Step buttons
  const stepBackBtn = document.getElementById('step-back-btn');
  const stepForwardBtn = document.getElementById('step-forward-btn');

  if (stepBackBtn) {
    stepBackBtn.onclick = () => currentDeltaController?.stepBackward();
  }

  if (stepForwardBtn) {
    stepForwardBtn.onclick = () => currentDeltaController?.stepForward();
  }

  // Go to start/end
  const goToStartBtn = document.getElementById('go-to-start-btn');
  if (goToStartBtn) {
    goToStartBtn.onclick = () => currentDeltaController?.goToStart();
  }

  // Speed control
  const speedSelect = document.getElementById('speed-selector') as HTMLSelectElement;
  if (speedSelect) {
    speedSelect.onchange = () => {
      const speed = parseInt(speedSelect.value);
      currentDeltaController?.setSpeed(speed);
    };
  }

  // Slider control - seek when dragged
  const sliderEl = document.getElementById('commit-slider') as HTMLInputElement;
  if (sliderEl) {
    sliderEl.oninput = () => {
      const index = parseInt(sliderEl.value);
      currentDeltaController?.seekToCommit(index);
    };
  }

  // Timeline scrubber - click and drag to seek
  const scrubber = document.getElementById('timeline-scrubber');
  if (scrubber) {
    let isDragging = false;

    const seekToPosition = (clientX: number) => {
      if (!currentDeltaController) return;
      const rect = scrubber.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const totalCommits = currentDeltaController.getTotalCommits();
      const targetIndex = Math.floor(percentage * (totalCommits - 1));
      currentDeltaController.seekToCommit(targetIndex);
    };

    scrubber.addEventListener('mousedown', (e) => {
      isDragging = true;
      seekToPosition(e.clientX);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        seekToPosition(e.clientX);
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // Initialize UI
  updateTimelineUI(0);
}

/**
 * Update Timeline UI elements
 */
function updateTimelineUI(index: number) {
  if (!currentDeltaController) return;

  const currentEl = document.getElementById('timeline-commit-index');
  const totalEl = document.getElementById('timeline-commit-total');
  const progressEl = document.getElementById('timeline-progress');

  if (currentEl) {
    currentEl.textContent = (index + 1).toString();
  }

  if (totalEl) {
    totalEl.textContent = currentDeltaController.getTotalCommits().toString();
  }

  // Update progress bar
  if (progressEl) {
    const total = currentDeltaController.getTotalCommits();
    const percentage = ((index + 1) / total) * 100;
    progressEl.style.width = `${percentage}%`;
  }

  // Update tag selector to match current position
  updateTagSelectorForCurrentCommit(index);
}

/**
 * Set up tag navigation (dropdown and markers)
 */
function setupTagNavigation() {
  const tagSelectorContainer = document.getElementById('tag-selector-container') as HTMLElement;

  // V2 Timeline format (with DeltaReplayController)
  if (currentDeltaController) {
    const metadata = currentDeltaController.getMetadata();
    const tags = metadata.tags;

    if (tags.length === 0) {
      console.log('No tags found in repository');
      // Hide the tag selector UI when there are no tags
      if (tagSelectorContainer) {
        tagSelectorContainer.style.display = 'none';
      }
      return;
    }

    // Show the tag selector UI when tags exist
    if (tagSelectorContainer) {
      tagSelectorContainer.style.display = 'inline';
    }

    console.log(`Setting up tag navigation: ${tags.length} tags found`);

    // Populate tag dropdown
    const tagSelector = document.getElementById('tag-selector') as HTMLSelectElement;
    if (tagSelector) {
      // Clear existing options (except the first "-- Select tag --")
      tagSelector.innerHTML = '<option value="">-- Select tag --</option>';

      // Add tags in reverse order (newest first, assuming tags are chronological)
      for (let i = tags.length - 1; i >= 0; i--) {
        const option = document.createElement('option');
        option.value = tags[i];
        option.textContent = tags[i];
        tagSelector.appendChild(option);
      }

      // Handle tag selection
      tagSelector.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const selectedTag = target.value;

        if (selectedTag && currentDeltaController) {
          const success = currentDeltaController.seekToTag(selectedTag);
          if (!success) {
            console.warn(`Tag not found: ${selectedTag}`);
          }
        }
      });
    }

    // Render tag markers on timeline scrubber
    renderTagMarkers();
  } else {
    // V1 Timeline format (no DeltaReplayController) - V1 format doesn't support tags
    console.log('Timeline V1 format: tags not supported');
    if (tagSelectorContainer) {
      tagSelectorContainer.style.display = 'none';
    }
  }
}

/**
 * Render visual tag markers on the timeline scrubber
 */
function renderTagMarkers() {
  if (!currentDeltaController) return;

  const tagMarkersContainer = document.getElementById('tag-markers');
  if (!tagMarkersContainer) return;

  // Clear existing markers
  tagMarkersContainer.innerHTML = '';

  const totalCommits = currentDeltaController.getTotalCommits();
  const metadata = currentDeltaController.getMetadata();

  // Find all commits with tags
  const taggedCommits: Array<{ index: number; tags: string[] }> = [];

  for (let i = 0; i < totalCommits; i++) {
    const commit = currentDeltaController.getCommitAtIndex(i);
    if (commit && commit.tags.length > 0) {
      taggedCommits.push({ index: i, tags: commit.tags });
    }
  }

  console.log(`Rendering ${taggedCommits.length} tag markers`);

  // Render markers
  for (const tagged of taggedCommits) {
    const percentage = (tagged.index / (totalCommits - 1)) * 100;
    const marker = document.createElement('div');
    marker.className = 'tag-marker';
    marker.style.left = `${percentage}%`;
    marker.setAttribute('data-tag', tagged.tags.join(', '));

    // Make marker clickable to seek
    marker.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent scrubber click
      currentDeltaController?.seekToCommit(tagged.index);
    });

    tagMarkersContainer.appendChild(marker);
  }
}

/**
 * Update tag selector to reflect current commit's tags
 */
function updateTagSelectorForCurrentCommit(index: number) {
  if (!currentDeltaController) return;

  const commit = currentDeltaController.getCommitAtIndex(index);
  const tagSelector = document.getElementById('tag-selector') as HTMLSelectElement;

  if (tagSelector && commit) {
    if (commit.tags.length > 0) {
      // Set selector to first tag at this commit
      tagSelector.value = commit.tags[0];
    } else {
      // Reset to placeholder if no tag at current commit
      tagSelector.value = '';
    }
  }
}

/**
 * Get currently selected mode from radio buttons
 */
function getSelectedMode(): 'head' | 'timeline' {
  const radio = document.querySelector('input[name="view-mode"]:checked') as HTMLInputElement;
  return (radio?.value as 'head' | 'timeline') || 'head';
}

/**
 * Set mode radio button programmatically
 */
function setSelectedMode(mode: 'head' | 'timeline') {
  const radio = document.querySelector(`input[name="view-mode"][value="${mode}"]`) as HTMLInputElement;
  if (radio) {
    radio.checked = true;
  }
}

/**
 * Show or hide mode switcher
 */
function updateModeSwitcherVisibility(show: boolean) {
  const modeSwitcher = document.getElementById('mode-switcher');
  if (modeSwitcher) {
    modeSwitcher.style.display = show ? 'flex' : 'none';
  }
}

/**
 * Update color mode dropdown to add/remove cluster option based on coupling data
 * IMPORTANT: Controls must be completely hidden (not disabled) when unavailable
 */
function updateColorModeOptionsForCoupling(hasCouplingData: boolean) {
  const colorModeSelector = document.getElementById('color-mode-selector') as HTMLSelectElement;
  if (!colorModeSelector) return;

  // Check if cluster option already exists
  const existingClusterOption = Array.from(colorModeSelector.options).find(
    opt => opt.value === 'cluster'
  );

  if (hasCouplingData && !existingClusterOption) {
    // Add cluster option at the end (before the closing </select>)
    const clusterOption = document.createElement('option');
    clusterOption.value = 'cluster';
    clusterOption.textContent = 'Coupling Clusters';
    colorModeSelector.appendChild(clusterOption);
    console.log('✓ Added "Coupling Clusters" color mode option');
  } else if (!hasCouplingData && existingClusterOption) {
    // Remove cluster option if coupling data unavailable
    // Check if cluster mode was selected BEFORE removing the option
    const wasClusterMode = colorModeSelector.value === 'cluster' || localStorage.getItem('colorMode') === 'cluster';

    existingClusterOption.remove();

    // If cluster mode was selected, switch to default (fileType)
    if (wasClusterMode) {
      colorModeSelector.value = 'fileType';
      // Update localStorage synchronously to avoid race conditions
      localStorage.setItem('colorMode', 'fileType');
      // Trigger change event to update visualization
      colorModeSelector.dispatchEvent(new Event('change'));
    }
    console.log('ℹ️  Removed "Coupling Clusters" color mode (no coupling data)');
  }
}

/**
 * Load and display a repository
 */
async function loadRepository(repoName: string) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('hidden');
    loading.innerHTML = '<div class="spinner"></div><p>Loading visualization...</p>';
  }

  try {
    console.log(`Loading repository: ${repoName}`);

    // Store current base repository name
    currentRepoBaseName = repoName;

    // Update GitHub link for this repo
    const baseRepoName = getBaseRepoName(repoName);
    updateRepoGitHubLink(baseRepoName);

    // Check if timeline data exists
    timelineAvailable = await checkTimelineExists(repoName);
    console.log(`Timeline available for ${repoName}: ${timelineAvailable}`);

    // Show/hide mode switcher based on timeline availability
    updateModeSwitcherVisibility(timelineAvailable);

    // Get selected mode
    const mode = getSelectedMode();

    // Determine which file to load and load it
    let data: any;
    let fileToLoad = repoName;

    const { files, fallbackToHead } = determineFileToLoad(repoName, mode, timelineAvailable);

    if (files.length > 1) {
      // Timeline mode: try files in order
      let loaded = false;

      for (const fileName of files) {
        try {
          console.log(`Trying to load: ${fileName}.json`);
          const testData = await loadData(fileName);
          data = testData;
          fileToLoad = fileName;
          loaded = true;
          console.log(`Successfully loaded: ${fileToLoad}.json`);
          break;
        } catch (e) {
          console.log(`Could not load ${fileName}: ${e}`);
        }
      }

      if (!loaded) {
        console.warn(`No timeline file could be loaded for ${repoName}, falling back to HEAD mode`);
        setSelectedMode('head');
        fileToLoad = repoName;
        data = await loadData(fileToLoad);
      }
    } else {
      // HEAD mode (single file)
      console.log(`Loading HEAD mode: ${files[0]}`);
      if (fallbackToHead) {
        setSelectedMode('head');
      }
      fileToLoad = files[0];
      data = await loadData(fileToLoad);
    }

    // Detect format and extract snapshot
    let snapshot: RepositorySnapshot;

    // Try to load coupling data based on actual loaded file (graceful degradation if unavailable)
    const hasCouplingData = await couplingLoader.tryLoad(fileToLoad);
    updateColorModeOptionsForCoupling(hasCouplingData);

    const format = detectDataFormat(data);
    const extractedSnapshot = extractSnapshot(data, format);

    if (format === 'timeline') {
      // Timeline: Full delta format - need to handle specially
      console.log('🎬 Timeline (Full Delta) format detected');
      await loadTimeline(data as TimelineDataV2, fileToLoad);
      return; // Early return - V2 uses different loading path
    } else if (format === 'timeline-v1') {
      // Timeline V1: Sampled format
      console.log('Timeline V1 format detected');
      currentTimelineData = data;
      currentDeltaController = null;
      snapshot = extractedSnapshot!;
      console.log(`Timeline data: ${data.timeline.totalCommits} total commits, ${data.timeline.baseSampling.actualCount} sampled`);
    } else {
      // Static snapshot format
      console.log('Static snapshot format detected');
      currentTimelineData = null;
      currentDeltaController = null;
      snapshot = extractedSnapshot!;
    }

    currentSnapshot = snapshot;
    console.log('Data loaded:', snapshot);

    // For static HEAD mode only: disable timeline mode UI
    if (!currentTimelineData && !currentDeltaController) {
      disableTimelineMode();
    }

    // Build commit hash index
    commitToFilesIndex = buildCommitIndex(snapshot.tree);
    console.log(`Built commit index: ${commitToFilesIndex.size} unique commits`);

    // Build path-to-file index for timeline highlighting
    pathToFileIndex = buildPathIndex(snapshot.tree);
    console.log(`Built path index: ${pathToFileIndex.size} files`);

    // Calculate percentile-based intervals for last modified dates
    const modificationDates = collectModificationDates(snapshot.tree);
    calculateLastModifiedIntervals(modificationDates);
    console.log(`Calculated last modified intervals from ${modificationDates.length} files`);

    // Calculate percentile-based intervals for lines of code
    const locValues = collectLocValues(snapshot.tree);
    calculateLocIntervals(locValues);
    console.log(`Calculated LOC intervals from ${locValues.length} files`);

    // Clear UI state from previous repo
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) {
      infoPanel.classList.remove('visible');
    }
    currentHighlightedCommit = null;
    if (currentVisualizer) {
      currentVisualizer.clearHighlight();
    }

    updateHeader(snapshot);
    populateStats(snapshot);
    updateHideGeneratedCheckbox(snapshot);

    // Show/hide timeline controls based on format
    const timelineControls = document.getElementById('timeline-controls');
    if (timelineControls) {
      if (currentTimelineData) {
        timelineControls.style.display = 'flex';
        // Set up timeline controls (only once per load)
        setupTimelineV1Controls();
        // Set up tag navigation (will hide UI for V1 since it doesn't support tags)
        setupTagNavigation();
        // Enable Timeline V1 mode UI (limit color options, hide incompatible features)
        enableTimelineMode();
      } else {
        timelineControls.style.display = 'none';
        // Re-enable filtering for HEAD view
        enableFiltering();
      }
    }

    // Initialize or reuse visualizer
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    if (!currentVisualizer) {
      currentVisualizer = new TreeVisualizer(canvas);

      // Build configuration from saved preferences
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const preferences: SavedPreferences = {
        labelMode: localStorage.getItem('labelMode') as 'always' | 'hover' | null,
        colorMode: localStorage.getItem('colorMode'),
        viewMode: localStorage.getItem('viewMode') as 'navigate' | 'overview' | null,
        layoutMode: localStorage.getItem('layoutMode'),
      };
      const config = buildVisualizerConfig(currentTheme as 'light' | 'dark', preferences);

      // Apply configuration with event handlers
      applyVisualizerConfig(
        currentVisualizer,
        config,
        couplingLoader.isLoaded() ? couplingLoader : null,
        {
          onFileClick: (file) => {
            // Check if we're about to toggle OFF highlighting (clicking same file twice)
            const wasHighlighted = currentHighlightedCommit === file.lastCommitHash;

            lastClickedFile = file;
            lastClickedDir = null;
            showFileDetails(file, true); // true = handle commit highlighting on click

            // If we toggled OFF highlighting, clear the selection to restore hover mode
            if (wasHighlighted && currentHighlightedCommit === null) {
              lastClickedFile = null;
              lastClickedDir = null;
            }
          },
          onDirClick: (dir) => {
            lastClickedDir = dir;
            lastClickedFile = null;
            showDirectoryDetails(dir);
          },
          onHover: (node, event) => {
            if (!node) {
              // Only hide panel if nothing is currently clicked/selected
              if (!lastClickedFile && !lastClickedDir) {
                const panel = document.getElementById('info-panel');
                if (panel) panel.classList.remove('visible');
              }
              return;
            }

            // Only show hover details if nothing is currently clicked/pinned
            // When a file is clicked, it stays pinned until clicked again
            if (!lastClickedFile && !lastClickedDir) {
              // Show details based on node type (temporary preview, doesn't affect clicked state)
              if (node.type === 'file') {
                // In cluster mode, don't show right panel - cluster card is shown in 3D
                const currentColorMode = localStorage.getItem('colorMode') as ColorMode | null;
                if (currentColorMode !== 'cluster') {
                  showFileDetails(node, false); // false = no commit highlighting (just preview)
                }
              } else {
                showDirectoryDetails(node);
              }
            }
          },
        }
      );

      // Start animation
      currentVisualizer.start();
    } else {
      // Update coupling loader if visualizer already exists
      currentVisualizer.setCouplingLoader(couplingLoader.isLoaded() ? couplingLoader : null);
    }

    // Enable timeline mode if loading timeline data (shows all files for highlighting)
    currentVisualizer.setTimelineMode(currentTimelineData !== null ? 'v1' : 'off');

    // Visualize the tree (apply filter if checkbox is checked)
    applyGeneratedFileFilter();

    // Update legend based on current color mode
    const currentColorMode = (localStorage.getItem('colorMode') as ColorMode) || 'fileType';
    if (currentColorMode === 'fileType') {
      populateLegend(snapshot);
    } else {
      updateLegendForColorMode(currentColorMode);
    }

    hideLoading();

    console.log('Visualization ready!');
  } catch (error) {
    console.error('Error initializing visualization:', error);
    const loading = document.getElementById('loading');
    if (loading) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isWebGLError = errorMessage.toLowerCase().includes('webgl');

      if (isWebGLError) {
        const browserHelp = getBrowserSpecificWebGLHelp();
        loading.innerHTML = `
          <p style="color: #ff4444;">WebGL is not available</p>
          <p style="font-size: 13px; margin-top: 15px; color: #ccc;">
            This visualization requires WebGL, which is disabled in your browser.
          </p>
          <p style="font-size: 12px; margin-top: 15px; color: #888; text-align: left; max-width: 420px; margin-left: auto; margin-right: auto;">
            ${browserHelp}
          </p>
        `;
      } else {
        loading.innerHTML = `
          <p style="color: #ff4444;">Error loading visualization</p>
          <p style="font-size: 12px; margin-top: 10px; color: #888;">
            ${errorMessage}
          </p>
          <p style="font-size: 12px; margin-top: 10px; color: #888;">
            Make sure you've run the processor and placed the data file in public/data/
          </p>
        `;
      }
    }
  }
}

/**
 * Main application initialization
 */
async function main() {
  // Get available repositories
  const repos = await getAvailableRepos();

  // Populate selector
  const selector = document.getElementById('repo-selector') as HTMLSelectElement;
  if (selector) {
    selector.innerHTML = '';
    repos.forEach(repo => {
      const option = document.createElement('option');
      option.value = repo;

      // Add owner/repo to the display text if we have GitHub info
      const baseRepoName = getBaseRepoName(repo);
      const githubInfo = getGitHubInfo(baseRepoName);
      if (githubInfo) {
        option.textContent = `${repo} (${githubInfo.owner}/${githubInfo.repo})`;
      } else {
        option.textContent = repo;
      }

      selector.appendChild(option);
    });

    // Load first repo by default
    if (repos.length > 0) {
      await loadRepository(repos[0]);
    }

    // Handle repo switching
    selector.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;

      // Clear filters when switching repos (fresh start for new codebase)
      if (currentVisualizer) {
        currentVisualizer.clearFilter();
      }

      await loadRepository(target.value);
    });
  }

  // Set up mode switcher (HEAD vs Timeline)
  const modeRadios = document.querySelectorAll('input[name="view-mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', async () => {
      // Reload current repository with new mode
      if (currentRepoBaseName) {
        await loadRepository(currentRepoBaseName);
      }
    });
  });

  // Set up layout mode selector
  const layoutModeSelector = document.getElementById('layout-mode-selector') as HTMLSelectElement;
  if (layoutModeSelector) {
    // Load saved preference from localStorage
    const savedLayoutMode = localStorage.getItem('layoutMode') || 'hierarchical';
    layoutModeSelector.value = savedLayoutMode;

    // Handle layout mode change
    layoutModeSelector.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const newMode = target.value;
      localStorage.setItem('layoutMode', newMode);

      if (currentVisualizer) {
        currentVisualizer.setLayoutStrategy(createLayoutStrategy(newMode));
      }
    });
  }

  // Set up color mode selector
  const colorModeSelector = document.getElementById('color-mode-selector') as HTMLSelectElement;
  if (colorModeSelector) {
    // Load saved preference from localStorage
    const savedColorMode = localStorage.getItem('colorMode') as ColorMode | null;
    if (savedColorMode) {
      colorModeSelector.value = savedColorMode;
    }

    // Handle color mode change
    colorModeSelector.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const newMode = target.value as ColorMode;
      localStorage.setItem('colorMode', newMode);

      // Clear filters when switching color modes (categories are incompatible)
      if (currentVisualizer) {
        currentVisualizer.clearFilter();
        currentVisualizer.setColorMode(newMode);
      }

      // Update legend for new color mode (checkboxes will be all checked)
      if (newMode === 'fileType' && currentSnapshot) {
        populateLegend(currentSnapshot);
      } else {
        updateLegendForColorMode(newMode);
      }

      // Update stats panel to reflect cleared filters
      if (currentSnapshot) {
        updateStatsDisplay(currentSnapshot);
      }
    });
  }

  // Set up label toggle (after first repo loads so currentVisualizer exists)
  const labelToggle = document.getElementById('label-toggle') as HTMLInputElement;
  if (labelToggle) {
    // Load saved preference from localStorage, default to 'hover' (unchecked)
    const savedMode = localStorage.getItem('labelMode') as 'always' | 'hover' | null;
    const initialMode = savedMode || 'hover';

    // Set checkbox to match saved mode (checked = always, unchecked = hover)
    labelToggle.checked = initialMode === 'always';

    // Handle toggle clicks
    labelToggle.addEventListener('change', () => {
      const newMode = labelToggle.checked ? 'always' : 'hover';
      localStorage.setItem('labelMode', newMode);

      if (currentVisualizer) {
        currentVisualizer.setLabelMode(newMode);
      }
    });
  }

  // Set up view mode toggle (HEAD view only - navigate vs overview)
  const viewModeToggle = document.getElementById('view-mode-toggle') as HTMLInputElement;
  if (viewModeToggle) {
    // Load saved preference from localStorage, default to 'navigate' (unchecked)
    const savedViewMode = localStorage.getItem('viewMode') as 'navigate' | 'overview' | null;
    const initialViewMode = savedViewMode || 'navigate';

    // Set checkbox to match saved mode (checked = overview, unchecked = navigate)
    viewModeToggle.checked = initialViewMode === 'overview';

    // Handle toggle clicks
    viewModeToggle.addEventListener('change', () => {
      const newMode = viewModeToggle.checked ? 'overview' : 'navigate';
      localStorage.setItem('viewMode', newMode);

      if (currentVisualizer) {
        currentVisualizer.setViewMode(newMode);
      }

      console.log('View mode:', newMode);
    });
  }

  // Set up highlight commit toggle
  const highlightCommitToggle = document.getElementById('highlight-commit-toggle') as HTMLInputElement;
  if (highlightCommitToggle) {
    // Load saved preference from localStorage, default to true if not set
    const savedHighlightCommit = localStorage.getItem('highlightCommit');
    highlightCommitEnabled = savedHighlightCommit !== null ? savedHighlightCommit === 'true' : true;

    // Set checkbox to match saved mode
    highlightCommitToggle.checked = highlightCommitEnabled;

    // Handle toggle clicks
    highlightCommitToggle.addEventListener('change', () => {
      highlightCommitEnabled = highlightCommitToggle.checked;
      localStorage.setItem('highlightCommit', highlightCommitEnabled.toString());

      // Clear any existing commit highlighting when toggled off
      if (!highlightCommitEnabled && currentVisualizer) {
        currentVisualizer.clearHighlight();
        currentHighlightedCommit = null;
      }

      console.log('Highlight commit mode:', highlightCommitEnabled ? 'enabled' : 'disabled');
    });
  }

  // Set up theme toggle
  const themeToggleContainer = document.getElementById('theme-toggle-container');
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');

  if (themeToggleContainer && sunIcon && moonIcon) {
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Set icon based on theme (show what you'll switch TO - sun when dark, moon when light)
    if (savedTheme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }

    // Apply initial theme to current visualizer if it exists
    if (currentVisualizer) {
      currentVisualizer.setTheme(savedTheme as 'light' | 'dark');
    }

    themeToggleContainer.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);

      // Toggle icon visibility
      if (newTheme === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }

      // Update 3D scene colors
      if (currentVisualizer) {
        currentVisualizer.setTheme(newTheme as 'light' | 'dark');
      }
    });
  }

  // Set up hide generated files checkbox
  const hideGeneratedCheckbox = document.getElementById('hide-generated-checkbox') as HTMLInputElement;
  if (hideGeneratedCheckbox) {
    hideGeneratedCheckbox.addEventListener('change', () => {
      applyGeneratedFileFilter();
    });
  }

  // Set up collapsible panels (one-time setup)
  const statsPanel = document.getElementById('stats-panel');
  const statsHeader = document.querySelector('#stats-panel h3');
  if (statsHeader && statsPanel) {
    statsHeader.addEventListener('click', () => {
      statsPanel.classList.toggle('collapsed');
    });
  }

  const legendHeader = document.querySelector('#legend h3');
  const legend = document.getElementById('legend');
  if (legendHeader && legend) {
    legendHeader.addEventListener('click', () => {
      legend.classList.toggle('collapsed');
    });
  }

  // Set up info panel collapse
  const infoPanelHeader = document.querySelector('#info-panel h3');
  const infoPanel = document.getElementById('info-panel');
  if (infoPanelHeader && infoPanel) {
    infoPanelHeader.addEventListener('click', () => {
      infoPanel.classList.toggle('collapsed');
    });
  }

  // Set up header section collapse
  const setupSectionCollapse = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    const sectionTitle = section?.querySelector('.section-title.collapsible');
    if (sectionTitle && section) {
      sectionTitle.addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });
    }
  };

  setupSectionCollapse('visualization-section');
  setupSectionCollapse('display-options-section');

  // Set up filter control buttons
  const filterTopBtn = document.getElementById('filter-top-btn');
  const filterAllBtn = document.getElementById('filter-all-btn');
  const filterNoneBtn = document.getElementById('filter-none-btn');
  const filterInvertBtn = document.getElementById('filter-invert-btn');

  if (filterTopBtn) {
    filterTopBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
      // Uncheck all
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      // Check only the first one (top category)
      if (checkboxes.length > 0) {
        checkboxes[0].checked = true;
      }
      applyLegendFilters(); // This will update button states
    });
  }

  if (filterAllBtn) {
    filterAllBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
      });
      applyLegendFilters(); // This will update button states
    });
  }

  if (filterNoneBtn) {
    filterNoneBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      applyLegendFilters(); // This will update button states
    });
  }

  if (filterInvertBtn) {
    filterInvertBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(checkbox => {
        checkbox.checked = !checkbox.checked;
      });
      applyLegendFilters(); // This will update button states
    });
  }
}

/**
 * Show filter controls (for modes that support filtering)
 */
function showFilterControls() {
  const filterControls = document.getElementById('filter-controls');
  if (filterControls) {
    filterControls.style.display = 'flex';
  }
}

/**
 * Hide filter controls (for modes that don't support filtering or in timeline mode)
 */
function hideFilterControls() {
  const filterControls = document.getElementById('filter-controls');
  const filterStatus = document.getElementById('filter-status');
  if (filterControls) {
    filterControls.style.display = 'none';
  }
  if (filterStatus) {
    filterStatus.textContent = '';
  }
}

/**
 * Disable filtering (when entering timeline mode)
 * Disables checkboxes and shows explanatory message
 */
function disableFiltering() {
  const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
  const filterControls = document.getElementById('filter-controls');
  const filterStatus = document.getElementById('filter-status');

  // Hide all checkboxes
  checkboxes.forEach(checkbox => {
    checkbox.style.display = 'none';
    checkbox.checked = true; // Reset to all checked
  });

  // Hide filter controls
  if (filterControls) {
    filterControls.style.display = 'none';
  }

  // Clear status message
  if (filterStatus) {
    filterStatus.textContent = '';
  }

  // Clear any active filters
  if (currentVisualizer) {
    currentVisualizer.clearFilter();
  }
}

/**
 * Enable filtering (when returning to HEAD mode)
 * Re-enables checkboxes and filter controls
 */
function enableFiltering() {
  const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
  const filterControls = document.getElementById('filter-controls');

  // Show all checkboxes
  checkboxes.forEach(checkbox => {
    checkbox.style.display = '';
    checkbox.disabled = false;
  });

  // Show filter controls
  if (filterControls) {
    filterControls.style.display = '';
    const buttons = filterControls.querySelectorAll('button');
    buttons.forEach(button => {
      (button as HTMLButtonElement).disabled = false;
    });
  }

  // Update status message (will be updated by applyLegendFilters if needed)
  updateFilterStatus();
}

/**
 * Update filter status message
 */
function updateFilterStatus() {
  const filterStatus = document.getElementById('filter-status');
  if (!filterStatus || !currentVisualizer) return;

  // Get checkbox counts
  const checkboxes = document.querySelectorAll('.legend-checkbox');
  const totalCategories = checkboxes.length;
  const activeCategories = currentVisualizer.getActiveFilterCategories();
  const activeCount = activeCategories.length;

  // If no filters OR all categories selected, no effective filtering happening
  if (!currentVisualizer.hasActiveFilters() || activeCount === totalCategories) {
    filterStatus.textContent = '';
  } else {
    // Show selected/total for clarity
    const categoryWord = activeCount === 1 ? 'category' : 'categories';
    filterStatus.textContent = `Filtering: ${activeCount} / ${totalCategories} ${categoryWord}`;
  }
}

/**
 * Update filter control button states based on current selection
 */
function updateFilterControlStates() {
  const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
  const topBtn = document.getElementById('filter-top-btn') as HTMLButtonElement;
  const allBtn = document.getElementById('filter-all-btn') as HTMLButtonElement;
  const noneBtn = document.getElementById('filter-none-btn') as HTMLButtonElement;
  const invertBtn = document.getElementById('filter-invert-btn') as HTMLButtonElement;

  if (!checkboxes.length || !topBtn || !allBtn || !noneBtn || !invertBtn) return;

  // Count checked/unchecked
  let checkedCount = 0;
  let uncheckedCount = 0;

  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkedCount++;
    } else {
      uncheckedCount++;
    }
  });

  const totalCount = checkboxes.length;

  // Check if only the first checkbox is checked
  const onlyFirstChecked = checkedCount === 1 && checkboxes.length > 0 && checkboxes[0].checked;

  // Hide "Top" when only the first checkbox is already checked
  if (onlyFirstChecked) {
    topBtn.style.display = 'none';
  } else {
    topBtn.style.display = '';
  }

  // Hide "All" when all are already checked
  if (checkedCount === totalCount) {
    allBtn.style.display = 'none';
  } else {
    allBtn.style.display = '';
  }

  // Hide "None" when none are checked
  if (checkedCount === 0) {
    noneBtn.style.display = 'none';
  } else {
    noneBtn.style.display = '';
  }

  // "Invert" is always visible (unless there are no checkboxes)
  if (totalCount === 0) {
    invertBtn.style.display = 'none';
  } else {
    invertBtn.style.display = '';
  }
}

/**
 * Apply current legend checkbox state to visualizer
 */
function applyLegendFilters() {
  if (!currentVisualizer || !currentSnapshot) return;

  // Get all checked checkboxes
  const checkboxes = document.querySelectorAll('.legend-checkbox') as NodeListOf<HTMLInputElement>;
  const checkedCategories: string[] = [];

  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      const category = checkbox.dataset.category;
      if (category) {
        checkedCategories.push(category);
      }
    }
  });

  // Apply filter (empty array = show all)
  if (checkedCategories.length === 0) {
    currentVisualizer.clearFilter();
  } else {
    currentVisualizer.setFilter(checkedCategories);
  }

  // Update visual state
  checkboxes.forEach(checkbox => {
    const legendItem = checkbox.closest('.legend-item');
    if (legendItem) {
      if (checkbox.checked) {
        legendItem.classList.remove('unchecked');
      } else {
        legendItem.classList.add('unchecked');
      }
    }
  });

  updateFilterStatus();

  // Update stats panel to reflect filtered counts
  updateStatsDisplay(currentSnapshot);

  // Update button states
  updateFilterControlStates();
}

/**
 * Update legend based on color mode
 */
function updateLegendForColorMode(mode: ColorMode) {
  const legendContent = document.getElementById('legend-content');
  const legendTitle = document.getElementById('legend-title');
  if (!legendContent) return;

  // Update legend title to match color mode
  if (legendTitle) {
    let modeTitle = getColorModeName(mode);
    if (mode === 'lastModified' && isUsingPercentileIntervals()) {
      modeTitle = 'Last Modified (Relative)';
    }
    legendTitle.textContent = modeTitle;
  }

  legendContent.innerHTML = '';

  const items = getLegendItems(mode);

  if (items.length > 0 && mode === 'lastModified' && currentSnapshot) {
    // Calculate file counts for each interval
    const intervalCounts = new Map<string, number>();
    const collectIntervalCounts = (node: TreeNode) => {
      if (node.type === 'file' && node.lastModified) {
        const colorInfo = getColorForFile(node, 'lastModified');
        intervalCounts.set(colorInfo.name, (intervalCounts.get(colorInfo.name) || 0) + 1);
      } else if (node.type === 'directory') {
        for (const child of node.children) {
          collectIntervalCounts(child);
        }
      }
    };
    collectIntervalCounts(currentSnapshot.tree);

    const totalFiles = currentSnapshot.stats.totalFiles;

    // Show intervals with counts and percentages (with checkboxes)
    for (const item of items) {
      const count = intervalCounts.get(item.name) || 0;
      const percentage = ((count / totalFiles) * 100).toFixed(1);
      const fileLabel = count === 1 ? 'file' : 'files';

      const html = buildIntervalLegendItemHTML({ ...item, count, percentage }, fileLabel);
      const legendItem = createLegendItem(html, applyLegendFilters, 'label');
      legendContent.appendChild(legendItem);
    }
    showFilterControls();
    updateFilterControlStates();
  } else if (items.length > 0) {
    // Show color mode specific legend without counts (with checkboxes for supported modes)
    for (const item of items) {
      const html = buildGenericLegendItemHTML(item);
      const legendItem = createLegendItem(html, applyLegendFilters, 'label');
      legendContent.appendChild(legendItem);
    }
    showFilterControls();
    updateFilterControlStates();
  } else if (mode === 'author' && currentSnapshot) {
    // For author mode, collect authors with file counts
    const authorCounts = new Map<string, number>();
    const collectAuthors = (node: TreeNode) => {
      if (node.type === 'file' && node.lastAuthor) {
        authorCounts.set(node.lastAuthor, (authorCounts.get(node.lastAuthor) || 0) + 1);
      } else if (node.type === 'directory') {
        for (const child of node.children) {
          collectAuthors(child);
        }
      }
    };
    collectAuthors(currentSnapshot.tree);

    // Sort by file count (descending), then show top 20
    const sortedAuthors = Array.from(authorCounts.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by count descending

    // Assign colors based on contributor rank (most active get most distinct colors)
    const authorNames = sortedAuthors.map(([author]) => author);
    assignAuthorColors(authorNames);

    const displayAuthors = sortedAuthors.slice(0, 20);

    const totalFiles = currentSnapshot.stats.totalFiles;

    for (const [author, count] of displayAuthors) {
      const percentage = ((count / totalFiles) * 100).toFixed(1);
      const colorInfo = getColorForFile({ lastAuthor: author } as FileNode, 'author');
      const fileLabel = count === 1 ? 'file' : 'files';

      const html = buildAuthorLegendItemHTML(author, colorInfo.hex, count, percentage, fileLabel);
      const legendItem = createLegendItem(html, applyLegendFilters, 'label');
      legendContent.appendChild(legendItem);
    }

    if (sortedAuthors.length > 20) {
      // Calculate coverage of top 20
      const top20FileCount = displayAuthors.reduce((sum, [, count]) => sum + count, 0);
      const coveragePercent = ((top20FileCount / totalFiles) * 100).toFixed(1);

      const html = buildOverflowMessageHTML(sortedAuthors.length - 20, coveragePercent);
      const legendItem = createLegendItem(html, applyLegendFilters, 'div');
      legendContent.appendChild(legendItem);
    }
    showFilterControls();
    updateFilterControlStates();
  }
  // Note: For fileType mode, legend is populated by populateLegend() which shows actual files present
}

/**
 * Timeline playback functions (V1 format - deprecated)
 */
function updateTimelineV1UI() {
  if (!currentTimelineData) return;

  const commits = currentTimelineData.timeline.baseSampling.commits;
  const commit = commits[timelineIndex];

  // Update progress bar
  const progress = ((timelineIndex + 1) / commits.length) * 100;
  const progressBar = document.getElementById('timeline-progress');
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  // Update commit counter
  const commitIndexEl = document.getElementById('timeline-commit-index');
  const commitTotalEl = document.getElementById('timeline-commit-total');

  if (commitIndexEl) commitIndexEl.textContent = (timelineIndex + 1).toString();
  if (commitTotalEl) commitTotalEl.textContent = commits.length.toString();

  // Update commit info in timeline (below the scrubber)
  const commitInfo = document.getElementById('commit-info');
  if (commitInfo && currentSnapshot) {
    const date = new Date(commit.date).toLocaleDateString();
    commitInfo.textContent = `${commit.hash.substring(0, 7)} • ${date} • ${currentSnapshot.stats.totalFiles} files • ${currentSnapshot.stats.totalLoc.toLocaleString()} LOC`;
  }

  console.log(`Timeline: commit ${timelineIndex + 1}/${commits.length} - ${commit.hash.substring(0, 7)}`);

  // Highlight changed files in this commit
  highlightTimelineCommitFiles(commit);
}

function highlightTimelineCommitFiles(commit: any, commitIndex?: number) {
  if (!currentVisualizer) return;

  // Timeline (full delta) vs V1 (sampled) have different highlighting semantics
  const isTimelineV2 = currentDeltaController !== null;

  // Calculate changes
  const filesAdded = commit.changes.filesAdded.length;
  const filesModified = commit.changes.filesModified.length;
  const filesDeleted = commit.changes.filesDeleted?.length || 0;

  if (isTimelineV2) {
    // TIMELINE V2: Show historical tree, highlight additions/modifications/deletions
    // Note: Deletions are rendered as ghosts separately, not included in changedFiles count
    const nonGhostChanges = filesAdded + filesModified;
    const totalChanges = filesAdded + filesModified + filesDeleted;

    // Collect files to highlight separately by type (additions vs modifications vs deletions)
    const addedFiles: FileNode[] = [];
    const modifiedFiles: FileNode[] = [];

    for (const path of commit.changes.filesAdded) {
      const fileNode = pathToFileIndex.get(path);
      if (fileNode) {
        addedFiles.push(fileNode);
      }
    }

    for (const path of commit.changes.filesModified) {
      const fileNode = pathToFileIndex.get(path);
      if (fileNode) {
        modifiedFiles.push(fileNode);
      }
    }

    // For deleted files, they've been rendered as ghosts by renderDeletedFiles()
    // The ghost rendering adds them to fileObjects map with full metadata
    // So we just need to pass the paths for highlighting - the visualization will find them

    const changedFiles = [...addedFiles, ...modifiedFiles];
    const deletedPaths = commit.changes.filesDeleted || [];

    if (totalChanges === 0) {
      // No changes at all - empty commit
      currentVisualizer.clearHighlight();
      hideTimelineWarning();
    } else if (changedFiles.length === 0 && deletedPaths.length === 0) {
      // Should have found additions/modifications/deletions but didn't - unexpected!
      currentVisualizer.clearHighlight();
      showTimelineWarning(`⚠️ Cannot highlight ${totalChanges} change(s)`);
      console.warn(`Timeline: Failed to find ${totalChanges} file changes`);
    } else if (changedFiles.length < nonGhostChanges) {
      // Found some but not all additions/modifications - partial highlighting
      const addedPaths = addedFiles.map(f => f.path);
      const modifiedPaths = modifiedFiles.map(f => f.path);
      currentVisualizer.highlightFilesByType(addedPaths, modifiedPaths, deletedPaths, []);

      // Some additions/modifications are missing (actual problem)
      showTimelineWarning(`⚠️ Highlighting ${changedFiles.length + deletedPaths.length}/${totalChanges} changes`);
    } else {
      // Found all additions/modifications - success! (deletions are ghosts)
      const addedPaths = addedFiles.map(f => f.path);
      const modifiedPaths = modifiedFiles.map(f => f.path);
      currentVisualizer.highlightFilesByType(addedPaths, modifiedPaths, deletedPaths, []);
      hideTimelineWarning();
    }

  } else {
    // TIMELINE V1: Show HEAD tree, highlight historical files that exist in HEAD
    const totalChanges = filesAdded + filesModified;
    const changedFiles: FileNode[] = [];

    for (const path of [...commit.changes.filesAdded, ...commit.changes.filesModified]) {
      const fileNode = pathToFileIndex.get(path);
      if (fileNode) {
        changedFiles.push(fileNode);
      }
    }

    // V1 warnings help user understand which historical files are missing from HEAD
    if (changedFiles.length === 0) {
      currentVisualizer.clearHighlight();
      showTimelineWarning(`⚠️ Cannot highlight changes - ${totalChanges} file${totalChanges !== 1 ? 's' : ''} not in current view`);
      console.log(`Timeline V1: 0 of ${totalChanges} files found in HEAD`);
    } else if (changedFiles.length < totalChanges) {
      const filePaths = changedFiles.map(f => f.path);
      currentVisualizer.highlightFiles(filePaths);
      const missing = totalChanges - changedFiles.length;
      showTimelineWarning(`⚠️ Highlighting ${changedFiles.length} of ${totalChanges} files (${missing} not in current view)`);
      console.log(`Timeline V1: Partial ${changedFiles.length}/${totalChanges} files in HEAD`);
    } else {
      const filePaths = changedFiles.map(f => f.path);
      currentVisualizer.highlightFiles(filePaths);
      hideTimelineWarning();
      console.log(`Timeline V1: Highlighted all ${changedFiles.length} files`);
    }
  }
}

function showTimelineWarning(message: string) {
  const warning = document.getElementById('timeline-warning');
  const text = document.getElementById('timeline-warning-text');
  if (warning && text) {
    text.textContent = message;
    warning.style.display = 'block';
  }
}

function hideTimelineWarning() {
  const warning = document.getElementById('timeline-warning');
  if (warning) {
    warning.style.display = 'none';
  }
}

function stepForward() {
  if (!currentTimelineData) return;

  const commits = currentTimelineData.timeline.baseSampling.commits;
  if (timelineIndex < commits.length - 1) {
    timelineIndex++;
    updateTimelineV1UI();
  }
}

function stepBackward() {
  if (!currentTimelineData) return;

  if (timelineIndex > 0) {
    timelineIndex--;
    updateTimelineV1UI();
  }
}

function goToStart() {
  if (!currentTimelineData) return;

  timelineIndex = 0;
  updateTimelineV1UI();
}

function togglePlayPause() {
  if (!currentTimelineData) return;

  const playPauseBtn = document.getElementById('play-pause-btn');

  if (timelinePlaying) {
    // Pause
    timelinePlaying = false;
    if (timelineIntervalId !== null) {
      clearInterval(timelineIntervalId);
      timelineIntervalId = null;
    }
    if (playPauseBtn) {
      playPauseBtn.textContent = '▶ Play';
    }
  } else {
    // Play
    timelinePlaying = true;
    if (playPauseBtn) {
      playPauseBtn.textContent = '⏸ Pause';
    }

    const baseInterval = 2000; // 2 seconds per commit at 1x speed
    const interval = baseInterval / timelineSpeed;

    timelineIntervalId = window.setInterval(() => {
      const commits = currentTimelineData!.timeline.baseSampling.commits;
      if (timelineIndex < commits.length - 1) {
        stepForward();
      } else {
        // Reached end, stop playing
        togglePlayPause();
      }
    }, interval);
  }
}

function seekTimeline(percentage: number) {
  if (!currentTimelineData) return;

  const commits = currentTimelineData.timeline.baseSampling.commits;
  const newIndex = Math.floor((percentage / 100) * commits.length);
  timelineIndex = Math.max(0, Math.min(newIndex, commits.length - 1));
  updateTimelineV1UI();
}

function setupTimelineV1Controls() {
  if (!currentTimelineData) return;

  // Initialize UI
  const commitTotalEl = document.getElementById('timeline-commit-total');
  if (commitTotalEl) {
    commitTotalEl.textContent = currentTimelineData.timeline.baseSampling.commits.length.toString();
  }

  // Play/Pause button
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', togglePlayPause);
  }

  // Step buttons
  const goToStartBtn = document.getElementById('go-to-start-btn');
  if (goToStartBtn) {
    goToStartBtn.addEventListener('click', goToStart);
  }

  const stepBackBtn = document.getElementById('step-back-btn');
  if (stepBackBtn) {
    stepBackBtn.addEventListener('click', stepBackward);
  }

  const stepForwardBtn = document.getElementById('step-forward-btn');
  if (stepForwardBtn) {
    stepForwardBtn.addEventListener('click', stepForward);
  }

  // Speed selector
  const speedSelector = document.getElementById('speed-selector') as HTMLSelectElement;
  if (speedSelector) {
    speedSelector.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      timelineSpeed = parseFloat(target.value);

      // If currently playing, restart with new speed
      if (timelinePlaying) {
        togglePlayPause(); // Stop
        togglePlayPause(); // Start with new speed
      }
    });
  }

  // Timeline scrubber - click to seek (Timeline V1 only)
  const scrubber = document.getElementById('timeline-scrubber');
  if (scrubber) {
    scrubber.addEventListener('click', (e) => {
      const rect = scrubber.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      seekTimeline(percentage);
    });
  }

  // Set initial state
  timelineIndex = 0;
  updateTimelineV1UI();
}

// Start the application
main();
