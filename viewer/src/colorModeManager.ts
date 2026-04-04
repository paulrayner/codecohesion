import { FileNode } from './types';
import { getColorForExtension } from './colorScheme';
import { couplingLoader } from './couplingLoader';
import { getHotspotColor } from './lib/hotspot-color';
import { getPaceLayerColor, getPaceLayerLegend } from './lib/pace-layer-color';

export type ColorMode = 'fileType' | 'lastModified' | 'author' | 'churn' | 'contributors' | 'fileAge' | 'recentActivity' | 'stability' | 'recency' | 'cluster' | 'linesOfCode' | 'hotspot' | 'paceLayer';

export interface ColorInfo {
  hex: string;
  name: string;
}

/**
 * Convert HSL to RGB hex color
 * @param h Hue (0-360 degrees)
 * @param s Saturation (0-100 percent)
 * @param l Lightness (0-100 percent)
 * @returns Hex color string (e.g., "#ff6b6b")
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Cache for author name to color index mapping
 * Used to ensure consistent colors across the application
 * Colors are generated dynamically using HSL for unlimited authors
 */
const authorColorCache = new Map<string, number>();
let nextColorIndex = 0;

/**
 * State for percentile-based last modified intervals
 */
interface LastModifiedInterval {
  minDate: Date;  // Lower bound of this interval (inclusive)
  maxDate: Date;  // Upper bound of this interval (inclusive)
  label: string;  // e.g., "Newest 20%: 2022-2025"
  hex: string;    // Color for this interval
}

let lastModifiedIntervals: LastModifiedInterval[] = [];

/**
 * State for percentile-based lines of code intervals
 */
interface LocInterval {
  minLoc: number;  // Lower bound of this interval (inclusive)
  maxLoc: number;  // Upper bound of this interval (inclusive)
  label: string;   // e.g., "Largest 5%: 1000-5000 LOC"
  hex: string;     // Color for this interval
}

let locIntervals: LocInterval[] = [];

/**
 * Reset the author color cache
 * Called when switching repositories
 */
export function resetAuthorColors(): void {
  authorColorCache.clear();
  nextColorIndex = 0;
}

/**
 * Calculate percentile-based intervals for last modified dates
 * This creates 7 buckets with finer granularity for newer files
 * Only uses percentile intervals for "stale" repos (no changes in last 90 days)
 */
export function calculateLastModifiedIntervals(dates: string[]): void {
  if (dates.length === 0) {
    lastModifiedIntervals = [];
    return;
  }

  // Sort dates chronologically
  const sortedDates = dates
    .map(d => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());

  const count = sortedDates.length;

  // Check if repo is active by looking at the 80th percentile
  // If 80% of files have been modified in the last 90 days, consider it "active"
  const now = new Date();
  const p80Index = Math.floor(count * 0.8);
  const date80thPercentile = sortedDates[p80Index];
  const daysSince80thPercentile = (now.getTime() - date80thPercentile.getTime()) / (1000 * 60 * 60 * 24);

  // If 80% of files are newer than 90 days, use fixed intervals (active repo)
  // Otherwise use percentile intervals (stale repo)
  if (daysSince80thPercentile < 90) {
    lastModifiedIntervals = [];
    return;
  }

  // Calculate percentile indices (5%, 10%, 20%, 40%, 60%, 80%, 90%, 95%, 100%)
  const p20 = Math.floor(count * 0.2) - 1;
  const p40 = Math.floor(count * 0.4) - 1;
  const p60 = Math.floor(count * 0.6) - 1;
  const p80 = Math.floor(count * 0.8) - 1;
  const p90 = Math.floor(count * 0.9) - 1;
  const p95 = Math.floor(count * 0.95) - 1;

  // Get the dates at each percentile
  const oldestDate = sortedDates[0];
  const date20 = sortedDates[Math.max(0, p20)];
  const date40 = sortedDates[Math.max(0, p40)];
  const date60 = sortedDates[Math.max(0, p60)];
  const date80 = sortedDates[Math.max(0, p80)];
  const date90 = sortedDates[Math.max(0, p90)];
  const date95 = sortedDates[Math.max(0, p95)];
  const newestDate = sortedDates[count - 1];

  // Helper to format year range
  const formatYearRange = (start: Date, end: Date): string => {
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    return startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
  };

  // Create intervals (ordered from newest to oldest for display)
  lastModifiedIntervals = [
    {
      minDate: date95,
      maxDate: newestDate,
      label: `Newest 5%: ${formatYearRange(date95, newestDate)}`,
      hex: '#00ff88'  // Bright green
    },
    {
      minDate: date90,
      maxDate: date95,
      label: `5-10%: ${formatYearRange(date90, date95)}`,
      hex: '#ccff00'  // Yellow
    },
    {
      minDate: date80,
      maxDate: date90,
      label: `10-20%: ${formatYearRange(date80, date90)}`,
      hex: '#ffaa00'  // Orange-yellow
    },
    {
      minDate: date60,
      maxDate: date80,
      label: `20-40%: ${formatYearRange(date60, date80)}`,
      hex: '#ff8800'  // Orange
    },
    {
      minDate: date40,
      maxDate: date60,
      label: `40-60%: ${formatYearRange(date40, date60)}`,
      hex: '#ff5500'  // Red-orange
    },
    {
      minDate: date20,
      maxDate: date40,
      label: `60-80%: ${formatYearRange(date20, date40)}`,
      hex: '#cc3333'  // Red
    },
    {
      minDate: oldestDate,
      maxDate: date20,
      label: `Oldest 20%: ${formatYearRange(oldestDate, date20)}`,
      hex: '#666666'  // Gray
    }
  ];
}

