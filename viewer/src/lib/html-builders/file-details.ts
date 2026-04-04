/**
 * Pure HTML builder for file details panel
 * Extracted from main.ts showFileDetails function
 */

import { FileNode } from '../../types';
import { Cluster, CouplingEdge } from '../../coupling-types';
import { getPaceLayerColor } from '../pace-layer-color';

export interface FileDetailsData {
  file: FileNode;
  githubFileUrl: string | null;
  commitInfo: {
    commitHashStr: string; // Short hash (7 chars)
    message: string;
    siblings: FileNode[]; // Other files in same commit (excluding current file)
  } | null;
  clusterInfo: {
    cluster: Cluster;
    topEdges: CouplingEdge[]; // Already sorted and limited to top 5
  } | null;
}

/** Renders a single label/value row in the info panel. */
function row(label: string, value: string): string {
  return `<div class="info-row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

/** Formats first-commit date as a human-readable age string. */
function formatFileAge(firstCommitDate: string | null): string {
  if (!firstCommitDate) return 'Unknown';
  const ageInDays = (Date.now() - new Date(firstCommitDate).getTime()) / (1000 * 60 * 60 * 24);
  const ageInYears = ageInDays / 365;
  if (ageInYears >= 5) return `${Math.floor(ageInYears)} years (Legacy)`;
  if (ageInYears >= 3) return `${Math.floor(ageInYears)} years (Old)`;
  if (ageInYears >= 1) return `${Math.floor(ageInYears)} year${Math.floor(ageInYears) > 1 ? 's' : ''} (Mature)`;
  const ageInMonths = ageInDays / 30;
  if (ageInMonths >= 3) return `${Math.floor(ageInMonths)} months (Recent)`;
  return `${Math.floor(ageInDays)} days (New)`;
}

/** Renders a colored pill badge for a pace layer name. */
function paceLayerBadge(layer: string | null | undefined): string {
  if (!layer) return '<span style="color: #6b7280; font-style: italic;">Unclassified</span>';
  const displayName = layer.charAt(0).toUpperCase() + layer.slice(1);
  const color = getPaceLayerColor(displayName);
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${color};color:#fff;font-size:10px;font-weight:600;">${displayName}</span>`;
}

/**
 * Build HTML for file details panel
 * Pure function - no side effects, no DOM access, no global state
 */
export function buildFileDetailsHTML(data: FileDetailsData): string {
  const { file, githubFileUrl, commitInfo, clusterInfo } = data;

  const lastModifiedStr = file.lastModified
    ? new Date(file.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Unknown';
  const commitHashStr = file.lastCommitHash ? file.lastCommitHash.substring(0, 7) : 'Unknown';
  const churnStr = file.commitCount !== null ? `${file.commitCount} commit${file.commitCount !== 1 ? 's' : ''}` : 'Unknown';
  const velocityStr = file.changeVelocity != null ? `${file.changeVelocity.toFixed(1)} commits/quarter` : 'Unknown';

  let html = `
    ${row('Type', 'File')}
    ${row('Path', file.path)}
    ${githubFileUrl ? row('View on GitHub', `<a href="${githubFileUrl}" target="_blank" style="color:#4a9eff;text-decoration:none;">🔗 Open file</a>`) : ''}
    ${row('Lines of Code', file.loc.toLocaleString())}
    ${row('Extension', `.${file.extension}`)}
    ${row('Pace Layer', paceLayerBadge(file.paceLayer))}
    ${row('Change Velocity', velocityStr)}
    ${row('Last Modified', lastModifiedStr)}
    ${row('Last Author', file.lastAuthor || 'Unknown')}
    ${row('Last Commit', commitHashStr)}
    ${row('Churn (Lifetime)', churnStr)}
    ${row('Contributors (Lifetime)', file.contributorCount !== null ? String(file.contributorCount) : 'Unknown')}
    ${row('File Age', formatFileAge(file.firstCommitDate))}
    ${row('Recent Activity (90 days)', file.recentLinesChanged !== null ? `${file.recentLinesChanged} lines changed` : 'Unknown')}
    ${row('Avg Change Size (Lifetime)', file.avgLinesPerCommit !== null ? `${file.avgLinesPerCommit} lines/commit` : 'Unknown')}
    ${row('Last Touched', file.daysSinceLastModified !== null ? `${file.daysSinceLastModified} days ago` : 'Unknown')}
  `;

  // Commit info section
  if (commitInfo && (commitInfo.message || commitInfo.siblings.length > 0)) {
    html += `<div style="margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);">`;
    if (commitInfo.message) {
      html += `
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;color:#888;margin-bottom:4px;">Commit: <span style="color:#4a9eff;font-family:monospace;">${commitInfo.commitHashStr}</span></div>
          <div style="font-size:12px;color:#ddd;font-style:italic;line-height:1.4;">"${commitInfo.message}"</div>
        </div>`;
    }
    if (commitInfo.siblings.length > 0) {
      html += `<div style="font-size:12px;font-weight:600;color:#4a9eff;margin-bottom:8px;">Commit Siblings (${commitInfo.siblings.length} file${commitInfo.siblings.length !== 1 ? 's' : ''})</div><div style="font-size:11px;">`;
      for (const sibling of commitInfo.siblings) {
        html += `<div style="padding:4px 0;color:#ccc;border-bottom:1px solid rgba(255,255,255,0.05);">${sibling.path}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Coupling analysis section
  if (clusterInfo) {
    const { cluster, topEdges } = clusterInfo;
    html += `
      <div style="margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:12px;font-weight:600;color:#4a9eff;margin-bottom:8px;">📊 Coupling Cluster</div>
        <div style="font-size:11px;color:#ccc;margin-bottom:12px;padding-left:12px;">${cluster.name} (${cluster.fileCount} files)</div>`;
    if (topEdges.length > 0) {
      html += `<div style="font-size:12px;font-weight:600;color:#4a9eff;margin-bottom:8px;">🔗 Most Frequently Changes With</div><div style="font-size:11px;">`;
      for (const edge of topEdges) {
        const otherFile = edge.fileA === file.path ? edge.fileB : edge.fileA;
        const fileName = otherFile.split('/').pop() || otherFile;
        const couplingPercent = Math.round(edge.coupling * 100);
        html += `
          <div style="padding:4px 0;color:#ccc;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#ddd;">${fileName}</span>
              <span style="color:#888;font-size:10px;">${edge.coChangeCount} co-changes</span>
            </div>
            <div style="font-size:10px;color:#888;margin-top:2px;">${couplingPercent}% coupling strength</div>
          </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  return html;
}
