import { describe, it, expect } from 'vitest';
import {
  shouldReframeCamera,
  REFRAME_GROWTH_FACTOR,
  REFRAME_MIN_COMMITS,
} from './timelineCameraReframe';

describe('shouldReframeCamera', () => {
  it('does not frame when there is nothing on screen', () => {
    expect(
      shouldReframeCamera({ commitsSinceReframe: 100, lastFramedSize: 0, currentSize: 0 })
    ).toBe(false);
  });

  it('frames immediately when never framed and the scene has content', () => {
    expect(
      shouldReframeCamera({ commitsSinceReframe: 0, lastFramedSize: 0, currentSize: 10 })
    ).toBe(true);
  });

  it('debounces: does not re-fit before the minimum commit gap even after large growth', () => {
    expect(
      shouldReframeCamera({
        commitsSinceReframe: REFRAME_MIN_COMMITS - 1,
        lastFramedSize: 10,
        currentSize: 10 * REFRAME_GROWTH_FACTOR * 5,
      })
    ).toBe(false);
  });

  it('re-fits once the scene has grown past the factor after the debounce', () => {
    expect(
      shouldReframeCamera({
        commitsSinceReframe: REFRAME_MIN_COMMITS,
        lastFramedSize: 10,
        currentSize: 10 * REFRAME_GROWTH_FACTOR,
      })
    ).toBe(true);
  });

  it('does not re-fit when growth is below the factor', () => {
    expect(
      shouldReframeCamera({
        commitsSinceReframe: REFRAME_MIN_COMMITS + 50,
        lastFramedSize: 10,
        currentSize: 10 * (REFRAME_GROWTH_FACTOR - 0.1),
      })
    ).toBe(false);
  });

  it('does not re-fit when the scene shrinks (deletions still fit the framed view)', () => {
    expect(
      shouldReframeCamera({
        commitsSinceReframe: 100,
        lastFramedSize: 100,
        currentSize: 40,
      })
    ).toBe(false);
  });

  it('reproduces the empty-screen bug: tiny opening frame, then real growth re-fits', () => {
    // Commit 0 framed a single-node tree (size ~2).
    const framedAtOpening = 2;
    // A handful of commits later the tree has spread well beyond the locked view.
    expect(
      shouldReframeCamera({
        commitsSinceReframe: REFRAME_MIN_COMMITS,
        lastFramedSize: framedAtOpening,
        currentSize: 50,
      })
    ).toBe(true);
  });
});
