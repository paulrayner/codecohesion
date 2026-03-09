import { describe, it, expect } from 'vitest';
import { findFileInTree } from './tree-utils';
import { createMockFile, createMockDir } from './test-fixtures';

describe('findFileInTree', () => {
  it('should find file at root level', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/a.ts' });
    const file2 = createMockFile({ name: 'b.ts', path: '/b.ts' });

    const tree = createMockDir('root', [file1, file2]);

    const result = findFileInTree(tree, '/a.ts');

    expect(result).toBe(file1);
  });

  it('should find file in nested directory', () => {
    const file = createMockFile({ name: 'main.ts', path: '/src/main.ts' });

    const tree = createMockDir('root', [
      createMockDir('src', [file]),
    ]);

    const result = findFileInTree(tree, '/src/main.ts');

    expect(result).toBe(file);
  });

  it('should find file in deeply nested directory', () => {
    const file = createMockFile({ name: 'deep.ts', path: '/a/b/c/d/deep.ts' });

    const tree = createMockDir('root', [
      createMockDir('a', [
        createMockDir('b', [
          createMockDir('c', [
            createMockDir('d', [file]),
          ]),
        ]),
      ]),
    ]);

    const result = findFileInTree(tree, '/a/b/c/d/deep.ts');

    expect(result).toBe(file);
  });

  it('should return null if file not found', () => {
    const file = createMockFile({ name: 'a.ts', path: '/a.ts' });

    const tree = createMockDir('root', [file]);

    const result = findFileInTree(tree, '/nonexistent.ts');

    expect(result).toBeNull();
  });

  it('should return null for empty tree', () => {
    const tree = createMockDir('root', []);

    const result = findFileInTree(tree, '/any.ts');

    expect(result).toBeNull();
  });

  it('should return null for empty path', () => {
    const file = createMockFile({ name: 'a.ts', path: '/a.ts' });

    const tree = createMockDir('root', [file]);

    const result = findFileInTree(tree, '');

    expect(result).toBeNull();
  });

  it('should handle multiple files with similar names', () => {
    const file1 = createMockFile({ name: 'test.ts', path: '/src/test.ts' });
    const file2 = createMockFile({ name: 'test.ts', path: '/tests/test.ts' });

    const tree = createMockDir('root', [
      createMockDir('src', [file1]),
      createMockDir('tests', [file2]),
    ]);

    const result1 = findFileInTree(tree, '/src/test.ts');
    const result2 = findFileInTree(tree, '/tests/test.ts');

    expect(result1).toBe(file1);
    expect(result2).toBe(file2);
  });

  it('should search entire tree when file is in last branch', () => {
    const file1 = createMockFile({ name: 'a.ts', path: '/dir1/a.ts' });
    const file2 = createMockFile({ name: 'b.ts', path: '/dir2/b.ts' });
    const target = createMockFile({ name: 'target.ts', path: '/dir3/target.ts' });

    const tree = createMockDir('root', [
      createMockDir('dir1', [file1]),
      createMockDir('dir2', [file2]),
      createMockDir('dir3', [target]),
    ]);

    const result = findFileInTree(tree, '/dir3/target.ts');

    expect(result).toBe(target);
  });

  it('should return first match when searching from root', () => {
    const file = createMockFile({ name: 'first.ts', path: '/src/first.ts' });
    const otherFile = createMockFile({ name: 'second.ts', path: '/src/second.ts' });

    const tree = createMockDir('root', [
      createMockDir('src', [file, otherFile]),
    ]);

    const result = findFileInTree(tree, '/src/first.ts');

    expect(result).toBe(file);
    expect(result?.name).toBe('first.ts');
  });
});