/**
 * Calculate percentile-based intervals for lines of code
 * This creates 6 buckets with finer granularity for larger files
 */
export function calculateLocIntervals(locValues: number[]): void {
  if (locValues.length === 0) {
    locIntervals = [];
    return;
  }

  // Sort LOC values in ascending order
  const sortedLoc = [...locValues].sort((a, b) => a - b);
  const count = sortedLoc.length;

  // Calculate percentile indices (20%, 40%, 60%, 80%, 95%, 100%)
  const p20 = Math.floor(count * 0.2) - 1;
  const p40 = Math.floor(count * 0.4) - 1;
  const p60 = Math.floor(count * 0.6) - 1;
  const p80 = Math.floor(count * 0.8) - 1;
  const p95 = Math.floor(count * 0.95) - 1;
  const p100 = count - 1;

  // Get the LOC values at each percentile
  const minLoc = sortedLoc[0];
  const loc20 = sortedLoc[Math.max(0, p20)];
  const loc40 = sortedLoc[Math.max(0, p40)];
  const loc60 = sortedLoc[Math.max(0, p60)];
  const loc80 = sortedLoc[Math.max(0, p80)];
  const loc95 = sortedLoc[Math.max(0, p95)];
  const maxLoc = sortedLoc[p100];

  // Helper to format LOC range
  const formatRange = (min: number, max: number): string => {
    return min === max ? `${min}` : `${min}-${max}`;
  };

  // Create intervals (ordered from largest to smallest for display)
  locIntervals = [
    {
      minLoc: loc95,
      maxLoc: maxLoc,
      label: `Largest 5%: ${formatRange(loc95, maxLoc)} LOC`,
      hex: '#c0392b'  // Dark red
    },
    {
      minLoc: loc80,
      maxLoc: loc95,
      label: `80-95%: ${formatRange(loc80, loc95)} LOC`,
      hex: '#e74c3c'  // Red
    },
    {
      minLoc: loc60,
      maxLoc: loc80,
      label: `60-80%: ${formatRange(loc60, loc80)} LOC`,
      hex: '#e67e22'  // Orange
    },
    {
      minLoc: loc40,
      maxLoc: loc60,
      label: `40-60%: ${formatRange(loc40, loc60)} LOC`,
      hex: '#f1c40f'  // Yellow
    },
    {
      minLoc: loc20,
      maxLoc: loc40,
      label: `20-40%: ${formatRange(loc20, loc40)} LOC`,
      hex: '#2ecc71'  // Green
    },
    {
      minLoc: minLoc,
      maxLoc: loc20,
      label: `Smallest 20%: ${formatRange(minLoc, loc20)} LOC`,
      hex: '#3498db'  // Blue
    }
  ];
}

