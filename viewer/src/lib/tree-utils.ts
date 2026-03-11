import { TreeNode, FileNode } from '../types';

/**
 * Find a file in the tree by its path
 * @param tree - The tree to search
 * @param targetPath - The path to search for
 * @returns The file node if found, null otherwise
 */
export function findFileInTree(tree: TreeNode, targetPath: string): FileNode | null {
  const traverse = (node: TreeNode): FileNode | null => {
    if (node.type === 'file') {
      if (node.path === targetPath) {
        return node;
      }
      return null;
    } else if (node.type === 'directory' && node.children) {
      for (const child of node.children) {
        const result = traverse(child);
        if (result) return result;
      }
    }
    return null;
  };

  return traverse(tree);
}
