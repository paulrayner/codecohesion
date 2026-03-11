/**
 * Architecture fitness tests for processor/src/
 *
 * These tests enforce structural invariants so refactoring doesn't introduce
 * god objects. They inspect source files directly using fs — no AST parsing,
 * just line counting.
 *
 * Invariants enforced:
 *   4. Every *.ts file in processor/src/ (excluding test files) is <= 700 LOC
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Resolve the src directory relative to this test file at runtime
const SRC_DIR = path.resolve(__dirname);

/** Return all *.ts source files in a directory, excluding test files. */
function collectSourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name: string) => {
      if (!name.endsWith('.ts')) return false;
      if (name.endsWith('.test.ts')) return false;
      return true;
    })
    .map((name: string) => path.join(dir, name));
}

/** Count lines in a file. */
function countLines(filePath: string): number {
  const contents = fs.readFileSync(filePath, 'utf8');
  return contents.split('\n').length;
}

// ---------------------------------------------------------------------------
// Collect files once for all tests
// ---------------------------------------------------------------------------

const sourceFiles = collectSourceFiles(SRC_DIR);

// ---------------------------------------------------------------------------
// Invariant 4: Every processor src file is <= 700 LOC
// ---------------------------------------------------------------------------

describe('Architecture: processor file size limit', () => {
  it('should have at least one processor source file to test', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  sourceFiles.forEach((filePath: string) => {
    const fileName = path.basename(filePath);
    it(`${fileName} should be <= 700 lines`, () => {
      const lineCount = countLines(filePath);
      expect(lineCount, `${fileName} has ${lineCount} lines — exceeds 700 LOC limit`).toBeLessThanOrEqual(700);
    });
  });
});
