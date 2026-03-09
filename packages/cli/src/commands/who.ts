import * as path from 'path';
import { loadJson } from '../data-reader';

interface FileNode {
  path: string;
  type: string;
  lastAuthor?: string;
  commitCount?: number;
  contributorCount?: number;
  children?: FileNode[];
}

interface Snapshot {
  tree: FileNode;
}

function findFile(node: FileNode, filePath: string): FileNode | null {
  if (node.type === 'file' && node.path === filePath) {
    return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findFile(child, filePath);
      if (found) return found;
    }
  }
  return null;
}

interface WhoCommandOptions {
  dataDir: string;
  snapshotFile: string;
  filePath: string;
}

export async function whoCommand(options: WhoCommandOptions): Promise<string> {
  const { dataDir, snapshotFile, filePath } = options;
  const snapshot = (await loadJson(path.join(dataDir, snapshotFile))) as Snapshot;
  const fileNode = findFile(snapshot.tree, filePath);

  if (!fileNode) {
    throw new Error(`File not found in snapshot: ${filePath}`);
  }

  const lines: string[] = [
    `File: ${filePath}`,
    `Last Author: ${fileNode.lastAuthor ?? 'unknown'}`,
    `Commit Count: ${fileNode.commitCount ?? 0}`,
    `Contributor Count: ${fileNode.contributorCount ?? 0}`,
  ];

  return lines.join('\n');
}