/**
 * Pre-assign colors to authors based on their rank (by file count)
 * This ensures top contributors get the most distinct colors
 * Uses HSL generation so supports unlimited authors
 */
export function assignAuthorColors(authorsByRank: string[]): void {
  resetAuthorColors();
  for (const author of authorsByRank) {
    if (!authorColorCache.has(author)) {
      authorColorCache.set(author, nextColorIndex);
      nextColorIndex++;
    }
  }
}

/**
 * Generate unique color for coupling cluster using HSL distribution
 * Distributes colors evenly across hue spectrum for unlimited unique colors
 * @param clusterId The cluster identifier (1-based from Louvain algorithm)
 * @param totalClusters Total number of clusters (for even distribution)
 * @returns RGB color value as number
 */
function getClusterColor(clusterId: number, totalClusters: number): number {
  // Distribute hues evenly across color spectrum (0-360 degrees)
  // Subtract 1 from clusterId since clusters are 1-indexed
  const hue = ((clusterId - 1) * 360) / totalClusters;

  // Use vibrant saturation and medium lightness for visibility on dark background
  const hex = hslToHex(hue, 75, 60);

  // Convert hex string to number (remove # prefix)
  return parseInt(hex.substring(1), 16);
}

/**
 * Generate a consistent color for an author using HSL distribution
 * Colors assigned based on first-seen order (typically by contributor rank)
 * Uses golden ratio for maximum perceptual difference between consecutive authors
 */
function getColorForAuthor(author: string | null): ColorInfo {
  if (!author) {
    return { hex: '#666666', name: 'Unknown' };
  }

  // Get or assign author index
  if (!authorColorCache.has(author)) {
    authorColorCache.set(author, nextColorIndex);
    nextColorIndex++;
  }

  const authorIndex = authorColorCache.get(author)!;

  // Generate color using golden ratio for maximum distinction
  // Golden ratio ensures consecutive authors get maximally different hues
  const goldenRatio = 0.618033988749895;
  const hue = (authorIndex * goldenRatio * 360) % 360;
  const hex = hslToHex(hue, 70, 60);

  return { hex, name: author };
}

/**
 * Get color for a file based on commit count (churn heatmap)
 * Uses quantile-based buckets for good distribution
 */
function getColorByChurn(commitCount: number | null): ColorInfo {
  if (commitCount === null || commitCount === 0) {
    return { hex: '#666666', name: 'No commits' };
  }

  // Cool to hot gradient: blue → yellow → orange → red
  if (commitCount <= 2) {
    return { hex: '#3498db', name: 'Low churn (1-2 commits)' };
  } else if (commitCount <= 5) {
    return { hex: '#2ecc71', name: 'Low-medium (3-5 commits)' };
  } else if (commitCount <= 10) {
    return { hex: '#f1c40f', name: 'Medium (6-10 commits)' };
  } else if (commitCount <= 20) {
    return { hex: '#e67e22', name: 'High (11-20 commits)' };
  } else if (commitCount <= 50) {
    return { hex: '#e74c3c', name: 'Very high (21-50 commits)' };
  } else {
    return { hex: '#c0392b', name: 'Extremely high (50+ commits)' };
  }
}

/**
 * Get color for a file based on number of unique contributors
 */
function getColorByContributors(contributorCount: number | null): ColorInfo {
  if (contributorCount === null || contributorCount === 0) {
    return { hex: '#666666', name: 'No contributors' };
  }

  if (contributorCount === 1) {
    return { hex: '#3498db', name: 'Solo (1 contributor)' };
  } else if (contributorCount === 2) {
    return { hex: '#2ecc71', name: 'Pair (2 contributors)' };
  } else if (contributorCount <= 4) {
    return { hex: '#f1c40f', name: 'Team (3-4 contributors)' };
  } else if (contributorCount <= 9) {
    return { hex: '#e67e22', name: 'Squad (5-9 contributors)' };
  } else {
    return { hex: '#e74c3c', name: 'Many (10+ contributors)' };
  }
}

/**
 * Get color for a file based on its age (first commit date)
 */
