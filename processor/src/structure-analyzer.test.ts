/**
 * Behavioral tests for StructureAnalyzer.analyze() — static structure extraction.
 *
 * Verifies extraction of ImportEdge entries (internal vs external) and
 * FunctionDecl entries (function, arrow, class, method) with correct metadata.
 * Syntax-error files are skipped with a warning. Relative imports are resolved;
 * bare specifiers are marked external.
 *
 * Architectural boundary: these tests exercise the public API of
 * StructureAnalyzer only — no assertions on internal parsing state.
 *
 * Note: execSync is used ONLY with hardcoded string arguments (no user input)
 * to set up temporary git repos for test isolation. This is safe test scaffolding.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// StructureAnalyzer does not exist yet — this import satisfies RED gate.
import { StructureAnalyzer } from './structure-analyzer';
import type { StructureGraph, ImportEdge, FunctionDecl } from './structure-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temporary directory, git-initialise it, and return its path. */
function makeTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codecohesion-test-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

/** Write a file inside the temp repo and return its absolute path. */
function writeFile(repoDir: string, relativePath: string, content: string): string {
  const fullPath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

/** Remove a directory tree. */
function cleanupDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Suite 1 — ImportEdge extraction: internal vs external
// ---------------------------------------------------------------------------

describe('StructureAnalyzer — ImportEdge extraction', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = makeTempRepo();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  it('returns one external ImportEdge for a bare specifier (e.g. "react")', async () => {
    writeFile(
      repoDir,
      'src/app.ts',
      `import { useState } from 'react';\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const reactEdge = graph.imports.find(
      (e: ImportEdge) => e.toRaw === 'react',
    );
    expect(reactEdge).toBeDefined();
    expect(reactEdge!.isExternal).toBe(true);
    expect(reactEdge!.from).toContain('src/app.ts');
  });

  it('returns one internal ImportEdge for a relative specifier (e.g. "./analyze")', async () => {
    // Create both files so the relative path is resolvable
    writeFile(repoDir, 'src/analyze.ts', `export function buildTree() {}\n`);
    writeFile(
      repoDir,
      'src/app.ts',
      `import { buildTree } from './analyze';\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const internalEdge = graph.imports.find(
      (e: ImportEdge) => e.toRaw === './analyze',
    );
    expect(internalEdge).toBeDefined();
    expect(internalEdge!.isExternal).toBe(false);
    // Resolved path should point at analyze.ts (repo-relative)
    expect(internalEdge!.to).toMatch(/analyze\.ts$/);
  });

  it('returns two ImportEdge entries when a file has both an external and an internal import', async () => {
    writeFile(repoDir, 'src/analyze.ts', `export function buildTree() {}\n`);
    writeFile(
      repoDir,
      'src/app.ts',
      [
        `import { useState } from 'react';`,
        `import { buildTree } from './analyze';`,
      ].join('\n'),
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const fromApp = graph.imports.filter((e: ImportEdge) =>
      e.from.endsWith('src/app.ts'),
    );
    expect(fromApp).toHaveLength(2);

    const externalEdges = fromApp.filter((e: ImportEdge) => e.isExternal);
    const internalEdges = fromApp.filter((e: ImportEdge) => !e.isExternal);
    expect(externalEdges).toHaveLength(1);
    expect(internalEdges).toHaveLength(1);
  });

  it('captures named symbols from a named import', async () => {
    writeFile(
      repoDir,
      'src/widget.ts',
      `import { useState, useEffect } from 'react';\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const edge = graph.imports.find(
      (e: ImportEdge) => e.toRaw === 'react',
    );
    expect(edge).toBeDefined();
    expect(edge!.symbols).toContain('useState');
    expect(edge!.symbols).toContain('useEffect');
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — FunctionDecl extraction: function and arrow kinds
// ---------------------------------------------------------------------------

describe('StructureAnalyzer — FunctionDecl extraction (function and arrow)', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = makeTempRepo();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  it('extracts a named function declaration with correct kind, name, params, and isExported', async () => {
    writeFile(
      repoDir,
      'src/utils.ts',
      `export function foo(a: string, b: number) {}\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const fooDecl = graph.functions.find(
      (f: FunctionDecl) => f.name === 'foo',
    );
    expect(fooDecl).toBeDefined();
    expect(fooDecl!.kind).toBe('function');
    expect(fooDecl!.isExported).toBe(true);
    expect(fooDecl!.params).toContain('a');
    expect(fooDecl!.params).toContain('b');
    expect(fooDecl!.file).toMatch(/src\/utils\.ts$/);
  });

  it('extracts an arrow function declaration with kind "arrow"', async () => {
    writeFile(
      repoDir,
      'src/utils.ts',
      `const bar = (x: number) => x * 2;\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const barDecl = graph.functions.find(
      (f: FunctionDecl) => f.name === 'bar',
    );
    expect(barDecl).toBeDefined();
    expect(barDecl!.kind).toBe('arrow');
    expect(barDecl!.params).toContain('x');
  });

  it('marks a non-exported function with isExported: false', async () => {
    writeFile(
      repoDir,
      'src/internal.ts',
      `function privateHelper(val: string) { return val; }\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const helperDecl = graph.functions.find(
      (f: FunctionDecl) => f.name === 'privateHelper',
    );
    expect(helperDecl).toBeDefined();
    expect(helperDecl!.isExported).toBe(false);
  });

  it('returns two FunctionDecl entries for a file with one function and one arrow', async () => {
    writeFile(
      repoDir,
      'src/mixed.ts',
      [
        `export function foo(a: string) {}`,
        `const bar = (x: number) => x;`,
      ].join('\n'),
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const fromFile = graph.functions.filter((f: FunctionDecl) =>
      f.file.endsWith('src/mixed.ts'),
    );
    expect(fromFile).toHaveLength(2);

    const kinds = fromFile.map((f: FunctionDecl) => f.kind).sort();
    expect(kinds).toContain('function');
    expect(kinds).toContain('arrow');
  });

  it('records correct 1-based line numbers for declarations', async () => {
    writeFile(
      repoDir,
      'src/lines.ts',
      [
        `// line 1 — comment`,
        `export function alpha() {}`,
        `export function beta() {}`,
      ].join('\n'),
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const alpha = graph.functions.find((f: FunctionDecl) => f.name === 'alpha');
    const beta = graph.functions.find((f: FunctionDecl) => f.name === 'beta');
    expect(alpha).toBeDefined();
    expect(beta).toBeDefined();
    expect(alpha!.line).toBe(2);
    expect(beta!.line).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — FunctionDecl extraction: class and method kinds
// ---------------------------------------------------------------------------

describe('StructureAnalyzer — FunctionDecl extraction (class and method)', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = makeTempRepo();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  it('extracts a class declaration as a FunctionDecl with kind "function" or "constructor"', async () => {
    writeFile(
      repoDir,
      'src/myClass.ts',
      [
        `export class MyClass {`,
        `  method() {}`,
        `}`,
      ].join('\n'),
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    // Class itself should produce at least one entry
    const classOrConstructorEntry = graph.functions.find(
      (f: FunctionDecl) =>
        f.name === 'MyClass' ||
        (f.file.endsWith('src/myClass.ts') && f.kind === 'constructor'),
    );
    expect(classOrConstructorEntry).toBeDefined();
    expect(classOrConstructorEntry!.file).toMatch(/src\/myClass\.ts$/);
  });

  it('extracts a method inside a class with kind "method"', async () => {
    writeFile(
      repoDir,
      'src/service.ts',
      [
        `export class MyClass {`,
        `  method() {}`,
        `}`,
      ].join('\n'),
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const methodDecl = graph.functions.find(
      (f: FunctionDecl) => f.name === 'method' && f.kind === 'method',
    );
    expect(methodDecl).toBeDefined();
    expect(methodDecl!.file).toMatch(/src\/service\.ts$/);
  });

  it('captures method parameter names', async () => {
    writeFile(
      repoDir,
      'src/svc.ts',
      [
        `export class SomeService {`,
        `  process(input: string, count: number) {}`,
        `}`,
      ].join('\n'),
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const processDecl = graph.functions.find(
      (f: FunctionDecl) => f.name === 'process',
    );
    expect(processDecl).toBeDefined();
    expect(processDecl!.params).toContain('input');
    expect(processDecl!.params).toContain('count');
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Syntax error handling
// ---------------------------------------------------------------------------

describe('StructureAnalyzer — syntax error handling', () => {
  let repoDir: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    repoDir = makeTempRepo();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    cleanupDir(repoDir);
  });

  it('does not throw when a file contains syntax errors', async () => {
    writeFile(
      repoDir,
      'src/broken.ts',
      `export function bad( { unclosed syntax ERROR >>>`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    // Must not throw
    await expect(analyzer.analyze()).resolves.toBeDefined();
  });

  it('produces no imports or functions for a syntax-error file', async () => {
    writeFile(
      repoDir,
      'src/broken.ts',
      `export function bad( { unclosed syntax ERROR >>>`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const brokenImports = graph.imports.filter((e: ImportEdge) =>
      e.from.endsWith('src/broken.ts'),
    );
    const brokenFunctions = graph.functions.filter((f: FunctionDecl) =>
      f.file.endsWith('src/broken.ts'),
    );
    expect(brokenImports).toHaveLength(0);
    expect(brokenFunctions).toHaveLength(0);
  });

  it('records a parse error in analysis.parseErrors', async () => {
    writeFile(
      repoDir,
      'src/broken.ts',
      `export function bad( { unclosed syntax ERROR >>>`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(graph.analysis.parseErrors).toBeGreaterThanOrEqual(1);
  });

  it('still processes valid files when one file has a syntax error', async () => {
    writeFile(
      repoDir,
      'src/broken.ts',
      `export function bad( { unclosed syntax ERROR >>>`,
    );
    writeFile(
      repoDir,
      'src/valid.ts',
      `export function goodFn(x: number) { return x; }\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const goodDecl = graph.functions.find(
      (f: FunctionDecl) => f.name === 'goodFn',
    );
    expect(goodDecl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Multi-file relative import resolution
// ---------------------------------------------------------------------------

describe('StructureAnalyzer — relative import resolution across multiple files', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = makeTempRepo();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  it('resolves a sibling-directory relative import to the correct repo-relative path', async () => {
    writeFile(repoDir, 'src/utils/helpers.ts', `export function help() {}\n`);
    writeFile(
      repoDir,
      'src/core/service.ts',
      `import { help } from '../utils/helpers';\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const edge = graph.imports.find(
      (e: ImportEdge) => e.toRaw === '../utils/helpers',
    );
    expect(edge).toBeDefined();
    expect(edge!.isExternal).toBe(false);
    // Resolved to repo-relative path pointing at helpers.ts
    expect(edge!.to).toMatch(/src\/utils\/helpers\.ts$/);
  });

  it('resolves imports correctly when files are in different directories', async () => {
    writeFile(repoDir, 'lib/db.ts', `export const db = {};\n`);
    writeFile(
      repoDir,
      'api/server.ts',
      `import { db } from '../lib/db';\n`,
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    const edge = graph.imports.find(
      (e: ImportEdge) => e.toRaw === '../lib/db',
    );
    expect(edge).toBeDefined();
    expect(edge!.isExternal).toBe(false);
    expect(edge!.to).toMatch(/lib\/db\.ts$/);
    expect(edge!.from).toMatch(/api\/server\.ts$/);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — StructureGraph format and analysis stats
// ---------------------------------------------------------------------------

// NOTE: Suite 7 (extraction error propagation) is appended after Suite 6.

describe('StructureAnalyzer — StructureGraph output format', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = makeTempRepo();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  it('returns format: "structure-v1"', async () => {
    writeFile(repoDir, 'src/index.ts', `export function main() {}\n`);

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(graph.format).toBe('structure-v1');
  });

  it('includes an ISO 8601 analyzedAt timestamp', async () => {
    writeFile(repoDir, 'src/index.ts', `export function main() {}\n`);

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(typeof graph.analyzedAt).toBe('string');
    // ISO 8601 dates contain a 'T' separator
    expect(graph.analyzedAt).toMatch(/T/);
    expect(new Date(graph.analyzedAt).getTime()).not.toBeNaN();
  });

  it('sets repositoryPath to the absolute path passed to the constructor', async () => {
    writeFile(repoDir, 'src/index.ts', `export function main() {}\n`);

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(graph.repositoryPath).toBe(repoDir);
  });

  it('sets analysis.filesAnalyzed to the number of TS/JS files examined', async () => {
    writeFile(repoDir, 'src/a.ts', `export function a() {}\n`);
    writeFile(repoDir, 'src/b.ts', `export function b() {}\n`);

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(graph.analysis.filesAnalyzed).toBe(2);
  });

  it('sets analysis.importEdges to the total count of imports found', async () => {
    writeFile(
      repoDir,
      'src/a.ts',
      `import { useState } from 'react';\nimport { foo } from './b';\n`,
    );
    writeFile(repoDir, 'src/b.ts', `export function foo() {}\n`);

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(graph.analysis.importEdges).toBe(graph.imports.length);
    expect(graph.analysis.importEdges).toBeGreaterThanOrEqual(2);
  });

  it('sets analysis.functionDecls to the total count of function declarations', async () => {
    writeFile(
      repoDir,
      'src/funcs.ts',
      [
        `export function alpha() {}`,
        `export function beta() {}`,
        `const gamma = () => {};`,
      ].join('\n'),
    );

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(graph.analysis.functionDecls).toBe(graph.functions.length);
    expect(graph.analysis.functionDecls).toBeGreaterThanOrEqual(3);
  });

  it('sets analysis.parseErrors to 0 when all files parse cleanly', async () => {
    writeFile(repoDir, 'src/clean.ts', `export function ok() {}\n`);

    const analyzer = new StructureAnalyzer(repoDir);
    const graph: StructureGraph = await analyzer.analyze();

    expect(graph.analysis.parseErrors).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Non-I/O extraction errors must propagate, not be swallowed
// ---------------------------------------------------------------------------
// NOTE: This suite is in a separate file to isolate vi.mock('tree-sitter')
// from the real tree-sitter usage in Suites 1-6. See:
// processor/src/structure-analyzer-extraction-error.test.ts
