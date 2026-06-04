/**
 * Decides whether a timeline commit can be applied incrementally or needs a
 * full rebuild of the scene from the current tree.
 *
 * The incremental update path can attach a new file only when its parent
 * directory already exists as a layout node; it does not create missing
 * intermediate directories. So when a commit adds files under directories the
 * scene has never materialized, those files would be silently dropped, leaving
 * the timeline empty as the repository grows. In that case the caller must
 * rebuild from the full tree instead.
 *
 * Pure decision logic, no Three.js. `existingDirPaths` is the set of directory
 * paths currently present as layout nodes, computed with the same path function
 * the incremental add path uses, so this stays consistent with it.
 */
export function requiresFullRebuild(
  addedPaths: string[],
  existingDirPaths: Set<string>
): boolean {
  return addedPaths.some((path) => {
    const lastSlash = path.lastIndexOf('/');
    // Mirror the incremental add path's parent computation exactly so this
    // decision matches whether that path could actually attach the file.
    const parentDir = lastSlash < 0 ? '' : path.substring(0, lastSlash);
    return !existingDirPaths.has(parentDir);
  });
}
