import { DataLoader } from './data-loader';
import {
  FileNode,
  TreeNode,
  RepositorySnapshot,
  TimelineData,
  StatsResponse,
  ContributorsResponse,
  ContributorInfo,
  FilesResponse,
  HotspotsResponse
} from './types';

export class QueryService {
  constructor(private dataLoader: DataLoader) {}

  /**
   * Find repository by URL
   */
  async findRepoByUrl(url: string) {
    return this.dataLoader.findRepoByUrl(url);
  }

  /**
   * Get repository statistics
   */
  async getStats(repoId: string): Promise<StatsResponse> {
    const data = await this.dataLoader.loadRepo(repoId);
    const snapshot = this.extractSnapshot(data);

    return {
      repository: {
        id: repoId,
        path: snapshot.repositoryPath
      },
      analyzedAt: snapshot.timestamp,
      commit: snapshot.commit,
      stats: snapshot.stats
    };
  }

  /**
   * Get contributors with optional date filtering and limit
   */
  async getContributors(
    repoId: string,
    since?: string,
    until?: string,
    limit?: number
  ): Promise<ContributorsResponse> {
    const data = await this.dataLoader.loadRepo(repoId);
    const snapshot = this.extractSnapshot(data);

    const contributorMap = new Map<string, ContributorInfo>();

    this.traverseTree(snapshot.tree, (node) => {
      if (node.type === 'file' && node.lastAuthor) {
        // Filter by date range if specified
        if (!this.isWithinDateRange(node.lastModified, since, until)) {
          return;
        }

        const existing = contributorMap.get(node.lastAuthor) || {
          email: node.lastAuthor,
          filesChanged: 0,
          lastModified: node.lastModified || ''
        };

        existing.filesChanged++;
        if (node.lastModified && node.lastModified > existing.lastModified) {
          existing.lastModified = node.lastModified;
        }

        contributorMap.set(node.lastAuthor, existing);
      }
    });

    const sortedContributors = Array.from(contributorMap.values())
      .sort((a, b) => b.filesChanged - a.filesChanged);

    const contributors = limit
      ? sortedContributors.slice(0, limit)
      : sortedContributors;

    return {
      repository: { id: repoId },
      period: { since, until, limit },
      contributors,
      total: contributorMap.size
    };
  }

  /**
   * Get files with optional path filtering and sorting
   */
  async getFiles(
    repoId: string,
    pathFilter?: string,
    metric?: string
  ): Promise<FilesResponse> {
    const data = await this.dataLoader.loadRepo(repoId);
    const snapshot = this.extractSnapshot(data);

    const files: FileNode[] = [];
    this.traverseTree(snapshot.tree, (node) => {
      if (node.type === 'file') {
        if (pathFilter && !node.path.startsWith(pathFilter)) return;
        files.push(node);
      }
    });

    // Sort by metric if provided
    if (metric === 'churn') {
      files.sort((a, b) => (b.commitCount || 0) - (a.commitCount || 0));
    } else if (metric === 'contributors') {
      files.sort((a, b) => (b.contributorCount || 0) - (a.contributorCount || 0));
    } else if (metric === 'loc') {
      files.sort((a, b) => b.loc - a.loc);
    } else if (metric === 'age') {
      files.sort((a, b) => {
        if (!a.firstCommitDate || !b.firstCommitDate) return 0;
        return new Date(a.firstCommitDate).getTime() - new Date(b.firstCommitDate).getTime();
      });
    }

    return { files, total: files.length };
  }

  /**
   * Get hotspot files (high churn and high contributor count)
   */
  async getHotspots(repoId: string, limit: number = 20): Promise<HotspotsResponse> {
    const { files } = await this.getFiles(repoId);

    const topChurn = files
      .filter(f => f.commitCount)
      .sort((a, b) => (b.commitCount || 0) - (a.commitCount || 0))
      .slice(0, limit);

    const topContributors = files
      .filter(f => f.contributorCount)
      .sort((a, b) => (b.contributorCount || 0) - (a.contributorCount || 0))
      .slice(0, limit);

    return {
      topChurn,
      topContributors
    };
  }

  /**
   * Extract snapshot from Timeline or static format
   */
  private extractSnapshot(data: RepositorySnapshot | TimelineData): RepositorySnapshot {
    return 'headSnapshot' in data ? data.headSnapshot : data;
  }

  /**
   * Traverse tree recursively and call callback for each node
   */
  private traverseTree(node: TreeNode, callback: (node: TreeNode) => void) {
    callback(node);
    if (node.type === 'directory') {
      node.children.forEach(child => this.traverseTree(child, callback));
    }
  }

  /**
   * Check if date is within range
   */
  private isWithinDateRange(
    dateStr: string | null,
    since?: string,
    until?: string
  ): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);

    if (since && date < new Date(since)) return false;
    if (until && date > new Date(until)) return false;

    return true;
  }
}
