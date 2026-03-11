import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { riskCommand } from './risk';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/data');

describe('riskCommand', () => {
  it('includes ranked files in the output', async () => {
    const result = await riskCommand({
      dataDir: FIXTURE_DIR,
      complexityFile: 'test-repo-complexity.json',
    });
    expect(result).toContain('src/A.ts');
    expect(result).toContain('src/B.ts');
  });

  it('lists files in descending hotspot score order (highest first)', async () => {
    const result = await riskCommand({
      dataDir: FIXTURE_DIR,
      complexityFile: 'test-repo-complexity.json',
    });
    const indexA = result.indexOf('src/A.ts');
    const indexB = result.indexOf('src/B.ts');
    const indexC = result.indexOf('src/C.ts');
    // A.ts (0.855) > B.ts (0.525) > C.ts (0.200)
    expect(indexA).toBeGreaterThanOrEqual(0);
    expect(indexB).toBeGreaterThanOrEqual(0);
    expect(indexC).toBeGreaterThanOrEqual(0);
    expect(indexA).toBeLessThan(indexB);
    expect(indexB).toBeLessThan(indexC);
  });

  it('includes hotspot scores in the output', async () => {
    const result = await riskCommand({
      dataDir: FIXTURE_DIR,
      complexityFile: 'test-repo-complexity.json',
    });
    // hotspotScore for A.ts is 0.855
    expect(result).toMatch(/0\.855|0\.86/);
  });

  it('includes all hotspot files from the fixture', async () => {
    const result = await riskCommand({
      dataDir: FIXTURE_DIR,
      complexityFile: 'test-repo-complexity.json',
    });
    expect(result).toContain('src/D.ts');
    expect(result).toContain('src/E.ts');
  });

  it('produces a table-like structure with rank or position indicator', async () => {
    const result = await riskCommand({
      dataDir: FIXTURE_DIR,
      complexityFile: 'test-repo-complexity.json',
    });
    // Should have at least a rank column or numbered rows
    expect(result).toMatch(/1|#1|rank/i);
  });
});
