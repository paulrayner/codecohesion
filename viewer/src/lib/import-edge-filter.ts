/**
 * Filtering utilities for import edges displayed in the viewer.
 *
 * Kept as pure functions so they are easy to test and compose
 * without any Three.js or DOM dependencies.
 */

/**
 * Minimal shape of an import edge consumed by the viewer.
 *
 * NOTE: This local interface diverges slightly from ImportEdgeSummary in
 * @codecohesion/shared-types — it treats `symbols` as required (string[])
 * whereas the shared DTO makes it optional. The viewer is not currently
 * bundled with shared-types, so the local declaration is kept here
 * intentionally. If shared-types is ever added as a viewer dependency,
 * replace this with: import type { ImportEdgeSummary } from '@codecohesion/shared-types'.
 */
interface ImportEdge {
  from: string;
  to: string;
  toRaw: string;
  symbols: string[];
  isExternal: boolean;
}

/** Options controlling which edges are returned. */
interface FilterImportEdgesOptions {
  /** Keep only edges whose target is within the repository. */
  internalOnly?: boolean;
  /** Keep only edges whose target is an external package. */
  externalOnly?: boolean;
  /**
   * Maximum number of edges to return.
   * When the filtered set exceeds this cap, edges are sorted
   * deterministically by `from + to` (ascending) before slicing.
   */
  maxEdges?: number;
}

/**
 * Filters and optionally caps a list of import edges.
 *
 * Filtering is applied before the maxEdges cap so callers get a
 * predictable, stable subset regardless of input order.
 */
export function filterImportEdges(
  edges: ImportEdge[],
  options: FilterImportEdgesOptions,
): ImportEdge[] {
  let result = edges.slice();

  if (options.internalOnly) {
    result = result.filter((edge) => !edge.isExternal);
  }

  if (options.externalOnly) {
    result = result.filter((edge) => edge.isExternal);
  }

  if (options.maxEdges !== undefined && result.length > options.maxEdges) {
    // Sort deterministically so the same input always produces the same slice.
    result = result
      .slice()
      .sort((a, b) => {
        const keyA = a.from + a.to;
        const keyB = b.from + b.to;
        return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
      })
      .slice(0, options.maxEdges);
  }

  return result;
}
