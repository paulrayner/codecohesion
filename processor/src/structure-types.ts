/**
 * Types for static structure analysis: imports and function declarations.
 * Separate from coupling-types.ts to keep concerns isolated.
 * Follows the same local-types pattern as coupling-types.ts.
 */

/**
 * Represents a resolved import relationship between two files.
 */
export interface ImportEdge {
  /** Absolute or repo-relative path of the importing file */
  from: string;
  /** Resolved repo-relative path of the imported file (empty string when external) */
  to: string;
  /** Raw specifier as written in the source (e.g. '../utils' or 'lodash') */
  toRaw: string;
  /** Named symbols imported (empty array when namespace or side-effect import) */
  symbols: string[];
  /** True when the import resolves to a node_modules package */
  isExternal: boolean;
}

/**
 * Represents a function or method declaration extracted from a source file.
 */
export interface FunctionDecl {
  /** Repo-relative path of the file containing this declaration */
  file: string;
  /** Name of the function or method */
  name: string;
  /** Declaration kind: function, method, arrow, constructor, or class */
  kind: 'function' | 'method' | 'arrow' | 'constructor' | 'class';
  /** 1-based line number where the declaration starts */
  line: number;
  /** 1-based line number where the declaration ends */
  endLine: number;
  /** Ordered list of parameter names */
  params: string[];
  /** True when the declaration carries an export modifier */
  isExported: boolean;
}

/**
 * Complete structure analysis result for a repository snapshot.
 * format discriminant allows future versioned variants (e.g. 'structure-v2').
 */
export interface StructureGraph {
  /** Format discriminant — always 'structure-v1' for this version */
  format: 'structure-v1';
  /** Absolute path to the analyzed repository */
  repositoryPath: string;
  /** ISO 8601 timestamp of when the analysis was performed */
  analyzedAt: string;

  analysis: {
    /** Number of source files examined */
    filesAnalyzed: number;
    /** Total import edges found across all files */
    importEdges: number;
    /** Total function declarations found across all files */
    functionDecls: number;
    /** Number of files that could not be parsed */
    parseErrors: number;
  };

  /** All resolved import relationships in the repository */
  imports: ImportEdge[];
  /** All function and method declarations in the repository */
  functions: FunctionDecl[];
}
