import { describe, it, expect } from 'vitest';
import { REPO_GITHUB_URLS, getGitHubInfo, getGitHubFileUrl, getGitHubDirUrl } from './github-links';

describe('getGitHubInfo', () => {
  it('returns info for a known repository', () => {
    const info = getGitHubInfo('gource');
    expect(info).not.toBeNull();
    expect(info?.owner).toBe('acaudwell');
    expect(info?.repo).toBe('Gource');
    expect(info?.url).toBe('https://github.com/acaudwell/Gource');
  });

  it('returns null for an unknown repository', () => {
    expect(getGitHubInfo('not-a-real-repo')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getGitHubInfo('')).toBeNull();
  });

  it('contains all expected repository keys', () => {
    const expectedKeys = ['gource', 'cbioportal', 'cbioportal-frontend', 'react', 'codecohesion'];
    for (const key of expectedKeys) {
      expect(REPO_GITHUB_URLS).toHaveProperty(key);
    }
  });
});

describe('getGitHubFileUrl', () => {
  it('builds a blob URL for a known repo and file path', () => {
    expect(getGitHubFileUrl('react', 'packages/react/index.js')).toBe(
      'https://github.com/facebook/react/blob/HEAD/packages/react/index.js'
    );
  });

  it('returns null for an unknown repository', () => {
    expect(getGitHubFileUrl('unknown-repo', 'src/main.ts')).toBeNull();
  });

  it('handles a file path with nested directories', () => {
    const url = getGitHubFileUrl('gource', 'src/core/Gource.cpp');
    expect(url).toBe('https://github.com/acaudwell/Gource/blob/HEAD/src/core/Gource.cpp');
  });
});

describe('getGitHubDirUrl', () => {
  it('builds a tree URL for a known repo and directory path', () => {
    expect(getGitHubDirUrl('react', 'packages/react')).toBe(
      'https://github.com/facebook/react/tree/HEAD/packages/react'
    );
  });

  it('returns the root tree URL when dirPath is empty string', () => {
    expect(getGitHubDirUrl('gource', '')).toBe(
      'https://github.com/acaudwell/Gource/tree/HEAD'
    );
  });

  it('returns null for an unknown repository', () => {
    expect(getGitHubDirUrl('unknown-repo', 'src')).toBeNull();
  });

  it('handles nested directory paths', () => {
    const url = getGitHubDirUrl('codecohesion', 'viewer/src/lib');
    expect(url).toBe('https://github.com/paulrayner/codecohesion/tree/HEAD/viewer/src/lib');
  });
});
