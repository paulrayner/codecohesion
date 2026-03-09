/**
 * Re-export shared types from the canonical source.
 *
 * This shim preserves all existing import paths (e.g., `from './types'`,
 * `from '../types'`) across the viewer codebase without touching them.
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
