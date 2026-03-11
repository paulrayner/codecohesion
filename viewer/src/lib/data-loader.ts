/**
 * Pure functions for data loading decisions
 * Extracted from main.ts loadRepository function
 */

import type { RepositorySnapshot, TimelineData, TimelineDataV2 } from '../types';

export type DataFormat = 'timeline-v2' | 'timeline-v1' | 'static';

/**
 * Determine which files to try loading based on mode and timeline availability
 *
 * @param repoName - Base repository name (e.g., 'gource')
 * @param mode - Selected viewing mode ('head' or 'timeline')
 * @param timelineAvailable - Whether timeline data exists for this repo
 * @returns Array of filenames to try (in priority order) and whether we should fallback to HEAD mode
 */
export function determineFileToLoad(
  repoName: string,
  mode: 'head' | 'timeline',
  timelineAvailable: boolean
): { files: string[]; fallbackToHead: boolean } {
  if (mode === 'timeline' && timelineAvailable) {
    // Try timeline files in order: -timeline-full, then -timeline, then fallback to base
    return {
      files: [
        `${repoName}-timeline-full`,
        `${repoName}-timeline`,
        repoName
      ],
      fallbackToHead: false
    };
  } else {
    // HEAD mode or timeline not available
    return {
      files: [repoName],
      fallbackToHead: mode === 'timeline' // Need to switch mode if user requested timeline but it's unavailable
    };
  }
}

/**
 * Detect the format of loaded data by examining its structure
 *
 * @param data - The loaded JSON data
 * @returns The detected format type
 */
export function detectDataFormat(data: unknown): DataFormat {
  if (data && typeof data === 'object' && 'format' in data) {
    if (data.format === 'timeline-v2') {
      return 'timeline-v2';
    } else if (data.format === 'timeline-v1') {
      return 'timeline-v1';
    }
  }
  return 'static';
}

/**
 * Extract a snapshot from loaded data based on format
 *
 * @param data - The loaded data
 * @param format - The detected format
 * @returns The extracted snapshot, or null for timeline-v2 (which uses special loading path)
 */
export function extractSnapshot(
  data: RepositorySnapshot | TimelineData | TimelineDataV2,
  format: DataFormat
): RepositorySnapshot | null {
  switch (format) {
    case 'timeline-v2':
      // Timeline uses special loading path - signal to caller with null
      return null;
    case 'timeline-v1':
      return (data as TimelineData).headSnapshot;
    case 'static':
      return data as RepositorySnapshot;
  }
}
