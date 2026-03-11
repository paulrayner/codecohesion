import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { handleImpact } from './impact.js';

const TEST_DATA_DIR = path.resolve(__dirname, '../../test/data');

/**
 * Structure fixture import graph:
 *   A → B  (A imports B)
 *   C → A  (C imports A)
 *
 * For blast radius of B.ts:
 *   - Direct dependents (files that import B): [A.ts]
 *   - Transitive dependents (files that import A): [C.ts]
 *   - Total blast radius: 2 (A.ts + C.ts)
 */
describe('handleImpact', () => {
  it('blast radius for B.ts includes its direct dependent A.ts', async () => {
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/B.ts' });

    expect(result.blastRadius).toBeGreaterThanOrEqual(1);
    expect(result.dependents).toContain('src/A.ts');
  });

  it('blast radius for B.ts includes transitive dependent C.ts (depth-2 BFS)', async () => {
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/B.ts' });

    expect(result.dependents).toContain('src/C.ts');
    expect(result.blastRadius).toBe(2);
  });

  it('blast radius for C.ts is 0 — no files import C', async () => {
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/C.ts' });

    expect(result.blastRadius).toBe(0);
    expect(result.dependents).toHaveLength(0);
  });

  it('blast radius for A.ts is 1 — only C.ts imports A directly, no further transitive deps', async () => {
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/A.ts' });

    expect(result.blastRadius).toBe(1);
    expect(result.dependents).toContain('src/C.ts');
    // B.ts is an import of A, not a dependent of A — should not appear
    expect(result.dependents).not.toContain('src/B.ts');
  });

  it('result includes the analyzed file path', async () => {
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/B.ts' });

    expect(result.file).toBe('src/B.ts');
  });

  it('result includes a blastRadius number field', async () => {
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/B.ts' });

    expect(typeof result.blastRadius).toBe('number');
  });

  it('result includes a dependents array', async () => {
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/B.ts' });

    expect(Array.isArray(result.dependents)).toBe(true);
  });

  it('throws a descriptive error when the structure file does not exist', async () => {
    await expect(
      handleImpact('/nonexistent/path', { file: 'src/B.ts' }),
    ).rejects.toThrow(/not found|ENOENT/i);
  });

  it('throws or returns empty result for a file not present in the graph', async () => {
    // A file that exists in no import edges should have blast radius 0
    const result = await handleImpact(TEST_DATA_DIR, { file: 'src/Unknown.ts' });

    expect(result.blastRadius).toBe(0);
    expect(result.dependents).toHaveLength(0);
  });

  /**
   * Cyclic graph fixture: P → Q and Q → P (mutual import cycle).
   *
   * When analyzing impact of src/P.ts:
   *   - Q imports P, so Q is a direct dependent
   *   - P imports Q, but P is the *starting node*, not a dependent of itself
   *   - Expected dependents: [src/Q.ts] only, blastRadius: 1
   *
   * BFS bug: the starting node is never added to the visited set before
   * the traversal begins, so when Q's reverse-lookup produces P again,
   * P is re-enqueued and ultimately added to the dependents list.
   * The correct result must NOT include the queried file in its own dependents.
   */
  describe('cyclic graph (P ↔ Q)', () => {
    const CYCLIC_FIXTURE = path.resolve(__dirname, '../../test/data/test-repo-cyclic.json');

    it(
      'does not hang or loop infinitely on a cyclic import graph',
      async () => {
        // If BFS has an infinite-loop bug this test will time out at 5 s
        const result = await handleImpact(TEST_DATA_DIR, {
          file: 'src/P.ts',
          filename: CYCLIC_FIXTURE,
        } as Parameters<typeof handleImpact>[1]);

        // Sanity check: the call returned at all
        expect(result).toBeDefined();
      },
      5000,
    );

    it('queried file is not included in its own dependents list on a cyclic graph', async () => {
      const result = await handleImpact(TEST_DATA_DIR, {
        file: 'src/P.ts',
        filename: CYCLIC_FIXTURE,
      } as Parameters<typeof handleImpact>[1]);

      // P should not appear in its own blast-radius result
      expect(result.dependents).not.toContain('src/P.ts');
    });

    it('cyclic graph blast radius for P.ts is 1 — only Q.ts depends on P directly', async () => {
      const result = await handleImpact(TEST_DATA_DIR, {
        file: 'src/P.ts',
        filename: CYCLIC_FIXTURE,
      } as Parameters<typeof handleImpact>[1]);

      expect(result.blastRadius).toBe(1);
      expect(result.dependents).toContain('src/Q.ts');
    });
  });
});
