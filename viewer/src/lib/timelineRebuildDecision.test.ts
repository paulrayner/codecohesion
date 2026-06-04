import { describe, it, expect } from 'vitest';
import { requiresFullRebuild } from './timelineRebuildDecision';

describe('requiresFullRebuild', () => {
  it('returns false when nothing was added', () => {
    expect(requiresFullRebuild([], new Set(['src', 'src/components']))).toBe(false);
  });

  it('returns false when every added file has an existing parent directory', () => {
    const dirs = new Set(['src', 'src/components']);
    expect(
      requiresFullRebuild(['src/components/Button.tsx', 'src/index.ts'], dirs)
    ).toBe(false);
  });

  it('returns true when an added file is under a directory not yet in the scene', () => {
    const dirs = new Set(['src']);
    expect(requiresFullRebuild(['src/components/Button.tsx'], dirs)).toBe(true);
  });

  it('returns true if any one added file needs a new directory', () => {
    const dirs = new Set(['src', 'src/components']);
    expect(
      requiresFullRebuild(
        ['src/components/Button.tsx', 'src/modules/orders/OrderPage.tsx'],
        dirs
      )
    ).toBe(true);
  });

  it('treats a root-level file as needing the root directory entry', () => {
    // Root present (represented as empty path): no rebuild needed.
    expect(requiresFullRebuild(['README.md'], new Set(['']))).toBe(false);
    // Root not represented: rebuild needed.
    expect(requiresFullRebuild(['README.md'], new Set(['src']))).toBe(true);
  });

  it('reproduces the empty-timeline bug: scene only has root, new file is nested', () => {
    // After the opening commit the scene has only the root directory.
    const dirs = new Set(['']);
    expect(requiresFullRebuild(['src/main.ts'], dirs)).toBe(true);
  });
});
