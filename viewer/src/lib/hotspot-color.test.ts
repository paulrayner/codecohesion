import { describe, it, expect } from 'vitest';
import { getHotspotColor, getComplexityColor } from './hotspot-color';

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

describe('getHotspotColor', () => {
  it('score 0 returns a cool (blue-ish) color with hue >= 200 degrees', () => {
    // Score 0 = "cold" end of the scale; blue hues signal low activity
    const color = getHotspotColor(0);
    expect(hueFromHex(color)).toBeGreaterThanOrEqual(200);
  });

  it('score 1 returns a hot (red-ish) color with hue <= 30 degrees', () => {
    // Score 1 = "hot" end of the scale; red hues signal high activity
    const color = getHotspotColor(1);
    expect(hueFromHex(color)).toBeLessThanOrEqual(30);
  });

  it('score 0.5 returns an intermediate color between cool and hot', () => {
    // The intermediate hue must sit between the cold and hot extremes
    const coldHue = hueFromHex(getHotspotColor(0));
    const hotHue = hueFromHex(getHotspotColor(1));
    const midHue = hueFromHex(getHotspotColor(0.5));

    // Mid hue should be strictly between hot and cold
    expect(midHue).toBeGreaterThan(hotHue);
    expect(midHue).toBeLessThan(coldHue);
  });

  it('NaN input clamps to a valid color without throwing', () => {
    // Defensive clamping: NaN must not cause a crash or an invalid hex
    expect(() => getHotspotColor(NaN)).not.toThrow();
    const color = getHotspotColor(NaN);
    expect(color).toMatch(HEX_COLOR_PATTERN);
  });

  it('negative input clamps to the 0-score color range', () => {
    // Values below 0 should behave identically to score 0 (clamp at bottom)
    const negativeColor = getHotspotColor(-1);
    const zeroColor = getHotspotColor(0);
    expect(negativeColor).toBe(zeroColor);
  });

  it('input > 1 clamps to the 1-score color range', () => {
    // Values above 1 should behave identically to score 1 (clamp at top)
    const overColor = getHotspotColor(2);
    const maxColor = getHotspotColor(1);
    expect(overColor).toBe(maxColor);
  });

  it('returns a valid 6-digit hex string for score 0', () => {
    expect(getHotspotColor(0)).toMatch(HEX_COLOR_PATTERN);
  });

  it('returns a valid 6-digit hex string for score 0.5', () => {
    expect(getHotspotColor(0.5)).toMatch(HEX_COLOR_PATTERN);
  });

  it('returns a valid 6-digit hex string for score 1', () => {
    expect(getHotspotColor(1)).toMatch(HEX_COLOR_PATTERN);
  });
});

describe('getComplexityColor', () => {
  it('score 0 of max returns a cool (blue-ish) color with hue >= 200 degrees', () => {
    // Complexity of 0 out of 100 = simplest possible file; should appear cool
    const color = getComplexityColor(0, 100);
    expect(hueFromHex(color)).toBeGreaterThanOrEqual(200);
  });

  it('score equal to max returns a hot (red-ish) color with hue <= 30 degrees', () => {
    // Complexity of 100 out of 100 = most complex file; should appear hot
    const color = getComplexityColor(100, 100);
    expect(hueFromHex(color)).toBeLessThanOrEqual(30);
  });

  it('returns a valid 6-digit hex string for score 0', () => {
    expect(getComplexityColor(0, 100)).toMatch(HEX_COLOR_PATTERN);
  });

  it('returns a valid 6-digit hex string for score equal to max', () => {
    expect(getComplexityColor(100, 100)).toMatch(HEX_COLOR_PATTERN);
  });

  it('returns a valid 6-digit hex string for mid-range score', () => {
    expect(getComplexityColor(50, 100)).toMatch(HEX_COLOR_PATTERN);
  });

  it('score above max clamps to the hot color range', () => {
    // Values beyond the maximum complexity should not produce out-of-range colors
    const overColor = getComplexityColor(200, 100);
    const maxColor = getComplexityColor(100, 100);
    expect(overColor).toBe(maxColor);
  });

  it('negative score clamps to the cool color range', () => {
    // Negative complexity is invalid; must clamp gracefully to the bottom
    const negativeColor = getComplexityColor(-10, 100);
    const zeroColor = getComplexityColor(0, 100);
    expect(negativeColor).toBe(zeroColor);
  });
});
