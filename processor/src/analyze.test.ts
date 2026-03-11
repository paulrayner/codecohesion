/**
 * Behavioral tests for buildTree() — the pure tree-building logic inside
 * RepositoryAnalyzer.
 *
 * Architectural constraint: no git, no filesystem. All inputs are in-memory.
 *
 * RED gate note: buildTree() is currently a `private` method on
 * RepositoryAnalyzer and is not exported as a standalone function. These tests
 * will fail until buildTree() (or an equivalent) is exported as a testable
 * pure function.
 */

import { describe, it, expect } from 'vitest';
// buildTree is expected to be exported as a standalone pure function.
// It does not exist as an export yet — this import will fail, satisfying RED.
import { buildTree } from './analyze';
import type { DirectoryNode, FileNode } from '@codecohesion/shared-types';

// ---------------------------------------------------------------------------
// Minimal input shape that buildTree() accepts
// ---------------------------------------------------------------------------

interface FileInput {
  path: string;
  loc: number;
  lastModified: string | null;
  lastAuthor: string | null;
  lastCommitHash: string | null;
  commitCount: number | null;
  contributorCount: number | null;
  firstCommitDate: string | null;
  recentLinesChanged: number | null;
  avgLinesPerCommit: number | null;
  daysSinceLastModified: number | null;
  isGenerated?: boolean;
}

