import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { contextCommand } from './context';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/data');

describe('contextCommand', () => {
  it('includes a functions section in the output', async () => {
    const result = await contextCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      structureFile: 'test-repo-structure.json',
      couplingFile: 'test-repo-coupling.json',
      filePath: 'src/A.ts',
    });
    expect(result).toMatch(/functions?/i);
  });

  it('includes a section listing imports for the target file', async () => {
    const result = await contextCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      structureFile: 'test-repo-structure.json',
      couplingFile: 'test-repo-coupling.json',
      filePath: 'src/A.ts',
    });
    expect(result).toMatch(/imports?/i);
    // A.ts imports B.ts
    expect(result).toContain('src/B.ts');
  });

  it('includes a temporal coupling section in the output', async () => {
    const result = await contextCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      structureFile: 'test-repo-structure.json',
      couplingFile: 'test-repo-coupling.json',
      filePath: 'src/A.ts',
    });
    expect(result).toMatch(/coupling/i);
  });

  it('includes temporal coupling partners for the target file', async () => {
    const result = await contextCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      structureFile: 'test-repo-structure.json',
      couplingFile: 'test-repo-coupling.json',
      filePath: 'src/A.ts',
    });
    // A.ts is coupled with B.ts (coupling score 0.85)
    expect(result).toContain('src/B.ts');
  });

  it('includes an ownership section showing the last author', async () => {
    const result = await contextCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      structureFile: 'test-repo-structure.json',
      couplingFile: 'test-repo-coupling.json',
      filePath: 'src/A.ts',
    });
    expect(result).toMatch(/ownership|owner|author/i);
    expect(result).toContain('Alice');
  });

  it('lists the declared function names from the structure data', async () => {
    const result = await contextCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      structureFile: 'test-repo-structure.json',
      couplingFile: 'test-repo-coupling.json',
      filePath: 'src/A.ts',
    });
    // A.ts has doWork and helper
    expect(result).toContain('doWork');
    expect(result).toContain('helper');
  });

  it('returns output even when coupling file has no edges for the target file', async () => {
    const result = await contextCommand({
      dataDir: FIXTURE_DIR,
      snapshotFile: 'test-repo.json',
      structureFile: 'test-repo-structure.json',
      couplingFile: 'test-repo-coupling.json',
      filePath: 'src/B.ts',
    });
    // B.ts appears in coupling edges but as fileB — should still produce a card
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});
