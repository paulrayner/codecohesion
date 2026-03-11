/**
 * Temporal Coupling Analyzer
 *
 * Analyzes git history to detect files that change together over time.
 * Uses Louvain clustering to identify potential bounded contexts.
 *
 * Based on research from:
 * - CodeScene's temporal coupling analysis
 * - "Microservice Decomposition via Static and Dynamic Analysis" (2020)
 * - DDD-VISION.md Level 1: File Co-Change Analysis
 */

import { TimelineDataV2, CommitSnapshot } from '@codecohesion/shared-types';
import { CouplingGraph, CouplingEdge, Cluster } from './coupling-types';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { Logger, consoleLogger } from './logger';

export class CouplingAnalyzer {
  private logger: Logger;

  // Configuration parameters
  private readonly MIN_COUPLING_THRESHOLD = 0.1;  // Ignore weak coupling (< 10%)
  private readonly MIN_CLUSTER_SIZE = 2;          // Ignore single-file clusters
  private readonly MAX_EDGES_OUTPUT = 10000;      // Prevent huge output files
  private readonly MIN_COCHANGE_COUNT = 2;        // Must change together at least twice

  // Internal state
  private coChangeMatrix: Map<string, Map<string, number>> = new Map();
  private fileChangeCounts: Map<string, number> = new Map();

  constructor(logger: Logger = consoleLogger) {
    this.logger = logger;
  }

  /**
   * Analyze temporal coupling from Timeline V2 data
   */
  analyze(timeline: TimelineDataV2, timelineFilePath: string): CouplingGraph {
    this.logger.log(`\n🔍 Analyzing temporal coupling...`);
    this.logger.log(`   Repository: ${timeline.repositoryPath}`);
    this.logger.log(`   Commits: ${timeline.commits.length}`);

    // Validate input format
    if (timeline.format !== 'timeline-v2') {
      throw new Error(`Invalid format: ${timeline.format}. Expected 'timeline-v2'`);
    }

    // Step 1: Build co-change matrix from commit history
    this.buildCoChangeMatrix(timeline.commits);

    // Step 2: Calculate coupling scores (Jaccard similarity)
    const edges = this.calculateCouplingScores();
    this.logger.log(`   Coupling edges: ${edges.length} (after filtering)`);

    // Step 3: Build graph for clustering
    const graph = this.buildGraph(edges);
    this.logger.log(`   Graph nodes: ${graph.order}, edges: ${graph.size}`);

    // Step 4: Run Louvain clustering
    const clusters = this.clusterFiles(graph);
    this.logger.log(`   Clusters detected: ${clusters.length}`);

    // Return complete coupling graph
    return {
      format: 'coupling-v1',
      repositoryPath: timeline.repositoryPath,
      sourceTimeline: timelineFilePath,
      analysis: {
        totalCommits: timeline.commits.length,
        filesAnalyzed: this.fileChangeCounts.size,
        couplingEdges: edges.length,
        generatedAt: new Date().toISOString(),
      },
      edges,
      clusters,
    };
  }

  /**
   * Build co-change matrix by analyzing all commits
   */
  private buildCoChangeMatrix(commits: CommitSnapshot[]): void {
    this.logger.log(`   Building co-change matrix...`);

    for (const commit of commits) {
      // Get all changed files (modified + added, exclude deleted)
      const changedFiles = [
        ...commit.changes.filesModified,
        ...commit.changes.filesAdded,
      ];

      // Skip empty commits
      if (changedFiles.length === 0) continue;

      // Record that each file changed
      for (const file of changedFiles) {
        this.fileChangeCounts.set(file, (this.fileChangeCounts.get(file) || 0) + 1);
      }

      // Record co-changes for every pair of files in this commit
      for (let i = 0; i < changedFiles.length; i++) {
        for (let j = i + 1; j < changedFiles.length; j++) {
          const fileA = changedFiles[i];
          const fileB = changedFiles[j];

          // Store in sorted order to avoid duplicates
          const [first, second] = fileA < fileB ? [fileA, fileB] : [fileB, fileA];

          if (!this.coChangeMatrix.has(first)) {
            this.coChangeMatrix.set(first, new Map());
          }

          const fileAEdges = this.coChangeMatrix.get(first)!;
          fileAEdges.set(second, (fileAEdges.get(second) || 0) + 1);
        }
      }
    }

    this.logger.log(`   Files tracked: ${this.fileChangeCounts.size}`);
    this.logger.log(`   Raw co-change pairs: ${this.getTotalCoChangePairs()}`);
  }

