import { describe, it, expect } from 'vitest';
import { computeShearStress, getStressColor, getStressEdges } from './shear-stress';
import type { CouplingEdge } from '../coupling-types';

// Helpers
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Extracts the HSL hue (0-360) from a hex color string by converting through RGB.
 * Used to verify that returned colors fall in the expected hue range.
 */
function hueFromHex(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue: number;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return hue;
}

/**
 * Builds a minimal CouplingEdge for use in stress edge filtering tests.
 */
function makeEdge(
  fileA: string,
  fileB: string,
  velocityA: number,
  velocityB: number,
): CouplingEdge & { velocityA: number; velocityB: number } {
  return {
    fileA,
    fileB,
    coChangeCount: 1,
    coupling: 0.5,
    velocityA,
    velocityB,
  };
}

// ---------------------------------------------------------------------------
// computeShearStress — invariant: result is always in [0, 1]
// ---------------------------------------------------------------------------

describe('computeShearStress', () => {
  it('returns a value in [0, 1] for arbitrary positive velocities', () => {
    // Property: stress is always a normalized score
    const stress = computeShearStress(10, 30);
    expect(stress).toBeGreaterThanOrEqual(0);
    expect(stress).toBeLessThanOrEqual(1);
  });

  it('two files with the same non-zero velocity → stress = 0', () => {
    // No velocity difference means no shear between the files
    expect(computeShearStress(5, 5)).toBe(0);
  });

  it('one file with velocity 0 and the other non-zero → stress = 1', () => {
    // Maximum shear: one file is completely static while the other changes freely
    expect(computeShearStress(0, 8)).toBe(1);
  });

  it('symmetric: stress(a, b) === stress(b, a)', () => {
    // Shear is directionally neutral — order of arguments must not matter
    expect(computeShearStress(3, 12)).toBe(computeShearStress(12, 3));
  });

  it('both velocities zero → stress = 0 (no division by zero)', () => {
    // Degenerate case: two static files have no relative shear
    expect(() => computeShearStress(0, 0)).not.toThrow();
    expect(computeShearStress(0, 0)).toBe(0);
  });

  it('stress formula: |vA - vB| / max(vA, vB) for typical values', () => {
    // Validates the exact formula against a known result
    // |4 - 12| / max(4, 12) = 8 / 12 ≈ 0.6667
    const expected = Math.abs(4 - 12) / Math.max(4, 12);
    expect(computeShearStress(4, 12)).toBeCloseTo(expected, 10);
  });

  it('equal velocities of large magnitude → stress = 0', () => {
    // Invariant holds regardless of the magnitude of the velocities
    expect(computeShearStress(1000, 1000)).toBe(0);
  });

  it('one velocity is much larger than the other → stress approaches 1', () => {
    // Near-maximum shear when velocities are highly asymmetric
    const stress = computeShearStress(1, 1000);
    expect(stress).toBeGreaterThan(0.99);
    expect(stress).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// getStressColor — maps [0, 1] stress to a traffic-light palette
// ---------------------------------------------------------------------------

describe('getStressColor', () => {
  it('stress = 0 returns a green hex color', () => {
    // Low stress should be visually calm (green hue ~120°)
    const color = getStressColor(0);
    expect(color).toMatch(HEX_COLOR_PATTERN);
    const hue = hueFromHex(color);
    // Green hues are roughly 90°–150°
    expect(hue).toBeGreaterThanOrEqual(90);
    expect(hue).toBeLessThanOrEqual(150);
  });

  it('stress = 1.0 returns a red hex color', () => {
    // High stress should be visually urgent (red hue near 0° or 360°)
    const color = getStressColor(1);
    expect(color).toMatch(HEX_COLOR_PATTERN);
    const hue = hueFromHex(color);
    // Red hues are 0°–30° or 330°–360°
    expect(hue <= 30 || hue >= 330).toBe(true);
  });

  it('stress = 0.5 returns an amber/yellow hex color', () => {
    // Mid-range stress should be amber/yellow (hue roughly 30°–70°)
    const color = getStressColor(0.5);
    expect(color).toMatch(HEX_COLOR_PATTERN);
    const hue = hueFromHex(color);
    expect(hue).toBeGreaterThanOrEqual(30);
    expect(hue).toBeLessThanOrEqual(70);
  });

  it('returns a valid 6-digit hex string for all boundary values', () => {
    // Output format invariant: always a 6-digit hex color
    expect(getStressColor(0)).toMatch(HEX_COLOR_PATTERN);
    expect(getStressColor(0.5)).toMatch(HEX_COLOR_PATTERN);
    expect(getStressColor(1)).toMatch(HEX_COLOR_PATTERN);
  });

  it('does not throw for out-of-range inputs (clamps gracefully)', () => {
    // Defensive clamping: invalid inputs must not crash
    expect(() => getStressColor(-1)).not.toThrow();
    expect(() => getStressColor(2)).not.toThrow();
    expect(() => getStressColor(NaN)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getStressEdges — filters coupling edges above a configurable threshold
// ---------------------------------------------------------------------------

describe('getStressEdges', () => {
  const edges = [
    makeEdge('a.ts', 'b.ts', 2, 10),   // stress = |2-10|/10 = 0.8
    makeEdge('c.ts', 'd.ts', 5, 5),    // stress = 0
    makeEdge('e.ts', 'f.ts', 1, 4),    // stress = |1-4|/4 = 0.75
    makeEdge('g.ts', 'h.ts', 0, 0),    // stress = 0 (both zero)
  ];

  it('returns only edges whose stress exceeds the threshold', () => {
    // Threshold 0.7: edges a↔b (0.8) and e↔f (0.75) should pass; others filtered
    const result = getStressEdges(edges, 0.7);
    expect(result.length).toBe(2);
  });

  it('threshold = 0 returns all edges with stress > 0', () => {
    // At the zero threshold, only edges with actual shear are included
    const result = getStressEdges(edges, 0);
    // c↔d and g↔h both have stress = 0, so they are excluded at threshold 0
    result.forEach(({ stress }) => {
      expect(stress).toBeGreaterThan(0);
    });
  });

  it('threshold = 1 returns no edges', () => {
    // Nothing can exceed maximum stress of 1
    const result = getStressEdges(edges, 1);
    expect(result.length).toBe(0);
  });

  it('returns objects that include the original edge fields and a stress property', () => {
    // Each result must carry both the original CouplingEdge data and the computed stress
    const result = getStressEdges(edges, 0.5);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((item) => {
      expect(item).toHaveProperty('fileA');
      expect(item).toHaveProperty('fileB');
      expect(item).toHaveProperty('coChangeCount');
      expect(item).toHaveProperty('coupling');
      expect(item).toHaveProperty('stress');
      expect(typeof item.stress).toBe('number');
    });
  });

  it('results are sorted by stress descending', () => {
    // Highest-stress edges should appear first for prioritized rendering
    const result = getStressEdges(edges, 0);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].stress).toBeGreaterThanOrEqual(result[i].stress);
    }
  });

  it('handles an empty edge array without throwing', () => {
    expect(() => getStressEdges([], 0.5)).not.toThrow();
    expect(getStressEdges([], 0.5)).toEqual([]);
  });
});
