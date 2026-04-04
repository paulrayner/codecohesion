import type { CouplingEdge } from '../coupling-types';

/**
 * Computes the normalized shear stress between two files based on their
 * commit velocities. Returns a value in [0, 1] representing how differently
 * the two files evolve — 0 means identical velocity, 1 means maximum divergence.
 *
 * Formula: |vA - vB| / max(vA, vB), with 0/0 defined as 0.
 */
export function computeShearStress(velocityA: number, velocityB: number): number {
  const maxVelocity = Math.max(velocityA, velocityB);
  if (maxVelocity === 0) return 0;
  return Math.abs(velocityA - velocityB) / maxVelocity;
}

/**
 * Maps a stress value in [0, 1] to a hex color on a green→amber→red gradient.
 * Out-of-range inputs are clamped to [0, 1] before mapping.
 *
 * Hue interpolation: green (120°) at 0 → red (0°) at 1.
 */
export function getStressColor(stress: number): string {
  // Clamp and handle NaN defensively
  const clamped = isNaN(stress) ? 0 : Math.max(0, Math.min(1, stress));

  // Interpolate hue from 120 (green) down to 0 (red)
  const hue = Math.round(120 * (1 - clamped));
  return hslToHex(hue, 100, 45);
}

/** Converts HSL values to a 6-digit hex color string. */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  const toHex = (n: number): string =>
    Math.round((n + m) * 255).toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** A coupling edge enriched with a computed shear stress score. */
export interface StressEdge extends CouplingEdge {
  stress: number;
}

/**
 * Filters and enriches coupling edges with shear stress scores.
 * Only edges whose stress exceeds the given threshold are returned,
 * sorted by stress descending (highest stress first).
 *
 * Each input edge must carry velocityA and velocityB properties.
 */
export function getStressEdges(
  couplingEdges: Array<CouplingEdge & { velocityA: number; velocityB: number }>,
  threshold: number,
): StressEdge[] {
  return couplingEdges
    .map((edge) => ({
      ...edge,
      stress: computeShearStress(edge.velocityA, edge.velocityB),
    }))
    .filter((edge) => edge.stress > threshold)
    .sort((a, b) => b.stress - a.stress);
}
