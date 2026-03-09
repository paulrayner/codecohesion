/**
 * Utilities for counting and filtering auto-generated files in a repository
 * tree.
 *
 * All functions are pure — no DOM, no Three.js, no side effects.
 */

import type { DirectoryNode, TreeNode } from '../types';

/**
 * Count the number of files marked as generated within the entire subtree
 * rooted at `tree`.
 */
export function countGeneratedFiles(tree: DirectoryNode): number {
  let count = 0;

  function countNode(node: TreeNode): void {
    if (node.type === 'file') {
      if (node.isGenerated) {
        count++;
      }
    } else {
      node.children.forEach(child => countNode(child));
    }
  }

  countNode(tree);
  return count;
}

/**
 * Return a new tree with all generated files removed.
 *
 * Directories that become empty after filtering are also removed. The root
 * directory is always returned as a `DirectoryNode` even when it has no
 * children, because callers rely on the root being present.
 */
export function filterGeneratedFiles(tree: DirectoryNode): DirectoryNode {
  function filterNode(node: TreeNode): TreeNode | null {
    if (node.type === 'file') {
      // Exclude file if marked as generated
      return node.isGenerated ? null : node;
    } else {
      // Directory: recursively filter children and drop empty directories
      const filteredChildren = node.children
        .map(child => filterNode(child))
        .filter((child): child is TreeNode => child !== null);

      if (filteredChildren.length === 0) {
        return null;
      }

      return { ...node, children: filteredChildren };
    }
  }

  const filtered = filterNode(tree);
  // If all children were removed, return the root with an empty children array
  // rather than null — callers always expect a DirectoryNode back.
  if (filtered === null) {
    return { ...tree, children: [] };
  }
  return filtered as DirectoryNode;
}
