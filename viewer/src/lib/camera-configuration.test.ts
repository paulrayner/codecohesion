import { describe, it, expect } from 'vitest';
import {
  getCameraFOV,
  getControlsConfig,
  getDampingEnabled,
  computeMaxDistance,
  computeFogRange,
} from './camera-configuration';

describe('getCameraFOV', () => {
  /**
   * 2D Force-Directed layouts use narrower FOV (30°) to reduce
   * perspective distortion in overhead view.
   */
  it('should return 30 degrees for 2D layout', () => {
    const fov = getCameraFOV(true);
    expect(fov).toBe(30);
  });

  /**
   * 3D Hierarchical layouts use standard FOV (60°) for
   * proper perspective depth perception.
   */
  it('should return 60 degrees for 3D layout', () => {
    const fov = getCameraFOV(false);
    expect(fov).toBe(60);
  });
});

describe('getControlsConfig', () => {
  /**
   * 2D overhead view should disable rotation - users can only pan and zoom.
   * Rotation doesn't make sense when camera is locked directly above scene.
   */
  it('should disable rotation for 2D layout', () => {
    const config = getControlsConfig(true);
    expect(config.enableRotate).toBe(false);
  });

  /**
   * 3D perspective view should enable rotation - users can orbit around scene.
   * Full 3D navigation requires rotation capability.
   */
  it('should enable rotation for 3D layout', () => {
    const config = getControlsConfig(false);
    expect(config.enableRotate).toBe(true);
  });
});

describe('getDampingEnabled', () => {
  /**
   * 2D overhead view should disable damping to prevent OrbitControls from
   * "correcting" the camera rotation. Damping causes controls.update() to
   * reset overhead camera to default orbit angle instead of staying directly above.
   */
  it('should disable damping for 2D layout', () => {
    const damping = getDampingEnabled(true);
    expect(damping).toBe(false);
  });

  /**
   * 3D perspective view should enable damping for smooth, natural camera motion.
   * Damping adds inertia to camera movements, making orbiting feel more fluid.
   */
  it('should enable damping for 3D layout', () => {
    const damping = getDampingEnabled(false);
    expect(damping).toBe(true);
  });
});

describe('computeMaxDistance', () => {
  /**
   * Small scenes must never reduce the zoom-out limit below the original
   * hardcoded default of 150 to avoid regressions on tiny repositories.
   */
  it('returns at least 150 for small scenes to preserve the existing default', () => {
    expect(computeMaxDistance(0)).toBe(150);
    expect(computeMaxDistance(10)).toBe(150);
    expect(computeMaxDistance(49)).toBe(150); // 49 * 3 = 147, below floor
  });

  it('scales with large scene radii when radius * 3 exceeds the floor', () => {
    expect(computeMaxDistance(100)).toBe(300);
    expect(computeMaxDistance(200)).toBe(600);
    expect(computeMaxDistance(1000)).toBe(3000);
  });

  it('returns exactly 150 when sceneRadius * 3 equals the floor boundary', () => {
    // 50 * 3 = 150, the exact boundary value
    expect(computeMaxDistance(50)).toBe(150);
  });

  it('returns scaled value when sceneRadius * 3 just exceeds the floor', () => {
    // 51 * 3 = 153, one step above the floor
    expect(computeMaxDistance(51)).toBe(153);
  });
});

describe('computeFogRange', () => {
  /**
   * Fog near and far must be proportional to maxDistance so that the fog
   * envelope stays visually consistent regardless of scene size, and the
   * far plane never falls inside the scene (which caused the black-screen bug).
   */
  it('returns near = maxDistance * 0.3 and far = maxDistance * 1.2', () => {
    const { near, far } = computeFogRange(150);
    expect(near).toBe(45);  // 150 * 0.3
    expect(far).toBe(180);  // 150 * 1.2
  });

  it('scales proportionally for large maxDistance values', () => {
    const { near, far } = computeFogRange(600);
    expect(near).toBe(180); // 600 * 0.3
    expect(far).toBe(720);  // 600 * 1.2
  });

  it('far is always greater than near', () => {
    for (const maxDistance of [50, 150, 300, 1000]) {
      const { near, far } = computeFogRange(maxDistance);
      expect(far).toBeGreaterThan(near);
    }
  });

  it('maintains a 4x ratio between far and near (1.2 / 0.3 = 4)', () => {
    // Consistent ratio ensures the fog band width scales uniformly
    const { near, far } = computeFogRange(300);
    expect(far / near).toBeCloseTo(4);
  });
});
