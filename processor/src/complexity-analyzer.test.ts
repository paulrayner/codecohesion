/**
 * Behavioral tests for ComplexityAnalyzer — cyclomatic complexity, cognitive
 * complexity (Sonar algorithm), hotspot scoring, and ComplexityReport output format.
 *
 * Tests exercise the public API of ComplexityAnalyzer only — no assertions on
 * internal AST traversal state.
 *
 * Cyclomatic complexity: counts branching nodes (if, for, while, switch case,
 * catch, &&, ||, ??) + 1 base per function.
 *
 * Cognitive complexity (Sonar): structural control-flow increments that carry
 * a nesting depth bonus. Flat sequential ifs score 1 each; nested structures
 * accumulate (increment + current_depth).
 *
 * Hotspot scoring: normalizes totalCyclomatic and commitCount to [0, 1] across
 * all files, then multiplies: hotspotScore = complexityScore × churnScore.
 *
 * Architectural boundary: tests import ComplexityAnalyzer and ComplexityReport
 * only — no internal parser or AST types.
 */

import { describe, it, expect } from 'vitest';

// ComplexityAnalyzer does not exist yet — this import satisfies the RED gate.
import { ComplexityAnalyzer } from './complexity-analyzer';
import type { ComplexityReport, FileComplexity, HotspotEntry } from './complexity-types';
import type { StructureGraph, FunctionDecl } from './structure-types';
import type { RepositorySnapshot, DirectoryNode, FileNode } from '@codecohesion/shared-types';

// ---------------------------------------------------------------------------
// Fixtures — minimal StructureGraph and RepositorySnapshot builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal StructureGraph fixture containing the provided function
 * declarations. The body source for each function is keyed by a composite key
 * of the form `${file}::${name}::${line}` to prevent collisions when two
 * different files contain functions with the same name.
 */
function makeStructureGraph(
  functions: FunctionDecl[],
  functionBodies: Record<string, string> = {},
): StructureGraph & { functionBodies: Record<string, string> } {
  return {
    format: 'structure-v1',
    repositoryPath: '/repo',
    analyzedAt: new Date().toISOString(),
    analysis: {
      filesAnalyzed: 1,
      importEdges: 0,
      functionDecls: functions.length,
      parseErrors: 0,
    },
    imports: [],
    functions,
    functionBodies,
  };
}

/**
 * Build a composite body key for a FunctionDecl. The key format is
 * `${file}::${name}::${line}` — unique per declaration even when two files
 * share a function name.
 */
function bodyKey(decl: FunctionDecl): string {
  return `${decl.file}::${decl.name}::${decl.line}`;
}

/**
 * Build a minimal FileNode fixture.
 */
function makeFileNode(filePath: string, commitCount: number): FileNode {
  return {
    path: filePath,
    name: filePath.split('/').pop() ?? filePath,
    type: 'file',
    loc: 10,
    extension: '.ts',
    lastModified: null,
    lastAuthor: null,
    lastCommitHash: null,
    commitCount,
    contributorCount: null,
    firstCommitDate: null,
    recentLinesChanged: null,
    avgLinesPerCommit: null,
    daysSinceLastModified: null,
  };
}

/**
 * Build a minimal RepositorySnapshot containing the given file nodes at the
 * top level of the tree.
 */
function makeSnapshot(fileNodes: FileNode[]): RepositorySnapshot {
  const tree: DirectoryNode = {
    path: '/repo',
    name: 'repo',
    type: 'directory',
    children: fileNodes,
  };

  return {
    repositoryPath: '/repo',
    commit: 'abc123',
    timestamp: new Date().toISOString(),
    author: 'Test',
    message: 'test commit',
    tree,
    commitMessages: {},
    stats: {
      totalFiles: fileNodes.length,
      totalLoc: fileNodes.reduce((sum, f) => sum + f.loc, 0),
      filesByExtension: { '.ts': fileNodes.length },
    },
  };
}

// ---------------------------------------------------------------------------
// Suite 1 — Cyclomatic complexity
// ---------------------------------------------------------------------------

