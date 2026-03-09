/**
 * Hotspot and complexity color functions.
 *
 * Maps a normalized [0, 1] score to a hex color by interpolating hue in HSL
 * space from a cool blue (score = 0, low activity) to a hot red (score = 1,
 * high activity). No Three.js dependency — pure HSL math.
 */

// Hue boundaries: cool end (blue-ish, ~240°) and hot end (red-ish, ~0°/360°)
const HUE_COOL = 240;
const HUE_HOT = 0;
const SATURATION = 70;
const LIGHTNESS = 50;

/**
 * Converts HSL values to a 6-digit hex color string.
 * Follows the standard HSL-to-RGB algorithm (h in [0,360], s/l in [0,100]).
 */
function hslToHex(hDeg: number, sDeg: number, lDeg: number): string {
  const s = sDeg / 100;
  const l = lDeg / 100;

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hDeg / 60) % 2) - 1));
  const m = l - chroma / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hDeg < 60) {
    [r, g, b] = [chroma, x, 0];
  } else if (hDeg < 120) {
    [r, g, b] = [x, chroma, 0];
  } else if (hDeg < 180) {
    [r, g, b] = [0, chroma, x];
  } else if (hDeg < 240) {
    [r, g, b] = [0, x, chroma];
  } else if (hDeg < 300) {
    [r, g, b] = [x, 0, chroma];
  } else {
    [r, g, b] = [chroma, 0, x];
  }

  const toHexByte = (channel: number): string =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/**
 * Maps a normalized score in [0, 1] to a hex color interpolated between a
 * cool blue (0) and hot red (1). Values outside [0, 1] — including NaN — are
 * clamped to the valid range before interpolation.
 */
export function getHotspotColor(score: number): string {
  // Clamp NaN and out-of-range values; NaN comparisons always return false so
  // the fallback `|| 0` converts NaN to 0 after the Math.min/max chain.
  const clamped = Math.min(1, Math.max(0, isNaN(score) ? 0 : score));
  const hue = HUE_COOL + (HUE_HOT - HUE_COOL) * clamped;
  return hslToHex(hue, SATURATION, LIGHTNESS);
}

/**
 * Maps an absolute complexity score relative to a maximum to a hex color.
 * Normalizes score/max to [0, 1] then delegates to getHotspotColor.
 * Out-of-range or negative scores are clamped gracefully.
 */
export function getComplexityColor(score: number, max: number): string {
  const normalized = max > 0 ? score / max : 0;
  return getHotspotColor(normalized);
}
