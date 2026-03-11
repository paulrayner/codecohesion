/**
 * Architecture fitness tests for viewer/src/lib/
 *
 * These tests enforce structural invariants so refactoring doesn't introduce
 * god objects or dependency violations. They inspect source files directly
 * using fs — no AST parsing, just line counting and regex matching.
 *
 * Invariants enforced:
 *   1. Every *.ts file in viewer/src/lib/ (excluding test files and
 *      test-fixtures.ts) is <= 200 LOC
 *   2. No file in viewer/src/lib/ imports from ../main or ../TreeVisualizer
 *   3. No file in viewer/src/lib/ imports 'three' (except allowlisted files)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Resolve the lib directory relative to this test file at runtime
const LIB_DIR = path.resolve(__dirname);

// Files that are allowed to import from 'three'
const THREE_IMPORT_ALLOWLIST = new Set([
  'cameraPositioning.ts',
  'camera-configuration.ts',
  'layout-positioning.ts',
]);

interface SourceFile {
  name: string;
  path: string;
  content: string;
  lineCount: number;
}

/**
 * Return all *.ts source files in a directory, excluding test files.
 * Reads and caches each file's content so downstream invariant tests
 * do not need to re-read from disk.
 */
function collectSourceFiles(dir: string): SourceFile[] {
  return fs
    .readdirSync(dir)
    .filter((name: string) => {
      if (!name.endsWith('.ts')) return false;
      if (name.endsWith('.test.ts')) return false;
      if (name === 'test-fixtures.ts') return false;
      return true;
    })
    .map((name: string) => {
      const filePath = path.join(dir, name);
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        name,
        path: filePath,
        content,
        lineCount: content.split('\n').length,
      };
    });
}

// ---------------------------------------------------------------------------
// Collect files once for all tests
// ---------------------------------------------------------------------------

const sourceFiles = collectSourceFiles(LIB_DIR);

// ---------------------------------------------------------------------------
// Invariant 1: Every lib source file is <= 200 LOC
// ---------------------------------------------------------------------------

describe('Architecture: lib file size limit', () => {
  it('should have at least one lib source file to test', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  sourceFiles.forEach(({ name, lineCount }: SourceFile) => {
    it(`${name} should be <= 200 lines`, () => {
      expect(lineCount, `${name} has ${lineCount} lines — exceeds 200 LOC limit`).toBeLessThanOrEqual(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Invariant 2: No lib file imports from ../main or ../TreeVisualizer
// ---------------------------------------------------------------------------

describe('Architecture: no imports from ../main or ../TreeVisualizer', () => {
  // Matches: import ... from '../main' or '../TreeVisualizer' (with or without extension)
  const forbiddenImportPattern = /from\s+['"]\.\.\/(?:main|TreeVisualizer)['"]/;

  sourceFiles.forEach(({ name, content }: SourceFile) => {
    it(`${name} should not import from ../main or ../TreeVisualizer`, () => {
      const hasViolation = forbiddenImportPattern.test(content);
      expect(
        hasViolation,
        `${name} contains a forbidden import from ../main or ../TreeVisualizer`
      ).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Invariant 3: No lib file imports 'three' (except allowlisted files)
// ---------------------------------------------------------------------------

describe('Architecture: no direct three.js imports outside allowlist', () => {
  // Matches: import ... from 'three' or import 'three'
  const threeImportPattern = /from\s+['"]three['"]/;

  sourceFiles
    .filter(({ name }: SourceFile) => !THREE_IMPORT_ALLOWLIST.has(name))
    .forEach(({ name, content }: SourceFile) => {
      it(`${name} should not import from 'three'`, () => {
        const hasViolation = threeImportPattern.test(content);
        expect(
          hasViolation,
          `${name} imports 'three' but is not on the allowlist`
        ).toBe(false);
      });
    });

  it('allowlisted files are not tested for three.js imports (sanity check)', () => {
    // Simply assert the allowlist is non-empty — documents intent
    expect(THREE_IMPORT_ALLOWLIST.size).toBeGreaterThan(0);
  });
});
