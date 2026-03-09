import type { FileNode } from '@codecohesion/shared-types';

/**
 * Re-export shared types from the canonical source
 */
export type {
  FileNode,
  DirectoryNode,
  TreeNode,
  RepositorySnapshot,
  TimelineData,
  CommitSnapshot,
  DrillDownLayer,
  TimelineDataV2,
} from '@codecohesion/shared-types';

/**
 * API Response Types for CodeCohesion API
 */

/**
 * HATEOAS Link Types
 */

export interface Link {
  href: string;
  description?: string;
  templated?: boolean;
}

export interface Links {
  [rel: string]: Link;
}

export interface Action {
  method: string;
  href: string;
  description: string;
}

export interface Actions {
  [name: string]: Action;
}

export interface RepoListItem {
  id: string;
  name: string;
  format?: string;
  _links?: Links;
  _actions?: Actions;
}

export interface RepoInfo extends RepoListItem {
  url?: string;
}

export interface ReposResponse {
  repos: RepoListItem[];
  _links?: Links;
}

export interface StatsResponse {
  repository: {
    id: string;
    path: string;
  };
  analyzedAt: string;
  commit: string;
  stats: {
    totalFiles: number;
    totalLoc: number;
    filesByExtension: Record<string, number>;
  };
}

export interface ContributorInfo {
  email: string;
  filesChanged: number;
  lastModified: string;
}

export interface ContributorsResponse {
  repository: {
    id: string;
    url?: string;
  };
  period: {
    since?: string;
    until?: string;
    days?: number;
    limit?: number;
  };
  contributors: ContributorInfo[];
  total: number;
}

export interface FilesResponse {
  files: FileNode[];
  total: number;
}

export interface HotspotsResponse {
  topChurn: FileNode[];
  topContributors: FileNode[];
}

export interface HelpAction {
  description: string;
  method: string;
  url: string;
  example?: string;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  help?: {
    message?: string;
    actions?: HelpAction[];
  };
  docs?: string;
}

export interface Example {
  description: string;
  request: string;
}

export interface RootResponse {
  service: string;
  version: string;
  description: string;
  _links: Links;
  examples: {
    [name: string]: Example;
  };
  capabilities: string[];
}

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

/**
 * Response type for complexity analysis endpoint.
 * Wraps the ComplexityReport produced by ComplexityAnalyzer.
 */
export interface ComplexityResponse {
  repository: {
    id: string;
  };
  data: import('codecohesion-processor').ComplexityReport;
}

/**
 * Response type for impact analysis endpoint.
 * Describes the downstream impact of a file change across the dependency graph.
 */
export interface ImpactResponse {
  repository: {
    id: string;
  };
  file: string;
  impactedFiles: string[];
  total: number;
}

/**
 * Response type for context (bounded context / cluster) endpoint.
 * Summarises detected architectural boundaries from coupling analysis.
 */
export interface ContextResponse {
  repository: {
    id: string;
  };
  clusters: Array<{
    id: number;
    name: string;
    files: string[];
    fileCount: number;
    avgInternalCoupling: number;
  }>;
  total: number;
}

/**
 * Response type for coupling analysis endpoint.
 * Wraps the CouplingGraph produced by CouplingAnalyzer.
 */
export interface CouplingResponse {
  repository: {
    id: string;
  };
  data: import('codecohesion-processor').CouplingGraph;
}

/**
 * Response type for repository health score endpoint.
 * Aggregates complexity, coupling, and churn signals into a composite score.
 *
 * Breakdown metrics:
 *   churnConcentration (30%): Gini coefficient of commit counts. Low = healthy.
 *   contributorDistribution (20%): Bus factor. Higher = healthier.
 *   complexityHotspotDensity (30%): Fraction of high-score files. Fewer = healthier. (optional)
 *   couplingDensity (20%): Strong coupling ratio. Lower = healthier. (optional)
 *
 * When optional data is missing, weights are redistributed proportionally.
 */
export interface HealthScoreResponse {
  repository: {
    id: string;
  };
  score: number;
  breakdown: {
    churnConcentration: number;
    contributorDistribution: number;
    complexityHotspotDensity: number | null;
    couplingDensity: number | null;
  };
  analyzedAt: string;
  recommendations: string[];
}
