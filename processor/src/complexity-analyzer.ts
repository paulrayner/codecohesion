/**
 * Complexity Analyzer
 *
 * Analyzes cyclomatic and cognitive complexity from a StructureGraph and
 * RepositorySnapshot. Produces a ComplexityReport with per-file metrics and
 * hotspot rankings (complexity × churn).
 *
 * Input: pre-computed StructureGraph (with optional functionBodies extension)
 *        and RepositorySnapshot (for commit count / churn data).
 * Constructor: optional Logger.
 *
 * Follows the same pattern as CouplingAnalyzer.
 */

import { RepositorySnapshot, FileNode } from '@codecohesion/shared-types';
import { StructureGraph, FunctionDecl } from './structure-types';
import {
  ComplexityReport,
  FileComplexity,
  FunctionComplexity,
  HotspotEntry,
} from './complexity-types';
import { calculateCyclomatic, calculateCognitive } from './complexity-calculators';
import { Logger, consoleLogger } from './logger';

/**
 * Extended StructureGraph that carries pre-computed function body strings
 * keyed by function name. Provided by the test harness and by callers that
 * supply source bodies for complexity calculation.
 */
interface StructureGraphWithBodies extends StructureGraph {
  functionBodies?: Record<string, string>;
}

export class ComplexityAnalyzer {
  private readonly logger: Logger;

  constructor(logger: Logger = consoleLogger) {
    this.logger = logger;
  }

  /**
   * Analyze complexity from a StructureGraph and RepositorySnapshot.
   * Returns a ComplexityReport with per-file metrics and hotspot rankings.
   */
  analyze(
    graph: StructureGraphWithBodies,
    snapshot: RepositorySnapshot,
  ): ComplexityReport {
    this.logger.log('Analyzing complexity...');

    const fileNodes = this.collectFileNodes(snapshot);
    const functionBodies = graph.functionBodies ?? {};

    // Group function declarations by file
    const functionsByFile = this.groupFunctionsByFile(graph.functions);

    // Build per-file complexity metrics
    const files: FileComplexity[] = fileNodes.map((fileNode) => {
      const filePath = fileNode.path;
      const decls = functionsByFile.get(filePath) ?? [];
      return this.analyzeFile(filePath, decls, functionBodies);
    });

    // Compute hotspot scores (complexity × churn, both normalized to [0,1])
    const hotspots = this.buildHotspots(files, fileNodes);

    // Aggregate analysis stats
    const allFunctions = files.flatMap((f) => f.functions);
    const functionsAnalyzed = allFunctions.length;
    const avgCyclomatic =
      functionsAnalyzed > 0
        ? allFunctions.reduce((sum, fn) => sum + fn.cyclomatic, 0) / functionsAnalyzed
        : 0;
    const avgCognitive =
      functionsAnalyzed > 0
        ? allFunctions.reduce((sum, fn) => sum + fn.cognitive, 0) / functionsAnalyzed
        : 0;

    return {
      format: 'complexity-v1',
      repositoryPath: graph.repositoryPath,
      analyzedAt: new Date().toISOString(),
      analysis: {
        filesAnalyzed: files.length,
        functionsAnalyzed,
        avgCyclomatic,
        avgCognitive,
      },
      files,
      hotspots,
    };
  }

  /**
   * Flatten the snapshot tree into a list of FileNode instances.
   */
  private collectFileNodes(snapshot: RepositorySnapshot): FileNode[] {
    const result: FileNode[] = [];

    const walk = (node: RepositorySnapshot['tree'] | RepositorySnapshot['tree']['children'][number]): void => {
      if (node.type === 'file') {
        result.push(node as FileNode);
      } else if ('children' in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child);
        }
      }
    };

    walk(snapshot.tree);
    return result;
  }

  /**
   * Group FunctionDecl entries by their file path.
   */
  private groupFunctionsByFile(functions: FunctionDecl[]): Map<string, FunctionDecl[]> {
    const map = new Map<string, FunctionDecl[]>();
    for (const decl of functions) {
      const existing = map.get(decl.file);
      if (existing) {
        existing.push(decl);
      } else {
        map.set(decl.file, [decl]);
      }
    }
    return map;
  }

  /**
   * Compute FileComplexity for a single file.
   */
  private analyzeFile(
    filePath: string,
    decls: FunctionDecl[],
    functionBodies: Record<string, string>,
  ): FileComplexity {
    const functions: FunctionComplexity[] = decls.map((decl) => {
      const key = `${decl.file}::${decl.name}::${decl.line}`;
      const body = functionBodies[key] ?? '';
      return {
        name: decl.name,
        kind: decl.kind,
        line: decl.line,
        endLine: decl.endLine,
        cyclomatic: calculateCyclomatic(body),
        cognitive: calculateCognitive(body),
      };
    });

    const totalCyclomatic = functions.reduce((sum, fn) => sum + fn.cyclomatic, 0);
    const totalCognitive = functions.reduce((sum, fn) => sum + fn.cognitive, 0);
    const maxCyclomatic = functions.reduce((max, fn) => fn.cyclomatic > max ? fn.cyclomatic : max, 0);
    const maxCognitive = functions.reduce((max, fn) => fn.cognitive > max ? fn.cognitive : max, 0);

    return {
      file: filePath,
      totalCyclomatic,
      totalCognitive,
      maxCyclomatic,
      maxCognitive,
      functionCount: functions.length,
      functions,
    };
  }

  /**
   * Build hotspot entries by normalizing complexity and churn scores to [0,1]
   * then computing hotspotScore = complexityScore × churnScore.
   * Returns entries sorted descending by hotspotScore.
   */
  private buildHotspots(
    files: FileComplexity[],
    fileNodes: FileNode[],
  ): HotspotEntry[] {
    // Build a commit-count lookup by file path
    const commitCounts = new Map<string, number>();
    for (const node of fileNodes) {
      commitCounts.set(node.path, node.commitCount ?? 0);
    }

    const maxCyclomatic = files.reduce((max, f) => f.totalCyclomatic > max ? f.totalCyclomatic : max, 0);
    const maxCommitCount = fileNodes.reduce((max, n) => (n.commitCount ?? 0) > max ? (n.commitCount ?? 0) : max, 0);

    const hotspots: HotspotEntry[] = files.map((fileComplexity) => {
      const commitCount = commitCounts.get(fileComplexity.file) ?? 0;

      const complexityScore = maxCyclomatic > 0
        ? fileComplexity.totalCyclomatic / maxCyclomatic
        : 0;

      const churnScore = maxCommitCount > 0
        ? commitCount / maxCommitCount
        : 0;

      return {
        file: fileComplexity.file,
        complexityScore,
        churnScore,
        hotspotScore: complexityScore * churnScore,
        totalCyclomatic: fileComplexity.totalCyclomatic,
        commitCount,
      };
    });

    hotspots.sort((a, b) => b.hotspotScore - a.hotspotScore);
    return hotspots;
  }
}
