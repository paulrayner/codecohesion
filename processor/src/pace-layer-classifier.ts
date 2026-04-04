/**
 * Pace layer classifier — assigns every file exactly one of four layers based
 * on change velocity percentile across the repository.
 *
 * Layers (bottom to top by change rate):
 *   foundation     — bottom 25% by changeVelocity (slowest-changing)
 *   infrastructure — 25th–50th percentile
 *   domain         — 50th–75th percentile
 *   surface        — top 25% (fastest-changing)
 *
 * changeVelocity = commitCount / repoAgeInUnits, where:
 *   - repos >= 2 years old: age measured in quarters
 *   - repos < 2 years old:  age measured in months
 *
 * Files with zero commits are always classified as "foundation".
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaceLayer = 'foundation' | 'infrastructure' | 'domain' | 'surface';

const PACE_LAYERS: readonly PaceLayer[] = [
  'foundation',
  'infrastructure',
  'domain',
  'surface',
];

/** Minimal file descriptor accepted by the classifier */
interface FileDescriptor {
  path: string;
  commitCount: number;
  firstCommitDate: string | null;
  lastModified: string | null;
}

/** Enriched result returned for each file */
export interface PaceLayerResult {
  path: string;
  paceLayer: PaceLayer;
  changeVelocity: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MS_PER_MONTH = (365.25 / 12) * 24 * 3600 * 1000;
const MS_PER_QUARTER = (365.25 / 4) * 24 * 3600 * 1000;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Compute change velocity for a single file given the repository's first-commit
 * date and a reference "now" date.
 *
 * The denominator unit switches at the 2-year boundary:
 *   - < 2 years  → months  (finer granularity for young repos)
 *   - >= 2 years → quarters (coarser granularity for mature repos)
 */
function computeChangeVelocity(
  commitCount: number,
  firstCommitDate: string | null,
  now: Date,
): number {
  if (commitCount === 0 || firstCommitDate === null) {
    return 0;
  }

  const firstDate = new Date(firstCommitDate);
  const ageMs = now.getTime() - firstDate.getTime();

  if (ageMs <= 0) {
    return 0;
  }

  // Determine repo age in whole calendar years to apply the 2-year boundary
  // consistently regardless of leap years. We compute the year difference and
  // then adjust back if the anniversary month/day hasn't been reached yet.
  const yearDiff = now.getUTCFullYear() - firstDate.getUTCFullYear();
  const anniversaryThisYear = new Date(Date.UTC(
    now.getUTCFullYear(),
    firstDate.getUTCMonth(),
    firstDate.getUTCDate(),
  ));
  const ageInYears = now >= anniversaryThisYear ? yearDiff : yearDiff - 1;

  const useQuarters = ageInYears >= 2;
  const ageInUnits = useQuarters ? ageMs / MS_PER_QUARTER : ageMs / MS_PER_MONTH;

  return commitCount / ageInUnits;
}

/**
 * Assign a pace layer based on the dense rank of a velocity value within the
 * sorted list of unique velocity values across all files.
 *
 * Using dense rank ensures that files with identical velocities always receive
 * the same layer (tie-breaking is consistent and predictable).
 *
 * @param velocity - The file's computed change velocity
 * @param sortedUniqueVelocities - Ascending-sorted unique velocity values
 */
function assignLayerByDenseRank(
  velocity: number,
  sortedUniqueVelocities: number[],
): PaceLayer {
  const uniqueCount = sortedUniqueVelocities.length;
  const rank = sortedUniqueVelocities.indexOf(velocity);
  // Map rank to one of four quartile buckets [0, 3]
  const bucketIndex = Math.floor((rank / uniqueCount) * 4);
  return PACE_LAYERS[bucketIndex];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a list of files into pace layers based on their change velocity.
 *
 * @param files - Array of file descriptors with commit metadata
 * @param now   - Reference date for age calculation (injectable for test determinism)
 * @returns     Array of results in the same order as input, each with paceLayer
 *              and changeVelocity
 */
export function classifyPaceLayers(
  files: FileDescriptor[],
  now: Date,
): PaceLayerResult[] {
  if (files.length === 0) {
    return [];
  }

  // Compute velocity for every file
  const velocities = files.map((file) =>
    computeChangeVelocity(file.commitCount, file.firstCommitDate, now),
  );

  // Build sorted list of unique non-zero velocities for percentile calculation.
  // Zero-commit files bypass percentile logic and are always "foundation".
  const nonZeroVelocities = velocities.filter((v) => v > 0);
  const sortedUniqueVelocities = [...new Set(nonZeroVelocities)].sort(
    (a, b) => a - b,
  );

  return files.map((file, index) => {
    const changeVelocity = velocities[index];

    // Zero-commit files are always foundation regardless of percentile position
    if (changeVelocity === 0) {
      return { path: file.path, paceLayer: 'foundation', changeVelocity: 0 };
    }

    const paceLayer = assignLayerByDenseRank(changeVelocity, sortedUniqueVelocities);
    return { path: file.path, paceLayer, changeVelocity };
  });
}
