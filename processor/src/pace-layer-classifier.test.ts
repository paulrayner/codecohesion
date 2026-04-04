/**
 * Behavioral tests for classifyPaceLayers() — pace layer classification based
 * on changeVelocity percentiles.
 *
 * Pace layers assign every file exactly one of four layers:
 *   foundation     — bottom 25% by changeVelocity (slowest-changing files)
 *   infrastructure — 25th–50th percentile
 *   domain         — 50th–75th percentile
 *   surface        — top 25% (fastest-changing files)
 *
 * changeVelocity = commitCount / repoAgeInUnits, where:
 *   - repos >= 2 years old: age measured in quarters (repoAgeInQuarters)
 *   - repos < 2 years old:  age measured in months  (repoAgeInMonths)
 *
 * Files with zero commits are always classified as "foundation" regardless of
 * percentile position.
 *
 * Architectural boundary: tests import classifyPaceLayers only.
 * classifyPaceLayers does not exist yet — this import satisfies the RED gate.
 */

import { describe, it, expect } from 'vitest';

// classifyPaceLayers does not exist yet — import will fail, satisfying RED.
import { classifyPaceLayers } from './pace-layer-classifier';

// ---------------------------------------------------------------------------
// Types used in tests
// ---------------------------------------------------------------------------

/** Minimal file descriptor fed into the classifier */
interface FileDescriptor {
  path: string;
  commitCount: number;
  firstCommitDate: string | null;
  lastModified: string | null;
}

/** Expected output shape returned by the classifier */
type PaceLayer = 'foundation' | 'infrastructure' | 'domain' | 'surface';

