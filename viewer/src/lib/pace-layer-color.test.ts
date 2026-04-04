import { describe, it, expect } from 'vitest';
import { getPaceLayerColor, getPaceLayerLegend } from './pace-layer-color';

// The four canonical pace layers and their specified hex colors
const PACE_LAYER_COLORS: Record<string, string> = {
  Foundation: '#3b82f6',
  Infrastructure: '#8b5cf6',
  Domain: '#f59e0b',
  Surface: '#ef4444',
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

describe('getPaceLayerColor — pace layer mapping', () => {
  it('Foundation maps to #3b82f6 (blue)', () => {
    // Foundation layer = stable, slow-moving platform code; represented in blue
    expect(getPaceLayerColor('Foundation')).toBe('#3b82f6');
  });

  it('Infrastructure maps to #8b5cf6 (purple)', () => {
    // Infrastructure layer = plumbing and wiring; represented in purple
    expect(getPaceLayerColor('Infrastructure')).toBe('#8b5cf6');
  });

  it('Domain maps to #f59e0b (amber)', () => {
    // Domain layer = core business logic; represented in amber
    expect(getPaceLayerColor('Domain')).toBe('#f59e0b');
  });

  it('Surface maps to #ef4444 (red)', () => {
    // Surface layer = UI / fast-changing presentation code; represented in red
    expect(getPaceLayerColor('Surface')).toBe('#ef4444');
  });

  it('all four pace layer colors are distinct from one another', () => {
    // Each layer must have a unique color — no two layers share the same hex
    const colors = Object.values(PACE_LAYER_COLORS);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(4);
  });
});

describe('getPaceLayerColor — fallback for missing paceLayer', () => {
  it('undefined paceLayer returns a neutral/gray fallback hex color', () => {
    // Files that carry no paceLayer annotation should not crash or return a
    // layer-specific color; a neutral gray signals "unclassified"
    const color = getPaceLayerColor(undefined);
    expect(color).toMatch(HEX_COLOR_PATTERN);
    // Must not be any of the four named layer colors
    expect(Object.values(PACE_LAYER_COLORS)).not.toContain(color);
  });

  it('null paceLayer returns a neutral/gray fallback hex color', () => {
    const color = getPaceLayerColor(null);
    expect(color).toMatch(HEX_COLOR_PATTERN);
    expect(Object.values(PACE_LAYER_COLORS)).not.toContain(color);
  });

  it('empty string paceLayer returns a neutral/gray fallback hex color', () => {
    const color = getPaceLayerColor('');
    expect(color).toMatch(HEX_COLOR_PATTERN);
    expect(Object.values(PACE_LAYER_COLORS)).not.toContain(color);
  });

  it('unknown paceLayer string returns a neutral/gray fallback hex color', () => {
    // An unrecognised layer name must not silently return a named-layer color
    const color = getPaceLayerColor('UnknownLayer');
    expect(color).toMatch(HEX_COLOR_PATTERN);
    expect(Object.values(PACE_LAYER_COLORS)).not.toContain(color);
  });

  it('fallback color is a valid 6-digit hex string', () => {
    expect(getPaceLayerColor(undefined)).toMatch(HEX_COLOR_PATTERN);
  });
});

describe('getPaceLayerColor — purity', () => {
  it('calling the function twice with the same input returns identical results', () => {
    // Pure function contract: no mutable module state influences output
    expect(getPaceLayerColor('Foundation')).toBe(getPaceLayerColor('Foundation'));
    expect(getPaceLayerColor(undefined)).toBe(getPaceLayerColor(undefined));
  });
});

describe('getPaceLayerLegend — legend items', () => {
  it('returns exactly 4 items', () => {
    // One legend entry per pace layer; no more, no less
    expect(getPaceLayerLegend()).toHaveLength(4);
  });

  it('first item is Foundation with hex #3b82f6', () => {
    const legend = getPaceLayerLegend();
    expect(legend[0].name).toBe('Foundation');
    expect(legend[0].hex).toBe('#3b82f6');
  });

  it('second item is Infrastructure with hex #8b5cf6', () => {
    const legend = getPaceLayerLegend();
    expect(legend[1].name).toBe('Infrastructure');
    expect(legend[1].hex).toBe('#8b5cf6');
  });

  it('third item is Domain with hex #f59e0b', () => {
    const legend = getPaceLayerLegend();
    expect(legend[2].name).toBe('Domain');
    expect(legend[2].hex).toBe('#f59e0b');
  });

  it('fourth item is Surface with hex #ef4444', () => {
    const legend = getPaceLayerLegend();
    expect(legend[3].name).toBe('Surface');
    expect(legend[3].hex).toBe('#ef4444');
  });

  it('legend items appear in order: Foundation, Infrastructure, Domain, Surface', () => {
    // Order must be stable — callers render legend entries top-to-bottom
    const names = getPaceLayerLegend().map((item) => item.name);
    expect(names).toEqual(['Foundation', 'Infrastructure', 'Domain', 'Surface']);
  });

  it('each legend item has a valid 6-digit hex color', () => {
    for (const item of getPaceLayerLegend()) {
      expect(item.hex).toMatch(HEX_COLOR_PATTERN);
    }
  });
});
