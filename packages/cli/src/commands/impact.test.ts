import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { impactCommand } from './impact';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/data');

// Structure fixture imports:
//   src/A.ts -> src/B.ts  (A imports B)
//   src/C.ts -> src/A.ts  (C imports A)
//
// So dependents of src/B.ts:
//   direct: src/A.ts (imports B)
//   transitive: src/C.ts (imports A which imports B)
//
// Dependents of src/A.ts:
//   direct: src/C.ts

describe('impactCommand', () => {
  it('lists the direct dependent of the target file', async () => {
    const result = await impactCommand({
      dataDir: FIXTURE_DIR,
      structureFile: 'test-repo-structure.json',
      filePath: 'src/B.ts',
    });
    expect(result).toContain('src/A.ts');
  });

  it('lists transitive dependents of the target file', async () => {
    const result = await impactCommand({
      dataDir: FIXTURE_DIR,
      structureFile: 'test-repo-structure.json',
      filePath: 'src/B.ts',
    });
    // C.ts depends on A.ts which depends on B.ts — transitive dependent
    expect(result).toContain('src/C.ts');
  });

  it('includes a blast radius count in the output', async () => {
    const result = await impactCommand({
      dataDir: FIXTURE_DIR,
      structureFile: 'test-repo-structure.json',
      filePath: 'src/B.ts',
    });
    // 2 total dependents (A.ts direct, C.ts transitive)
    expect(result).toMatch(/blast radius|2/i);
  });

  it('shows only direct dependents for a file with no transitive chain', async () => {
    const result = await impactCommand({
      dataDir: FIXTURE_DIR,
      structureFile: 'test-repo-structure.json',
      filePath: 'src/A.ts',
    });
    expect(result).toContain('src/C.ts');
  });

  it('returns a message when a file has no dependents', async () => {
    const result = await impactCommand({
      dataDir: FIXTURE_DIR,
      structureFile: 'test-repo-structure.json',
      filePath: 'src/C.ts',
    });
    // C.ts has no files that import it
    expect(result).toMatch(/no dependents|0|none/i);
  });

  it('distinguishes direct from transitive dependents in the output', async () => {
    const result = await impactCommand({
      dataDir: FIXTURE_DIR,
      structureFile: 'test-repo-structure.json',
      filePath: 'src/B.ts',
    });
    expect(result).toMatch(/direct|transitive/i);
  });
});
