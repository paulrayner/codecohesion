/**
 * Shared types for CodeCohesion monorepo
 *
 * Source of truth for data structures used across processor, viewer, and api.
 */

export interface FileNode {
  path: string;
  name: string;
  type: 'file';
  loc: number;
  extension: string;
  lastModified: string | null;
  lastAuthor: string | null;
  lastCommitHash: string | null;
  commitCount: number | null;        // Total commits for this file (churn)
  contributorCount: number | null;   // Number of unique contributors
  firstCommitDate: string | null;    // Date of first commit (file age)
  recentLinesChanged: number | null; // Lines added + deleted in last 90 days
  avgLinesPerCommit: number | null;  // Average lines changed per commit (volatility)
  daysSinceLastModified: number | null; // Days since last modification
  isGenerated?: boolean;             // Whether file is auto-generated/minified (Phase 1)
  paceLayer?: 'foundation' | 'infrastructure' | 'domain' | 'surface'; // Pace layer classification (Phase 2)
  changeVelocity?: number;           // Commits per quarter or month depending on repo age (Phase 2)
}

export interface DirectoryNode {
  path: string;
  name: string;
  type: 'directory';
  children: TreeNode[];
}

export type TreeNode = FileNode | DirectoryNode;

export interface RepositorySnapshot {
  repositoryPath: string;
  commit: string;
  timestamp: string;
  author: string;
  message: string;
  tree: DirectoryNode;
  commitMessages: Record<string, string>; // Map of commit hash -> commit message
  stats: {
    totalFiles: number;
    totalLoc: number;
    filesByExtension: Record<string, number>;
  };
}

/**
 * Timeline format with adaptive sampling (Slice 2)
 */
export interface TimelineData {
  format: 'timeline-v1';
  repositoryPath: string;
  headSnapshot: RepositorySnapshot;  // Backward compatibility - same as static format
  timeline: {
    totalCommits: number;
    dateRange: {
      first: string;
      last: string;
    };
    baseSampling: {
      algorithm: 'adaptive-v2';
      targetCount: number;
      actualCount: number;
      commits: CommitSnapshot[];
    };
    drillDownLayers?: DrillDownLayer[];  // Optional - for time-range detail
  };
}

/**
 * Single commit snapshot with delta information
 */
export interface CommitSnapshot {
  hash: string;
  date: string;
  author: string;
  message: string;
  tags: string[];
  isMergeCommit: boolean;
  importanceScore: number;
  changes: {
    filesAdded: string[];
    filesModified: string[];
    filesDeleted: string[];
    totalFilesChanged: number;
    linesAdded: number;
    linesDeleted: number;
  };
  tree?: DirectoryNode;  // Optional - full tree for keyframes only
}

/**
 * Drill-down layer for detailed time range analysis
 */
export interface DrillDownLayer {
  id: string;
  label: string;
  dateRange: {
    start: string;
    end: string;
  };
  commits: CommitSnapshot[];  // All commits in this range
}

/**
 * Summary DTO for a single import edge — safe to embed in API responses.
 * Omits large internal details; full detail lives in StructureGraph (processor-local).
 */
export interface ImportEdgeSummary {
  from: string;
  to: string;
  toRaw: string;
  isExternal: boolean;
  /** Named symbols imported; optional for backwards compatibility with consumers that omit it. */
  symbols?: string[];
}

/**
 * Summary DTO for a structure analysis result.
 * Returned by the API; full StructureGraph is processor-local.
 */
export interface StructureSummary {
  format: 'structure-v1';
  repositoryPath: string;
  analyzedAt: string;
  filesAnalyzed: number;
  importEdges: number;
  functionDecls: number;
  parseErrors: number;
}

/**
 * Timeline V2 format with full commit history (no sampling)
 * Designed for delta-based tree reconstruction (Phase 1 POC)
 */
export interface TimelineDataV2 {
  format: 'timeline-v2';
  repositoryPath: string;

  // Metadata about the repository
  metadata: {
    totalCommits: number;
    dateRange: {
      first: string;
      last: string;
    };
    tags: string[];  // All version tags in the repository
  };

  // ALL commits as deltas (no sampling)
  commits: CommitSnapshot[];

  // Note: Keyframes generated client-side for now
  // In future, could add: keyframes?: { interval: number; snapshots: Array<{index: number; tree: DirectoryNode}> }
}
