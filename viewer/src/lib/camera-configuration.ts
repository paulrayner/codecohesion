/**
 * Pure functions for camera and controls configuration
 * Extracted from TreeVisualizer.setLayoutStrategy() for testability
 */

/**
 * Get camera field of view for layout mode
 *
 * 2D layouts use narrower FOV to reduce perspective distortion.
 * 3D layouts use standard FOV for perspective depth.
 *
 * @param is2DLayout Whether using 2D Force-Directed layout (overhead view)
 * @returns Camera FOV in degrees
 */
export function getCameraFOV(is2DLayout: boolean): number {
  return is2DLayout ? 30 : 60;
}

/**
 * Get OrbitControls rotation configuration for layout mode
 *
 * 2D layouts disable rotation (pan and zoom only).
 * 3D layouts enable rotation (full orbit control).
 *
 * @param is2DLayout Whether using 2D Force-Directed layout (overhead view)
 * @returns Configuration object with enableRotate flag
 */
export function getControlsConfig(is2DLayout: boolean): { enableRotate: boolean } {
  return { enableRotate: !is2DLayout };
}

/**
 * Get OrbitControls damping configuration for layout mode
 *
 * 2D layouts disable damping to prevent OrbitControls from "correcting"
 * the overhead camera rotation. Damping causes controls.update() to
 * reset overhead camera to default orbit angle.
 *
 * 3D layouts enable damping for smooth, natural camera motion.
 *
 * @param is2DLayout Whether using 2D Force-Directed layout (overhead view)
 * @returns True if damping should be enabled, false otherwise
 */
export function getDampingEnabled(is2DLayout: boolean): boolean {
  return !is2DLayout;
}

/**
 * Compute OrbitControls maxDistance from scene bounding radius
 *
 * Scales the zoom-out limit proportionally to the scene size so that large
 * repositories remain fully navigable. The floor of 150 preserves the
 * existing default for small scenes.
 *
 * @param sceneRadius Bounding-sphere radius of all laid-out nodes
 * @returns maxDistance value for OrbitControls
 */
export function computeMaxDistance(sceneRadius: number): number {
  return Math.max(150, sceneRadius * 3);
}

/**
 * Compute fog near/far range proportional to camera maxDistance
 *
 * Keeps the fog envelope scaled to the scene so the background fade
 * starts and ends at consistent visual positions regardless of scene size.
 * Using near = maxDistance * 0.3 and far = maxDistance * 1.2 avoids the
 * black-screen artifact caused by fog far being inside the scene bounds.
 *
 * @param maxDistance OrbitControls maxDistance (from computeMaxDistance)
 * @returns Object with near and far fog distances
 */
export function computeFogRange(maxDistance: number): { near: number; far: number } {
  return {
    near: maxDistance * 0.3,
    far: maxDistance * 1.2,
  };
}
