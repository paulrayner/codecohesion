/**
 * Shared types for the prototype timeline sampler.
 */

export interface CommitAnalysis {
  hash: string;
  shortHash: string;
  date: Date;
  timestamp: number;
  author: string;
  message: string;

  // File changes
  filesAdded: number;
  filesDeleted: number;
  filesModified: number;
  totalFilesChanged: number;

  // LOC changes
  linesAdded: number;
  linesDeleted: number;
  totalLinesChanged: number;

  // Structural changes
  directoriesChanged: number;
  hasFileRenames: boolean;
  isMergeCommit: boolean;

  // Special markers
  isFirstCommit: boolean;
  isLastCommit: boolean;
  tags: string[];

  // Time context
  daysSincePrevious: number;

  // Scoring (populated later)
  importanceScore: number;
  scoreBreakdown: Array<{ reason: string; points: number }>;
}

export interface ScoredCommit extends CommitAnalysis {
  rank: number;
  selected: boolean;
}

export interface SamplingScenario {
  name: string;
  targetCount: number;
  commits: ScoredCommit[];
}

export interface RepositoryStats {
  totalCommits: number;
  dateRange: { start: Date; end: Date };
  totalFiles: number;
  contributors: number;
  tags: number;
}

export interface AdaptiveThresholds {
  filesChanged: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  linesChanged: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}
