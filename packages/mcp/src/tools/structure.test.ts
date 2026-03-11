import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { handleStructure } from './structure.js';

const TEST_DATA_DIR = path.resolve(__dirname, '../../test/data');

/**
 * Structure fixture:
 *   imports: A → B, C → A
 *   functions in A.ts: doWork (exported), helper (not exported)
 *   functions in B.ts: parse (exported), validate (not exported)
 *   functions in C.ts: render (exported), format (not exported)
 */
describe('handleStructure', () => {
  it('returns functions declared in the requested file', async () => {
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/A.ts' });

    expect(result.functions).toBeDefined();
    expect(Array.isArray(result.functions)).toBe(true);
    const names = result.functions.map((f: { name: string }) => f.name);
    expect(names).toContain('doWork');
    expect(names).toContain('helper');
  });

  it('does not include functions from other files', async () => {
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/A.ts' });

    const names = result.functions.map((f: { name: string }) => f.name);
    expect(names).not.toContain('parse');
    expect(names).not.toContain('render');
  });

  it('returns imports (outgoing) for the requested file', async () => {
    // A.ts imports B.ts
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/A.ts' });

    expect(result.imports).toBeDefined();
    expect(Array.isArray(result.imports)).toBe(true);
    const targets = result.imports.map((e: { to: string }) => e.to);
    expect(targets).toContain('src/B.ts');
  });

  it('returns importedBy (incoming) for the requested file', async () => {
    // A.ts is imported by C.ts
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/A.ts' });

    expect(result.importedBy).toBeDefined();
    expect(Array.isArray(result.importedBy)).toBe(true);
    const sources = result.importedBy.map((e: { from: string }) => e.from);
    expect(sources).toContain('src/C.ts');
  });

  it('B.ts has no imports of internal files and is not imported by anyone except A.ts', async () => {
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/B.ts' });

    // B imports nobody (no edges from B.ts in fixture)
    expect(result.imports).toHaveLength(0);

    // B is imported by A.ts
    const sources = result.importedBy.map((e: { from: string }) => e.from);
    expect(sources).toContain('src/A.ts');
  });

  it('C.ts imports A.ts and has no importedBy entries', async () => {
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/C.ts' });

    const targets = result.imports.map((e: { to: string }) => e.to);
    expect(targets).toContain('src/A.ts');

    expect(result.importedBy).toHaveLength(0);
  });

  it('result includes the analyzed file path', async () => {
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/A.ts' });

    expect(result.file).toBe('src/A.ts');
  });

  it('function entries include required fields', async () => {
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/A.ts' });

    const fn = result.functions[0];
    expect(fn).toHaveProperty('name');
    expect(fn).toHaveProperty('kind');
    expect(fn).toHaveProperty('line');
    expect(fn).toHaveProperty('isExported');
  });

  it('returns empty functions/imports/importedBy for a file not in the graph', async () => {
    const result = await handleStructure(TEST_DATA_DIR, { file: 'src/Unknown.ts' });

    expect(result.functions).toHaveLength(0);
    expect(result.imports).toHaveLength(0);
    expect(result.importedBy).toHaveLength(0);
  });

  it('throws a descriptive error when the structure file does not exist', async () => {
    await expect(
      handleStructure('/nonexistent/path', { file: 'src/A.ts' }),
    ).rejects.toThrow(/not found|ENOENT/i);
  });

  /**
   * Filename parameter tests.
   *
   * Handlers should accept an explicit `filename` parameter so callers can
   * point them at specific data files rather than relying on the hardcoded
   * 'test-repo-structure.json' default.  Passing a non-existent filename
   * must cause the handler to throw — if the handler ignores the param and
   * uses its hardcoded default instead, the call succeeds and these tests fail.
   */
  describe('filename parameter', () => {
    it('throws when a caller-supplied filename does not exist', async () => {
      await expect(
        handleStructure(TEST_DATA_DIR, {
          file: 'src/A.ts',
          filename: 'does-not-exist.json',
        } as Parameters<typeof handleStructure>[1]),
      ).rejects.toThrow(/not found|ENOENT/i);
    });

    it('uses the caller-supplied filename instead of the hardcoded default', async () => {
      // Passing the structure fixture explicitly should return the same data
      // as the default call — confirming the filename param is actually used.
      const explicitResult = await handleStructure(TEST_DATA_DIR, {
        file: 'src/A.ts',
        filename: 'test-repo-structure.json',
      } as Parameters<typeof handleStructure>[1]);

      const defaultResult = await handleStructure(TEST_DATA_DIR, { file: 'src/A.ts' });

      expect(explicitResult.functions).toHaveLength(defaultResult.functions.length);
      expect(explicitResult.imports).toHaveLength(defaultResult.imports.length);
    });
  });
});
