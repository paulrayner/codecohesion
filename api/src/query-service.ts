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
  HotspotsResponse,
  HealthScoreResponse
} from './types';
import type { ImportEdge, FunctionDecl, CouplingEdge } from 'codecohesion-processor';

export interface FileContextResponse {
  repository: { id: string };
  file: string;
  ownership: {
    lastAuthor: string | null;
    commitCount: number | null;
  };
  imports: ImportEdge[];
  functions: FunctionDecl[];
  coupling?: CouplingEdge[];
}

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
   * Get impact analysis for a file — returns all transitive dependents via BFS
   * over the reverse dependency map built from structure import edges.
   */
  async getImpact(repoId: string, filePath: string) {
    const structure = await this.dataLoader.loadStructure(repoId);

    // Build reverse dependency map: file -> set of files that import it
    const reverseDeps = new Map<string, Set<string>>();
    for (const edge of structure.imports) {
      if (!reverseDeps.has(edge.to)) {
        reverseDeps.set(edge.to, new Set());
      }
      reverseDeps.get(edge.to)!.add(edge.from);
    }

    // BFS to find all transitive dependents
    const allDependents = new Set<string>();
    const queue = [...(reverseDeps.get(filePath) ?? [])];
    for (const dep of queue) {
      allDependents.add(dep);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const dep of (reverseDeps.get(current) ?? [])) {
        if (!allDependents.has(dep)) {
          allDependents.add(dep);
          queue.push(dep);
        }
      }
    }

    const impactedFiles = [...allDependents];
    return {
      repository: { id: repoId },
      file: filePath,
      impactedFiles,
      blastRadius: impactedFiles.length,
    };
  }

  /**
   * Get context for a specific file — aggregates ownership, imports, functions, and optional coupling.
   */
  async getContext(repoId: string, filePath: string): Promise<FileContextResponse> {
    const data = await this.dataLoader.loadSnapshot(repoId);
    const snapshot = this.extractSnapshot(data);

    // Find file node in tree for ownership info
    let fileNode: TreeNode | null = null;
    this.traverseTree(snapshot.tree, (node) => {
      if (node.type === 'file' && node.path === filePath) {
        fileNode = node;
      }
    });

    const ownership = {
      lastAuthor: fileNode ? (fileNode as FileNode).lastAuthor ?? null : null,
      commitCount: fileNode ? (fileNode as FileNode).commitCount ?? null : null,
    };

    const structure = await this.dataLoader.loadStructure(repoId);
    const imports = structure.imports.filter((edge) => edge.from === filePath);
    const functions = structure.functions.filter((fn) => fn.file === filePath);

    // Coupling is optional — graceful degradation when not found
    let coupling: FileContextResponse['coupling'];
    try {
      const couplingGraph = await this.dataLoader.loadCoupling(repoId);
      coupling = couplingGraph.edges.filter(
        (edge) => edge.fileA === filePath || edge.fileB === filePath
      );
    } catch {
      // coupling data not available — omit from response
      coupling = undefined;
    }

    const response: FileContextResponse = {
      repository: { id: repoId },
      file: filePath,
      ownership,
      imports,
      functions,
    };

    if (coupling !== undefined) {
      response.coupling = coupling;
    }

    return response;
  }

  /**
   * Get full coupling graph (edges + clusters + analysis metadata) for a repository.
   */
  async getCoupling(repoId: string) {
    const couplingGraph = await this.dataLoader.loadCoupling(repoId);
    return {
      repository: { id: repoId },
      data: {
        analysis: couplingGraph.analysis,
        edges: couplingGraph.edges,
        clusters: couplingGraph.clusters,
      },
    };
  }

  /**
   * Get coupling edges for a specific file, sorted by coupling descending.
   */
  async getCouplingForFile(repoId: string, filePath: string) {
    const couplingGraph = await this.dataLoader.loadCoupling(repoId);
    const edges = couplingGraph.edges
      .filter((edge) => edge.fileA === filePath || edge.fileB === filePath)
      .sort((a, b) => b.coupling - a.coupling);
    return {
      repository: { id: repoId },
      file: filePath,
      edges,
    };
  }

  /**
   * Get complexity analysis data for a repository
   */
  async getComplexity(repoId: string) {
    const data = await this.dataLoader.loadComplexity(repoId);
    return {
      repository: { id: repoId },
      data
    };
  }

  /**
   * Get top-N hotspot entries sorted by hotspotScore descending
   */
  async getComplexityHotspots(repoId: string, limit: number = 20) {
    const report = await this.dataLoader.loadComplexity(repoId);
    const hotspots = [...report.hotspots]
      .sort((a, b) => b.hotspotScore - a.hotspotScore)
      .slice(0, limit);
    return { hotspots };
  }

  /**
   * Compute a composite health score for a repository.
   *
   * Weights (when all data is available):
   *   churnConcentration      30% — Gini coefficient of commit counts; low Gini = healthy
   *   contributorDistribution 20% — bus factor (unique contributors); more = healthier
   *   complexityHotspotDensity 30% — fraction of hotspots above 0.5 threshold; fewer = healthier
   *   couplingDensity         20% — fraction of edges with coupling > 0.5; lower = healthier
   *
   * When optional data (complexity / coupling) is unavailable, its weight is
   * redistributed proportionally across the remaining available metrics.
   */
  async getHealth(repoId: string): Promise<HealthScoreResponse> {
    const snapshotData = await this.dataLoader.loadSnapshot(repoId);
    const snapshot = this.extractSnapshot(snapshotData);

    // --- Collect all file nodes ---
    const files: FileNode[] = [];
    this.traverseTree(snapshot.tree, (node) => {
      if (node.type === 'file') {
        files.push(node);
      }
    });

    // --- Churn concentration (Gini coefficient of commit counts) ---
    // Low Gini (evenly distributed churn) = healthy → high score
    const commitCounts = files.map((f) => f.commitCount ?? 0).filter((c) => c > 0);
    const churnGini = this.giniCoefficient(commitCounts);
    // Gini of 0 = perfect equality = score 100; Gini of 1 = maximum concentration = score 0
    const churnConcentrationScore = Math.round((1 - churnGini) * 100);

    // --- Contributor distribution (bus factor) ---
    // Higher unique contributor counts = healthier; we use the median contributorCount per file
    const contributorCounts = files.map((f) => f.contributorCount ?? 1);
    const avgContributors = contributorCounts.length > 0
      ? contributorCounts.reduce((s, c) => s + c, 0) / contributorCounts.length
      : 1;
    // Cap at 10 contributors average for a score of 100
    const contributorDistributionScore = Math.min(100, Math.round((avgContributors / 10) * 100));

    // --- Optional: complexity hotspot density ---
    let complexityHotspotDensityScore: number | null = null;
    try {
      const complexityReport = await this.dataLoader.loadComplexity(repoId);
      // Hotspot density: fraction of hotspots with hotspotScore > 0.5
      const highHotspots = complexityReport.hotspots.filter((h) => h.hotspotScore > 0.5).length;
      const totalHotspots = complexityReport.hotspots.length;
      const density = totalHotspots > 0 ? highHotspots / totalHotspots : 0;
      // Lower density = healthier
      complexityHotspotDensityScore = Math.round((1 - density) * 100);
    } catch {
      // Complexity data not available — skip this metric
    }

    // --- Optional: coupling density ---
    let couplingDensityScore: number | null = null;
    try {
      const couplingGraph = await this.dataLoader.loadCoupling(repoId);
      // Strong coupling ratio: edges with coupling > 0.5
      const strongEdges = couplingGraph.edges.filter((e) => e.coupling > 0.5).length;
      const totalEdges = couplingGraph.edges.length;
      const ratio = totalEdges > 0 ? strongEdges / totalEdges : 0;
      // Lower ratio = healthier
      couplingDensityScore = Math.round((1 - ratio) * 100);
    } catch {
      // Coupling data not available — skip this metric
    }

    // --- Weighted composite score with proportional redistribution ---
    // Base weights
    const baseWeights = {
      churnConcentration: 0.30,
      contributorDistribution: 0.20,
      complexityHotspotDensity: complexityHotspotDensityScore !== null ? 0.30 : 0,
      couplingDensity: couplingDensityScore !== null ? 0.20 : 0,
    };

    const totalWeight = Object.values(baseWeights).reduce((s, w) => s + w, 0);

    const score = Math.round(
      (churnConcentrationScore * baseWeights.churnConcentration
        + contributorDistributionScore * baseWeights.contributorDistribution
        + (complexityHotspotDensityScore ?? 0) * baseWeights.complexityHotspotDensity
        + (couplingDensityScore ?? 0) * baseWeights.couplingDensity
      ) / totalWeight
    );

    // --- Recommendations ---
    const recommendations: string[] = [];

    if (churnConcentrationScore < 50) {
      // Find the most churned file for actionable advice
      const mostChurned = [...files].sort((a, b) => (b.commitCount ?? 0) - (a.commitCount ?? 0))[0];
      const fileHint = mostChurned ? ` (e.g. ${mostChurned.path} with ${mostChurned.commitCount} commits)` : '';
      recommendations.push(
        `Churn is highly concentrated in a few files${fileHint}. Consider breaking them apart or improving test coverage to reduce risk.`
      );
    }

    if (contributorDistributionScore < 50) {
      recommendations.push(
        'Many files have very few contributors. Increase code review participation and knowledge sharing to reduce bus-factor risk.'
      );
    }

    if (complexityHotspotDensityScore !== null && complexityHotspotDensityScore < 50) {
      recommendations.push(
        'A significant fraction of files are complexity hotspots. Refactor high-complexity functions and reduce cyclomatic complexity.'
      );
    }

    if (couplingDensityScore !== null && couplingDensityScore < 50) {
      recommendations.push(
        'Strong temporal coupling detected between many file pairs. Review co-change patterns and consider decoupling tightly coupled modules.'
      );
    }

    return {
      repository: { id: repoId },
      score,
      breakdown: {
        churnConcentration: churnConcentrationScore,
        contributorDistribution: contributorDistributionScore,
        complexityHotspotDensity: complexityHotspotDensityScore,
        couplingDensity: couplingDensityScore,
      },
      analyzedAt: new Date().toISOString(),
      recommendations,
    };
  }

  /**
   * Compute the Gini coefficient for an array of non-negative values.
   * Returns 0 for perfect equality, approaching 1 for maximum concentration.
   */
  private giniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((s, v) => s + v, 0);
    if (total === 0) return 0;
    const weightedSum = sorted.reduce((s, v, i) => s + (i + 1) * v, 0);
    // Gini = (2 * sum(rank * value)) / (n * total) - (n + 1) / n
    return (2 * weightedSum) / (n * total) - (n + 1) / n;
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
