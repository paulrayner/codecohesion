import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { loadJson } from './data-reader';

const FIXTURE_DIR = path.resolve(__dirname, '../test/data');

describe('loadJson', () => {
  it('resolves a JSON file and parses it into an object', async () => {
    const result = await loadJson(path.join(FIXTURE_DIR, 'test-repo.json'));
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect((result as Record<string, unknown>).repositoryPath).toBe('/test/repo');
  });

  it('returns a plain JS value (not a string)', async () => {
    const result = await loadJson(path.join(FIXTURE_DIR, 'test-repo-complexity.json'));
    expect(typeof result).not.toBe('string');
    expect((result as Record<string, unknown>).format).toBe('complexity-v1');
  });

  it('throws an error when the file does not exist', async () => {
    await expect(
      loadJson(path.join(FIXTURE_DIR, 'nonexistent-file.json'))
    ).rejects.toThrow();
  });

  it('throws an error that identifies the missing path', async () => {
    const missingPath = path.join(FIXTURE_DIR, 'nonexistent-file.json');
    await expect(loadJson(missingPath)).rejects.toThrow(/nonexistent-file\.json/);
  });
});
