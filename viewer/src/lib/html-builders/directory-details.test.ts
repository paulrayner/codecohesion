import { describe, it, expect } from 'vitest';
import { buildDirectoryDetailsHTML, DirectoryDetailsData } from './directory-details';
import { DirectoryNode } from '../../types';
import { createMockDir } from '../test-fixtures';

describe('buildDirectoryDetailsHTML', () => {
  it('should render complete directory details with all data present', () => {
    const dir = createMockDir('components');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 5420,
        fileCount: 15,
        dirCount: 3,
        dominantExt: 'tsx',
        dominantName: 'TypeScript React',
      },
      lastModified: {
        date: 'Oct 20, 2025',
        author: 'Jane Smith',
      },
      githubDirUrl: 'https://github.com/test/repo/tree/main/src/components',
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
  });

  it('should render directory details without GitHub URL', () => {
    const dir = createMockDir('lib');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 2100,
        fileCount: 8,
        dirCount: 2,
        dominantExt: 'ts',
        dominantName: 'TypeScript',
      },
      lastModified: {
        date: 'Sep 15, 2025',
        author: 'Bob Johnson',
      },
      githubDirUrl: null,
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
    expect(html).not.toContain('View on GitHub');
  });

  it('should render root directory details', () => {
    const dir: DirectoryNode = {
      path: '',
      name: 'root',
      type: 'directory',
      children: [],
    };
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 15000,
        fileCount: 50,
        dirCount: 10,
        dominantExt: 'ts',
        dominantName: 'TypeScript',
      },
      lastModified: {
        date: 'Oct 22, 2025',
        author: 'Alice Dev',
      },
      githubDirUrl: 'https://github.com/test/repo',
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
    expect(html).toContain('(root)');
  });

  it('should render empty directory details', () => {
    const dir = createMockDir('empty');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 0,
        fileCount: 0,
        dirCount: 0,
        dominantExt: 'none',
        dominantName: 'none',
      },
      lastModified: {
        date: 'Unknown',
        author: 'Unknown',
      },
      githubDirUrl: null,
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
    expect(html).toContain('0');
    expect(html).toContain('Unknown');
  });

  it('should render directory with large LOC count formatted correctly', () => {
    const dir = createMockDir('large');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 1234567,
        fileCount: 250,
        dirCount: 15,
        dominantExt: 'js',
        dominantName: 'JavaScript',
      },
      lastModified: {
        date: 'Oct 1, 2025',
        author: 'Dev Team',
      },
      githubDirUrl: null,
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
    expect(html).toContain('1,234,567');
  });

  it('should render directory with single file and no subdirectories', () => {
    const dir = createMockDir('config');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 50,
        fileCount: 1,
        dirCount: 0,
        dominantExt: 'json',
        dominantName: 'JSON',
      },
      lastModified: {
        date: 'Aug 10, 2025',
        author: 'Config Bot',
      },
      githubDirUrl: 'https://github.com/test/repo/tree/main/config',
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
  });

  it('should render directory with only subdirectories', () => {
    const dir = createMockDir('modules');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 8000,
        fileCount: 0,
        dirCount: 5,
        dominantExt: 'ts',
        dominantName: 'TypeScript',
      },
      lastModified: {
        date: 'Oct 18, 2025',
        author: 'Module Team',
      },
      githubDirUrl: null,
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
    expect(html).toContain('0</span>'); // 0 files
  });

  it('should render directory with unknown dominant type', () => {
    const dir = createMockDir('misc');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 500,
        fileCount: 10,
        dirCount: 1,
        dominantExt: 'xyz',
        dominantName: 'xyz',
      },
      lastModified: {
        date: 'Jul 5, 2025',
        author: 'Unknown',
      },
      githubDirUrl: null,
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
    expect(html).toContain('xyz');
  });

  it('should handle special characters in path and name', () => {
    const dir = createMockDir('foo_bar');
    const data: DirectoryDetailsData = {
      dir,
      stats: {
        totalLoc: 300,
        fileCount: 5,
        dirCount: 1,
        dominantExt: 'py',
        dominantName: 'Python',
      },
      lastModified: {
        date: 'Oct 10, 2025',
        author: "O'Brien",
      },
      githubDirUrl: 'https://github.com/test/repo/tree/main/special-chars/foo_bar',
    };

    const html = buildDirectoryDetailsHTML(data);
    expect(html).toMatchSnapshot();
    expect(html).toContain('foo_bar');
    expect(html).toContain("O'Brien");
  });
});
