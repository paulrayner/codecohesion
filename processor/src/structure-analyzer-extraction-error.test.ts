/**
 * RED gate test: extraction errors (non-I/O) must propagate out of
 * StructureAnalyzer.analyze(), not be silently swallowed as parse errors.
 *
 * This test is isolated in its own file because it uses vi.mock('tree-sitter')
 * which replaces the module for the entire file — incompatible with the real
 * tree-sitter usage in structure-analyzer.test.ts (Suites 1-6).
 *
 * Bug being tested: the catch block in StructureAnalyzer.analyze() currently
 * catches ALL errors and increments parseErrors. This means a TypeError thrown
 * inside extractImports() (a logic/assertion error, not an I/O error) is
 * silently counted as a parse error instead of propagating to the caller.
 *
 * The fix requires distinguishing I/O errors (swallow → parseErrors++) from
 * non-I/O logic errors (propagate → re-throw).
 *
 * Note: execSync is used ONLY with hardcoded string arguments (no user input)
 * to set up temporary git repos for test isolation. This is safe test scaffolding,
 * consistent with the pattern in structure-analyzer.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// vi.mock must be at module scope (hoisted by vitest before imports).
// We replace tree-sitter with a factory that returns a Parser whose parse()
// returns a tree where rootNode.hasError is false (parse succeeds) but whose
// rootNode.namedChildren getter throws a TypeError. This simulates a non-I/O
// logic error inside extractImports() — the kind the catch block must NOT
// swallow as a parse error.
// ---------------------------------------------------------------------------

vi.mock('tree-sitter', () => {
  const fakeRoot = {
    hasError: false,
    // namedChildren is accessed inside extractImports() and extractFunctions().
    // Throwing here simulates a non-I/O internal error during extraction.
    get namedChildren(): never {
      throw new TypeError(
        'Simulated non-I/O extraction failure: namedChildren is corrupt',
      );
    },
  };

  class MockParser {
    setLanguage(_lang: unknown): void {
      // No-op — language setting is not exercised in this test.
    }

    parse(_source: string): { rootNode: typeof fakeRoot } {
      return { rootNode: fakeRoot };
    }
  }

  return { default: MockParser };
});

// Also mock tree-sitter-typescript so StructureAnalyzer can import it without
// loading the native binary — only needed to satisfy the require() call.
vi.mock('tree-sitter-typescript', () => ({
  default: { typescript: {} },
  typescript: {},
}));

// StructureAnalyzer is imported AFTER vi.mock so it picks up the mocked modules.
import { StructureAnalyzer } from './structure-analyzer';

// ---------------------------------------------------------------------------
// Helpers — mirror the pattern in structure-analyzer.test.ts
// ---------------------------------------------------------------------------

function makeTempRepo(): string {
  const { execSync } = require('child_process') as typeof import('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codecohesion-extraction-err-'));
  // All arguments are hardcoded string literals — no user input involved.
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

function writeFile(repoDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function cleanupDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Suite — extraction error propagation
// ---------------------------------------------------------------------------

describe('StructureAnalyzer — extraction errors propagate (not swallowed as parse errors)', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = makeTempRepo();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  it('propagates a TypeError thrown during import extraction, not counted as a parse error', async () => {
    // Write a valid TypeScript source file. The mocked Parser will return a
    // tree where rootNode.hasError = false, so the catch block is entered via
    // the TypeError thrown by namedChildren — not via a hasError early-exit.
    writeFile(
      repoDir,
      'src/widget.ts',
      `import { useState } from 'react';\nexport function widget() {}\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);

    // RED gate assertion: the implementation currently swallows the TypeError
    // and increments parseErrors. After the fix, analyze() must reject with
    // the TypeError so callers can distinguish logic bugs from bad input files.
    await expect(analyzer.analyze()).rejects.toThrow(TypeError);
  });

  it('does not increment parseErrors when a non-I/O TypeError propagates', async () => {
    // Complementary assertion: if the error is swallowed (current behaviour),
    // parseErrors will be 1 and no rejection occurs. After the fix, the error
    // propagates and parseErrors is never incremented (the error escapes
    // before the graph is returned).
    writeFile(
      repoDir,
      'src/service.ts',
      `export function service() {}\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);

    // The implementation must throw, NOT return a graph with parseErrors: 1.
    // If this resolves successfully, the bug is still present.
    await expect(analyzer.analyze()).rejects.toThrow(TypeError);
  });
});
