import * as path from 'path';
import { loadJson } from '../data-reader';

interface Hotspot {
  file: string;
  hotspotScore: number;
}

interface ComplexityData {
  hotspots: Hotspot[];
}

interface RiskCommandOptions {
  dataDir: string;
  complexityFile: string;
}

export async function riskCommand(options: RiskCommandOptions): Promise<string> {
  const { dataDir, complexityFile } = options;
  const data = (await loadJson(path.join(dataDir, complexityFile))) as ComplexityData;

  const sorted = [...data.hotspots].sort((a, b) => b.hotspotScore - a.hotspotScore);

  const header = `Rank  File                  Hotspot Score`;
  const rows = sorted.map((hotspot, index) => {
    const rank = String(index + 1).padEnd(6);
    const file = hotspot.file.padEnd(22);
    const score = hotspot.hotspotScore.toFixed(3);
    return `${rank}${file}${score}`;
  });

  return [header, ...rows].join('\n');
}
