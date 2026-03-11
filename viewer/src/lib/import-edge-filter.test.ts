import { describe, it, expect } from 'vitest';
import { filterImportEdges } from './import-edge-filter';

/**
 * Inline type mirroring processor's ImportEdge — the viewer lib must not
 * import from processor directly (architecture fitness constraint).
 */
interface ImportEdge {
  from: string;
  to: string;
  toRaw: string;
  symbols: string[];
  isExternal: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEdge(from: string, to: string, isExternal: boolean): ImportEdge {
  return { from, to, toRaw: to, symbols: [], isExternal };
}

/** Build N edges with predictable from/to values for sort-order testing. */
function makeEdges(count: number): ImportEdge[] {
  return Array.from({ length: count }, (_, i) => {
    // Zero-pad so lexicographic sort matches numeric sort for these tests
    const n = String(i).padStart(6, '0');
    return makeEdge(`src/file${n}.ts`, `src/dep${n}.ts`, i % 2 === 0);
  });
}

// ---------------------------------------------------------------------------
// Suite 1 — maxEdges cap with deterministic sort
// ---------------------------------------------------------------------------

describe('filterImportEdges — maxEdges cap', () => {
  it('returns exactly maxEdges entries when input exceeds cap', () => {
    const edges = makeEdges(1000);
    const result = filterImportEdges(edges, { maxEdges: 500 });
    expect(result).toHaveLength(500);
  });

  it('returns edges sorted deterministically by from+to', () => {
    const edges = makeEdges(1000);
    const result = filterImportEdges(edges, { maxEdges: 500 });

    // Verify the returned slice is sorted ascending by from, then to
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      const prevKey = prev.from + prev.to;
      const currKey = curr.from + curr.to;
      expect(prevKey <= currKey).toBe(true);
    }
  });

  it('is deterministic: two calls with the same input return identical results', () => {
    const edges = makeEdges(1000);
    const first = filterImportEdges(edges, { maxEdges: 500 });
    const second = filterImportEdges(edges, { maxEdges: 500 });
    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — internalOnly filter
// ---------------------------------------------------------------------------

describe('filterImportEdges — internalOnly filter', () => {
  it('returns only isExternal: false entries when internalOnly is true', () => {
    const edges = [
      makeEdge('src/a.ts', 'src/b.ts', false),
      makeEdge('src/a.ts', 'react', true),
      makeEdge('src/c.ts', 'src/d.ts', false),
      makeEdge('src/c.ts', 'lodash', true),
    ];

    const result = filterImportEdges(edges, { internalOnly: true });

    expect(result).toHaveLength(2);
    result.forEach((edge) => expect(edge.isExternal).toBe(false));
  });

  it('returns empty array when all edges are external and internalOnly is true', () => {
    const edges = [
      makeEdge('src/a.ts', 'react', true),
      makeEdge('src/b.ts', 'lodash', true),
    ];

    const result = filterImportEdges(edges, { internalOnly: true });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — externalOnly filter
// ---------------------------------------------------------------------------

describe('filterImportEdges — externalOnly filter', () => {
  it('returns only isExternal: true entries when externalOnly is true', () => {
    const edges = [
      makeEdge('src/a.ts', 'src/b.ts', false),
      makeEdge('src/a.ts', 'react', true),
      makeEdge('src/c.ts', 'src/d.ts', false),
      makeEdge('src/c.ts', 'lodash', true),
    ];

    const result = filterImportEdges(edges, { externalOnly: true });

    expect(result).toHaveLength(2);
    result.forEach((edge) => expect(edge.isExternal).toBe(true));
  });

  it('returns empty array when all edges are internal and externalOnly is true', () => {
    const edges = [
      makeEdge('src/a.ts', 'src/b.ts', false),
      makeEdge('src/c.ts', 'src/d.ts', false),
    ];

    const result = filterImportEdges(edges, { externalOnly: true });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — empty input
// ---------------------------------------------------------------------------

describe('filterImportEdges — empty input', () => {
  it('returns empty array when input is empty with no options', () => {
    expect(filterImportEdges([], {})).toEqual([]);
  });

  it('returns empty array when input is empty with maxEdges set', () => {
    expect(filterImportEdges([], { maxEdges: 100 })).toEqual([]);
  });

  it('returns empty array when input is empty with internalOnly set', () => {
    expect(filterImportEdges([], { internalOnly: true })).toEqual([]);
  });

  it('returns empty array when input is empty with externalOnly set', () => {
    expect(filterImportEdges([], { externalOnly: true })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — no options returns all edges unchanged
// ---------------------------------------------------------------------------

describe('filterImportEdges — no options', () => {
  it('returns all edges when called with an empty options object', () => {
    const edges = makeEdges(10);
    const result = filterImportEdges(edges, {});
    expect(result).toHaveLength(10);
  });

  it('preserves every edge from the input when no options constrain output', () => {
    const edges = [
      makeEdge('src/a.ts', 'src/b.ts', false),
      makeEdge('src/a.ts', 'react', true),
    ];
    const result = filterImportEdges(edges, {});
    expect(result).toEqual(expect.arrayContaining(edges));
    expect(result).toHaveLength(edges.length);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — maxEdges larger than array length returns all edges
// ---------------------------------------------------------------------------

describe('filterImportEdges — maxEdges larger than input', () => {
  it('returns all edges when maxEdges exceeds input length', () => {
    const edges = makeEdges(5);
    const result = filterImportEdges(edges, { maxEdges: 1000 });
    expect(result).toHaveLength(5);
  });

  it('returns all edges when maxEdges equals input length exactly', () => {
    const edges = makeEdges(7);
    const result = filterImportEdges(edges, { maxEdges: 7 });
    expect(result).toHaveLength(7);
  });
});
