import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { whoCommand } from './who';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/data');

describe('whoCommand', () => {
  it('returns lastAuthor for the requested file', async () => {
    const result = await whoCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      filePath: 'src/A.ts',
    });
    expect(result).toContain('Alice');
  });

  it('returns commitCount for the requested file', async () => {
    const result = await whoCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      filePath: 'src/A.ts',
    });
    expect(result).toContain('45');
  });

  it('returns ownership data for a different file', async () => {
    const result = await whoCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      filePath: 'src/B.ts',
    });
    expect(result).toContain('Bob');
    expect(result).toContain('35');
  });

  it('throws an error when the file is not found in the snapshot', async () => {
    await expect(
      whoCommand({
        dataDir: FIXTURE_DIR,
        snapshotFile: 'test-repo.json',
        filePath: 'src/NotReal.ts',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('includes the contributorCount in output', async () => {
    const result = await whoCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      filePath: 'src/A.ts',
    });
    // contributorCount is 3 for src/A.ts
    expect(result).toContain('3');
  });
});
