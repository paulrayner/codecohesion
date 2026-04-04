/**
 * Pace Layer color functions.
 *
 * Maps the four canonical pace layers (Foundation, Infrastructure, Domain,
 * Surface) to fixed hex colors. Files without a pace layer annotation receive
 * a neutral gray fallback so they remain visually distinct from any named layer.
 */

import type { ColorInfo } from '../colorModeManager';

/** Hex color assigned to each canonical pace layer. */
const PACE_LAYER_COLOR_MAP: Record<string, string> = {
  Foundation: '#3b82f6',
  Infrastructure: '#8b5cf6',
  Domain: '#f59e0b',
  Surface: '#ef4444',
};

/** Neutral fallback for files that carry no pace layer annotation. */
const FALLBACK_COLOR = '#6b7280';

/**
 * Returns the hex color for a given pace layer string.
 * Unrecognised, empty, null, or undefined values return a neutral gray
 * fallback that is distinct from every named-layer color.
 */
export function getPaceLayerColor(layer: string | null | undefined): string {
  if (!layer) {
    return FALLBACK_COLOR;
  }
  return PACE_LAYER_COLOR_MAP[layer] ?? FALLBACK_COLOR;
}

/**
 * Returns the ordered legend items for the pace layer color mode.
 * Order is stable: Foundation → Infrastructure → Domain → Surface.
 */
export function getPaceLayerLegend(): ColorInfo[] {
  return [
    { name: 'Foundation', hex: '#3b82f6' },
    { name: 'Infrastructure', hex: '#8b5cf6' },
    { name: 'Domain', hex: '#f59e0b' },
    { name: 'Surface', hex: '#ef4444' },
  ];
}

