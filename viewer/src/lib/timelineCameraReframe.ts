/**
 * Decides when the timeline view should re-fit (re-frame) the camera during
 * playback. The camera is framed once on the first commit, but a repository's
 * file tree grows as commits replay, so the nodes drift outside a camera locked
 * to the opening frame. This re-fits the camera as the scene actually grows,
 * not on every frame (which would fight the user's panning and thrash playback).
 *
 * Pure decision logic, no Three.js. The caller measures the scene's bounding-box
 * size and supplies the commit counter.
 */

/** Re-fit once the scene is this many times larger than at the last framing. */
export const REFRAME_GROWTH_FACTOR = 1.4;

/** Debounce: never re-fit more often than this many commits apart. */
export const REFRAME_MIN_COMMITS = 5;

export interface ReframeState {
  /** Commits replayed since the camera was last framed. */
  commitsSinceReframe: number;
  /** Max bounding-box dimension at the last framing (0 = never framed). */
  lastFramedSize: number;
  /** Max bounding-box dimension of the scene right now. */
  currentSize: number;
}

/**
 * Returns true when the timeline should re-fit the camera to the current scene.
 */
export function shouldReframeCamera(state: ReframeState): boolean {
  const { commitsSinceReframe, lastFramedSize, currentSize } = state;

  // Nothing on screen yet: nothing to frame to.
  if (currentSize <= 0) return false;

  // Never framed (e.g. opened on an empty/one-node frame): frame now.
  if (lastFramedSize <= 0) return true;

  // Debounce rapid growth so we don't re-fit every single commit.
  if (commitsSinceReframe < REFRAME_MIN_COMMITS) return false;

  // Re-fit once the scene has grown meaningfully past the framed extent.
  return currentSize >= lastFramedSize * REFRAME_GROWTH_FACTOR;
}
