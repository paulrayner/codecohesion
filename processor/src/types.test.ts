/**
 * Type shape validation tests for processor output structures.
 *
 * These tests assert that the RepositorySnapshot, DirectoryNode, FileNode,
 * and related types have the correct shape at runtime — simulating what a
 * consumer would encounter when deserializing processor JSON output.
 */

import { describe, it, expect } from 'vitest';
import type {
  FileNode,
  DirectoryNode,
  TreeNode,
  RepositorySnapshot,
} from '@codecohesion/shared-types';

// ---------------------------------------------------------------------------
// Helpers — construct minimal valid shapes without touching git or filesystem
// ---------------------------------------------------------------------------

function makeFileNode(overrides: Partial<FileNode> = {}): FileNode {
  return {
    path: 'src/index.ts',
    name: 'index.ts',
    type: 'file',
    loc: 42,
    extension: 'ts',
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

function makeDirectoryNode(overrides: Partial<DirectoryNode> = {}): DirectoryNode {
  return {
    path: 'src',
    name: 'src',
    type: 'directory',
    children: [],
    ...overrides,
  };
}

function makeRepositorySnapshot(overrides: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  const tree = makeDirectoryNode({ path: '', name: 'root' });
  return {
    repositoryPath: '/tmp/repo',
    commit: 'abc123',
    timestamp: '2024-01-01T00:00:00Z',
    author: 'Test Author',
    message: 'Initial commit',
    tree,
    commitMessages: {},
    stats: {
      totalFiles: 0,
      totalLoc: 0,
      filesByExtension: {},
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FileNode shape
// ---------------------------------------------------------------------------

describe('FileNode type shape', () => {
  it('has type discriminant set to "file"', () => {
    const node = makeFileNode();
    expect(node.type).toBe('file');
  });

  it('has required string fields: path, name, extension', () => {
    const node = makeFileNode({ path: 'lib/utils.ts', name: 'utils.ts', extension: 'ts' });
    expect(typeof node.path).toBe('string');
    expect(typeof node.name).toBe('string');
    expect(typeof node.extension).toBe('string');
  });

  it('has numeric loc field', () => {
    const node = makeFileNode({ loc: 100 });
    expect(typeof node.loc).toBe('number');
    expect(node.loc).toBe(100);
  });

  it('allows nullable git metadata fields', () => {
    const node = makeFileNode({
      lastModified: '2024-01-01',
      lastAuthor: 'Alice',
      lastCommitHash: 'deadbeef',
      commitCount: 5,
      contributorCount: 2,
      firstCommitDate: '2023-06-01',
      recentLinesChanged: 30,
      avgLinesPerCommit: 10,
      daysSinceLastModified: 7,
    });
    expect(node.lastAuthor).toBe('Alice');
    expect(node.commitCount).toBe(5);
    expect(node.daysSinceLastModified).toBe(7);
  });

  it('accepts null values for all optional git metadata fields', () => {
    const node = makeFileNode();
    expect(node.lastModified).toBeNull();
    expect(node.lastAuthor).toBeNull();
    expect(node.lastCommitHash).toBeNull();
    expect(node.commitCount).toBeNull();
    expect(node.contributorCount).toBeNull();
    expect(node.firstCommitDate).toBeNull();
    expect(node.recentLinesChanged).toBeNull();
    expect(node.avgLinesPerCommit).toBeNull();
    expect(node.daysSinceLastModified).toBeNull();
  });

  it('supports optional isGenerated flag', () => {
    const generated = makeFileNode({ isGenerated: true });
    const regular = makeFileNode();
    expect(generated.isGenerated).toBe(true);
    expect(regular.isGenerated).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DirectoryNode shape
// ---------------------------------------------------------------------------

describe('DirectoryNode type shape', () => {
  it('has type discriminant set to "directory"', () => {
    const node = makeDirectoryNode();
    expect(node.type).toBe('directory');
  });

  it('has a children array', () => {
    const node = makeDirectoryNode();
    expect(Array.isArray(node.children)).toBe(true);
  });

  it('children array accepts FileNode and DirectoryNode (TreeNode union)', () => {
    const fileChild = makeFileNode({ path: 'src/index.ts', name: 'index.ts' });
    const dirChild = makeDirectoryNode({ path: 'src/lib', name: 'lib' });
    const parent = makeDirectoryNode({ children: [fileChild, dirChild] });

    expect(parent.children).toHaveLength(2);
    expect(parent.children[0].type).toBe('file');
    expect(parent.children[1].type).toBe('directory');
  });

  it('can represent a nested tree without depth limit', () => {
    const deep = makeDirectoryNode({
      path: 'a/b/c',
      name: 'c',
      children: [
        makeDirectoryNode({
          path: 'a/b/c/d',
          name: 'd',
          children: [makeFileNode({ path: 'a/b/c/d/file.ts', name: 'file.ts' })],
        }),
      ],
    });
    const nested = (deep.children[0] as DirectoryNode).children[0] as FileNode;
    expect(nested.path).toBe('a/b/c/d/file.ts');
  });
});

// ---------------------------------------------------------------------------
// TreeNode union discriminant
// ---------------------------------------------------------------------------

describe('TreeNode discriminated union', () => {
  it('narrows correctly to FileNode when type is "file"', () => {
    const nodes: TreeNode[] = [
      makeFileNode({ path: 'a.ts', name: 'a.ts' }),
      makeDirectoryNode({ path: 'lib', name: 'lib' }),
    ];
    const files = nodes.filter((n): n is FileNode => n.type === 'file');
    expect(files).toHaveLength(1);
    expect(files[0].loc).toBeDefined();
  });

  it('narrows correctly to DirectoryNode when type is "directory"', () => {
    const nodes: TreeNode[] = [
      makeFileNode({ path: 'a.ts', name: 'a.ts' }),
      makeDirectoryNode({ path: 'lib', name: 'lib' }),
    ];
    const dirs = nodes.filter((n): n is DirectoryNode => n.type === 'directory');
    expect(dirs).toHaveLength(1);
    expect(dirs[0].children).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// RepositorySnapshot shape
// ---------------------------------------------------------------------------

describe('RepositorySnapshot type shape', () => {
  it('has all required top-level string fields', () => {
    const snap = makeRepositorySnapshot();
    expect(typeof snap.repositoryPath).toBe('string');
    expect(typeof snap.commit).toBe('string');
    expect(typeof snap.timestamp).toBe('string');
    expect(typeof snap.author).toBe('string');
    expect(typeof snap.message).toBe('string');
  });

  it('has a tree field that is a DirectoryNode', () => {
    const snap = makeRepositorySnapshot();
    expect(snap.tree.type).toBe('directory');
    expect(Array.isArray(snap.tree.children)).toBe(true);
  });

  it('has a commitMessages record mapping hash strings to message strings', () => {
    const snap = makeRepositorySnapshot({
      commitMessages: { abc123: 'Initial commit', def456: 'Add feature' },
    });
    expect(snap.commitMessages['abc123']).toBe('Initial commit');
    expect(snap.commitMessages['def456']).toBe('Add feature');
  });

  it('has stats.totalFiles as a number', () => {
    const snap = makeRepositorySnapshot({
      stats: { totalFiles: 10, totalLoc: 500, filesByExtension: {} },
    });
    expect(typeof snap.stats.totalFiles).toBe('number');
    expect(snap.stats.totalFiles).toBe(10);
  });

  it('has stats.totalLoc as a number', () => {
    const snap = makeRepositorySnapshot({
      stats: { totalFiles: 3, totalLoc: 300, filesByExtension: {} },
    });
    expect(snap.stats.totalLoc).toBe(300);
  });

  it('has stats.filesByExtension as a string-to-number record', () => {
    const snap = makeRepositorySnapshot({
      stats: {
        totalFiles: 5,
        totalLoc: 250,
        filesByExtension: { ts: 3, json: 2 },
      },
    });
    expect(snap.stats.filesByExtension['ts']).toBe(3);
    expect(snap.stats.filesByExtension['json']).toBe(2);
  });

  it('roundtrips correctly through JSON serialization', () => {
    const file = makeFileNode({ path: 'src/main.ts', name: 'main.ts', loc: 99 });
    const tree = makeDirectoryNode({ path: '', name: 'root', children: [file] });
    const snap = makeRepositorySnapshot({ tree, stats: { totalFiles: 1, totalLoc: 99, filesByExtension: { ts: 1 } } });

    const json = JSON.stringify(snap);
    const parsed: RepositorySnapshot = JSON.parse(json);

    expect(parsed.commit).toBe(snap.commit);
    expect(parsed.tree.type).toBe('directory');
    const parsedFile = parsed.tree.children[0] as FileNode;
    expect(parsedFile.loc).toBe(99);
    expect(parsedFile.extension).toBe('ts');
  });
});
