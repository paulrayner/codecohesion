import * as path from 'path';
import { loadJson } from '../data-reader.js';

interface ImportEdge {
  from: string;
  to: string;
}

interface StructureData {
  imports: ImportEdge[];
}

interface ImpactParams {
  file: string;
  filename?: string;
}

interface ImpactResult {
  file: string;
  blastRadius: number;
  dependents: string[];
}

export async function handleImpact(
  dataDir: string,
  params: ImpactParams,
): Promise<ImpactResult> {
  const resolvedFilename = params.filename ?? 'test-repo-structure.json';
  const resolvedDataDir = path.isAbsolute(resolvedFilename) ? '' : dataDir;
  const data = await loadJson<StructureData>(resolvedDataDir, resolvedFilename);

  // Build reverse adjacency map: file -> files that import it
  const reverseGraph = new Map<string, string[]>();
  for (const edge of data.imports) {
    if (!reverseGraph.has(edge.to)) {
      reverseGraph.set(edge.to, []);
    }
    reverseGraph.get(edge.to)!.push(edge.from);
  }

  // BFS to find all transitive dependents
  const visited = new Set<string>([params.file]);
  const queue: string[] = [params.file];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const directDependents = reverseGraph.get(current) ?? [];
    for (const dep of directDependents) {
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    }
  }

  const dependents = Array.from(visited).filter((f) => f !== params.file);

  return {
    file: params.file,
    blastRadius: dependents.length,
    dependents,
  };
}
