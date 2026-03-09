import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { DataLoader } from './data-loader';

describe('DataLoader', () => {
  let dataLoader: DataLoader;

  beforeAll(() => {
    // Use test fixtures directory
    const testDataDir = path.join(__dirname, '../test/data');
    dataLoader = new DataLoader(testDataDir);
  });

  describe('listRepos', () => {
    it('should list available repositories', async () => {
      const repos = await dataLoader.listRepos();

      expect(repos).toBeInstanceOf(Array);
      expect(repos.length).toBeGreaterThan(0);

      const repo = repos[0];
      expect(repo).toHaveProperty('id');
      expect(repo).toHaveProperty('name');
      expect(repo).toHaveProperty('format');
    });

    it('should detect static format', async () => {
      const repos = await dataLoader.listRepos();
      const staticRepo = repos.find(r => r.name.includes('static'));

      expect(staticRepo).toBeDefined();
      expect(staticRepo?.format).toBe('static');
    });

    it('should detect timeline-v2 format', async () => {
      const repos = await dataLoader.listRepos();
      const timelineRepo = repos.find(r => r.name.includes('timeline'));

      expect(timelineRepo).toBeDefined();
      expect(timelineRepo?.format).toBe('timeline-v2');
    });
  });

  describe('loadRepo', () => {
    it('should load repository by ID (static format)', async () => {
      const repos = await dataLoader.listRepos();
      const staticRepo = repos.find(r => r.name.includes('static'));
      if (!staticRepo) throw new Error('Static test fixture not found');

      const data = await dataLoader.loadRepo(staticRepo.id);

      expect(data).toBeDefined();
      expect(data).toHaveProperty('tree');
    });

    it('should throw error for non-existent repository', async () => {
      await expect(dataLoader.loadRepo('non-existent')).rejects.toThrow('Repository not found');
    });

    it('should load static format correctly', async () => {
      const repos = await dataLoader.listRepos();
      const staticRepo = repos.find(r => r.name.includes('static'));
      if (!staticRepo) throw new Error('Static test fixture not found');

      const data = await dataLoader.loadRepo(staticRepo.id);

      expect(data).toHaveProperty('repositoryPath');
      expect(data).toHaveProperty('commit');
      expect(data).toHaveProperty('tree');
      expect(data).toHaveProperty('stats');
    });

    it('should load timeline format correctly', async () => {
      const repos = await dataLoader.listRepos();
      const timelineRepo = repos.find(r => r.name.includes('timeline'));
      if (!timelineRepo) throw new Error('Timeline test fixture not found');

      const data = await dataLoader.loadRepo(timelineRepo.id);

      expect(data).toHaveProperty('format');
      expect(data).toHaveProperty('commits');
      expect(data).toHaveProperty('metadata');
      expect((data as Record<string, unknown>).format).toBe('timeline-v2');
    });
  });

  describe('findRepoByUrl', () => {
    it('should find repository by GitHub URL', async () => {
      const repo = await dataLoader.findRepoByUrl('https://github.com/test/ecommerce');

      expect(repo).toBeDefined();
      expect(repo?.id).toContain('ecommerce');
    });

    it('should handle URLs with .git suffix', async () => {
      const repo = await dataLoader.findRepoByUrl('https://github.com/test/ecommerce.git');

      expect(repo).toBeDefined();
      expect(repo?.id).toContain('ecommerce');
    });

    it('should return null for non-existent repository', async () => {
      const repo = await dataLoader.findRepoByUrl('https://github.com/test/nonexistent');

      expect(repo).toBeNull();
    });

    it('should return null for invalid URL', async () => {
      const repo = await dataLoader.findRepoByUrl('not-a-url');

      expect(repo).toBeNull();
    });
  });
});
