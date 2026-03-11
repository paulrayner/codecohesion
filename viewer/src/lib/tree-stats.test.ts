import { describe, it, expect } from 'vitest';
import { calculateDirectoryStats, calculateMaxDepth, countDirectories, collectModificationDates } from './tree-stats';
import { createMockFile, createMockDir } from './test-fixtures';

describe('calculateDirectoryStats', () => {
  it('should count files by extension', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'a.ts', extension: 'ts', loc: 100 }),
      createMockFile({ name: 'b.ts', extension: 'ts', loc: 50 }),
      createMockFile({ name: 'c.js', extension: 'js', loc: 75 }),
    ]);

    const result = calculateDirectoryStats(dir);

    expect(result.filesByExt).toEqual({ ts: 2, js: 1 });
  });

  it('should sum total LOC', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'a.ts', loc: 100 }),
      createMockFile({ name: 'b.ts', loc: 50 }),
    ]);

    const result = calculateDirectoryStats(dir);

    expect(result.totalLoc).toBe(150);
  });

  it('should handle empty directory', () => {
    const dir = createMockDir('root', []);

    const result = calculateDirectoryStats(dir);

    expect(result.totalLoc).toBe(0);
    expect(result.filesByExt).toEqual({});
  });

  it('should handle nested directories', () => {
    const dir = createMockDir('root', [
      createMockDir('src', [
        createMockFile({ name: 'main.ts', extension: 'ts', loc: 200 }),
        createMockFile({ name: 'utils.ts', extension: 'ts', loc: 100 }),
      ]),
      createMockFile({ name: 'index.html', extension: 'html', loc: 50 }),
    ]);

    const result = calculateDirectoryStats(dir);

    expect(result.totalLoc).toBe(350);
    expect(result.filesByExt).toEqual({ ts: 2, html: 1 });
  });

  it('should handle mixed extensions and deep nesting', () => {
    const dir = createMockDir('root', [
      createMockDir('src', [
        createMockDir('components', [
          createMockFile({ name: 'Button.tsx', extension: 'tsx', loc: 100 }),
          createMockFile({ name: 'Input.tsx', extension: 'tsx', loc: 80 }),
        ]),
        createMockFile({ name: 'App.ts', extension: 'ts', loc: 150 }),
      ]),
      createMockDir('tests', [
        createMockFile({ name: 'app.test.ts', extension: 'ts', loc: 200 }),
      ]),
    ]);

    const result = calculateDirectoryStats(dir);

    expect(result.totalLoc).toBe(530);
    expect(result.filesByExt).toEqual({ tsx: 2, ts: 2 });
  });
});

describe('calculateMaxDepth', () => {
  it('should return 0 for a file', () => {
    const file = createMockFile();
    expect(calculateMaxDepth(file)).toBe(0);
  });

  it('should return 0 for flat directory', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'a.ts' }),
      createMockFile({ name: 'b.ts' }),
    ]);

    expect(calculateMaxDepth(dir)).toBe(1); // Files are at depth 1 from root (depth 0)
  });

  it('should calculate depth for nested directories', () => {
    const dir = createMockDir('root', [
      createMockDir('level1', [
        createMockDir('level2', [
          createMockFile({ name: 'deep.ts' }),
        ]),
      ]),
    ]);

    expect(calculateMaxDepth(dir)).toBe(3); // root(0) -> level1(1) -> level2(2) -> file(3)
  });

  it('should handle unbalanced tree', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'shallow.ts' }),
      createMockDir('deep', [
        createMockDir('deeper', [
          createMockDir('deepest', [
            createMockFile({ name: 'file.ts' }),
          ]),
        ]),
      ]),
    ]);

    expect(calculateMaxDepth(dir)).toBe(4); // root(0) -> deep(1) -> deeper(2) -> deepest(3) -> file(4)
  });

  it('should handle empty directory', () => {
    const dir = createMockDir('root', []);
    expect(calculateMaxDepth(dir)).toBe(0);
  });
});

describe('countDirectories', () => {
  it('should return 0 for a file', () => {
    const file = createMockFile();
    expect(countDirectories(file)).toBe(0);
  });

  it('should count single directory', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'a.ts' }),
    ]);

    expect(countDirectories(dir)).toBe(1);
  });

  it('should count nested directories', () => {
    const dir = createMockDir('root', [
      createMockDir('src', [
        createMockFile({ name: 'a.ts' }),
      ]),
      createMockDir('tests', [
        createMockFile({ name: 'b.ts' }),
      ]),
    ]);

    expect(countDirectories(dir)).toBe(3); // root + src + tests
  });

  it('should count deeply nested directories', () => {
    const dir = createMockDir('root', [
      createMockDir('level1', [
        createMockDir('level2', [
          createMockDir('level3', [
            createMockFile({ name: 'deep.ts' }),
          ]),
        ]),
      ]),
    ]);

    expect(countDirectories(dir)).toBe(4); // root + level1 + level2 + level3
  });

  it('should handle empty directory', () => {
    const dir = createMockDir('root', []);
    expect(countDirectories(dir)).toBe(1); // Just the root
  });
});

describe('collectModificationDates', () => {
  it('should collect dates from all files', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'a.ts', lastModified: '2024-01-01' }),
      createMockFile({ name: 'b.ts', lastModified: '2024-01-02' }),
      createMockFile({ name: 'c.ts', lastModified: '2024-01-03' }),
    ]);

    const dates = collectModificationDates(dir);

    expect(dates).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('should skip files without modification dates', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'a.ts', lastModified: '2024-01-01' }),
      createMockFile({ name: 'b.ts', lastModified: null }),
      createMockFile({ name: 'c.ts', lastModified: '2024-01-03' }),
    ]);

    const dates = collectModificationDates(dir);

    expect(dates).toEqual(['2024-01-01', '2024-01-03']);
  });

  it('should collect dates from nested directories', () => {
    const dir = createMockDir('root', [
      createMockDir('src', [
        createMockFile({ name: 'main.ts', lastModified: '2024-01-01' }),
        createMockFile({ name: 'utils.ts', lastModified: '2024-01-02' }),
      ]),
      createMockFile({ name: 'index.ts', lastModified: '2024-01-03' }),
    ]);

    const dates = collectModificationDates(dir);

    expect(dates).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('should return empty array for empty directory', () => {
    const dir = createMockDir('root', []);
    const dates = collectModificationDates(dir);
    expect(dates).toEqual([]);
  });

  it('should return empty array when no files have dates', () => {
    const dir = createMockDir('root', [
      createMockFile({ name: 'a.ts', lastModified: null }),
      createMockFile({ name: 'b.ts', lastModified: null }),
    ]);

    const dates = collectModificationDates(dir);

    expect(dates).toEqual([]);
  });
});