function getColorByFileAge(firstCommitDate: string | null): ColorInfo {
  if (!firstCommitDate) {
    return { hex: '#666666', name: 'Unknown age' };
  }

  const now = Date.now();
  const fileDate = new Date(firstCommitDate).getTime();
  const ageInDays = (now - fileDate) / (1000 * 60 * 60 * 24);
  const ageInMonths = ageInDays / 30;
  const ageInYears = ageInDays / 365;

  // New → legacy gradient: cyan → blue → purple → brown → gray
  if (ageInMonths < 3) {
    return { hex: '#00d9ff', name: 'New (<3 months)' };
  } else if (ageInYears < 1) {
    return { hex: '#3498db', name: 'Recent (3-12 months)' };
  } else if (ageInYears < 3) {
    return { hex: '#9b59b6', name: 'Mature (1-3 years)' };
  } else if (ageInYears < 5) {
    return { hex: '#795548', name: 'Old (3-5 years)' };
  } else {
    return { hex: '#34495e', name: 'Legacy (5+ years)' };
  }
}

/**
 * Get color for a file based on recent activity (lines changed in last 90 days)
 */
function getColorByRecentActivity(recentLinesChanged: number | null): ColorInfo {
  if (recentLinesChanged === null || recentLinesChanged === 0) {
    return { hex: '#666666', name: 'No recent activity' };
  }

  // Blue (low activity) → Red (high activity)
  if (recentLinesChanged <= 50) {
    return { hex: '#3498db', name: 'Low (1-50 lines)' };
  } else if (recentLinesChanged <= 200) {
    return { hex: '#2ecc71', name: 'Moderate (51-200 lines)' };
  } else if (recentLinesChanged <= 500) {
    return { hex: '#f1c40f', name: 'High (201-500 lines)' };
  } else if (recentLinesChanged <= 1000) {
    return { hex: '#e67e22', name: 'Very high (501-1000 lines)' };
  } else {
    return { hex: '#e74c3c', name: 'Extremely high (1000+ lines)' };
  }
}

/**
 * Get color for a file based on code stability (avg lines changed per commit)
 */
function getColorByStability(avgLinesPerCommit: number | null): ColorInfo {
  if (avgLinesPerCommit === null) {
    return { hex: '#666666', name: 'Unknown' };
  }

  // Blue (stable, small changes) → Red (volatile, large changes)
  if (avgLinesPerCommit < 10) {
    return { hex: '#3498db', name: 'Very stable (<10 lines/commit)' };
  } else if (avgLinesPerCommit < 25) {
    return { hex: '#2ecc71', name: 'Stable (10-24 lines/commit)' };
  } else if (avgLinesPerCommit < 50) {
    return { hex: '#f1c40f', name: 'Moderate (25-49 lines/commit)' };
  } else if (avgLinesPerCommit < 100) {
    return { hex: '#e67e22', name: 'Volatile (50-99 lines/commit)' };
  } else {
    return { hex: '#e74c3c', name: 'Very volatile (100+ lines/commit)' };
  }
}

/**
 * Get color for a file based on recency (days since last modified)
 */
function getColorByRecency(daysSinceLastModified: number | null): ColorInfo {
  if (daysSinceLastModified === null) {
    return { hex: '#666666', name: 'Unknown' };
  }

  // Red (hot, recent) → Gray (cold, stale)
  if (daysSinceLastModified < 7) {
    return { hex: '#e74c3c', name: 'Hot (<7 days)' };
  } else if (daysSinceLastModified < 30) {
    return { hex: '#e67e22', name: 'Warm (1-4 weeks)' };
  } else if (daysSinceLastModified < 90) {
    return { hex: '#f1c40f', name: 'Recent (1-3 months)' };
  } else if (daysSinceLastModified < 180) {
    return { hex: '#3498db', name: 'Cool (3-6 months)' };
  } else {
    return { hex: '#95a5a6', name: 'Cold (6+ months)' };
  }
}

/**
 * Get color for a file based on lines of code
 * Uses percentile-based intervals if calculated
 */