  /**
   * Calculate coupling scores using Jaccard similarity
   */
  private calculateCouplingScores(): CouplingEdge[] {
    this.logger.log(`   Calculating coupling scores...`);
    const edges: CouplingEdge[] = [];

    for (const [fileA, fileAEdges] of this.coChangeMatrix) {
      const changesA = this.fileChangeCounts.get(fileA) || 0;

      for (const [fileB, coChangeCount] of fileAEdges) {
        const changesB = this.fileChangeCounts.get(fileB) || 0;

        // Jaccard similarity: |A ∩ B| / |A ∪ B|
        // = changes_together / (changes_to_A + changes_to_B - changes_together)
        const coupling = coChangeCount / (changesA + changesB - coChangeCount);

        // Filter out weak coupling and infrequent co-changes
        if (coupling >= this.MIN_COUPLING_THRESHOLD && coChangeCount >= this.MIN_COCHANGE_COUNT) {
          edges.push({
            fileA,
            fileB,
            coChangeCount,
            coupling: Math.round(coupling * 1000) / 1000, // Round to 3 decimals
          });
        }
      }
    }

    // Sort by coupling strength (strongest first) and limit output size
    edges.sort((a, b) => b.coupling - a.coupling);

    if (edges.length > this.MAX_EDGES_OUTPUT) {
      this.logger.log(`   ⚠️  Limiting edges to top ${this.MAX_EDGES_OUTPUT} (from ${edges.length})`);
      return edges.slice(0, this.MAX_EDGES_OUTPUT);
    }

    return edges;
  }

  /**
   * Build weighted graph from coupling edges
   */
  private buildGraph(edges: CouplingEdge[]): Graph {
    this.logger.log(`   Building weighted graph...`);
    const graph = new Graph({ type: 'undirected' });

    // Add all files as nodes
    for (const file of this.fileChangeCounts.keys()) {
      graph.addNode(file);
    }

    // Add edges with coupling as weight
    for (const edge of edges) {
      // Some files might not have nodes if they didn't pass the threshold
      if (graph.hasNode(edge.fileA) && graph.hasNode(edge.fileB)) {
        graph.addEdge(edge.fileA, edge.fileB, { weight: edge.coupling });
      }
    }

    return graph;
  }

  /**
   * Cluster files using Louvain community detection
   */
  private clusterFiles(graph: Graph): Cluster[] {
    this.logger.log(`   Running Louvain clustering...`);

    // Run Louvain algorithm
    const clusterAssignments = louvain(graph, {
      resolution: 1.0, // Standard resolution (can be tuned)
    });

    // Group files by cluster ID
    const clustersMap = new Map<number, string[]>();
    for (const [file, clusterId] of Object.entries(clusterAssignments)) {
      if (!clustersMap.has(clusterId)) {
        clustersMap.set(clusterId, []);
      }
      clustersMap.get(clusterId)!.push(file);
    }

    // Convert to Cluster objects
    const clusters: Cluster[] = [];
    let clusterNumber = 1;

    for (const [_clusterId, files] of clustersMap) {
      // Filter out very small clusters
      if (files.length < this.MIN_CLUSTER_SIZE) {
        continue;
      }

      clusters.push({
        id: clusterNumber++,
        name: `Cluster ${clusterNumber}`,
        files,
        fileCount: files.length,
        avgInternalCoupling: this.calculateAvgInternalCoupling(files, graph),
      });
    }

    // Sort clusters by size (largest first)
    clusters.sort((a, b) => b.fileCount - a.fileCount);

    // Renumber clusters after sorting
    clusters.forEach((cluster, index) => {
      cluster.id = index + 1;
      cluster.name = `Cluster ${index + 1}`;
    });

    return clusters;
  }

  /**
   * Calculate average coupling within a cluster
   */
  private calculateAvgInternalCoupling(files: string[], graph: Graph): number {
    let totalCoupling = 0;
    let edgeCount = 0;

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const fileA = files[i];
        const fileB = files[j];

        if (graph.hasEdge(fileA, fileB)) {
          const attrs = graph.getEdgeAttributes(fileA, fileB);
          totalCoupling += (attrs.weight as number) || 0;
          edgeCount++;
        }
      }
    }

    return edgeCount > 0 ? Math.round((totalCoupling / edgeCount) * 1000) / 1000 : 0;
  }

  /**
   * Get total number of co-change pairs (for logging)
   */
  private getTotalCoChangePairs(): number {
    let total = 0;
    for (const fileAEdges of this.coChangeMatrix.values()) {
      total += fileAEdges.size;
    }
    return total;
  }
}
