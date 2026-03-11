import { describe, it, expect } from 'vitest';
import { buildCommitIndex, buildPathIndex } from './tree-indexers';
import { createMockFile, createMockDir } from './test-fixtures';

describe('buildCommitIndex', () => {
  it('should index files by commit hash', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/a.ts', lastCommitHash: 'abc123' });
    const file2 = createMockFile({ name: 'b.ts', path: '/b.ts', lastCommitHash: 'abc123' });
    const file3 = createMockFile({ name: 'c.ts', path: '/c.ts', lastCommitHash: 'def456' });

    const dir = createMockDir('root', [file1, file2, file3]);

    const index = buildCommitIndex(dir);

    expect(index.size).toBe(2);
    expect(index.get('abc123')).toEqual([file1, file2]);
    expect(index.get('def456')).toEqual([file3]);
  });

  it('should handle files without commit hashes', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/a.ts', lastCommitHash: 'abc123' });
    const file2 = createMockFile({ name: 'b.ts', path: '/b.ts', lastCommitHash: null });
    const file3 = createMockFile({ name: 'c.ts', path: '/c.ts', lastCommitHash: 'def456' });

    const dir = createMockDir('root', [file1, file2, file3]);

    const index = buildCommitIndex(dir);

    expect(index.size).toBe(2);
    expect(index.get('abc123')).toEqual([file1]);
    expect(index.get('def456')).toEqual([file3]);
    expect(index.has('null')).toBe(false);
  });

  it('should handle nested directories', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/src/a.ts', lastCommitHash: 'abc123' });
    const file2 = createMockFile({ name: 'b.ts', path: '/src/b.ts', lastCommitHash: 'abc123' });
    const file3 = createMockFile({ name: 'c.ts', path: '/tests/c.ts', lastCommitHash: 'def456' });

    const dir = createMockDir('root', [
      createMockDir('src', [file1, file2]),
      createMockDir('tests', [file3]),
    ]);

    const index = buildCommitIndex(dir);

    expect(index.size).toBe(2);
    expect(index.get('abc123')).toEqual([file1, file2]);
    expect(index.get('def456')).toEqual([file3]);
  });

  it('should return empty index for empty tree', () => {
    const dir = createMockDir('root', []);
    const index = buildCommitIndex(dir);
    expect(index.size).toBe(0);
  });

  it('should handle all files with unique commits', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/a.ts', lastCommitHash: 'aaa111' });
    const file2 = createMockFile({ name: 'b.ts', path: '/b.ts', lastCommitHash: 'bbb222' });
    const file3 = createMockFile({ name: 'c.ts', path: '/c.ts', lastCommitHash: 'ccc333' });

    const dir = createMockDir('root', [file1, file2, file3]);

    const index = buildCommitIndex(dir);

    expect(index.size).toBe(3);
    expect(index.get('aaa111')).toEqual([file1]);
    expect(index.get('bbb222')).toEqual([file2]);
    expect(index.get('ccc333')).toEqual([file3]);
  });

  it('should handle all files without commit hashes', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/a.ts', lastCommitHash: null });
    const file2 = createMockFile({ name: 'b.ts', path: '/b.ts', lastCommitHash: null });

    const dir = createMockDir('root', [file1, file2]);

    const index = buildCommitIndex(dir);

    expect(index.size).toBe(0);
  });
});

describe('buildPathIndex', () => {
  it('should index files by path', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/a.ts' });
    const file2 = createMockFile({ name: 'b.ts', path: '/b.ts' });
    const file3 = createMockFile({ name: 'c.ts', path: '/c.ts' });

    const dir = createMockDir('root', [file1, file2, file3]);

    const index = buildPathIndex(dir);

    expect(index.size).toBe(3);
    expect(index.get('/a.ts')).toBe(file1);
    expect(index.get('/b.ts')).toBe(file2);
    expect(index.get('/c.ts')).toBe(file3);
  });

  it('should handle nested paths', () => {
    const file1 = createMockFile({ name: 'main.ts', path: '/src/main.ts' });
    const file2 = createMockFile({ name: 'utils.ts', path: '/src/utils.ts' });
    const file3 = createMockFile({ name: 'app.test.ts', path: '/tests/app.test.ts' });

    const dir = createMockDir('root', [
      createMockDir('src', [file1, file2]),
      createMockDir('tests', [file3]),
    ]);

    const index = buildPathIndex(dir);

    expect(index.size).toBe(3);
    expect(index.get('/src/main.ts')).toBe(file1);
    expect(index.get('/src/utils.ts')).toBe(file2);
    expect(index.get('/tests/app.test.ts')).toBe(file3);
  });

  it('should handle deeply nested paths', () => {
    const file = createMockFile({ name: 'deep.ts', path: '/a/b/c/d/deep.ts' });

    const dir = createMockDir('root', [
      createMockDir('a', [
        createMockDir('b', [
          createMockDir('c', [
            createMockDir('d', [file]),
          ]),
        ]),
      ]),
    ]);

    const index = buildPathIndex(dir);

    expect(index.size).toBe(1);
    expect(index.get('/a/b/c/d/deep.ts')).toBe(file);
  });

  it('should return empty index for empty tree', () => {
    const dir = createMockDir('root', []);
    const index = buildPathIndex(dir);
    expect(index.size).toBe(0);
  });

  it('should handle root-level files', () => {
    const file1 = createMockFile({ name: 'README.md', path: '/README.md' });
    const file2 = createMockFile({ name: 'package.json', path: '/package.json' });

    const dir = createMockDir('root', [file1, file2]);

    const index = buildPathIndex(dir);

    expect(index.size).toBe(2);
    expect(index.get('/README.md')).toBe(file1);
    expect(index.get('/package.json')).toBe(file2);
  });

  it('should preserve reference to original file nodes', () => {
    const file = createMockFile({ name: 'test.ts', path: '/test.ts', loc: 500 });
    const dir = createMockDir('root', [file]);

    const index = buildPathIndex(dir);
    const indexedFile = index.get('/test.ts');

    expect(indexedFile).toBe(file); // Same reference
    expect(indexedFile?.loc).toBe(500);
  });
});