function makeInput(path: string, loc: number, overrides: Partial<FileInput> = {}): FileInput {
  return {
    path,
    loc,
    lastModified: null,
    lastAuthor: null,
    lastCommitHash: null,
    commitCount: null,
    contributorCount: null,
    firstCommitDate: null,
    recentLinesChanged: null,
    avgLinesPerCommit: null,
    daysSinceLastModified: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic tree structure
// ---------------------------------------------------------------------------

describe('buildTree() — basic structure', () => {
  it('returns a root DirectoryNode for an empty file list', () => {
    const root = buildTree([]);
    expect(root.type).toBe('directory');
    expect(root.name).toBe('root');
    expect(root.children).toHaveLength(0);
  });

  it('places a top-level file directly under root', () => {
    const root = buildTree([makeInput('README.md', 5)]);
    expect(root.children).toHaveLength(1);
    const child = root.children[0] as FileNode;
    expect(child.type).toBe('file');
    expect(child.name).toBe('README.md');
    expect(child.path).toBe('README.md');
  });

  it('creates an intermediate directory node for a nested file', () => {
    const root = buildTree([makeInput('src/index.ts', 10)]);
    expect(root.children).toHaveLength(1);
    const srcDir = root.children[0] as DirectoryNode;
    expect(srcDir.type).toBe('directory');
    expect(srcDir.name).toBe('src');
    expect(srcDir.children).toHaveLength(1);
    const file = srcDir.children[0] as FileNode;
    expect(file.name).toBe('index.ts');
  });

  it('reuses an existing directory node for sibling files', () => {
    const root = buildTree([
      makeInput('src/a.ts', 10),
      makeInput('src/b.ts', 20),
    ]);
    // Should have exactly one 'src' directory, not two
    expect(root.children).toHaveLength(1);
    const srcDir = root.children[0] as DirectoryNode;
    expect(srcDir.name).toBe('src');
    expect(srcDir.children).toHaveLength(2);
  });

  it('handles multiple top-level directories independently', () => {
    const root = buildTree([
      makeInput('src/index.ts', 10),
      makeInput('test/index.test.ts', 20),
    ]);
    expect(root.children).toHaveLength(2);
    const names = root.children.map(c => c.name).sort();
    expect(names).toEqual(['src', 'test']);
  });
});

// ---------------------------------------------------------------------------
// Correct parent-child relationships
// ---------------------------------------------------------------------------

describe('buildTree() — parent-child relationships', () => {
  it('builds a three-level deep path correctly', () => {
    const root = buildTree([makeInput('src/lib/utils.ts', 30)]);
    const src = root.children[0] as DirectoryNode;
    expect(src.type).toBe('directory');
    expect(src.name).toBe('src');

    const lib = src.children[0] as DirectoryNode;
    expect(lib.type).toBe('directory');
    expect(lib.name).toBe('lib');

    const utils = lib.children[0] as FileNode;
    expect(utils.type).toBe('file');
    expect(utils.name).toBe('utils.ts');
  });

  it('sets the correct path on an intermediate directory node', () => {
    const root = buildTree([makeInput('src/lib/utils.ts', 30)]);
    const src = root.children[0] as DirectoryNode;
    expect(src.path).toBe('src');

    const lib = src.children[0] as DirectoryNode;
    expect(lib.path).toBe('src/lib');
  });

  it('sets the full path on leaf FileNode', () => {
    const root = buildTree([makeInput('src/lib/utils.ts', 30)]);
    const file = (
      (root.children[0] as DirectoryNode).children[0] as DirectoryNode
    ).children[0] as FileNode;
    expect(file.path).toBe('src/lib/utils.ts');
  });

  it('shares directory nodes across files with common ancestors', () => {
    const root = buildTree([
      makeInput('src/a/foo.ts', 5),
      makeInput('src/b/bar.ts', 10),
    ]);
    const src = root.children[0] as DirectoryNode;
    expect(src.name).toBe('src');
    // Both 'a' and 'b' are children of the same src node
    expect(src.children).toHaveLength(2);
    const childNames = src.children.map(c => c.name).sort();
    expect(childNames).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// File metadata propagation
// ---------------------------------------------------------------------------

describe('buildTree() — file metadata', () => {
  it('preserves loc on the FileNode', () => {
    const root = buildTree([makeInput('src/main.ts', 123)]);
    const src = root.children[0] as DirectoryNode;
    const file = src.children[0] as FileNode;
    expect(file.loc).toBe(123);
  });

  it('derives file extension from the file name', () => {
    const root = buildTree([makeInput('src/component.tsx', 50)]);
    const file = (root.children[0] as DirectoryNode).children[0] as FileNode;
    expect(file.extension).toBe('tsx');
  });

  it('uses "no-extension" for files without an extension', () => {
    const root = buildTree([makeInput('Makefile', 20)]);
    const file = root.children[0] as FileNode;
    expect(file.extension).toBe('no-extension');
  });

  it('propagates lastAuthor onto the FileNode', () => {
    const root = buildTree([
      makeInput('src/widget.ts', 10, { lastAuthor: 'Alice', lastModified: '2024-01-15' }),
    ]);
    const file = (root.children[0] as DirectoryNode).children[0] as FileNode;
    expect(file.lastAuthor).toBe('Alice');
    expect(file.lastModified).toBe('2024-01-15');
  });

  it('propagates commitCount and contributorCount onto the FileNode', () => {
    const root = buildTree([
      makeInput('src/hot.ts', 200, { commitCount: 42, contributorCount: 3 }),
    ]);
    const file = (root.children[0] as DirectoryNode).children[0] as FileNode;
    expect(file.commitCount).toBe(42);
    expect(file.contributorCount).toBe(3);
  });

  it('propagates isGenerated flag when true', () => {
    const root = buildTree([
      makeInput('dist/bundle.js', 9999, { isGenerated: true }),
    ]);
    const dist = root.children[0] as DirectoryNode;
    const file = dist.children[0] as FileNode;
    expect(file.isGenerated).toBe(true);
  });

  it('leaves isGenerated undefined when not provided', () => {
    const root = buildTree([makeInput('src/clean.ts', 10)]);
    const file = (root.children[0] as DirectoryNode).children[0] as FileNode;
    expect(file.isGenerated).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// LOC and stats correctness
// ---------------------------------------------------------------------------

describe('buildTree() — LOC correctness', () => {
  it('sets loc to 0 for a file with zero lines', () => {
    const root = buildTree([makeInput('src/empty.ts', 0)]);
    const file = (root.children[0] as DirectoryNode).children[0] as FileNode;
    expect(file.loc).toBe(0);
  });

  it('preserves distinct LOC values for multiple files', () => {
    const root = buildTree([
      makeInput('src/small.ts', 5),
      makeInput('src/large.ts', 500),
    ]);
    const src = root.children[0] as DirectoryNode;
    const byName = Object.fromEntries(src.children.map(c => [c.name, c]));
    expect((byName['small.ts'] as FileNode).loc).toBe(5);
    expect((byName['large.ts'] as FileNode).loc).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('buildTree() — edge cases', () => {
  it('handles a deeply nested single file (5 levels)', () => {
    const root = buildTree([makeInput('a/b/c/d/e.ts', 1)]);
    let node: DirectoryNode = root;
    const expectedNames = ['a', 'b', 'c', 'd'];
    for (const expected of expectedNames) {
      expect(node.children).toHaveLength(1);
      const child = node.children[0] as DirectoryNode;
      expect(child.type).toBe('directory');
      expect(child.name).toBe(expected);
      node = child;
    }
    expect(node.children).toHaveLength(1);
    const leaf = node.children[0] as FileNode;
    expect(leaf.type).toBe('file');
    expect(leaf.name).toBe('e.ts');
  });

  it('handles many files in the same directory without duplication', () => {
    const files = Array.from({ length: 10 }, (_, i) => makeInput(`src/file${i}.ts`, i * 10));
    const root = buildTree(files);
    expect(root.children).toHaveLength(1);
    const src = root.children[0] as DirectoryNode;
    expect(src.children).toHaveLength(10);
  });

  it('does not mix files from different directories', () => {
    const root = buildTree([
      makeInput('frontend/App.tsx', 100),
      makeInput('backend/server.ts', 200),
    ]);
    const frontend = root.children.find(c => c.name === 'frontend') as DirectoryNode;
    const backend = root.children.find(c => c.name === 'backend') as DirectoryNode;
    expect(frontend).toBeDefined();
    expect(backend).toBeDefined();
    expect((frontend.children[0] as FileNode).name).toBe('App.tsx');
    expect((backend.children[0] as FileNode).name).toBe('server.ts');
  });
});
