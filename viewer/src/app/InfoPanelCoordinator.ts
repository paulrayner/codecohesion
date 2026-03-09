import { EventBus } from './EventBus';
import { AppState } from './AppState';
import { FileNode, DirectoryNode, TreeNode } from '../types';
import { Cluster, CouplingEdge } from '../coupling-types';
import { buildFileDetailsHTML } from '../lib/html-builders/file-details';
import { buildDirectoryDetailsHTML } from '../lib/html-builders/directory-details';
import { calculateDirectoryStats } from '../lib/tree-stats';
import { getBaseRepoName } from '../lib/repo-utils';
import { getGitHubFileUrl, getGitHubDirUrl } from '../lib/github-links';
import { FILE_COLORS } from '../colorScheme';
import { couplingLoader } from '../couplingLoader';
import { ColorMode } from '../colorModeManager';

/**
 * Coordinates updates to the file/directory details info panel.
 *
 * Reads application state via AppState rather than maintaining its own copies,
 * keeping this class free of stale-state bugs.
 */
export class InfoPanelCoordinator {
  constructor(
    private readonly bus: EventBus,
    private readonly appState: AppState
  ) {
    this.bus.on('node:clicked:file', (e) => this.showFileDetails(e.file, true));
    this.bus.on('node:clicked:dir', (e) => this.showDirectoryDetails(e.dir));
    this.bus.on('node:hovered', (e) => this.handleHover(e.node));
  }

  private handleHover(node: TreeNode | null): void {
    if (!node) return;

    if (node.type === 'file') {
      const currentColorMode = localStorage.getItem('colorMode') as ColorMode | null;
      // Cluster mode handles its own hover display via TreeVisualizer
      if (currentColorMode !== 'cluster') {
        this.showFileDetails(node, false);
      }
    } else if (node.type === 'directory') {
      this.showDirectoryDetails(node);
    }
  }

  /**
   * Show file details in the info panel.
   *
   * When handleCommitHighlighting is true (click), toggles commit sibling
   * highlighting on/off. When false (hover), clears any existing highlight.
   */
  public showFileDetails(file: FileNode, handleCommitHighlighting: boolean = false): void {
    const panel = document.getElementById('info-panel');
    const nameEl = document.getElementById('selected-name');
    const contentEl = document.getElementById('info-content');

    if (!panel || !nameEl || !contentEl) return;

    nameEl.textContent = file.name;

    const baseRepoName = getBaseRepoName(this.appState.repo.currentRepoBaseName);
    const githubFileUrl = getGitHubFileUrl(baseRepoName, file.path);

    let commitInfo: { commitHashStr: string; message: string; siblings: FileNode[] } | null = null;

    if (handleCommitHighlighting && this.appState.selection.highlightCommitEnabled && file.lastCommitHash) {
      // Toggle OFF when clicking the same commit again
      if (this.appState.selection.currentHighlightedCommit === file.lastCommitHash) {
        if (this.appState.visualizer.currentVisualizer) {
          this.appState.visualizer.currentVisualizer.clearHighlight();
        }
        this.appState.selection.currentHighlightedCommit = null;
      } else {
        // New commit or first click — show highlighting
        const commitSiblings = this.appState.selection.commitToFilesIndex.get(file.lastCommitHash) ?? [];
        const otherFiles = commitSiblings.filter((f) => f.path !== file.path);

        const commitMessage = this.appState.visualizer.currentSnapshot?.commitMessages?.[file.lastCommitHash];
        const commitHashStr = file.lastCommitHash.substring(0, 7);

        if (commitMessage || otherFiles.length > 0) {
          commitInfo = {
            commitHashStr,
            message: commitMessage ?? '',
            siblings: otherFiles,
          };
        }

        if (this.appState.visualizer.currentVisualizer) {
          const allCommitFiles = commitSiblings.map((f) => f.path);
          this.appState.visualizer.currentVisualizer.highlightFiles(allCommitFiles);
        }
        this.appState.selection.currentHighlightedCommit = file.lastCommitHash;
      }
    } else {
      // Hover path or highlighting disabled — clear any active highlight
      if (this.appState.visualizer.currentVisualizer) {
        this.appState.visualizer.currentVisualizer.clearHighlight();
      }
      this.appState.selection.currentHighlightedCommit = null;
    }

    let clusterInfo: { cluster: Cluster; topEdges: CouplingEdge[] } | null = null;

    if (couplingLoader.isLoaded()) {
      const currentColorMode = localStorage.getItem('colorMode') as ColorMode | null;

      if (currentColorMode === 'cluster') {
        const clusterId = couplingLoader.getClusterForFile(file.path);

        if (clusterId !== null) {
          const clusters = couplingLoader.getClusters();
          const cluster = clusters.find((c) => c.id === clusterId);

          if (cluster) {
            const allEdges = couplingLoader.getEdges(0.1);
            const fileEdges = allEdges
              .filter((edge) => edge.fileA === file.path || edge.fileB === file.path)
              .sort((a, b) => b.coupling - a.coupling)
              .slice(0, 5);

            clusterInfo = { cluster, topEdges: fileEdges };
          }
        }
      }
    }

    // buildFileDetailsHTML is a pure function over typed snapshot data — not user input
    contentEl.innerHTML = buildFileDetailsHTML({ file, githubFileUrl, commitInfo, clusterInfo });
    panel.classList.add('visible');

    // Flash the panel header on click to provide visual feedback
    if (handleCommitHighlighting && nameEl) {
      nameEl.style.transition = 'background-color 0.3s';
      nameEl.style.backgroundColor = 'rgba(74, 158, 255, 0.3)';
      setTimeout(() => {
        nameEl.style.backgroundColor = '';
      }, 300);
    }
  }

  /**
   * Show directory details in the info panel.
   */
  public showDirectoryDetails(dir: DirectoryNode): void {
    const panel = document.getElementById('info-panel');
    const nameEl = document.getElementById('selected-name');
    const contentEl = document.getElementById('info-content');

    if (!panel || !nameEl || !contentEl) return;

    nameEl.textContent = dir.name;

    const fileCount = dir.children.filter((c) => c.type === 'file').length;
    const dirCount = dir.children.filter((c) => c.type === 'directory').length;
    const dirStats = calculateDirectoryStats(dir);

    // Determine the dominant file type by extension count
    let dominantExt = 'none';
    let maxCount = 0;
    for (const [ext, count] of Object.entries(dirStats.filesByExt)) {
      if (count > maxCount) {
        maxCount = count;
        dominantExt = ext;
      }
    }

    const dominantName = FILE_COLORS[dominantExt]?.name ?? dominantExt;

    // Find the most recently modified file anywhere in the subtree
    let mostRecentDate: string | null = null;
    let mostRecentAuthor: string | null = null;

    const findMostRecent = (node: TreeNode): void => {
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
          day: 'numeric',
        })
      : 'Unknown';

    const authorStr = mostRecentAuthor ?? 'Unknown';
    const baseRepoName = getBaseRepoName(this.appState.repo.currentRepoBaseName);
    const githubDirUrl = getGitHubDirUrl(baseRepoName, dir.path);

    // buildDirectoryDetailsHTML is a pure function over typed snapshot data — not user input
    contentEl.innerHTML = buildDirectoryDetailsHTML({
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

    panel.classList.add('visible');
  }
}