function getColorByLinesOfCode(loc: number): ColorInfo {
  // Use percentile intervals if available
  if (locIntervals.length > 0) {
    for (const interval of locIntervals) {
      if (loc >= interval.minLoc && loc <= interval.maxLoc) {
        return { hex: interval.hex, name: interval.label };
      }
    }
    // Fallback to smallest interval if loc is smaller than all intervals
    const smallestInterval = locIntervals[locIntervals.length - 1];
    return { hex: smallestInterval.hex, name: smallestInterval.label };
  }

  // Fallback to fixed intervals if percentiles not calculated
  if (loc < 100) {
    return { hex: '#3498db', name: 'Small (<100 LOC)' };
  } else if (loc < 300) {
    return { hex: '#2ecc71', name: 'Medium (100-300 LOC)' };
  } else if (loc < 600) {
    return { hex: '#f1c40f', name: 'Large (300-600 LOC)' };
  } else if (loc < 1000) {
    return { hex: '#e67e22', name: 'Very large (600-1000 LOC)' };
  } else {
    return { hex: '#e74c3c', name: 'Huge (1000+ LOC)' };
  }
}

/**
 * Module-level maximum hotspot score, set by calculateHotspotMax.
 * Used to normalize commitCount * recentLinesChanged to [0, 1].
 * Falls back to a fixed cap when not set.
 */
let hotspotMaxScore = 0;

/**
 * Pre-compute the maximum hotspot score across all file scores.
 * Call this after loading a snapshot, in the same pattern as
 * calculateLastModifiedIntervals and calculateLocIntervals.
 *
 * @param scores Array of raw hotspot scores (commitCount * recentLinesChanged)
 */
export function calculateHotspotMax(scores: number[]): void {
  hotspotMaxScore = scores.length > 0 ? Math.max(...scores) : 0;
}

/**
 * Get color for a file using the hotspot (churn × recency) score.
 * Normalizes commitCount * recentLinesChanged against the pre-computed max,
 * then delegates to getHotspotColor for the cool→hot gradient.
 *
 * Files with no commit data or no recent activity are shown as cold (score = 0).
 */
function getColorByHotspot(file: FileNode): ColorInfo {
  const commitCount = file.commitCount ?? 0;
  const recentLinesChanged = file.recentLinesChanged ?? 0;
  const raw = commitCount * recentLinesChanged;

  // Normalize against the max observed score; fall back to a fixed cap so
  // the function works even when calculateHotspotMax was not called.
  const cap = hotspotMaxScore > 0 ? hotspotMaxScore : 1;
  const normalized = Math.min(1, raw / cap);

  return { hex: getHotspotColor(normalized), name: `Hotspot score: ${raw}` };
}

/**
 * Get color for a file based on the selected color mode
 */
export function getColorForFile(file: FileNode, mode: ColorMode): ColorInfo {
  switch (mode) {
    case 'fileType':
      return getColorForExtension(file.extension);

    case 'lastModified':
      return getColorByLastModified(file.lastModified);

    case 'author':
      return getColorForAuthor(file.lastAuthor);

    case 'churn':
      return getColorByChurn(file.commitCount);

    case 'contributors':
      return getColorByContributors(file.contributorCount);

    case 'fileAge':
      return getColorByFileAge(file.firstCommitDate);

    case 'recentActivity':
      return getColorByRecentActivity(file.recentLinesChanged);

    case 'stability':
      return getColorByStability(file.avgLinesPerCommit);

    case 'recency':
      return getColorByRecency(file.daysSinceLastModified);

    case 'cluster': {
      const clusterId = couplingLoader.getClusterForFile(file.path);

      if (clusterId === null) {
        return { hex: '#888888', name: 'Unclustered' };
      }

      const clusters = couplingLoader.getClusters();
      const cluster = clusters.find(c => c.id === clusterId);
      const color = getClusterColor(clusterId, clusters.length);
      return {
        hex: `#${color.toString(16).padStart(6, '0')}`,
        // Include file count to match legend display format
        name: cluster ? `${cluster.name} (${cluster.fileCount} files)` : `Cluster ${clusterId}`
      };
    }

    case 'linesOfCode':
      return getColorByLinesOfCode(file.loc);

    case 'hotspot':
      return getColorByHotspot(file);

    case 'paceLayer': {
      const hex = getPaceLayerColor((file as FileNode & { paceLayer?: string }).paceLayer);
      return { hex, name: (file as FileNode & { paceLayer?: string }).paceLayer ?? 'Unclassified' };
    }

    default:
      return getColorForExtension(file.extension);
  }
}

