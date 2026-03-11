import * as path from 'path';
import { loadJson } from '../data-reader';

interface FileNode {
  path: string;
  type: string;
  lastAuthor?: string;
  commitCount?: number;
  children?: FileNode[];
}

interface Snapshot {
  tree: FileNode;
}

interface ImportEdge {
  from: string;
  to: string;
}

interface FunctionDecl {
  file: string;
  name: string;
}

interface StructureData {
  imports: ImportEdge[];
  functions: FunctionDecl[];
}

interface CouplingEdge {
  fileA: string;
  fileB: string;
  coupling: number;
}

interface CouplingData {
  edges: CouplingEdge[];
}

interface ContextCommandOptions {
  dataDir: string;
  snapshotFile: string;
  structureFile: string;
  couplingFile: string;
  filePath: string;
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

export async function contextCommand(options: ContextCommandOptions): Promise<string> {
  const { dataDir, snapshotFile, structureFile, couplingFile, filePath } = options;

  const [snapshot, structure, coupling] = await Promise.all([
    loadJson(path.join(dataDir, snapshotFile)) as Promise<Snapshot>,
    loadJson(path.join(dataDir, structureFile)) as Promise<StructureData>,
    loadJson(path.join(dataDir, couplingFile)) as Promise<CouplingData>,
  ]);

  const lines: string[] = [`Context for: ${filePath}`, ''];

  // Ownership section
  const fileNode = findFile(snapshot.tree, filePath);
  lines.push('=== Ownership ===');
  if (fileNode) {
    lines.push(`Last Author: ${fileNode.lastAuthor ?? 'unknown'}`);
    lines.push(`Commit Count: ${fileNode.commitCount ?? 0}`);
  } else {
    lines.push('No ownership data found.');
  }
  lines.push('');

  // Imports section
  const imports = structure.imports.filter((edge) => edge.from === filePath);
  lines.push('=== Imports ===');
  if (imports.length > 0) {
    for (const edge of imports) {
      lines.push(`  ${edge.to}`);
    }
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  // Functions section
  const functions = structure.functions.filter((fn) => fn.file === filePath);
  lines.push('=== Functions ===');
  if (functions.length > 0) {
    for (const fn of functions) {
      lines.push(`  ${fn.name}`);
    }
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  // Temporal coupling section
  const couplingEdges = coupling.edges.filter(
    (edge) => edge.fileA === filePath || edge.fileB === filePath,
  );
  lines.push('=== Temporal Coupling ===');
  if (couplingEdges.length > 0) {
    for (const edge of couplingEdges) {
      const partner = edge.fileA === filePath ? edge.fileB : edge.fileA;
      lines.push(`  ${partner} (score: ${edge.coupling})`);
    }
  } else {
    lines.push('  (none)');
  }

  return lines.join('\n');
}
