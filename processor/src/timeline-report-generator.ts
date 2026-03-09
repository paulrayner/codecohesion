import * as path from 'path';
import { ScoredCommit, SamplingScenario, RepositoryStats } from './timeline-sampler-types';

/**
 * Generate an HTML report for timeline commit sampling analysis.
 *
 * @param repoPath - Absolute path to the repository (used for repo name in title)
 * @param scored - All scored commits
 * @param scenarios - Generated sampling scenarios
 * @param stats - Repository statistics
 * @returns HTML string for the report
 */
export function generateReport(
  repoPath: string,
  scored: ScoredCommit[],
  scenarios: SamplingScenario[],
  stats: RepositoryStats
): string {
  console.log('Generating HTML report...');

  const repoName = path.basename(repoPath);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timeline Analysis V2: ${repoName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #2c3e50; margin-bottom: 10px; }
    h2 { color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 40px; }
    h3 { color: #7f8c8d; }

    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
    .stat-box { background: #ecf0f1; padding: 15px; border-radius: 6px; }
    .stat-box strong { display: block; font-size: 24px; color: #2c3e50; margin-top: 5px; }

    .scenario { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

    .timeline-viz {
      position: relative;
      height: 60px;
      background: #ecf0f1;
      border-radius: 4px;
      margin: 20px 0;
      overflow: hidden;
    }
    .timeline-dot {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #3498db;
      border-radius: 50%;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      transition: all 0.2s;
    }
    .timeline-dot:hover {
      width: 12px;
      height: 12px;
      background: #2980b9;
    }
    .timeline-dot.milestone {
      background: #e74c3c;
      width: 10px;
      height: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      background: white;
      font-size: 13px;
    }
    th {
      background: #34495e;
      color: white;
      padding: 12px 8px;
      text-align: left;
      position: sticky;
      top: 0;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #ecf0f1;
    }
    tr:hover {
      background: #f8f9fa;
    }

    .score {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      color: white;
    }
    .score.high { background: #e74c3c; }
    .score.medium { background: #f39c12; }
    .score.low { background: #95a5a6; }

    .tag {
      display: inline-block;
      background: #3498db;
      color: white;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      margin-right: 4px;
    }

    .breakdown {
      font-size: 11px;
      color: #7f8c8d;
      line-height: 1.4;
    }
    .breakdown-item {
      display: inline-block;
      margin-right: 10px;
      white-space: nowrap;
    }

    .commit-msg {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .validation {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .validation.good {
      background: #d4edda;
      border-color: #28a745;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Timeline Sampling Analysis <span style="color: #27ae60; font-size: 0.6em;">V2: Adaptive Algorithm</span></h1>
    <h2>${repoName}</h2>
    <div style="background: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 15px 0; border-radius: 4px;">
      <strong>🎯 Algorithm Improvements (V2):</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li><strong>Adaptive Thresholds:</strong> Percentile-based scoring (p75, p90, p95, p99) adapts to repo patterns</li>
        <li><strong>Version Tags Boosted:</strong> Tags now score 100 points (was 40) to guarantee capture</li>
        <li><strong>Merge Commit Detection:</strong> PR/branch merges score +30 points</li>
        <li><strong>First/Last Commits:</strong> Boosted to 100 points (was 50)</li>
      </ul>
      <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
        📝 Compare to V1 (fixed thresholds): <code>timeline-report-v1-fixed-thresholds.html</code>
      </div>
    </div>
    <div class="stats">
      <div class="stat-box">
        <div>Total Commits</div>
        <strong>${stats.totalCommits.toLocaleString()}</strong>
      </div>
      <div class="stat-box">
        <div>Date Range</div>
        <strong>${stats.dateRange.start.toLocaleDateString()} - ${stats.dateRange.end.toLocaleDateString()}</strong>
      </div>
      <div class="stat-box">
        <div>Contributors</div>
        <strong>${stats.contributors}</strong>
      </div>
      <div class="stat-box">
        <div>Version Tags</div>
        <strong>${stats.tags}</strong>
      </div>
    </div>
  </div>
`;

  // Generate each scenario
  for (const scenario of scenarios) {
    html += generateScenarioHTML(scenario, stats, scored);
  }

  html += `
  <div class="scenario">
    <h2>🎯 Scoring Algorithm V2 (Adaptive)</h2>
    <p>Commits are scored based on multiple factors with <strong>adaptive, percentile-based thresholds</strong>:</p>
    <ul>
      <li><strong>Critical Milestones:</strong> First commit (+100), Last commit (+100), Version tags (+100) 🆕</li>
      <li><strong>Adaptive Files Changed:</strong> p99 (+50), p95 (+35), p90 (+20), p75 (+10) 🆕</li>
      <li><strong>Adaptive Lines Changed:</strong> p99 (+40), p95 (+25), p90 (+15), p75 (+8) 🆕</li>
      <li><strong>Directories:</strong> Adaptive based on file change percentiles 🆕</li>
      <li><strong>Merge Commits:</strong> PR/branch merges (+30) 🆕</li>
      <li><strong>Refactoring:</strong> File renames (+20)</li>
      <li><strong>Time Gaps:</strong> 180+ days (+50), 90+ days (+30), 30+ days (+15)</li>
      <li><strong>Keywords:</strong> Refactor (+15), Version number (+20), Breaking/Major (+25), Initial (+20)</li>
    </ul>
    <p><strong>Selection Strategy:</strong> Hybrid approach combining temporal buckets (ensuring even coverage) with global importance ranking.</p>
    <p><strong>Key Improvement:</strong> Thresholds adapt to each repository's patterns. Works equally well for repos with tiny frequent commits (React) or larger infrequent commits (Gource).</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Generate HTML for a single sampling scenario.
 */
function generateScenarioHTML(
  scenario: SamplingScenario,
  stats: RepositoryStats,
  allScored: ScoredCommit[]
): string {
  const firstTimestamp = stats.dateRange.start.getTime();
  const lastTimestamp = stats.dateRange.end.getTime();
  const totalDuration = lastTimestamp - firstTimestamp;

  // Generate timeline visualization
  let timelineHTML = '<div class="timeline-viz">';
  for (const commit of scenario.commits) {
    const position = ((commit.timestamp - firstTimestamp) / totalDuration) * 100;
    const isMilestone = commit.tags.length > 0 || commit.isFirstCommit || commit.isLastCommit;
    const className = isMilestone ? 'timeline-dot milestone' : 'timeline-dot';
    timelineHTML += `<div class="${className}" style="left: ${position}%" title="${commit.shortHash}: ${commit.message}"></div>`;
  }
  timelineHTML += '</div>';

  // Calculate validation metrics
  const maxGapDays = calculateMaxGap(scenario.commits);
  const allTags = allScored.filter(c => c.tags.length > 0);
  const selectedTags = scenario.commits.filter(c => c.tags.length > 0);
  const tagsCovered = selectedTags.length;
  const tagsTotal = allTags.length;

  const validationGood = maxGapDays < 90 && tagsCovered === tagsTotal;

  let html = `
  <div class="scenario">
    <h2>${scenario.name} (${scenario.commits.length} commits)</h2>

    <div class="validation ${validationGood ? 'good' : ''}">
      <strong>Validation:</strong><br>
      ${maxGapDays < 90 ? '✅' : '⚠️'} Maximum time gap: ${Math.round(maxGapDays)} days ${maxGapDays > 90 ? '(Warning: >90 days)' : ''}<br>
      ${tagsCovered === tagsTotal ? '✅' : '⚠️'} Version tags covered: ${tagsCovered}/${tagsTotal}
    </div>

    ${timelineHTML}

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Hash</th>
          <th>Score</th>
          <th>Files</th>
          <th>Lines ±</th>
          <th>Tags</th>
          <th>Message</th>
          <th>Score Breakdown</th>
        </tr>
      </thead>
      <tbody>
`;

  for (const commit of scenario.commits) {
    const scoreClass = commit.importanceScore >= 100 ? 'high' : commit.importanceScore >= 50 ? 'medium' : 'low';
    const tagsHTML = commit.tags.map(t => `<span class="tag">${t}</span>`).join('');
    const breakdownHTML = commit.scoreBreakdown
      .map(b => `<span class="breakdown-item">${b.reason} (+${b.points})</span>`)
      .join('');

    html += `
        <tr>
          <td>${commit.date.toLocaleDateString()}</td>
          <td><code>${commit.shortHash}</code></td>
          <td><span class="score ${scoreClass}">${commit.importanceScore}</span></td>
          <td>${commit.totalFilesChanged}</td>
          <td>+${commit.linesAdded} -${commit.linesDeleted}</td>
          <td>${tagsHTML}</td>
          <td><div class="commit-msg">${commit.message}</div></td>
          <td><div class="breakdown">${breakdownHTML}</div></td>
        </tr>
`;
  }

  html += `
      </tbody>
    </table>
  </div>
`;

  return html;
}

/**
 * Calculate the maximum time gap (in days) between consecutive selected commits.
 */
function calculateMaxGap(commits: ScoredCommit[]): number {
  if (commits.length < 2) return 0;

  let maxGap = 0;
  for (let i = 1; i < commits.length; i++) {
    const gap = (commits[i].timestamp - commits[i - 1].timestamp) / (1000 * 60 * 60 * 24);
    maxGap = Math.max(maxGap, gap);
  }
  return maxGap;
}
