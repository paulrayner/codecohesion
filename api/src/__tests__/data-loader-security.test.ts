import { describe, it, expect, vi, afterEach } from 'vitest';
import { DataLoader } from '../data-loader';

// Mock the fs/promises module so tests do not touch the real filesystem.
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

import fs from 'fs/promises';

afterEach(() => {
  vi.clearAllMocks();
});

describe('DataLoader.loadStructure — path traversal security', () => {
  it('should throw "Invalid repository id" when repoId contains ../ traversal', async () => {
    const loader = new DataLoader('/safe/data/dir');

    await expect(loader.loadStructure('../../../etc/passwd')).rejects.toThrow(
      'Invalid repository id'
    );
  });

  it('should throw "Invalid repository id" when repoId contains encoded traversal sequences', async () => {
    const loader = new DataLoader('/safe/data/dir');

    await expect(loader.loadStructure('..%2F..%2Fetc%2Fpasswd')).rejects.toThrow(
      'Invalid repository id'
    );
  });

  it('should throw "Invalid repository id" when repoId contains backslash traversal', async () => {
    const loader = new DataLoader('/safe/data/dir');

    await expect(loader.loadStructure('..\\..\\windows\\system32')).rejects.toThrow(
      'Invalid repository id'
    );
  });

  it('should load structure normally for a valid repoId (sanity check)', async () => {
    const mockStructureGraph = {
      nodes: [{ id: 'src/index.ts', label: 'index.ts' }],
      imports: [],
    };

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(mockStructureGraph) as unknown as ArrayBuffer
    );

    const loader = new DataLoader('/safe/data/dir');
    const result = await loader.loadStructure('my-repo');

    expect(result).toEqual(mockStructureGraph);
    expect(vi.mocked(fs.readFile)).toHaveBeenCalledWith(
      expect.stringContaining('my-repo-structure.json'),
      'utf-8'
    );
  });
});
