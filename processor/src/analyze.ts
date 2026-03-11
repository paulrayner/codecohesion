import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { DirectoryNode, FileNode, RepositorySnapshot } from '@codecohesion/shared-types';
import { Logger, consoleLogger } from './logger';
import { FileReader, nodeFileReader } from './file-reader';

interface FileInfo {
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Pure standalone helpers — no git, no filesystem dependencies
// ---------------------------------------------------------------------------

/**
 * Derive a file extension from a filename, returning "no-extension" when none
 * is present.
 */
function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.length > 0 ? ext.substring(1) : 'no-extension';
}

/**
 * Build a hierarchical DirectoryNode tree from a flat list of enriched file
 * records. This is a pure function with no I/O side-effects, making it
 * straightforward to unit-test in isolation.
 */
export function buildTree(files: Array<{
  path: string;
  loc: number;
  lastModified: string | null;
  lastAuthor: string | null;
  lastCommitHash: string | null;
  commitCount: number | null;
  contributorCount: number | null;
  firstCommitDate: string | null;
  recentLinesChanged: number | null;
  avgLinesPerCommit: number | null;
  daysSinceLastModified: number | null;
  isGenerated?: boolean;
}>): DirectoryNode {
  const root: DirectoryNode = {
    path: '',
    name: 'root',
    type: 'directory',
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let currentNode = root;

    // Navigate/create intermediate directory nodes
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      const dirPath = parts.slice(0, i + 1).join('/');

      let dirNode = currentNode.children.find(
        (child) => child.type === 'directory' && child.name === dirName,
      ) as DirectoryNode | undefined;

      if (!dirNode) {
        dirNode = {
          path: dirPath,
          name: dirName,
          type: 'directory',
          children: [],
        };
        currentNode.children.push(dirNode);
      }

      currentNode = dirNode;
    }

    // Add leaf FileNode
    const fileName = parts[parts.length - 1];
    const fileNode: FileNode = {
      path: file.path,
      name: fileName,
      type: 'file',
      loc: file.loc,
      extension: getExtension(fileName),
      lastModified: file.lastModified,
      lastAuthor: file.lastAuthor,
      lastCommitHash: file.lastCommitHash,
      commitCount: file.commitCount,
      contributorCount: file.contributorCount,
      firstCommitDate: file.firstCommitDate,
      recentLinesChanged: file.recentLinesChanged,
      avgLinesPerCommit: file.avgLinesPerCommit,
      daysSinceLastModified: file.daysSinceLastModified,
      isGenerated: file.isGenerated,
    };
    currentNode.children.push(fileNode);
  }

  return root;
}

class RepositoryAnalyzer {
  private git: SimpleGit;
  private repoPath: string;
  private logger: Logger;
  private fileReader: FileReader;

  constructor(repoPath: string, logger: Logger = consoleLogger, fileReader: FileReader = nodeFileReader) {
    this.repoPath = path.resolve(repoPath);
    this.git = simpleGit(this.repoPath);
    this.logger = logger;
    this.fileReader = fileReader;
  }

  /**
   * Count non-blank lines in file content
   */
  private countLinesOfCode(content: string): number {
    const lines = content.split('\n');
    return lines.filter(line => line.trim().length > 0).length;
  }

  /**
   * Get file extension
   */
  private getExtension(filePath: string): string {
    const ext = path.extname(filePath);
    return ext.length > 0 ? ext.substring(1) : 'no-extension';
  }

  /**
   * Check if file path matches generated/minified file patterns
   * Phase 1.6: Expanded pattern coverage for common generated files
   */
  private isGeneratedFile(filePath: string): boolean {
    // Normalize path separators and ensure leading slash for pattern matching
    const normalizedPath = '/' + filePath.replace(/\\/g, '/');

    const patterns = [
      // Minified files
      '.min.js',
      '.min.css',

      // Build output directories
      '/dist/',
      '/build/',
      '/out/',
      '/node_modules/',
      '/vendor/',

      // Bundled files
      '.bundle.js',
      '/bundle.js',
      '/__generated__/',

      // Lock files (Phase 1.6)
      'yarn.lock',
      'package-lock.json',
      'pnpm-lock.yaml',
      'composer.lock',
      'Gemfile.lock',
      'Cargo.lock',
      'poetry.lock',
      'Pipfile.lock',

      // Build artifacts (Phase 1.6)
      '.map',                // Source maps

      // Test artifacts (Phase 1.6)
      '/__snapshots__/',     // Jest snapshot directories
      '.snap',               // Jest snapshot files
      '/__compiled__/'       // Compiled test fixtures
    ];

    return patterns.some(pattern => normalizedPath.includes(pattern));
  }

