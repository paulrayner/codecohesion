import fs from 'fs/promises';
import path from 'path';
import { RepositorySnapshot, TimelineData, RepoListItem, RepoInfo } from './types';
import { LRUCache } from './lru-cache';

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
