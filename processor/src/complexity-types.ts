/**
 * Types for complexity analysis: cyclomatic complexity, cognitive complexity,
 * and hotspot scoring (complexity × churn).
 *
 * Follows the same local-types pattern as coupling-types.ts and structure-types.ts.
 */

/**
 * Cyclomatic and cognitive complexity metrics for a single function.
 */
export interface FunctionComplexity {
  /** Name of the function or method */
  name: string;
  /** Declaration kind: function, method, arrow, constructor, or class */
  kind: 'function' | 'method' | 'arrow' | 'constructor' | 'class';
  /** 1-based line number where the declaration starts */
  line: number;
  /** 1-based line number where the declaration ends */
  endLine: number;
  /** Cyclomatic complexity (branching nodes + 1 base) */
  cyclomatic: number;
  /** Cognitive complexity (Sonar algorithm: structural increments + nesting depth bonuses) */
  cognitive: number;
}

/**
 * Aggregated complexity metrics for a single file.
 */
export interface FileComplexity {
  /** Repo-relative path of the file */
  file: string;
  /** Sum of cyclomatic complexity across all functions in this file */
  totalCyclomatic: number;
  /** Sum of cognitive complexity across all functions in this file */
  totalCognitive: number;
  /** Maximum cyclomatic complexity across all functions */
  maxCyclomatic: number;
  /** Maximum cognitive complexity across all functions */
  maxCognitive: number;
  /** Number of functions analyzed in this file */
  functionCount: number;
  /** Per-function complexity breakdown */
  functions: FunctionComplexity[];
}

/**
 * A hotspot entry combining complexity and churn signals.
 * Higher score = higher priority for refactoring attention.
 */
export interface HotspotEntry {
  /** Repo-relative path of the file */
  file: string;
  /** Normalized complexity score (0–1) */
  complexityScore: number;
  /** Normalized churn score (0–1) */
  churnScore: number;
  /** Combined hotspot score: complexityScore × churnScore */
  hotspotScore: number;
  /** Raw total cyclomatic complexity for this file */
  totalCyclomatic: number;
  /** Raw commit count for this file (churn) */
  commitCount: number;
}

/**
 * Complete complexity analysis result for a repository snapshot.
 * format discriminant allows future versioned variants (e.g. 'complexity-v2').
 */
export interface ComplexityReport {
  /** Format discriminant — always 'complexity-v1' for this version */
  format: 'complexity-v1';
  /** Absolute path to the analyzed repository */
  repositoryPath: string;
  /** ISO 8601 timestamp of when the analysis was performed */
  analyzedAt: string;

  analysis: {
    /** Number of source files examined */
    filesAnalyzed: number;
    /** Total functions analyzed */
    functionsAnalyzed: number;
    /** Average cyclomatic complexity across all functions */
    avgCyclomatic: number;
    /** Average cognitive complexity across all functions */
    avgCognitive: number;
  };

  /** Per-file complexity breakdown */
  files: FileComplexity[];
  /** Files ranked by hotspot score (highest first) */
  hotspots: HotspotEntry[];
}