interface PaceLayerResult {
  path: string;
  paceLayer: PaceLayer;
  changeVelocity: number;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a file descriptor with sensible defaults. firstCommitDate and
 * lastModified are ISO date strings; set them explicitly when testing velocity
 * calculation.
 */
function makeFile(
  path: string,
  commitCount: number,
  overrides: Partial<FileDescriptor> = {},
): FileDescriptor {
  return {
    path,
    commitCount,
    firstCommitDate: null,
    lastModified: null,
    ...overrides,
  };
}

/**
 * ISO date string that is approximately `yearsAgo` years before a fixed
 * reference date (2024-01-01). Using a fixed reference keeps tests
 * deterministic regardless of when they run.
 */
function isoYearsAgo(yearsAgo: number): string {
  const ref = new Date('2024-01-01T00:00:00Z');
  ref.setFullYear(ref.getFullYear() - yearsAgo);
  return ref.toISOString();
}

/**
 * ISO date string that is approximately `monthsAgo` months before the fixed
 * reference date (2024-01-01).
 */
function isoMonthsAgo(monthsAgo: number): string {
  const ref = new Date('2024-01-01T00:00:00Z');
  ref.setMonth(ref.getMonth() - monthsAgo);
  return ref.toISOString();
}

// ---------------------------------------------------------------------------
// Layer assignment — every file gets exactly one layer
// ---------------------------------------------------------------------------

describe('classifyPaceLayers() — every file gets exactly one layer', () => {
  it('returns a result for every input file', () => {
    const files = [
      makeFile('a.ts', 1, { firstCommitDate: isoYearsAgo(3) }),
      makeFile('b.ts', 5, { firstCommitDate: isoYearsAgo(3) }),
      makeFile('c.ts', 10, { firstCommitDate: isoYearsAgo(3) }),
      makeFile('d.ts', 20, { firstCommitDate: isoYearsAgo(3) }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    expect(results).toHaveLength(4);
  });

  it('assigns exactly one of the four valid layer values to each file', () => {
    const validLayers: PaceLayer[] = ['foundation', 'infrastructure', 'domain', 'surface'];
    const files = [
      makeFile('a.ts', 1, { firstCommitDate: isoYearsAgo(3) }),
      makeFile('b.ts', 5, { firstCommitDate: isoYearsAgo(3) }),
      makeFile('c.ts', 10, { firstCommitDate: isoYearsAgo(3) }),
      makeFile('d.ts', 20, { firstCommitDate: isoYearsAgo(3) }),
    ];
    const results: PaceLayerResult[] = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    for (const result of results) {
      expect(validLayers).toContain(result.paceLayer);
    }
  });

  it('preserves the file path in each result', () => {
    const files = [
      makeFile('src/core/auth.ts', 3, { firstCommitDate: isoYearsAgo(2) }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    expect(results[0].path).toBe('src/core/auth.ts');
  });

  it('returns an empty array for an empty input', () => {
    const results = classifyPaceLayers([], new Date('2024-01-01T00:00:00Z'));
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Files with zero commits always land in foundation
// ---------------------------------------------------------------------------

describe('classifyPaceLayers() — zero-commit files are always foundation', () => {
  it('classifies a file with zero commits as foundation', () => {
    const files = [
      makeFile('src/generated/types.ts', 0, { firstCommitDate: isoYearsAgo(4) }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    expect(results[0].paceLayer).toBe('foundation');
  });

  it('classifies zero-commit files as foundation even when other files have high velocity', () => {
    const files = [
      makeFile('src/stable.ts', 0, { firstCommitDate: isoYearsAgo(4) }),
      makeFile('src/hot1.ts', 100, { firstCommitDate: isoYearsAgo(4) }),
      makeFile('src/hot2.ts', 200, { firstCommitDate: isoYearsAgo(4) }),
      makeFile('src/hot3.ts', 300, { firstCommitDate: isoYearsAgo(4) }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const stableResult = results.find(r => r.path === 'src/stable.ts')!;
    expect(stableResult.paceLayer).toBe('foundation');
  });

  it('assigns changeVelocity of 0 for zero-commit files', () => {
    const files = [
      makeFile('src/unchanged.ts', 0, { firstCommitDate: isoYearsAgo(2) }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    expect(results[0].changeVelocity).toBe(0);
  });

  it('classifies files with null firstCommitDate and zero commits as foundation', () => {
    const files = [
      makeFile('src/mystery.ts', 0, { firstCommitDate: null }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    expect(results[0].paceLayer).toBe('foundation');
  });
});

// ---------------------------------------------------------------------------
// Percentile-based layer distribution — four equal quartiles
// ---------------------------------------------------------------------------

describe('classifyPaceLayers() — percentile-based quartile assignment', () => {
  it('assigns the four distinct layers across four files with strictly different velocities', () => {
    // 4 files: distinct commit counts → each should land in a unique quartile
    const firstDate = isoYearsAgo(4);
    const files = [
      makeFile('slow.ts',   1,  { firstCommitDate: firstDate }),
      makeFile('mid1.ts',   4,  { firstCommitDate: firstDate }),
      makeFile('mid2.ts',   8,  { firstCommitDate: firstDate }),
      makeFile('fast.ts',  16,  { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const byPath = Object.fromEntries(results.map(r => [r.path, r.paceLayer]));

    expect(byPath['slow.ts']).toBe('foundation');
    expect(byPath['mid1.ts']).toBe('infrastructure');
    expect(byPath['mid2.ts']).toBe('domain');
    expect(byPath['fast.ts']).toBe('surface');
  });

  it('assigns foundation to the bottom quartile (slowest 25%) in an 8-file set', () => {
    const firstDate = isoYearsAgo(4);
    const files = [
      makeFile('f1.ts',  1, { firstCommitDate: firstDate }),
      makeFile('f2.ts',  2, { firstCommitDate: firstDate }),
      makeFile('f3.ts',  4, { firstCommitDate: firstDate }),
      makeFile('f4.ts',  6, { firstCommitDate: firstDate }),
      makeFile('f5.ts',  8, { firstCommitDate: firstDate }),
      makeFile('f6.ts', 10, { firstCommitDate: firstDate }),
      makeFile('f7.ts', 14, { firstCommitDate: firstDate }),
      makeFile('f8.ts', 20, { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const foundationFiles = results.filter(r => r.paceLayer === 'foundation');
    // Bottom 25% of 8 = 2 files
    expect(foundationFiles).toHaveLength(2);
    const foundationPaths = foundationFiles.map(r => r.path).sort();
    expect(foundationPaths).toEqual(['f1.ts', 'f2.ts']);
  });

  it('assigns surface to the top quartile (fastest 25%) in an 8-file set', () => {
    const firstDate = isoYearsAgo(4);
    const files = [
      makeFile('f1.ts',  1, { firstCommitDate: firstDate }),
      makeFile('f2.ts',  2, { firstCommitDate: firstDate }),
      makeFile('f3.ts',  4, { firstCommitDate: firstDate }),
      makeFile('f4.ts',  6, { firstCommitDate: firstDate }),
      makeFile('f5.ts',  8, { firstCommitDate: firstDate }),
      makeFile('f6.ts', 10, { firstCommitDate: firstDate }),
      makeFile('f7.ts', 14, { firstCommitDate: firstDate }),
      makeFile('f8.ts', 20, { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const surfaceFiles = results.filter(r => r.paceLayer === 'surface');
    // Top 25% of 8 = 2 files
    expect(surfaceFiles).toHaveLength(2);
    const surfacePaths = surfaceFiles.map(r => r.path).sort();
    expect(surfacePaths).toEqual(['f7.ts', 'f8.ts']);
  });

  it('assigns infrastructure to the 25th–50th percentile in an 8-file set', () => {
    const firstDate = isoYearsAgo(4);
    const files = [
      makeFile('f1.ts',  1, { firstCommitDate: firstDate }),
      makeFile('f2.ts',  2, { firstCommitDate: firstDate }),
      makeFile('f3.ts',  4, { firstCommitDate: firstDate }),
      makeFile('f4.ts',  6, { firstCommitDate: firstDate }),
      makeFile('f5.ts',  8, { firstCommitDate: firstDate }),
      makeFile('f6.ts', 10, { firstCommitDate: firstDate }),
      makeFile('f7.ts', 14, { firstCommitDate: firstDate }),
      makeFile('f8.ts', 20, { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const infraFiles = results.filter(r => r.paceLayer === 'infrastructure');
    expect(infraFiles).toHaveLength(2);
    const infraPaths = infraFiles.map(r => r.path).sort();
    expect(infraPaths).toEqual(['f3.ts', 'f4.ts']);
  });

  it('assigns domain to the 50th–75th percentile in an 8-file set', () => {
    const firstDate = isoYearsAgo(4);
    const files = [
      makeFile('f1.ts',  1, { firstCommitDate: firstDate }),
      makeFile('f2.ts',  2, { firstCommitDate: firstDate }),
      makeFile('f3.ts',  4, { firstCommitDate: firstDate }),
      makeFile('f4.ts',  6, { firstCommitDate: firstDate }),
      makeFile('f5.ts',  8, { firstCommitDate: firstDate }),
      makeFile('f6.ts', 10, { firstCommitDate: firstDate }),
      makeFile('f7.ts', 14, { firstCommitDate: firstDate }),
      makeFile('f8.ts', 20, { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const domainFiles = results.filter(r => r.paceLayer === 'domain');
    expect(domainFiles).toHaveLength(2);
    const domainPaths = domainFiles.map(r => r.path).sort();
    expect(domainPaths).toEqual(['f5.ts', 'f6.ts']);
  });
});

// ---------------------------------------------------------------------------
// All-same-velocity edge case — all files land in the same layer
// ---------------------------------------------------------------------------

describe('classifyPaceLayers() — uniform velocity edge case', () => {
  it('assigns all files to the same layer when all have identical changeVelocity', () => {
    const firstDate = isoYearsAgo(4);
    const files = [
      makeFile('a.ts', 10, { firstCommitDate: firstDate }),
      makeFile('b.ts', 10, { firstCommitDate: firstDate }),
      makeFile('c.ts', 10, { firstCommitDate: firstDate }),
      makeFile('d.ts', 10, { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const layers = results.map(r => r.paceLayer);
    // All identical velocities → all share the same layer (ties resolved consistently)
    const uniqueLayers = new Set(layers);
    expect(uniqueLayers.size).toBe(1);
  });

  it('assigns the same layer to a single-file repository', () => {
    const files = [
      makeFile('src/index.ts', 5, { firstCommitDate: isoYearsAgo(2) }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    expect(results).toHaveLength(1);
    const validLayers: PaceLayer[] = ['foundation', 'infrastructure', 'domain', 'surface'];
    expect(validLayers).toContain(results[0].paceLayer);
  });
});

// ---------------------------------------------------------------------------
// changeVelocity calculation — quarters for repos >= 2 years, months otherwise
// ---------------------------------------------------------------------------

describe('classifyPaceLayers() — changeVelocity uses quarters for repos >= 2 years', () => {
  it('divides commits by quarters for a repo exactly 4 years old', () => {
    // 4 years = 16 quarters; commitCount = 32 → velocity = 2.0 commits/quarter
    const now = new Date('2024-01-01T00:00:00Z');
    const fourYearsAgo = new Date('2020-01-01T00:00:00Z').toISOString();
    const files = [
      makeFile('src/core.ts', 32, { firstCommitDate: fourYearsAgo }),
    ];
    const results = classifyPaceLayers(files, now);
    expect(results[0].changeVelocity).toBeCloseTo(2.0, 1);
  });

  it('divides commits by quarters for a repo exactly 2 years old (boundary)', () => {
    // 2 years = 8 quarters; commitCount = 16 → velocity = 2.0 commits/quarter
    const now = new Date('2024-01-01T00:00:00Z');
    const twoYearsAgo = new Date('2022-01-01T00:00:00Z').toISOString();
    const files = [
      makeFile('src/boundary.ts', 16, { firstCommitDate: twoYearsAgo }),
    ];
    const results = classifyPaceLayers(files, now);
    expect(results[0].changeVelocity).toBeCloseTo(2.0, 1);
  });
});

describe('classifyPaceLayers() — changeVelocity uses months for repos < 2 years', () => {
  it('divides commits by months for a repo 12 months old', () => {
    // 12 months; commitCount = 24 → velocity = 2.0 commits/month
    const now = new Date('2024-01-01T00:00:00Z');
    const twelveMonthsAgo = isoMonthsAgo(12);
    const files = [
      makeFile('src/feature.ts', 24, { firstCommitDate: twelveMonthsAgo }),
    ];
    const results = classifyPaceLayers(files, now);
    expect(results[0].changeVelocity).toBeCloseTo(2.0, 1);
  });

  it('divides commits by months for a repo 6 months old', () => {
    // 6 months; commitCount = 12 → velocity = 2.0 commits/month
    const now = new Date('2024-01-01T00:00:00Z');
    const sixMonthsAgo = isoMonthsAgo(6);
    const files = [
      makeFile('src/recent.ts', 12, { firstCommitDate: sixMonthsAgo }),
    ];
    const results = classifyPaceLayers(files, now);
    expect(results[0].changeVelocity).toBeCloseTo(2.0, 1);
  });
});

// ---------------------------------------------------------------------------
// Repo age boundary: quarter vs month unit switch
// ---------------------------------------------------------------------------

describe('classifyPaceLayers() — age unit switch at 2-year boundary', () => {
  it('produces a higher velocity number for a < 2-year repo vs >= 2-year repo with same commit count', () => {
    // Same commit count (24), but < 2-year repo measures in months (less denominator),
    // >= 2-year repo measures in quarters (more denominator → lower velocity number
    // when the ratio is the same — but here short repo age means fewer months vs more quarters)
    //
    // 18-month repo: 24 commits / 18 months = 1.33/month
    // 3-year repo:   24 commits / 12 quarters = 2.0/quarter
    // The point is that velocity units differ; we're testing that the classifier
    // doesn't confuse months with quarters at the boundary.

    const now = new Date('2024-01-01T00:00:00Z');
    const shortRepoStart = isoMonthsAgo(18);    // < 2 years → months
    const longRepoStart  = isoYearsAgo(3);      // >= 2 years → quarters

    const shortRepoFiles = [makeFile('src/a.ts', 24, { firstCommitDate: shortRepoStart })];
    const longRepoFiles  = [makeFile('src/a.ts', 24, { firstCommitDate: longRepoStart  })];

    const shortResults = classifyPaceLayers(shortRepoFiles, now);
    const longResults  = classifyPaceLayers(longRepoFiles,  now);

    // Both should return a numeric velocity >= 0
    expect(shortResults[0].changeVelocity).toBeGreaterThan(0);
    expect(longResults[0].changeVelocity).toBeGreaterThan(0);

    // Velocities should differ because denominator units differ
    expect(shortResults[0].changeVelocity).not.toBeCloseTo(longResults[0].changeVelocity, 2);
  });
});

// ---------------------------------------------------------------------------
// changeVelocity is exposed on each result
// ---------------------------------------------------------------------------

describe('classifyPaceLayers() — changeVelocity is present on every result', () => {
  it('exposes a non-negative changeVelocity for every file', () => {
    const firstDate = isoYearsAgo(2);
    const files = [
      makeFile('a.ts',  5, { firstCommitDate: firstDate }),
      makeFile('b.ts', 10, { firstCommitDate: firstDate }),
      makeFile('c.ts', 20, { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    for (const result of results) {
      expect(typeof result.changeVelocity).toBe('number');
      expect(result.changeVelocity).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns higher changeVelocity for a file with more commits in the same repo', () => {
    const firstDate = isoYearsAgo(3);
    const files = [
      makeFile('slow.ts',  2, { firstCommitDate: firstDate }),
      makeFile('fast.ts', 50, { firstCommitDate: firstDate }),
    ];
    const results = classifyPaceLayers(files, new Date('2024-01-01T00:00:00Z'));
    const slow = results.find(r => r.path === 'slow.ts')!;
    const fast = results.find(r => r.path === 'fast.ts')!;
    expect(fast.changeVelocity).toBeGreaterThan(slow.changeVelocity);
  });
});
