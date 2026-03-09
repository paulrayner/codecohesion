import * as THREE from 'three';
import { LayoutNode } from './ILayoutStrategy';
import { DirectoryNode } from './types';
import { AABB2D, SpatialItem } from './SpatialIndex';

/**
 * PhysicsNode - Physics state for force-directed layout
 *
 * Wraps a LayoutNode with mutable physics properties:
 * - position (updated each frame)
 * - velocity
 * - acceleration (force accumulator)
 *
 * Based on Gource's RDirNode physics implementation.
 */
export class PhysicsNode implements SpatialItem {
  // Tree structure reference
  layoutNode: LayoutNode;
  directoryNode: DirectoryNode;

  // Physics state (mutable!)
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  prevAcceleration: THREE.Vector3;

  // Geometry (Gource uses TWO radii + territory)
  radius: number;           // dir_radius: collision detection (includes all descendants)
  parentRadius: number;     // parent_radius: child orbit distance (direct files only)
  territoryRadius: number;  // collision radius + max file orbit distance + padding

  // Hierarchy references
  parent: PhysicsNode | null;
  children: PhysicsNode[] = [];

  // Initialization
  isInitialized: boolean = false;

  constructor(layoutNode: LayoutNode, radius: number, parentRadius: number, territoryRadius: number, parent: PhysicsNode | null = null) {
    this.layoutNode = layoutNode;
    this.directoryNode = layoutNode.node as DirectoryNode;
    this.radius = radius;
    this.parentRadius = parentRadius;
    this.territoryRadius = territoryRadius;
    this.parent = parent;

    // Initialize physics state
    this.position = layoutNode.position.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.prevAcceleration = new THREE.Vector3(0, 0, 0);
  }

  /**
   * Get bounding box for spatial indexing (X/Z plane only)
   * Uses territory radius to ensure file orbit space is included in queries
   */
  getBounds(): AABB2D {
    return {
      minX: this.position.x - this.territoryRadius,
      minZ: this.position.z - this.territoryRadius,
      maxX: this.position.x + this.territoryRadius,
      maxZ: this.position.z + this.territoryRadius
    };
  }

  /**
   * Check if this node overlaps with another using territory radius.
   * Territory radius includes file orbit space, preventing file clouds from overlapping
   * even when directory collision radii don't touch.
   */
  overlaps(other: PhysicsNode): boolean {
    const dx = other.position.x - this.position.x;
    const dz = other.position.z - this.position.z;
    const distSq = dx * dx + dz * dz;
    const sumRadius = this.territoryRadius + other.territoryRadius;
    return distSq < sumRadius * sumRadius;
  }

  /**
   * Get distance to parent (in X/Z plane)
   * Uses collision radius for tight parent-child orbits (Gource style).
   * Territory-based separation is handled by repulsion forces between siblings.
   */
  distanceToParent(): number {
    if (!this.parent) return 0;

    const dx = this.parent.position.x - this.position.x;
    const dz = this.parent.position.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Distance from edge to edge (not center to center)
    // Uses parent.parentRadius (direct files only) for child orbit distance
    return dist - this.radius - this.parent.parentRadius;
  }

  /**
   * Check if another node is an ancestor of this node.
   * Uses an iterative walk up the parent chain instead of recursion to avoid
   * stack overflow on deeply nested hierarchies.
   */
  isAncestor(node: PhysicsNode): boolean {
    let current: PhysicsNode | null = this.parent;
    while (current !== null) {
      if (current === node) return true;
      current = current.parent;
    }
    return false;
  }

  /**
   * Get 2D direction vector to another node (X/Z plane only)
   */
  directionTo(other: PhysicsNode): THREE.Vector2 {
    const dx = other.position.x - this.position.x;
    const dz = other.position.z - this.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);

    if (len < 0.00001) {
      // Random direction if exactly overlapping
      return new THREE.Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
    }

    return new THREE.Vector2(dx / len, dz / len);
  }

  /**
   * Apply force to acceleration (2D force in X/Z plane)
   */
  applyForce(forceX: number, forceZ: number): void {
    this.acceleration.x += forceX;
    this.acceleration.z += forceZ;
  }

  /**
   * Reset acceleration to zero (call at start of force calculation)
   */
  resetAcceleration(): void {
    this.acceleration.set(0, 0, 0);
  }

  /**
   * Update position using Gource's simple integration: position += acceleration × dt.
   * No velocity accumulation prevents jitter - forces don't carry over between frames.
   * Acceleration is reset at the start of each frame by applyForces().
   */
  integrate(dt: number): void {
    // Root node is fixed at origin
    if (!this.parent) {
      this.position.set(0, 0, 0);
      return;
    }

    // Gource's simple integration: pos += accel × dt
    this.position.x += this.acceleration.x * dt;
    this.position.z += this.acceleration.z * dt;

    // Keep Y position fixed at 0 (true flat 2D layout like Gource)
    // All nodes on same plane, no hierarchical depth
    this.position.y = 0;

    // Sync back to layout node
    this.layoutNode.position.copy(this.position);
  }
}
