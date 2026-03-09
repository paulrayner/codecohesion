#!/usr/bin/env node

/**
 * Prototype: Timeline Commit Sampling with Importance Scoring
 *
 * This script analyzes a git repository's full history and scores commits
 * by importance to enable intelligent sampling for timeline animations.
 *
 * Output: HTML report showing which commits would be selected at different
 * sampling densities (50, 100, 200, 500 commits).
 */

import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit, DefaultLogFields, LogResult } from 'simple-git';
import {
  CommitAnalysis,
  ScoredCommit,
  SamplingScenario,
  RepositoryStats,
  AdaptiveThresholds,
} from './timeline-sampler-types';
import { generateReport } from './timeline-report-generator';

class TimelineSampler {
  private git: SimpleGit;
  private repoPath: string;
  private commits: CommitAnalysis[] = [];
  private tags: Map<string, string[]> = new Map(); // hash -> tag names

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath);
    this.git = simpleGit(this.repoPath);
  }

  /**
   * Load full commit history with stats
   */
  async loadHistory(): Promise<void> {
    console.log(`Loading commit history from: ${this.repoPath}`);

    // Get all tags first
    await this.loadTags();

    // Get all commits
    const log: LogResult<DefaultLogFields> = await this.git.log(['--all']);

    console.log(`Found ${log.all.length} commits`);

    // Process each commit
    for (let i = 0; i < log.all.length; i++) {
      const commit = log.all[i];

      // Get detailed stats for this commit
      const stats = await this.getCommitStats(commit.hash);

      // Check if it's a merge commit (has multiple parents)
      const isMergeCommit = /^Merge (pull request|branch)/i.test(commit.message) ||
                            (commit.message.toLowerCase().includes('merge') && stats.filesAdded + stats.filesDeleted + stats.filesModified > 3);

      this.commits.push({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 7),
        date: new Date(commit.date),
        timestamp: new Date(commit.date).getTime(),
        author: commit.author_name,
        message: commit.message,

        filesAdded: stats.filesAdded,
        filesDeleted: stats.filesDeleted,
        filesModified: stats.filesModified,
        totalFilesChanged: stats.filesAdded + stats.filesDeleted + stats.filesModified,

        linesAdded: stats.linesAdded,
        linesDeleted: stats.linesDeleted,
        totalLinesChanged: stats.linesAdded + stats.linesDeleted,

        directoriesChanged: stats.directoriesChanged,
        hasFileRenames: stats.hasRenames,
        isMergeCommit,

        isFirstCommit: i === log.all.length - 1, // Git log is reverse chronological
        isLastCommit: i === 0,
        tags: this.tags.get(commit.hash) || [],

        daysSincePrevious: 0, // Will calculate after sorting

        importanceScore: 0,
        scoreBreakdown: []
      });

      // Progress indicator
      if ((i + 1) % 100 === 0) {
        console.log(`  Processed ${i + 1}/${log.all.length} commits...`);
      }
    }

    // Sort by date (oldest first)
    this.commits.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate time gaps
    for (let i = 1; i < this.commits.length; i++) {
      const daysDiff = (this.commits[i].timestamp - this.commits[i - 1].timestamp) / (1000 * 60 * 60 * 24);
      this.commits[i].daysSincePrevious = daysDiff;
    }

    console.log(`History loaded: ${this.commits.length} commits`);
  }

  /**
   * Load all tags and map them to commit hashes
   */
  private async loadTags(): Promise<void> {
    const tagList = await this.git.tags();

    for (const tag of tagList.all) {
      try {
        const show = await this.git.show([tag, '--format=%H', '--no-patch']);
        const hash = show.trim().split('\n')[0];

        if (!this.tags.has(hash)) {
          this.tags.set(hash, []);
        }
        this.tags.get(hash)!.push(tag);
      } catch (error) {
        // Ignore tags that can't be resolved
      }
    }

    console.log(`Loaded ${tagList.all.length} tags`);
  }

  /**
   * Get detailed stats for a single commit
   */
  private async getCommitStats(hash: string): Promise<{
    filesAdded: number;
    filesDeleted: number;
    filesModified: number;
    linesAdded: number;
    linesDeleted: number;
    directoriesChanged: number;
    hasRenames: boolean;
  }> {
    try {
      // Parse numstat for detailed stats
      const numstat = await this.git.raw(['diff', '--numstat', `${hash}^`, hash]);

      let filesAdded = 0;
      let filesDeleted = 0;
      let filesModified = 0;
      let linesAdded = 0;
      let linesDeleted = 0;
      const directories = new Set<string>();
      let hasRenames = false;

      // Parse numstat output
      const lines = numstat.trim().split('\n');
      for (const line of lines) {
        if (!line) continue;

        const parts = line.split('\t');
        if (parts.length < 3) continue;

        const added = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
        const deleted = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
        const filePath = parts[2];

        // Check for renames
        if (filePath.includes('=>')) {
          hasRenames = true;
        }

        // Track directory
        const dir = path.dirname(filePath);
        if (dir !== '.') {
          directories.add(dir);
        }

        // Categorize file change
        if (added > 0 && deleted === 0) {
          filesAdded++;
        } else if (added === 0 && deleted > 0) {
          filesDeleted++;
        } else if (added > 0 && deleted > 0) {
          filesModified++;
        }

        linesAdded += added;
        linesDeleted += deleted;
      }

      return {
        filesAdded,
        filesDeleted,
        filesModified,
        linesAdded,
        linesDeleted,
        directoriesChanged: directories.size,
        hasRenames
      };
    } catch (error) {
      // First commit or error - return zeros
      return {
        filesAdded: 0,
        filesDeleted: 0,
        filesModified: 0,
        linesAdded: 0,
        linesDeleted: 0,
        directoriesChanged: 0,
        hasRenames: false
      };
    }
  }

  /**
   * Calculate adaptive thresholds based on repository-specific percentiles
   */
  private calculateAdaptiveThresholds(): AdaptiveThresholds {
    console.log('Calculating adaptive thresholds...');

    // Extract all values
    const filesChangedValues = this.commits.map(c => c.totalFilesChanged).sort((a, b) => a - b);
    const linesChangedValues = this.commits.map(c => c.totalLinesChanged).sort((a, b) => a - b);

    const percentile = (arr: number[], p: number): number => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    const thresholds: AdaptiveThresholds = {
      filesChanged: {
        p50: percentile(filesChangedValues, 50),
        p75: percentile(filesChangedValues, 75),
        p90: percentile(filesChangedValues, 90),
        p95: percentile(filesChangedValues, 95),
        p99: percentile(filesChangedValues, 99)
      },
      linesChanged: {
        p50: percentile(linesChangedValues, 50),
        p75: percentile(linesChangedValues, 75),
        p90: percentile(linesChangedValues, 90),
        p95: percentile(linesChangedValues, 95),
        p99: percentile(linesChangedValues, 99)
      }
    };

    console.log('Adaptive thresholds:');
    console.log(`  Files changed - p50: ${thresholds.filesChanged.p50}, p75: ${thresholds.filesChanged.p75}, p90: ${thresholds.filesChanged.p90}, p95: ${thresholds.filesChanged.p95}, p99: ${thresholds.filesChanged.p99}`);
    console.log(`  Lines changed - p50: ${thresholds.linesChanged.p50}, p75: ${thresholds.linesChanged.p75}, p90: ${thresholds.linesChanged.p90}, p95: ${thresholds.linesChanged.p95}, p99: ${thresholds.linesChanged.p99}`);

    return thresholds;
  }

  /**
   * Score commits by importance (V2: Adaptive Algorithm)
   */
  scoreCommits(): ScoredCommit[] {
    console.log('Scoring commits by importance (V2: Adaptive)...');

    // Calculate adaptive thresholds
    const thresholds = this.calculateAdaptiveThresholds();

    const scored: ScoredCommit[] = this.commits.map(commit => {
      const breakdown: Array<{ reason: string; points: number }> = [];
      let score = 0;

      // Base score
      score += 10;
      breakdown.push({ reason: 'Base score', points: 10 });

      // ========================================
      // CRITICAL MILESTONES (Highest Priority)
      // ========================================

      if (commit.isFirstCommit) {
        score += 100;
        breakdown.push({ reason: 'First commit', points: 100 });
      }
      if (commit.isLastCommit) {
        score += 100;
        breakdown.push({ reason: 'Last commit (HEAD)', points: 100 });
      }

      // VERSION TAGS: Boosted to 100 to guarantee capture
      if (commit.tags.length > 0) {
        const points = 100;
        score += points;
        breakdown.push({ reason: `Version tag: ${commit.tags.join(', ')}`, points });
      }

      // ========================================
      // ADAPTIVE STRUCTURAL SIGNIFICANCE
      // ========================================

      // Files changed (adaptive percentile-based)
      if (commit.totalFilesChanged >= thresholds.filesChanged.p99) {
        score += 50;
        breakdown.push({ reason: `${commit.totalFilesChanged} files (p99)`, points: 50 });
      } else if (commit.totalFilesChanged >= thresholds.filesChanged.p95) {
        score += 35;
        breakdown.push({ reason: `${commit.totalFilesChanged} files (p95)`, points: 35 });
      } else if (commit.totalFilesChanged >= thresholds.filesChanged.p90) {
        score += 20;
        breakdown.push({ reason: `${commit.totalFilesChanged} files (p90)`, points: 20 });
      } else if (commit.totalFilesChanged >= thresholds.filesChanged.p75) {
        score += 10;
        breakdown.push({ reason: `${commit.totalFilesChanged} files (p75)`, points: 10 });
      }

      // Lines changed (adaptive percentile-based)
      if (commit.totalLinesChanged >= thresholds.linesChanged.p99) {
        score += 40;
        breakdown.push({ reason: `${commit.totalLinesChanged} lines (p99)`, points: 40 });
      } else if (commit.totalLinesChanged >= thresholds.linesChanged.p95) {
        score += 25;
        breakdown.push({ reason: `${commit.totalLinesChanged} lines (p95)`, points: 25 });
      } else if (commit.totalLinesChanged >= thresholds.linesChanged.p90) {
        score += 15;
        breakdown.push({ reason: `${commit.totalLinesChanged} lines (p90)`, points: 15 });
      } else if (commit.totalLinesChanged >= thresholds.linesChanged.p75) {
        score += 8;
        breakdown.push({ reason: `${commit.totalLinesChanged} lines (p75)`, points: 8 });
      }

      // Directory changes (still useful with adaptive context)
      const dirP95 = Math.max(5, Math.floor(thresholds.filesChanged.p95 / 3));
      const dirP75 = Math.max(3, Math.floor(thresholds.filesChanged.p75 / 3));

      if (commit.directoriesChanged > dirP95) {
        score += 25;
        breakdown.push({ reason: `${commit.directoriesChanged} directories (high)`, points: 25 });
      } else if (commit.directoriesChanged > dirP75) {
        score += 12;
        breakdown.push({ reason: `${commit.directoriesChanged} directories (med)`, points: 12 });
      }

      // File renames (structural refactoring)
      if (commit.hasFileRenames) {
        score += 20;
        breakdown.push({ reason: 'File renames detected', points: 20 });
      }

      // Merge commits (feature completions, PR merges)
      if (commit.isMergeCommit) {
        score += 30;
        breakdown.push({ reason: 'Merge commit (feature/PR)', points: 30 });
      }

      // Time gaps (commits after long silence)
      if (commit.daysSincePrevious > 180) {
        score += 50;
        breakdown.push({ reason: `${Math.round(commit.daysSincePrevious)} days since previous`, points: 50 });
      } else if (commit.daysSincePrevious > 90) {
        score += 30;
        breakdown.push({ reason: `${Math.round(commit.daysSincePrevious)} days since previous`, points: 30 });
      } else if (commit.daysSincePrevious > 30) {
        score += 15;
        breakdown.push({ reason: `${Math.round(commit.daysSincePrevious)} days since previous`, points: 15 });
      }

      // Commit message keywords
      const msg = commit.message.toLowerCase();
      if (/refactor|restructure|reorganize|rewrite/i.test(msg)) {
        score += 15;
        breakdown.push({ reason: 'Refactoring keyword in message', points: 15 });
      }
      if (/v?\d+\.\d+\.\d+/.test(commit.message)) {
        score += 20;
        breakdown.push({ reason: 'Version number in message', points: 20 });
      }
      if (/breaking|major|significant/i.test(msg)) {
        score += 25;
        breakdown.push({ reason: 'Major change keyword in message', points: 25 });
      }
      if (/initial|first/i.test(msg) && commit.totalFilesChanged > 10) {
        score += 20;
        breakdown.push({ reason: 'Initial implementation', points: 20 });
      }

      return {
        ...commit,
        importanceScore: Math.min(score, 200), // Cap at 200
        scoreBreakdown: breakdown,
        rank: 0,
        selected: false
      };
    });

    // Assign ranks
    scored.sort((a, b) => b.importanceScore - a.importanceScore);
    scored.forEach((commit, index) => {
      commit.rank = index + 1;
    });

    const highestScore = scored.length > 0 ? scored[0].importanceScore : 0;

    // Re-sort by date
    scored.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`Scoring complete. Highest score: ${highestScore}`);
    return scored;
  }

  /**
   * Select commits with temporal spread (V2: Priority Milestones First)
   */
  selectCommits(scored: ScoredCommit[], targetCount: number): ScoredCommit[] {
    console.log(`Selecting ${targetCount} commits...`);

    // Reset selection
    scored.forEach(c => c.selected = false);

    const selected: ScoredCommit[] = [];

    // ========================================
    // PHASE 1: Select ALL critical milestones (guaranteed)
    // ========================================
    const milestones = scored.filter(c => c.tags.length > 0 || c.isFirstCommit || c.isLastCommit);
    for (const milestone of milestones) {
      milestone.selected = true;
      selected.push(milestone);
    }

    console.log(`  Phase 1: Selected ${selected.length} critical milestones (tags + first/last)`);

    // If we've already exceeded target, just return the milestones
    if (selected.length >= targetCount) {
      console.log(`  Milestone count (${selected.length}) >= target (${targetCount}), returning milestones only`);
      return selected.sort((a, b) => a.timestamp - b.timestamp);
    }

    // ========================================
    // PHASE 2: Fill remaining with temporal + importance hybrid
    // ========================================
    const remaining = targetCount - selected.length;
    const unselected = scored.filter(c => !c.selected);

    // Divide timeline into buckets
    const firstTimestamp = scored[0].timestamp;
    const lastTimestamp = scored[scored.length - 1].timestamp;
    const totalDuration = lastTimestamp - firstTimestamp;
    const bucketCount = Math.min(remaining, Math.ceil(remaining / 2));
    const bucketSize = totalDuration / bucketCount;

    // Create time buckets
    const buckets: ScoredCommit[][] = Array.from({ length: bucketCount }, () => []);

    for (const commit of unselected) {
      const bucketIndex = Math.min(
        Math.floor((commit.timestamp - firstTimestamp) / bucketSize),
        bucketCount - 1
      );
      if (buckets[bucketIndex]) {
        buckets[bucketIndex].push(commit);
      }
    }

    // Select highest-scored commit from each bucket
    let bucketSelected = 0;
    for (const bucket of buckets) {
      if (bucket.length === 0) continue;

      // Sort bucket by score
      bucket.sort((a, b) => b.importanceScore - a.importanceScore);

      const best = bucket[0];
      best.selected = true;
      selected.push(best);
      bucketSelected++;
    }

    console.log(`  Phase 2: Selected ${bucketSelected} commits from temporal buckets`);

    // Fill any remaining slots with highest global scores
    if (selected.length < targetCount) {
      const stillRemaining = targetCount - selected.length;
      const stillUnselected = scored.filter(c => !c.selected);
      stillUnselected.sort((a, b) => b.importanceScore - a.importanceScore);

      let globalSelected = 0;
      for (let i = 0; i < stillRemaining && i < stillUnselected.length; i++) {
        stillUnselected[i].selected = true;
        selected.push(stillUnselected[i]);
        globalSelected++;
      }

      console.log(`  Phase 3: Selected ${globalSelected} commits from global high scores`);
    }

    // Sort by date
    selected.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`  Total selected: ${selected.length} commits`);
    return selected;
  }

  /**
   * Generate scenarios at different sampling densities
   */
  generateScenarios(scored: ScoredCommit[]): SamplingScenario[] {
    const scenarios: SamplingScenario[] = [
      { name: 'Milestones Only', targetCount: 50, commits: [] },
      { name: 'Balanced', targetCount: 100, commits: [] },
      { name: 'Detailed', targetCount: 200, commits: [] },
      { name: 'Comprehensive', targetCount: 500, commits: [] }
    ];

    for (const scenario of scenarios) {
      // Cap at total commits available
      const actualTarget = Math.min(scenario.targetCount, scored.length);
      scenario.commits = this.selectCommits(scored, actualTarget);
    }

    return scenarios;
  }

  /**
   * Get repository statistics
   */
  getStats(): RepositoryStats {
    const contributors = new Set(this.commits.map(c => c.author));
    const allTags = new Set<string>();
    this.commits.forEach(c => c.tags.forEach(t => allTags.add(t)));

    return {
      totalCommits: this.commits.length,
      dateRange: {
        start: this.commits[0].date,
        end: this.commits[this.commits.length - 1].date
      },
      totalFiles: 0, // Would need additional analysis
      contributors: contributors.size,
      tags: allTags.size
    };
  }

  /**
   * Generate HTML report
   */
  generateReport(scored: ScoredCommit[], scenarios: SamplingScenario[], stats: RepositoryStats): string {
    return generateReport(this.repoPath, scored, scenarios, stats);
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const repoPath = args[0] || path.join(process.env.HOME!, 'Documents/Gource');
  const outputPath = args[1] || path.join(__dirname, '../output/timeline-report.html');

  console.log('='.repeat(60));
  console.log('Timeline Commit Sampling Prototype');
  console.log('='.repeat(60));
  console.log();

  try {
    const sampler = new TimelineSampler(repoPath);

    // Load full history
    await sampler.loadHistory();

    // Score commits
    const scored = sampler.scoreCommits();

    // Generate sampling scenarios
    const scenarios = sampler.generateScenarios(scored);

    // Get stats
    const stats = sampler.getStats();

    // Generate report
    const html = sampler.generateReport(scored, scenarios, stats);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write report
    fs.writeFileSync(outputPath, html);

    console.log();
    console.log('='.repeat(60));
    console.log(`✅ Report generated: ${outputPath}`);
    console.log('='.repeat(60));
    console.log();
    console.log('Scenarios generated:');
    for (const scenario of scenarios) {
      console.log(`  - ${scenario.name}: ${scenario.commits.length} commits`);
    }
  } catch (error) {
    console.error('Error analyzing timeline:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TimelineSampler };
