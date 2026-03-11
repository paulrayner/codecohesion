import { DirectoryNode, FileNode, TreeNode } from '../types';
import { ColorMode, getColorForFile } from '../colorModeManager';

/**
 * Calculate the dominant color for a directory based on file count
 * @param dir - The directory node to analyze
 * @param colorMode - The current color mode
 * @returns The dominant color as a numeric value (for THREE.js)
 */
export function calculateDominantColor(dir: DirectoryNode, colorMode: ColorMode): number {
  // Collect all files in directory (recursively)
  const files: FileNode[] = [];
  const processNode = (node: TreeNode) => {
    if (node.type === 'file') {
      files.push(node);
    } else {
      // Recursively process subdirectories
      for (const child of node.children) {
        processNode(child);
      }
    }
  };

  // Process all children
  for (const child of dir.children) {
    processNode(child);
  }

  // Calculate dominant color based on current color mode
  if (files.length > 0) {
    const colorCounts = new Map<string, number>();

    for (const file of files) {
      const colorInfo = getColorForFile(file, colorMode);
      const hexColor = colorInfo.hex;
      colorCounts.set(hexColor, (colorCounts.get(hexColor) || 0) + 1);
    }

    // Find the most common color
    let maxCount = 0;
    let dominantHex = '#888888'; // Default gray
    for (const [hex, count] of colorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantHex = hex;
      }
    }

    return parseInt(dominantHex.replace('#', ''), 16);
  } else {
    // No files, use default gray
    return 0x888888;
  }
}

/**
 * Get color breakdown for a directory (for testing/debugging)
 * @param dir - The directory node to analyze
 * @param colorMode - The current color mode
 * @returns Map of color hex codes to file counts
 */
export function getColorBreakdown(dir: DirectoryNode, colorMode: ColorMode): Map<string, number> {
  const files: FileNode[] = [];
  const processNode = (node: TreeNode) => {
    if (node.type === 'file') {
      files.push(node);
    } else {
      for (const child of node.children) {
        processNode(child);
      }
    }
  };

  for (const child of dir.children) {
    processNode(child);
  }

  const colorCounts = new Map<string, number>();
  for (const file of files) {
    const colorInfo = getColorForFile(file, colorMode);
    const hexColor = colorInfo.hex;
    colorCounts.set(hexColor, (colorCounts.get(hexColor) || 0) + 1);
  }

  return colorCounts;
}
