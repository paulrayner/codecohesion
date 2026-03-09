import * as path from 'path';
import { loadJson } from '../data-reader';

interface ImportEdge {
  from: string;
  to: string;
}

interface StructureData {
  imports: ImportEdge[];
}

interface ImpactCommandOptions {
  dataDir: string;
  structureFile: string;
  filePath: string;
}

export async function impactCommand(options: ImpactCommandOptions): Promise<string> {
  const { dataDir, structureFile, filePath } = options;
  const data = (await loadJson(path.join(dataDir, structureFile))) as StructureData;

  // Build reverse dependency map: file -> files that import it
  const reverseDeps = new Map<string, Set<string>>();
  for (const edge of data.imports) {
    if (!reverseDeps.has(edge.to)) {
      reverseDeps.set(edge.to, new Set());
    }
    reverseDeps.get(edge.to)!.add(edge.from);
  }

  // BFS to find all transitive dependents
  const directDependents = reverseDeps.get(filePath) ?? new Set<string>();
  const allDependents = new Set<string>();
  const transitiveDependents = new Set<string>();

  const queue = [...directDependents];
  for (const dep of directDependents) {
    allDependents.add(dep);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextDeps = reverseDeps.get(current) ?? new Set<string>();
    for (const dep of nextDeps) {
      if (!allDependents.has(dep)) {
        allDependents.add(dep);
        transitiveDependents.add(dep);
        queue.push(dep);
      }
    }
  }

  if (allDependents.size === 0) {
    return `No dependents found for ${filePath}\nBlast radius: 0`;
  }

  const lines: string[] = [`Impact analysis for: ${filePath}`, `Blast radius: ${allDependents.size}`];

  if (directDependents.size > 0) {
    lines.push('\nDirect dependents:');
    for (const dep of directDependents) {
      lines.push(`  ${dep}`);
    }
  }

  if (transitiveDependents.size > 0) {
    lines.push('\nTransitive dependents:');
    for (const dep of transitiveDependents) {
      lines.push(`  ${dep}`);
    }
  }

  return lines.join('\n');
}
