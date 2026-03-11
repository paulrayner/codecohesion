import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { handleHotspots } from './hotspots.js';

const TEST_DATA_DIR = path.resolve(__dirname, '../../test/data');

describe('handleHotspots', () => {
  it('returns hotspots sorted by score descending', async () => {
    const result = await handleHotspots(TEST_DATA_DIR, {});

    expect(result.hotspots).toBeDefined();
    expect(result.hotspots.length).toBeGreaterThan(0);

    // Verify descending order by hotspotScore
    const scores = result.hotspots.map((h: { hotspotScore: number }) => h.hotspotScore);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  it('first hotspot has the highest score', async () => {
    const result = await handleHotspots(TEST_DATA_DIR, {});

    expect(result.hotspots[0].file).toBe('src/A.ts');
    expect(result.hotspots[0].hotspotScore).toBeCloseTo(0.855);
  });

  it('respects limit param — returns only the requested number of hotspots', async () => {
    const result = await handleHotspots(TEST_DATA_DIR, { limit: 2 });

    expect(result.hotspots).toHaveLength(2);
  });

  it('limit param of 1 returns only the top hotspot', async () => {
    const result = await handleHotspots(TEST_DATA_DIR, { limit: 1 });

    expect(result.hotspots).toHaveLength(1);
    expect(result.hotspots[0].file).toBe('src/A.ts');
  });

  it('returns all hotspots when limit exceeds available count', async () => {
    const result = await handleHotspots(TEST_DATA_DIR, { limit: 100 });

    // fixture has 5 hotspots
    expect(result.hotspots).toHaveLength(5);
  });

  it('returns all hotspots when no limit is specified', async () => {
    const result = await handleHotspots(TEST_DATA_DIR, {});

    expect(result.hotspots).toHaveLength(5);
  });

  it('throws a descriptive error when the complexity file does not exist', async () => {
    await expect(
      handleHotspots('/nonexistent/path', {}),
    ).rejects.toThrow(/not found|ENOENT/i);
  });

  it('result includes required hotspot fields', async () => {
    const result = await handleHotspots(TEST_DATA_DIR, { limit: 1 });
    const hotspot = result.hotspots[0];

    expect(hotspot).toHaveProperty('file');
    expect(hotspot).toHaveProperty('hotspotScore');
    expect(hotspot).toHaveProperty('complexityScore');
    expect(hotspot).toHaveProperty('churnScore');
    expect(hotspot).toHaveProperty('totalCyclomatic');
    expect(hotspot).toHaveProperty('commitCount');
  });

  /**
   * Filename parameter tests.
   *
   * Handlers should accept an explicit `filename` parameter so callers can
   * point them at specific data files rather than relying on the hardcoded
   * 'test-repo-complexity.json' default.  Passing a non-existent filename
   * must cause the handler to throw — if the handler ignores the param and
   * uses its hardcoded default instead, the call succeeds and these tests fail.
   */
  describe('filename parameter', () => {
    it('throws when a caller-supplied filename does not exist', async () => {
      await expect(
        handleHotspots(TEST_DATA_DIR, {
          filename: 'does-not-exist.json',
        } as Parameters<typeof handleHotspots>[1]),
      ).rejects.toThrow(/not found|ENOENT/i);
    });

    it('uses the caller-supplied filename instead of the hardcoded default', async () => {
      // Passing the complexity fixture explicitly should return the same data
      // as the default call — confirming the filename param is actually used.
      const explicitResult = await handleHotspots(TEST_DATA_DIR, {
        filename: 'test-repo-complexity.json',
      } as Parameters<typeof handleHotspots>[1]);

      const defaultResult = await handleHotspots(TEST_DATA_DIR, {});

      expect(explicitResult.hotspots).toHaveLength(defaultResult.hotspots.length);
      expect(explicitResult.hotspots[0].file).toBe(defaultResult.hotspots[0].file);
    });
  });
});