describe('ComplexityAnalyzer — cyclomatic complexity', () => {
  it('scores 5 for a function with 3 if statements and 1 for loop (3 + 1 branches + 1 base)', () => {
    // Body: 3 ifs + 1 for = 4 branching nodes, base = 1, total = 5
    const body = `
      function processItems(items) {
        if (items.length === 0) { return; }
        for (let i = 0; i < items.length; i++) {
          if (items[i] > 0) {
            if (items[i] > 100) { /* noop */ }
          }
        }
      }
    `;

    const funcDecl: FunctionDecl = {
      file: 'src/process.ts',
      name: 'processItems',
      kind: 'function',
      line: 1,
      endLine: 10,
      params: ['items'],
      isExported: false,
    };

    const graph = makeStructureGraph([funcDecl], { [bodyKey(funcDecl)]: body });
    const snapshot = makeSnapshot([makeFileNode('src/process.ts', 5)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const fileResult = report.files.find(
      (f: FileComplexity) => f.file === 'src/process.ts',
    );
    expect(fileResult).toBeDefined();

    const fnResult = fileResult!.functions.find(
      (f) => f.name === 'processItems',
    );
    expect(fnResult).toBeDefined();
    expect(fnResult!.cyclomatic).toBe(5);
  });

  it('increments cyclomatic complexity for && and || logical operators', () => {
    // Body: 1 if + 1 && + 1 || = 3 branching nodes, base = 1, total = 4
    const body = `
      function check(a, b, c) {
        if (a > 0 && b > 0 || c > 0) { return true; }
        return false;
      }
    `;

    const funcDecl: FunctionDecl = {
      file: 'src/check.ts',
      name: 'check',
      kind: 'function',
      line: 1,
      endLine: 5,
      params: ['a', 'b', 'c'],
      isExported: false,
    };

    const graph = makeStructureGraph([funcDecl], { [bodyKey(funcDecl)]: body });
    const snapshot = makeSnapshot([makeFileNode('src/check.ts', 3)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const fileResult = report.files.find(
      (f: FileComplexity) => f.file === 'src/check.ts',
    );
    expect(fileResult).toBeDefined();

    const fnResult = fileResult!.functions.find((f) => f.name === 'check');
    expect(fnResult).toBeDefined();
    // 1 if + 1 && + 1 || = 3 branches + 1 base = 4
    expect(fnResult!.cyclomatic).toBe(4);
  });

  it('increments cyclomatic complexity for the ?? (nullish coalescing) operator', () => {
    // Body: 1 ?? operator = 1 branch, base = 1, total = 2
    const body = `
      function getDefault(value) {
        return value ?? 'default';
      }
    `;

    const funcDecl: FunctionDecl = {
      file: 'src/default.ts',
      name: 'getDefault',
      kind: 'function',
      line: 1,
      endLine: 4,
      params: ['value'],
      isExported: false,
    };

    const graph = makeStructureGraph([funcDecl], { [bodyKey(funcDecl)]: body });
    const snapshot = makeSnapshot([makeFileNode('src/default.ts', 1)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const fileResult = report.files.find(
      (f: FileComplexity) => f.file === 'src/default.ts',
    );
    const fnResult = fileResult?.functions.find(
      (f) => f.name === 'getDefault',
    );
    expect(fnResult).toBeDefined();
    // 1 ?? + 1 base = 2
    expect(fnResult!.cyclomatic).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Cognitive complexity (Sonar algorithm)
// ---------------------------------------------------------------------------

describe('ComplexityAnalyzer — cognitive complexity', () => {
  it('scores 6 for nested if inside for inside if (1 + (1+1) + (1+2) = 6)', () => {
    // Sonar nesting increments:
    //   outer if: depth=0 → increment = 1+0 = 1
    //   for loop: depth=1 → increment = 1+1 = 2
    //   inner if: depth=2 → increment = 1+2 = 3
    //   total = 1 + 2 + 3 = 6
    const body = `
      function nested(items, flag) {
        if (flag) {
          for (let i = 0; i < items.length; i++) {
            if (items[i] > 0) {
              /* noop */
            }
          }
        }
      }
    `;

    const funcDecl: FunctionDecl = {
      file: 'src/nested.ts',
      name: 'nested',
      kind: 'function',
      line: 1,
      endLine: 10,
      params: ['items', 'flag'],
      isExported: false,
    };

    const graph = makeStructureGraph([funcDecl], { [bodyKey(funcDecl)]: body });
    const snapshot = makeSnapshot([makeFileNode('src/nested.ts', 2)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const fileResult = report.files.find(
      (f: FileComplexity) => f.file === 'src/nested.ts',
    );
    const fnResult = fileResult?.functions.find((f) => f.name === 'nested');
    expect(fnResult).toBeDefined();
    expect(fnResult!.cognitive).toBe(6);
  });

  it('scores 1 per flat sequential if (no nesting bonus)', () => {
    // Sonar: each if at depth=0 → increment = 1+0 = 1 each
    // 3 flat ifs → total cognitive = 3
    const body = `
      function flatChecks(a, b, c) {
        if (a > 0) { /* noop */ }
        if (b > 0) { /* noop */ }
        if (c > 0) { /* noop */ }
      }
    `;

    const funcDecl: FunctionDecl = {
      file: 'src/flat.ts',
      name: 'flatChecks',
      kind: 'function',
      line: 1,
      endLine: 6,
      params: ['a', 'b', 'c'],
      isExported: false,
    };

    const graph = makeStructureGraph([funcDecl], { [bodyKey(funcDecl)]: body });
    const snapshot = makeSnapshot([makeFileNode('src/flat.ts', 1)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const fileResult = report.files.find(
      (f: FileComplexity) => f.file === 'src/flat.ts',
    );
    const fnResult = fileResult?.functions.find((f) => f.name === 'flatChecks');
    expect(fnResult).toBeDefined();
    // 3 flat ifs at depth 0 → 1 + 1 + 1 = 3
    expect(fnResult!.cognitive).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Hotspot scoring
// ---------------------------------------------------------------------------

describe('ComplexityAnalyzer — hotspot scoring', () => {
  it('ranks the file with highest complexity AND highest churn first in hotspots[]', () => {
    // File A: high complexity body (3 ifs + 1 for = cyclomatic 5), high churn (50 commits)
    const highComplexityBody = `
      function heavyFn(items) {
        if (items.length === 0) { return; }
        for (let i = 0; i < items.length; i++) {
          if (items[i] > 0) {
            if (items[i] > 100) { /* noop */ }
          }
        }
      }
    `;

    // File B: trivial body (no branches = cyclomatic 1), low churn (1 commit)
    const lowComplexityBody = `
      function trivialFn(x) {
        return x;
      }
    `;

    const highFn: FunctionDecl = {
      file: 'src/heavy.ts',
      name: 'heavyFn',
      kind: 'function',
      line: 1,
      endLine: 10,
      params: ['items'],
      isExported: true,
    };

    const lowFn: FunctionDecl = {
      file: 'src/trivial.ts',
      name: 'trivialFn',
      kind: 'function',
      line: 1,
      endLine: 3,
      params: ['x'],
      isExported: true,
    };

    const graph = makeStructureGraph(
      [highFn, lowFn],
      {
        [bodyKey(highFn)]: highComplexityBody,
        [bodyKey(lowFn)]: lowComplexityBody,
      },
    );

    const snapshot = makeSnapshot([
      makeFileNode('src/heavy.ts', 50),   // high churn
      makeFileNode('src/trivial.ts', 1),  // low churn
    ]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    expect(report.hotspots.length).toBeGreaterThanOrEqual(2);
    // The high complexity + high churn file must rank first
    expect(report.hotspots[0].file).toBe('src/heavy.ts');
  });

  it('hotspot scores are in descending order', () => {
    const highBody = `
      function heavyFn(items) {
        if (items.length === 0) { return; }
        for (let i = 0; i < items.length; i++) {
          if (items[i] > 0) {
            if (items[i] > 100) { /* noop */ }
          }
        }
      }
    `;

    const lowBody = `
      function trivialFn(x) { return x; }
    `;

    const highFn: FunctionDecl = {
      file: 'src/heavy.ts',
      name: 'heavyFn',
      kind: 'function',
      line: 1,
      endLine: 10,
      params: ['items'],
      isExported: true,
    };

    const lowFn: FunctionDecl = {
      file: 'src/trivial.ts',
      name: 'trivialFn',
      kind: 'function',
      line: 1,
      endLine: 3,
      params: ['x'],
      isExported: true,
    };

    const graph = makeStructureGraph(
      [highFn, lowFn],
      {
        [bodyKey(highFn)]: highBody,
        [bodyKey(lowFn)]: lowBody,
      },
    );

    const snapshot = makeSnapshot([
      makeFileNode('src/heavy.ts', 50),
      makeFileNode('src/trivial.ts', 1),
    ]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    for (let i = 0; i < report.hotspots.length - 1; i++) {
      expect(report.hotspots[i].hotspotScore).toBeGreaterThanOrEqual(
        report.hotspots[i + 1].hotspotScore,
      );
    }
  });

  it('hotspotScore is the product of complexityScore and churnScore (both in 0-1)', () => {
    const body = `
      function fn(x) {
        if (x > 0) { return x; }
        return 0;
      }
    `;

    const funcDecl: FunctionDecl = {
      file: 'src/single.ts',
      name: 'fn',
      kind: 'function',
      line: 1,
      endLine: 5,
      params: ['x'],
      isExported: true,
    };

    const graph = makeStructureGraph(
      [funcDecl],
      { [bodyKey(funcDecl)]: body },
    );

    const snapshot = makeSnapshot([makeFileNode('src/single.ts', 10)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const hotspot = report.hotspots.find(
      (h: HotspotEntry) => h.file === 'src/single.ts',
    );
    expect(hotspot).toBeDefined();
    expect(hotspot!.complexityScore).toBeGreaterThanOrEqual(0);
    expect(hotspot!.complexityScore).toBeLessThanOrEqual(1);
    expect(hotspot!.churnScore).toBeGreaterThanOrEqual(0);
    expect(hotspot!.churnScore).toBeLessThanOrEqual(1);
    // hotspotScore must equal the product
    expect(hotspot!.hotspotScore).toBeCloseTo(
      hotspot!.complexityScore * hotspot!.churnScore,
      10,
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — ComplexityReport output format
// ---------------------------------------------------------------------------

describe('ComplexityAnalyzer — ComplexityReport output format', () => {
  it('analyze(structureGraph, snapshot) returns a ComplexityReport with format: "complexity-v1"', () => {
    const funcDecl: FunctionDecl = {
      file: 'src/index.ts',
      name: 'main',
      kind: 'function',
      line: 1,
      endLine: 3,
      params: [],
      isExported: true,
    };

    const graph = makeStructureGraph([funcDecl], { [bodyKey(funcDecl)]: 'function main() {}' });
    const snapshot = makeSnapshot([makeFileNode('src/index.ts', 1)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    expect(report.format).toBe('complexity-v1');
  });

  it('ComplexityReport includes repositoryPath, analyzedAt, analysis, files, and hotspots', () => {
    const funcDecl: FunctionDecl = {
      file: 'src/index.ts',
      name: 'main',
      kind: 'function',
      line: 1,
      endLine: 3,
      params: [],
      isExported: true,
    };

    const graph = makeStructureGraph([funcDecl], { [bodyKey(funcDecl)]: 'function main() {}' });
    const snapshot = makeSnapshot([makeFileNode('src/index.ts', 1)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    expect(typeof report.repositoryPath).toBe('string');
    expect(typeof report.analyzedAt).toBe('string');
    // analyzedAt must be a valid ISO 8601 date
    expect(new Date(report.analyzedAt).getTime()).not.toBeNaN();
    expect(report.analysis).toBeDefined();
    expect(typeof report.analysis.filesAnalyzed).toBe('number');
    expect(typeof report.analysis.functionsAnalyzed).toBe('number');
    expect(Array.isArray(report.files)).toBe(true);
    expect(Array.isArray(report.hotspots)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Files with no functions
// ---------------------------------------------------------------------------

describe('ComplexityAnalyzer — files with no functions', () => {
  it('produces a FileComplexity with all zeros for a file that has no functions', () => {
    // StructureGraph with no functions declared for the file
    const graph = makeStructureGraph([], {});
    const snapshot = makeSnapshot([makeFileNode('src/empty.ts', 3)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const fileResult = report.files.find(
      (f: FileComplexity) => f.file === 'src/empty.ts',
    );
    expect(fileResult).toBeDefined();
    expect(fileResult!.totalCyclomatic).toBe(0);
    expect(fileResult!.totalCognitive).toBe(0);
    expect(fileResult!.maxCyclomatic).toBe(0);
    expect(fileResult!.maxCognitive).toBe(0);
    expect(fileResult!.functionCount).toBe(0);
    expect(fileResult!.functions).toHaveLength(0);
  });

  it('includes files with no functions in the hotspots list with complexityScore of 0', () => {
    const graph = makeStructureGraph([], {});
    const snapshot = makeSnapshot([makeFileNode('src/empty.ts', 3)]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    const hotspot = report.hotspots.find(
      (h: HotspotEntry) => h.file === 'src/empty.ts',
    );
    expect(hotspot).toBeDefined();
    expect(hotspot!.complexityScore).toBe(0);
    // hotspotScore = 0 * churnScore = 0
    expect(hotspot!.hotspotScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Key collision: two files with identically-named functions
// ---------------------------------------------------------------------------

describe('ComplexityAnalyzer — key collision: same function name in two files', () => {
  it('preserves body for both functions when two files each declare handleClick', () => {
    // RED gate: the implementation uses decl.name as the functionBodies key,
    // so the second handleClick body overwrites the first. Both functions must
    // receive their own body and produce non-zero cyclomatic complexity.
    const bodyA = `
      function handleClick(event) {
        if (event.target) {
          if (event.shiftKey) { return; }
        }
        return true;
      }
    `;
    // bodyA: 2 ifs + 1 base = cyclomatic 3

    const bodyB = `
      function handleClick(evt) {
        if (evt.preventDefault) {
          evt.preventDefault();
        }
        return false;
      }
    `;
    // bodyB: 1 if + 1 base = cyclomatic 2

    const declA: FunctionDecl = {
      file: 'src/component-a.ts',
      name: 'handleClick',
      kind: 'function',
      line: 1,
      endLine: 8,
      params: ['event'],
      isExported: false,
    };

    const declB: FunctionDecl = {
      file: 'src/component-b.ts',
      name: 'handleClick',
      kind: 'function',
      line: 1,
      endLine: 7,
      params: ['evt'],
      isExported: false,
    };

    // Composite keys prevent collision: each decl gets its own body entry.
    const graph = makeStructureGraph(
      [declA, declB],
      {
        [bodyKey(declA)]: bodyA,
        [bodyKey(declB)]: bodyB,
      },
    );

    const snapshot = makeSnapshot([
      makeFileNode('src/component-a.ts', 5),
      makeFileNode('src/component-b.ts', 3),
    ]);

    const analyzer = new ComplexityAnalyzer();
    const report: ComplexityReport = analyzer.analyze(graph, snapshot);

    // File A: handleClick should have cyclomatic 3 (2 ifs + base)
    const fileA = report.files.find((f: FileComplexity) => f.file === 'src/component-a.ts');
    expect(fileA).toBeDefined();
    const fnA = fileA!.functions.find((f) => f.name === 'handleClick');
    expect(fnA).toBeDefined();
    expect(fnA!.cyclomatic).toBe(3);

    // File B: handleClick should have cyclomatic 2 (1 if + base)
    const fileB = report.files.find((f: FileComplexity) => f.file === 'src/component-b.ts');
    expect(fileB).toBeDefined();
    const fnB = fileB!.functions.find((f) => f.name === 'handleClick');
    expect(fnB).toBeDefined();
    expect(fnB!.cyclomatic).toBe(2);

    // Both must be non-zero — a collision would leave one of them with cyclomatic 1
    // (the empty-body fallback) or give both the same wrong value.
    expect(fnA!.cyclomatic).not.toBe(fnB!.cyclomatic);
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Math.max scalability: >100,000 files must not stack-overflow
// ---------------------------------------------------------------------------

describe('ComplexityAnalyzer — Math.max scalability with large file counts', () => {
  it('does not throw RangeError when buildHotspots() is called with >100,000 files', () => {
    // RED gate: the implementation uses Math.max(...files.map(...)) which
    // passes all values as individual function arguments. V8 has a maximum
    // call stack argument count (~124,000 on this runtime), so spreading an
    // array larger than that throws "RangeError: Maximum call stack size
    // exceeded". 200,000 reliably exceeds the V8 limit on all tested platforms.
    const FILE_COUNT = 200_000;

    // Build 110,000 file nodes, all with distinct paths and commit counts of 1.
    const fileNodes: FileNode[] = Array.from({ length: FILE_COUNT }, (_, i) => ({
      path: `src/file-${i}.ts`,
      name: `file-${i}.ts`,
      type: 'file' as const,
      loc: 5,
      extension: '.ts',
      lastModified: null,
      lastAuthor: null,
      lastCommitHash: null,
      commitCount: 1,
      contributorCount: null,
      firstCommitDate: null,
      recentLinesChanged: null,
      avgLinesPerCommit: null,
      daysSinceLastModified: null,
    }));

    // No function declarations — each file contributes totalCyclomatic = 0.
    // This exercises the Math.max spread over files[] and fileNodes[].
    const graph = makeStructureGraph([], {});
    const snapshot = makeSnapshot(fileNodes);

    const analyzer = new ComplexityAnalyzer();

    // Must not throw RangeError: Maximum call stack size exceeded
    expect(() => analyzer.analyze(graph, snapshot)).not.toThrow();
  });
});