  /**
   * Get git metadata for a file (all metrics for visualization)
   */
  private async getGitMetadata(filePath: string): Promise<{
    lastModified: string | null;
    lastAuthor: string | null;
    lastCommitHash: string | null;
    lastCommitMessage: string | null;
    commitCount: number | null;
    contributorCount: number | null;
    firstCommitDate: string | null;
    recentLinesChanged: number | null;
    avgLinesPerCommit: number | null;
    daysSinceLastModified: number | null;
  }> {
    try {
      // Get full git log for this file (--follow to track renames)
      const log = await this.git.log({ file: filePath, '--follow': null });

      if (log.all.length > 0 && log.latest) {
        const latest = log.latest;
        const oldest = log.all[log.all.length - 1];

        // Get unique contributors
        const uniqueAuthors = new Set(log.all.map(commit => commit.author_name));

        // Get numstat data for lines changed calculations
        const numstatLog = await this.git.raw([
          'log',
          '--numstat',
          '--follow',
          '--',
          filePath
        ]);

        // Parse numstat output to calculate line change metrics
        let totalLinesChanged = 0;
        let recentLinesChanged = 0;
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const lines = numstatLog.split('\n');
        let currentCommitDate: Date | null = null;

        for (const line of lines) {
          // Date line format: "Date:   Thu Jan 18 12:00:00 2024 -0800"
          if (line.startsWith('Date:')) {
            const dateStr = line.substring(5).trim();
            currentCommitDate = new Date(dateStr);
          }

          // Numstat line format: "10\t5\tfilepath.ts"
          const numstatMatch = line.match(/^(\d+|-)\t(\d+|-)\t/);
          if (numstatMatch && currentCommitDate) {
            const added = numstatMatch[1] === '-' ? 0 : parseInt(numstatMatch[1]);
            const deleted = numstatMatch[2] === '-' ? 0 : parseInt(numstatMatch[2]);
            const linesChanged = added + deleted;

            totalLinesChanged += linesChanged;

            // Check if commit is within last 90 days
            if (currentCommitDate >= ninetyDaysAgo) {
              recentLinesChanged += linesChanged;
            }
          }
        }

        // Calculate average lines per commit
        const avgLinesPerCommit = log.total > 0 ? Math.round(totalLinesChanged / log.total) : 0;

        // Calculate days since last modified
        const lastModifiedDate = new Date(latest.date);
        const now = new Date();
        const daysSinceLastModified = Math.floor((now.getTime() - lastModifiedDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          lastModified: latest.date,
          lastAuthor: latest.author_name,
          lastCommitHash: latest.hash,
          lastCommitMessage: latest.message,
          commitCount: log.total,
          contributorCount: uniqueAuthors.size,
          firstCommitDate: oldest.date,
          recentLinesChanged: recentLinesChanged,
          avgLinesPerCommit: avgLinesPerCommit,
          daysSinceLastModified: daysSinceLastModified
        };
      }
    } catch (error) {
      this.logger.warn(`Could not get git history for ${filePath}`);
    }
    return {
      lastModified: null,
      lastAuthor: null,
      lastCommitHash: null,
      lastCommitMessage: null,
      commitCount: null,
      contributorCount: null,
      firstCommitDate: null,
      recentLinesChanged: null,
      avgLinesPerCommit: null,
      daysSinceLastModified: null
    };
  }

  /**
   * Read all files at HEAD
   */
  private async getFilesAtHead(): Promise<FileInfo[]> {
    const files = await this.git.raw(['ls-tree', '-r', 'HEAD', '--name-only']);
    const fileList = files.trim().split('\n').filter((f: string) => f.length > 0);

    const fileInfos: FileInfo[] = [];

    for (const filePath of fileList) {
      try {
        const fullPath = path.join(this.repoPath, filePath);

        // Skip binary files and very large files
        const stats = this.fileReader.stat(fullPath);
        if (stats.size > 1024 * 1024) { // Skip files > 1MB
          this.logger.log(`Skipping large file: ${filePath}`);
          continue;
        }

        const content = this.fileReader.readText(fullPath);
        fileInfos.push({ path: filePath, content });
      } catch (error) {
        this.logger.log(`Could not read file ${filePath}, skipping`);
      }
    }

    return fileInfos;
  }

  /**
   * Build hierarchical tree structure from flat file list
   */
  private buildTree(files: Parameters<typeof buildTree>[0]): DirectoryNode {
    return buildTree(files);
  }

  /**
   * Analyze repository at HEAD
   */
  async analyze(): Promise<RepositorySnapshot> {
    this.logger.log(`Analyzing repository: ${this.repoPath}`);

    // Get HEAD commit info
    const log = await this.git.log({ maxCount: 1 });
    const headCommit = log.latest;

    if (!headCommit) {
      throw new Error('No commits found in repository');
    }

    this.logger.log(`HEAD commit: ${headCommit.hash}`);
    this.logger.log(`Reading files...`);

    // Get all files and calculate LOC
    const fileInfos = await this.getFilesAtHead();
    this.logger.log(`Found ${fileInfos.length} files`);

    // Calculate LOC and get git metadata for each file (parallelized with concurrency pool)
    this.logger.log('Collecting git metadata...');
    const commitMessages: Record<string, string> = {};
    let generatedFileCount = 0;
    let completedCount = 0;

    // Process files in parallel with a concurrency limit to avoid overwhelming git
    const CONCURRENCY_LIMIT = 12;
    const fileResults: Array<{
      path: string;
      loc: number;
      lastModified: string | null;
      lastAuthor: string | null;
      lastCommitHash: string | null;
      lastCommitMessage: string | null;
      commitCount: number | null;
      contributorCount: number | null;
      firstCommitDate: string | null;
      recentLinesChanged: number | null;
      avgLinesPerCommit: number | null;
      daysSinceLastModified: number | null;
      isGenerated: boolean | undefined;
    }> = new Array(fileInfos.length);

    const processFile = async (index: number) => {
      const f = fileInfos[index];
      const metadata = await this.getGitMetadata(f.path);
      const isGenerated = this.isGeneratedFile(f.path);

      fileResults[index] = {
        path: f.path,
        loc: this.countLinesOfCode(f.content),
        lastModified: metadata.lastModified,
        lastAuthor: metadata.lastAuthor,
        lastCommitHash: metadata.lastCommitHash,
        lastCommitMessage: metadata.lastCommitMessage,
        commitCount: metadata.commitCount,
        contributorCount: metadata.contributorCount,
        firstCommitDate: metadata.firstCommitDate,
        recentLinesChanged: metadata.recentLinesChanged,
        avgLinesPerCommit: metadata.avgLinesPerCommit,
        daysSinceLastModified: metadata.daysSinceLastModified,
        isGenerated: isGenerated || undefined,
      };

      completedCount++;
      if (completedCount % 100 === 0) {
        this.logger.log(`  Processed ${completedCount}/${fileInfos.length} files...`);
      }
    };

    // Concurrency pool: run up to CONCURRENCY_LIMIT tasks at once
    const pending: Promise<void>[] = [];
    for (let i = 0; i < fileInfos.length; i++) {
      const promise = processFile(i).then(() => {
        pending.splice(pending.indexOf(promise), 1);
      });
      pending.push(promise);
      if (pending.length >= CONCURRENCY_LIMIT) {
        await Promise.race(pending);
      }
    }
    await Promise.all(pending);

    // Collect results in order
    const filesWithMetadata = [];
    for (const result of fileResults) {
      filesWithMetadata.push({
        path: result.path,
        loc: result.loc,
        lastModified: result.lastModified,
        lastAuthor: result.lastAuthor,
        lastCommitHash: result.lastCommitHash,
        commitCount: result.commitCount,
        contributorCount: result.contributorCount,
        firstCommitDate: result.firstCommitDate,
        recentLinesChanged: result.recentLinesChanged,
        avgLinesPerCommit: result.avgLinesPerCommit,
        daysSinceLastModified: result.daysSinceLastModified,
        isGenerated: result.isGenerated,
      });

      if (result.isGenerated) {
        generatedFileCount++;
      }

      // Collect unique commit messages
      if (result.lastCommitHash && result.lastCommitMessage) {
        if (!commitMessages[result.lastCommitHash]) {
          commitMessages[result.lastCommitHash] = result.lastCommitMessage;
        }
      }
    }

    // Report generated file detection
    if (generatedFileCount > 0) {
      this.logger.log(`Detected ${generatedFileCount} generated/minified files (node_modules, dist, build, etc.)`);
    }

    // Build tree structure
    this.logger.log('Building tree structure...');
    const tree = this.buildTree(filesWithMetadata);

    // Calculate stats
    const totalLoc = filesWithMetadata.reduce((sum, f) => sum + f.loc, 0);
    const filesByExtension: Record<string, number> = {};

    for (const file of filesWithMetadata) {
      const ext = this.getExtension(file.path);
      filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
    }

    this.logger.log(`Collected ${Object.keys(commitMessages).length} unique commit messages`);

    const snapshot: RepositorySnapshot = {
      repositoryPath: this.repoPath,
      commit: headCommit.hash,
      timestamp: headCommit.date,
      author: headCommit.author_name,
      message: headCommit.message,
      tree,
      commitMessages,
      stats: {
        totalFiles: filesWithMetadata.length,
        totalLoc,
        filesByExtension
      }
    };

    this.logger.log(`Analysis complete: ${totalLoc} total LOC across ${filesWithMetadata.length} files`);
    return snapshot;
  }
}

export { RepositoryAnalyzer };