/**
 * Color files based on when they were last modified
 * Uses percentile-based intervals if calculated, otherwise falls back to fixed intervals
 */
function getColorByLastModified(lastModified: string | null): ColorInfo {
  if (!lastModified) {
    return { hex: '#666666', name: 'Unknown' };
  }

  const modifiedDate = new Date(lastModified);

  // Use percentile intervals if available
  if (lastModifiedIntervals.length > 0) {
    for (const interval of lastModifiedIntervals) {
      if (modifiedDate >= interval.minDate && modifiedDate <= interval.maxDate) {
        return { hex: interval.hex, name: interval.label };
      }
    }
    // Fallback to oldest interval if date is older than all intervals
    const oldestInterval = lastModifiedIntervals[lastModifiedIntervals.length - 1];
    return { hex: oldestInterval.hex, name: oldestInterval.label };
  }

  // Fallback to extended fixed time intervals if percentiles not calculated
  const now = new Date();
  const daysSince = (now.getTime() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince < 7) {
    return { hex: '#00ff88', name: 'Last week' };
  } else if (daysSince < 30) {
    return { hex: '#ccff00', name: '1 week - 1 month' };
  } else if (daysSince < 90) {
    return { hex: '#ffaa00', name: '1-3 months' };
  } else if (daysSince < 180) {
    return { hex: '#ff8800', name: '3-6 months' };
  } else if (daysSince < 365) {
    return { hex: '#ff5500', name: '6 months - 1 year' };
  } else if (daysSince < 730) {
    return { hex: '#cc3333', name: '1-2 years' };
  } else {
    return { hex: '#666666', name: 'Older than 2 years' };
  }
}

/**
 * Check if percentile-based intervals are active
 */
export function isUsingPercentileIntervals(): boolean {
  return lastModifiedIntervals.length > 0;
}

/**
 * Get legend items for the current color mode
 */
