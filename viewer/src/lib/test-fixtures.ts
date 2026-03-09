/**
 * Shared test fixtures for tree node construction across test suites.
 *
 * This module is test-only and must not be imported by production code.
 */
import { DirectoryNode, FileNode, TreeNode } from '../types';

/**
 * Creates a mock FileNode with sensible defaults. Pass overrides to customise
 * individual fields without repeating the full shape in every test.
 *
 * Canonical shape sourced from tree-stats.test.ts.
 */
export function createMockFile(overrides: Partial<FileNode> = {}): FileNode {
  return {
    path: overrides.path || '/test.ts',
    name: overrides.name || 'test.ts',
    type: 'file',
    loc: overrides.loc ?? 100,
    extension: overrides.extension || 'ts',
    lastModified: overrides.lastModified || null,
    lastAuthor: overrides.lastAuthor || null,
    lastCommitHash: overrides.lastCommitHash || null,
    commitCount: overrides.commitCount || null,
    contributorCount: overrides.contributorCount || null,
    firstCommitDate: overrides.firstCommitDate || null,
    recentLinesChanged: overrides.recentLinesChanged || null,
    avgLinesPerCommit: overrides.avgLinesPerCommit || null,
    daysSinceLastModified: overrides.daysSinceLastModified || null,
    isGenerated: overrides.isGenerated,
  };
}

/**
 * Creates a mock DirectoryNode. The path is derived from the name as `/${name}`
 * to match the canonical shape used across tree test suites.
 */
export function createMockDir(name: string, children: TreeNode[] = []): DirectoryNode {
  return {
    path: `/${name}`,
    name,
    type: 'directory',
    children,
  };
}
