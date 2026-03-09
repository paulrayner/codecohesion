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
