import { loadJson } from '../data-reader.js';

interface HotspotEntry {
  file: string;
  complexityScore: number;
  churnScore: number;
  hotspotScore: number;
  totalCyclomatic: number;
  commitCount: number;
}

interface ComplexityData {
  hotspots: HotspotEntry[];
}

interface HotspotsParams {
  limit?: number;
  filename?: string;
}

interface HotspotsResult {
  hotspots: HotspotEntry[];
}

export async function handleHotspots(
  dataDir: string,
  params: HotspotsParams,
): Promise<HotspotsResult> {
  const data = await loadJson<ComplexityData>(dataDir, params.filename ?? 'test-repo-complexity.json');

  const sorted = [...data.hotspots].sort((a, b) => b.hotspotScore - a.hotspotScore);

  const limited =
    params.limit !== undefined ? sorted.slice(0, params.limit) : sorted;

  return { hotspots: limited };
}
