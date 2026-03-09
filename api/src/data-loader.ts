import fs from 'fs/promises';
import path from 'path';
import { RepositorySnapshot, TimelineData, RepoListItem, RepoInfo } from './types';
import { LRUCache } from './lru-cache';
import type { StructureGraph, ImportEdge, ComplexityReport, CouplingGraph } from 'codecohesion-processor';

export class DataLoader {
  private dataDir: string;
  private cache = new LRUCache<string, RepositorySnapshot | TimelineData>(20);

  constructor(dataDir?: string) {
    // In production (Railway), dist/ is at api/dist/, so data/ is at api/data/
    // In development (ts-node), src/ is at api/src/, so data/ is at api/data/
    this.dataDir = dataDir || path.join(__dirname, '../data');
  }

  /**
   * List all available repositories from JSON files in data directory
   */
  async listRepos(): Promise<RepoListItem[]> {
    const files = await fs.readdir(this.dataDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'));

    const repos = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const data = await this.loadRepoFile(file);
          const item: RepoListItem = {
            id: this.fileToRepoId(file),
            name: file.replace('.json', ''),
            format: this.detectFormat(data)
          };
          return item;
        } catch (error) {
          console.error(`Failed to load ${file}:`, error);
          return null;
        }
      })
    );

    return repos.filter((r): r is RepoListItem => r !== null);
  }

  /**
   * Load snapshot data for a repository by ID directly.
   * Expects a file named `{repoId}.json` in the data directory.
   * Throws when the file does not exist.
   */
  async loadSnapshot(repoId: string): Promise<RepositorySnapshot | TimelineData> {
    const filename = `${repoId}.json`;
    const filePath = path.join(this.dataDir, filename);
    const resolved = path.resolve(this.dataDir, filename);
    if (
      !resolved.startsWith(path.resolve(this.dataDir) + path.sep) ||
      repoId.includes('%') ||
      repoId.includes('\\')
    ) {
      throw new Error(`Invalid repository id: ${repoId}`);
    }
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as RepositorySnapshot | TimelineData;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Repository not found: ${repoId}`);
      }
      throw err;
    }
  }

  /**
   * Load structure analysis data for a repository.
   * Expects a file named `{repoId}-structure.json` in the data directory.
   * Throws when the file does not exist.
   */
  async loadStructure(repoId: string): Promise<StructureGraph> {
    const filename = `${repoId}-structure.json`;
    const filePath = path.join(this.dataDir, filename);
    const resolved = path.resolve(this.dataDir, filename);
    if (
      !resolved.startsWith(path.resolve(this.dataDir) + path.sep) ||
      repoId.includes('%') ||
      repoId.includes('\\')
    ) {
      throw new Error(`Invalid repository id: ${repoId}`);
    }
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as StructureGraph;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Structure data not found for repository: ${repoId}. Run processing with mode 'structure' first.`);
      }
      throw err;
    }
  }

  /**
   * Load complexity analysis data for a repository.
   * Expects a file named `{repoId}-complexity.json` in the data directory.
   * Throws when the file does not exist.
   */
  async loadComplexity(repoId: string): Promise<ComplexityReport> {
    const filename = `${repoId}-complexity.json`;
    const filePath = path.join(this.dataDir, filename);
    const resolved = path.resolve(this.dataDir, filename);
    if (
      !resolved.startsWith(path.resolve(this.dataDir) + path.sep) ||
      repoId.includes('%') ||
      repoId.includes('\\')
    ) {
      throw new Error(`Invalid repository id: ${repoId}`);
    }
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as ComplexityReport;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Complexity data not found for repository: ${repoId}. Run processing with mode 'complexity' first.`);
      }
      throw err;
    }
  }

  /**
   * Load coupling analysis data for a repository.
   * Expects a file named `{repoId}-coupling.json` in the data directory.
   * Throws when the file does not exist.
   */
  async loadCoupling(repoId: string): Promise<CouplingGraph> {
    const filename = `${repoId}-coupling.json`;
    const filePath = path.join(this.dataDir, filename);
    const resolved = path.resolve(this.dataDir, filename);
    if (
      !resolved.startsWith(path.resolve(this.dataDir) + path.sep) ||
      repoId.includes('%') ||
      repoId.includes('\\')
    ) {
      throw new Error(`Invalid repository id: ${repoId}`);
    }
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as CouplingGraph;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Coupling data not found for repository: ${repoId}. Run processing with mode 'coupling' first.`);
      }
      throw err;
    }
  }

  /**
   * Load structure import edges for a repository, with optional filters.
   * @param repoId - Repository identifier (matches filename prefix)
   * @param fileFilter - When provided, only return edges where `from` starts with this prefix
   * @param externalFilter - When provided, filter to only external (true) or internal (false) imports
   */
  async loadImports(
    repoId: string,
    fileFilter?: string,
    externalFilter?: boolean
  ): Promise<ImportEdge[]> {
    const structure = await this.loadStructure(repoId);
    let imports = structure.imports;

    if (fileFilter !== undefined) {
      imports = imports.filter(edge => edge.from.startsWith(fileFilter));
    }

    if (externalFilter !== undefined) {
      imports = imports.filter(edge => edge.isExternal === externalFilter);
    }

    return imports;
  }

  /**
   * Load repository data by ID
   */
  async loadRepo(repoId: string): Promise<RepositorySnapshot | TimelineData> {
    const file = await this.findFileByRepoId(repoId);
    if (!file) {
      throw new Error(`Repository not found: ${repoId}`);
    }
    return this.loadRepoFile(file);
  }

  /**
   * Find repository by GitHub URL
   */
  async findRepoByUrl(url: string): Promise<RepoInfo | null> {
    // Extract repo name from URL
    // "https://github.com/facebook/react" → "react"
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
    if (!match) return null;

    const repoName = match[1].toLowerCase();
    const repos = await this.listRepos();

    // Find repo whose ID contains the repo name
    const found = repos.find(r => r.id.toLowerCase().includes(repoName));
    if (!found) return null;

    return {
      ...found,
      url
    };
  }

  /**
   * Load and parse JSON file from data directory
   */
  private async loadRepoFile(filename: string): Promise<RepositorySnapshot | TimelineData> {
    const cached = this.cache.get(filename);
    if (cached) return cached;

    const filePath = path.join(this.dataDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as RepositorySnapshot | TimelineData;
    this.cache.set(filename, data);
    return data;
  }

  /**
   * Convert filename to repository ID
   */
  private fileToRepoId(filename: string): string {
    return filename.replace('.json', '').toLowerCase();
  }

  /**
   * Find file by repository ID
   */
  private async findFileByRepoId(repoId: string): Promise<string | null> {
    const files = await fs.readdir(this.dataDir);
    return files.find(f => this.fileToRepoId(f) === repoId.toLowerCase()) || null;
  }

  /**
   * Detect format from data structure
   */
  private detectFormat(data: unknown): string {
    if (typeof data === 'object' && data !== null && 'format' in data) {
      const { format } = data as { format: unknown };
      if (typeof format === 'string') {
        return format;
      }
    }
    return 'static';
  }
}