export function getLegendItems(mode: ColorMode): ColorInfo[] {
  switch (mode) {
    case 'lastModified':
      // Use percentile intervals if calculated
      if (lastModifiedIntervals.length > 0) {
        return lastModifiedIntervals.map(interval => ({
          hex: interval.hex,
          name: interval.label
        }));
      }
      // Fallback to extended fixed intervals
      return [
        { hex: '#00ff88', name: 'Last week' },
        { hex: '#ccff00', name: '1 week - 1 month' },
        { hex: '#ffaa00', name: '1-3 months' },
        { hex: '#ff8800', name: '3-6 months' },
        { hex: '#ff5500', name: '6 months - 1 year' },
        { hex: '#cc3333', name: '1-2 years' },
        { hex: '#666666', name: 'Older than 2 years' }
      ];

    case 'author':
      // For author mode, legend is populated dynamically based on authors present
      return [];

    case 'churn':
      return [
        { hex: '#c0392b', name: 'Extremely high (50+ commits)' },
        { hex: '#e74c3c', name: 'Very high (21-50 commits)' },
        { hex: '#e67e22', name: 'High (11-20 commits)' },
        { hex: '#f1c40f', name: 'Medium (6-10 commits)' },
        { hex: '#2ecc71', name: 'Low-medium (3-5 commits)' },
        { hex: '#3498db', name: 'Low churn (1-2 commits)' }
      ];

    case 'contributors':
      return [
        { hex: '#e74c3c', name: 'Many (10+ contributors)' },
        { hex: '#e67e22', name: 'Squad (5-9 contributors)' },
        { hex: '#f1c40f', name: 'Team (3-4 contributors)' },
        { hex: '#2ecc71', name: 'Pair (2 contributors)' },
        { hex: '#3498db', name: 'Solo (1 contributor)' }
      ];

    case 'fileAge':
      return [
        { hex: '#00d9ff', name: 'New (<3 months)' },
        { hex: '#3498db', name: 'Recent (3-12 months)' },
        { hex: '#9b59b6', name: 'Mature (1-3 years)' },
        { hex: '#795548', name: 'Old (3-5 years)' },
        { hex: '#34495e', name: 'Legacy (5+ years)' }
      ];

    case 'recentActivity':
      return [
        { hex: '#e74c3c', name: 'Extremely high (1000+ lines)' },
        { hex: '#e67e22', name: 'Very high (501-1000 lines)' },
        { hex: '#f1c40f', name: 'High (201-500 lines)' },
        { hex: '#2ecc71', name: 'Moderate (51-200 lines)' },
        { hex: '#3498db', name: 'Low (1-50 lines)' }
      ];

    case 'stability':
      return [
        { hex: '#e74c3c', name: 'Very volatile (100+ lines/commit)' },
        { hex: '#e67e22', name: 'Volatile (50-99 lines/commit)' },
        { hex: '#f1c40f', name: 'Moderate (25-49 lines/commit)' },
        { hex: '#2ecc71', name: 'Stable (10-24 lines/commit)' },
        { hex: '#3498db', name: 'Very stable (<10 lines/commit)' }
      ];

    case 'recency':
      return [
        { hex: '#e74c3c', name: 'Hot (<7 days)' },
        { hex: '#e67e22', name: 'Warm (1-4 weeks)' },
        { hex: '#f1c40f', name: 'Recent (1-3 months)' },
        { hex: '#3498db', name: 'Cool (3-6 months)' },
        { hex: '#95a5a6', name: 'Cold (6+ months)' }
      ];

    case 'fileType':
      // For file type mode, legend is populated dynamically based on files present
      return [];

    case 'cluster': {
      // Show legend items for each cluster, ordered by size (descending)
      const clusters = couplingLoader.getClusters();

      if (clusters.length === 0) {
        return [{ hex: '#888888', name: 'No coupling data' }];
      }

      return clusters.map(cluster => ({
        hex: `#${getClusterColor(cluster.id, clusters.length).toString(16).padStart(6, '0')}`,
        name: `${cluster.name} (${cluster.fileCount} files)`
      }));
    }

    case 'linesOfCode':
      // Use percentile intervals if calculated
      if (locIntervals.length > 0) {
        return locIntervals.map(interval => ({
          hex: interval.hex,
          name: interval.label
        }));
      }
      // Fallback to fixed intervals
      return [
        { hex: '#e74c3c', name: 'Huge (1000+ LOC)' },
        { hex: '#e67e22', name: 'Very large (600-1000 LOC)' },
        { hex: '#f1c40f', name: 'Large (300-600 LOC)' },
        { hex: '#2ecc71', name: 'Medium (100-300 LOC)' },
        { hex: '#3498db', name: 'Small (<100 LOC)' }
      ];

    case 'hotspot':
      // Five gradient stops from cold (low churn × recency) to hot (high churn × recency)
      return [
        { hex: getHotspotColor(1.0), name: 'Critical (very high churn × recency)' },
        { hex: getHotspotColor(0.75), name: 'Hot (high churn × recency)' },
        { hex: getHotspotColor(0.5), name: 'Warm (moderate churn × recency)' },
        { hex: getHotspotColor(0.25), name: 'Cool (low churn × recency)' },
        { hex: getHotspotColor(0.0), name: 'Cold (no recent activity)' }
      ];

    case 'paceLayer':
      return getPaceLayerLegend();

    default:
      return [];
  }
}

/**
 * Get display name for color mode
 */
export function getColorModeName(mode: ColorMode): string {
  switch (mode) {
    case 'fileType':
      return 'File Type';
    case 'lastModified':
      return 'Last Modified';
    case 'author':
      return 'Author';
    case 'churn':
      return 'Churn (Lifetime Commits)';
    case 'contributors':
      return 'Contributors (Lifetime)';
    case 'fileAge':
      return 'File Age';
    case 'recentActivity':
      return 'Recent Activity (90 days)';
    case 'stability':
      return 'Code Stability';
    case 'recency':
      return 'Recency';
    case 'cluster':
      return 'Coupling Clusters';
    case 'linesOfCode':
      return 'Lines of Code';
    case 'hotspot':
      return 'Hotspot (Churn × Recency)';
    case 'paceLayer':
      return 'Pace Layer';
    default:
      return 'Unknown';
  }
}
