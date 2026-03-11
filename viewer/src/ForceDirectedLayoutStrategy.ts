import * as THREE from 'three';
import { DirectoryNode, FileNode } from './types';
import { ILayoutStrategy, LayoutNode, CameraDefaults } from './ILayoutStrategy';
import { PhysicsNode } from './PhysicsNode';
import { SpatialIndex } from './SpatialIndex';

/**
 * Configuration for force-directed physics (Gource algorithm)
 */
export interface ForceDirectedConfig {
  gravity: number;           // Parent attraction strength (default: 10.0)
  collisionPadding: number;  // Extra space between nodes (default: 0.5)
  fileDiameter: number;      // File diameter for ring spacing (default: 1.5)

  // Spiral positioning config (for initial placement)
  spiralBaseSpacing: number;     // Safety margin beyond radii (default: 0.5)
  spiralRadialMultiplier: number; // How much each step expands spiral (default: 0.7)

  // Repulsion config
  repulsionStrength: number;     // Force multiplier for repulsion (default: 1.0, like Gource)
}

/**
 * File orbit info (Gource style - relative positioning)
 */
export interface FileOrbitInfo {
  layoutNode: LayoutNode;
  relativeOffset: THREE.Vector2; // X/Z offset from parent
  parentPhysicsNode: PhysicsNode; // Reference to parent
}

/**
 * ForceDirectedLayoutStrategy - Gource-style physics-based layout
 *
 * Creates organic, breathing tree visualization using real-time physics simulation.
 * Based on Gource's RDirNode force calculations.
 *
 * Key features:
 * 1. Territory-based collision detection (includes file orbit space)
 * 2. Area-based directory sizing (Gource's recursive algorithm)
 * 3. Real-time physics forces (collision, gravity, alignment, spacing)
 * 4. Incremental updates for smooth timeline transitions
 *
 * Sizing strategy (Gource's algorithm):
 * - dir_area = (file_area × visible_count) + Σ(child.getArea())
 * - dir_radius = sqrt(dir_area) × padding
 * - Territory radius: Collision radius + max file orbit + padding
 *
 * Key forces:
 * 1. Collision avoidance (repulsion between overlapping territories)
 * 2. Parent gravity (attraction to parent at radius distance)
 * 3. Grandparent alignment (push along parent→grandparent direction)
 * 4. Sibling spacing (spread evenly around parent circumference)
 */
export class ForceDirectedLayoutStrategy implements ILayoutStrategy {
  private physicsNodes: Map<DirectoryNode, PhysicsNode> = new Map();
  private fileLayoutNodes: LayoutNode[] = [];
  private fileOrbitInfo: FileOrbitInfo[] = []; // NEW: Track relative file positions
  private config: ForceDirectedConfig;
  private spatialIndex: SpatialIndex = new SpatialIndex();

  constructor(config?: Partial<ForceDirectedConfig>) {
    this.config = {
      gravity: 10.0,
      collisionPadding: 0.5, // Reduced for tighter packing
      fileDiameter: 1.5, // Scaled for Three.js world coords (Gource uses 8.0 for pixels)
      spiralBaseSpacing: 0.5, // Reduced for compact layout
      spiralRadialMultiplier: 0.7, // Spiral expansion rate
      repulsionStrength: 2.0, // Amplified for territory-based overlap (larger overlaps need stronger push)
      ...config
    };
  }

  /**
   * Calculate directory area recursively (Gource's algorithm)
   *
   * dir_area = (file_area × visible_count) + Σ(child.getArea())
   *
   * This includes:
   * - Area of all direct files
   * - Recursive area of all subdirectories (which includes their files + subdirs)
   *
   * @param dirNode Directory to calculate area for
   * @returns Total area occupied by this directory and all descendants
   */
  private calculateArea(dirNode: DirectoryNode): number {
    const file_area = this.config.fileDiameter * this.config.fileDiameter * Math.PI;

    // Count direct files
    const visible_count = dirNode.children.filter(c => c.type === 'file').length;
    const total_file_area = file_area * visible_count;

    let dir_area = total_file_area;

    // Add area of subdirectories (recursive)
    for (const child of dirNode.children) {
      if (child.type === 'directory') {
        dir_area += this.calculateArea(child);
      }
    }

    return dir_area;
  }

  /**
   * Calculate directory radius from area (Gource's algorithm)
   *
   * dir_radius = sqrt(dir_area) × padding
   *
   * Padding value (0.23) is tuned so files orbit at 80-95% of radius,
   * minimizing empty space between directory file clouds.
   *
   * @param dirNode Directory to calculate radius for
   * @returns Collision radius for this directory
   */
  private calculateDirectoryRadius(dirNode: DirectoryNode): number {
    const dir_area = this.calculateArea(dirNode);
    const dir_radius = Math.max(1.0, Math.sqrt(dir_area)) * 0.23; // Tuned for optimal file orbit ratio

    return dir_radius;
  }

  /**
   * Calculate max file orbit distance for a directory.
   * Simulates Gource's ring algorithm to find the outermost ring distance.
   */
  private calculateMaxOrbitDistance(fileCount: number): number {
    if (fileCount === 0) return 0;

    let maxFilesInRing = 1;
    let diameter = 1;
    let distance = 0.0;
    let filesRemaining = fileCount;

    while (filesRemaining > 0) {
      const filesInRing = Math.min(filesRemaining, maxFilesInRing);
      filesRemaining -= filesInRing;

      if (filesRemaining > 0) {
        diameter++;
        distance += this.config.fileDiameter;
        maxFilesInRing = Math.max(1, Math.floor(diameter * Math.PI));
      }
    }

    return distance;
  }

  /**
   * Calculate territory radius: collision radius + max file orbit + file diameter padding.
   * Territory includes the space occupied by orbiting files around a directory.
   */
  private calculateTerritoryRadius(dirNode: DirectoryNode, collisionRadius: number): number {
    const fileCount = dirNode.children.filter(c => c.type === 'file').length;
    const maxOrbit = this.calculateMaxOrbitDistance(fileCount);
    // Add fileDiameter as padding for the file spheres themselves
    return collisionRadius + maxOrbit + this.config.fileDiameter;
  }

  /**
   * Calculate radius for child node positioning (satisfies ILayoutStrategy interface).
   * For the force-directed layout, use sqrt scaling consistent with the area-based model.
   */
  calculateRadius(childCount: number): number {
    const baseRadius = 6;
    return baseRadius + Math.sqrt(childCount) * 2.5;
  }


  /**
   * Get camera defaults for top-down 2D view (Gource style)
   */
  getCameraDefaults(): CameraDefaults {
    return {
      position: new THREE.Vector3(0, 150, 0.1), // Adjusted for smaller scene scale
      lookAt: new THREE.Vector3(0, 0, 0)
    };
  }

  /**
   * Initialize layout tree and physics nodes
   */
  layoutTree(
    node: DirectoryNode,
    position: THREE.Vector3,
    _level: number,
    _angleStart: number,
    _angleEnd: number,
    _parentLayout?: LayoutNode
  ): LayoutNode[] {
    // Clear previous state
    this.physicsNodes.clear();
    this.fileLayoutNodes = [];

    // Create physics nodes for all directories
    const rootPhysicsNode = this.createPhysicsNodes(node, position, null);

    // Set initial positions
    this.setInitialPositions(rootPhysicsNode);

    // Create file nodes (static, orbit parents)
    this.createFileNodes();

    // Collect all layout nodes
    const layoutNodes: LayoutNode[] = [];
    this.physicsNodes.forEach(pNode => {
      layoutNodes.push(pNode.layoutNode);
    });
    layoutNodes.push(...this.fileLayoutNodes);

    return layoutNodes;
  }

  /**
   * Recursively create physics nodes for directory tree
   *
   * Uses Gource's area-based sizing: directory radius includes area of all descendants.
   * This ensures parent directories are large enough to accommodate their entire subtree.
   */
  private createPhysicsNodes(
    dirNode: DirectoryNode,
    position: THREE.Vector3,
    parent: PhysicsNode | null
  ): PhysicsNode {
    // Gource's area-based sizing: radius includes all descendants
    const radius = this.calculateDirectoryRadius(dirNode);

    // Calculate parent_radius (Gource: based on direct files only, not subdirectories)
    const fileCount = dirNode.children.filter(c => c.type === 'file').length;
    const fileArea = this.config.fileDiameter * this.config.fileDiameter * Math.PI;
    const parentArea = fileArea * fileCount;
    const parentRadius = Math.max(1.0, Math.sqrt(parentArea)) * 0.23;

    // Territory radius includes file orbit space
    const territoryRadius = this.calculateTerritoryRadius(dirNode, radius);

    // Create layout node
    const layoutNode: LayoutNode = {
      node: dirNode,
      position: position.clone(),
      parent: parent?.layoutNode
    };

    // Create physics node
    const physicsNode = new PhysicsNode(layoutNode, radius, parentRadius, territoryRadius, parent);
    this.physicsNodes.set(dirNode, physicsNode);

    // Add to parent's children
    if (parent) {
      parent.children.push(physicsNode);
    }

    // Recursively create child directories
    const childDirs = dirNode.children.filter(c => c.type === 'directory') as DirectoryNode[];
    for (const childDir of childDirs) {
      const childPos = position.clone(); // Will be set by setInitialPositions
      this.createPhysicsNodes(childDir, childPos, physicsNode);
    }

    return physicsNode;
  }

  /**
   * Set initial positions for all physics nodes using spiral positioning
   *
   * Uses golden angle spiral for even distribution of siblings based on territory size.
   * This prevents initial overlaps that require many physics iterations to resolve.
   */
  private setInitialPositions(root: PhysicsNode): void {
    // Root is fixed at origin
    root.position.set(0, 0, 0);
    root.isInitialized = true;

    // Recursively initialize children
    const queue: PhysicsNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;

      // Position children in golden angle spiral around parent
      this.positionChildrenInSpiral(node);

      // Add children to queue for recursive processing
      for (const child of node.children) {
        queue.push(child);
      }
    }
  }

  /**
   * Position children in golden angle spiral around parent
   *
   * Golden angle (137.5°) creates even distribution without obvious patterns.
   * Distance from center increases with each child to prevent overlap.
   */
  private positionChildrenInSpiral(parent: PhysicsNode): void {
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5° in radians

    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child.isInitialized) continue;

      const angle = i * GOLDEN_ANGLE;
      const distance = this.calculateSpiralDistance(
        parent,
        child,
        i
      );

      // Convert polar to cartesian coordinates
      const offsetX = Math.cos(angle) * distance;
      const offsetZ = Math.sin(angle) * distance;

      // Position child relative to parent
      child.position.set(
        parent.position.x + offsetX,
        0,
        parent.position.z + offsetZ
      );

      child.isInitialized = true;
    }
  }

  /**
   * Calculate distance from parent for child at given spiral index (Gource algorithm)
   *
   * Formula: baseDistance + (index * childRadius * multiplier)
   * - Base: Ensures radii don't overlap (parent.radius + child.radius + margin)
   * - Radial offset: Expands spiral to prevent overlap as it grows
   *
   * Uses territory radius to ensure file clouds don't overlap in initial placement
   */
  private calculateSpiralDistance(
    parent: PhysicsNode,
    child: PhysicsNode,
    index: number
  ): number {
    const baseDistance =
      parent.territoryRadius +
      child.territoryRadius +
      this.config.spiralBaseSpacing;

    const radialOffset =
      index * child.territoryRadius * this.config.spiralRadialMultiplier;

    return baseDistance + radialOffset;
  }

  /**
   * Create file nodes that orbit their parent directories (Gource algorithm)
   */
  private createFileNodes(): void {
    this.fileOrbitInfo = []; // Reset
    this.fileLayoutNodes = [];

    this.physicsNodes.forEach(physicsNode => {
      const dirNode = physicsNode.directoryNode;
      const files = dirNode.children.filter(c => c.type === 'file') as FileNode[];

      if (files.length === 0) return;

      // Gource's ring algorithm: first ring has 1 file, subsequent rings use diameter × π
      // Start at directory center (distance 0.0), independent of collision radius
      let maxFilesInRing = 1; // First ring: 1 file (Gource hardcodes this)
      let diameter = 1;
      let distance = 0.0; // First ring at center (Gource's approach)
      let fileIndex = 0;
      let filesRemaining = files.length;

      while (filesRemaining > 0) {
        const filesInRing = Math.min(filesRemaining, maxFilesInRing);
        const angleStep = (Math.PI * 2) / filesInRing;
        const angleOffset = (diameter - 1) * 0.5; // Rotate each ring to stagger files organically

        for (let i = 0; i < filesInRing && fileIndex < files.length; i++) {
          const file = files[fileIndex];
          const angle = angleStep * i + angleOffset;

          // Store RELATIVE offset from parent (Gource style)
          const relativeOffset = new THREE.Vector2(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance
          );

          // Create layout node (position will be updated in updateFilePositions)
          const layoutNode: LayoutNode = {
            node: file,
            position: new THREE.Vector3(0, 0, 0), // Placeholder, updated every frame
            parent: physicsNode.layoutNode
          };

          this.fileOrbitInfo.push({
            layoutNode,
            relativeOffset,
            parentPhysicsNode: physicsNode
          });

          this.fileLayoutNodes.push(layoutNode);
          fileIndex++;
        }

        filesRemaining -= filesInRing;
        diameter++;
        distance += this.config.fileDiameter;
        maxFilesInRing = Math.max(1, Math.floor(diameter * Math.PI)); // Next ring uses formula
      }
    });

    // Initial position update
    this.updateFilePositions();
  }

  /**
   * Physics update (called every frame)
   */
  tick(dt: number): void {
    // Cap delta time to prevent huge jumps
    dt = Math.min(dt, 0.1);

    // 1. Rebuild spatial index
    this.spatialIndex.clear();
    this.physicsNodes.forEach(node => {
      if (node.parent) { // Don't index root
        this.spatialIndex.insert(node);
      }
    });

    // 2. Apply forces to each node
    this.physicsNodes.forEach(node => {
      if (node.parent) { // Root is fixed
        this.applyForces(node);
      }
    });

    // 3. Integrate (move nodes)
    this.physicsNodes.forEach(node => {
      node.integrate(dt);
    });

    // 4. Update file positions (orbit parents)
    this.updateFilePositions();
  }

  /**
   * Apply all forces to a physics node (Gource algorithm)
   */
  private applyForces(node: PhysicsNode): void {
    node.resetAcceleration();

    // 1. Collision avoidance (repulsion from nearby nodes)
    // Use territory radius for search to detect overlapping file clouds
    const nearby = this.spatialIndex.queryNearPoint(
      node.position.x,
      node.position.z,
      node.territoryRadius * 2 // Search radius based on territory radius
    );

    for (const other of nearby) {
      const otherNode = other as PhysicsNode;
      if (otherNode === node) continue;
      if (otherNode === node.parent) continue;
      if (otherNode.parent === node) continue;
      if (node.isAncestor(otherNode)) continue;
      if (otherNode.isAncestor(node)) continue;

      // Check overlap
      if (node.overlaps(otherNode)) {
        this.applyRepulsion(node, otherNode);
      }
    }

    // 2. Parent gravity (attraction to parent)
    this.applyParentGravity(node);

    // 3. Grandparent alignment (push along parent→grandparent direction)
    if (node.parent && node.parent.parent) {
      this.applyGrandparentAlignment(node);
    }

    // 4. Sibling spacing (spread around parent circumference)
    this.applySiblingSpacing(node);
  }

  /**
   * Force 1: Repulsion from overlapping nodes
   *
   * Uses territory radius (collision radius + file orbit space) for overlap detection.
   * This prevents file clouds from overlapping even when directory cubes don't collide.
   *
   * Formula: force = -overlap × repulsionStrength
   * - overlap: Negative when territories intersect (dist < territory1 + territory2)
   * - repulsionStrength: Configurable multiplier (default 1.0)
   */
  private applyRepulsion(node: PhysicsNode, other: PhysicsNode): void {
    const dx = other.position.x - node.position.x;
    const dz = other.position.z - node.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.00001) return; // Avoid division by zero

    // Calculate overlap using territory radius (includes file orbit space)
    const overlap = dist - node.territoryRadius - other.territoryRadius;

    // Only apply repulsion if territories overlap (overlap < 0)
    if (overlap >= 0) return;

    // Force proportional to overlap distance
    const forceMagnitude = -overlap * this.config.repulsionStrength;

    // Direction: push away from other node
    const dirX = -dx / dist;
    const dirZ = -dz / dist;

    node.applyForce(forceMagnitude * dirX, forceMagnitude * dirZ);
  }

  /**
   * Force 2: Parent gravity (pull toward parent at radius distance)
   */
  private applyParentGravity(node: PhysicsNode): void {
    if (!node.parent) return;

    const parentDist = node.distanceToParent();
    const dx = node.parent.position.x - node.position.x;
    const dz = node.parent.position.z - node.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.00001) return;

    const forceX = this.config.gravity * parentDist * (dx / dist);
    const forceZ = this.config.gravity * parentDist * (dz / dist);

    node.applyForce(forceX, forceZ);
  }

  /**
   * Force 3: Grandparent alignment (push along parent→grandparent direction)
   */
  private applyGrandparentAlignment(node: PhysicsNode): void {
    const parent = node.parent!;
    const grandparent = parent.parent!;

    // Direction from grandparent to parent
    const edgeX = parent.position.x - grandparent.position.x;
    const edgeZ = parent.position.z - grandparent.position.z;
    const edgeLen = Math.sqrt(edgeX * edgeX + edgeZ * edgeZ);

    if (edgeLen < 0.00001) return;

    const normalX = edgeX / edgeLen;
    const normalZ = edgeZ / edgeLen;

    // Desired position: along parent→grandparent line, at parent's radius
    const desiredX = parent.position.x + (parent.radius + node.radius) * normalX;
    const desiredZ = parent.position.z + (parent.radius + node.radius) * normalZ;

    // Force toward desired position
    const forceX = desiredX - node.position.x;
    const forceZ = desiredZ - node.position.z;

    node.applyForce(forceX, forceZ);
  }

  /**
   * Force 4: Sibling spacing (spread evenly around parent)
   */
  private applySiblingSpacing(node: PhysicsNode): void {
    const siblings = node.parent!.children.filter(s => s !== node);
    if (siblings.length === 0) return;

    let repulsionX = 0;
    let repulsionZ = 0;
    let visibleCount = 1;

    for (const sibling of siblings) {
      visibleCount++;

      // Repel from sibling
      const dir = node.directionTo(sibling);
      repulsionX -= dir.x;
      repulsionZ -= dir.y;
    }

    // Scale by parent circumference divided by sibling count
    const sliceSize = (node.parent!.radius * Math.PI) / (visibleCount + 1);
    repulsionX *= sliceSize;
    repulsionZ *= sliceSize;

    node.applyForce(repulsionX, repulsionZ);
  }

  /**
   * Update file positions to orbit their parent directories (Gource style)
   * Files use relative offsets, calculate absolute position from parent
   */
  private updateFilePositions(): void {
    for (const fileInfo of this.fileOrbitInfo) {
      const parent = fileInfo.parentPhysicsNode;

      // Calculate absolute position (relative offset + parent position)
      fileInfo.layoutNode.position.x = parent.position.x + fileInfo.relativeOffset.x;
      fileInfo.layoutNode.position.y = 0; // Always Y=0 (true flat 2D)
      fileInfo.layoutNode.position.z = parent.position.z + fileInfo.relativeOffset.y;
    }
  }

  /**
   * This layout needs continuous updates
   */
  needsContinuousUpdate(): boolean {
    return true;
  }

  /**
   * Add a new node to the layout (for incremental timeline updates)
   * @param layoutNode - The new layout node to add (must be a file)
   */
  addNode(layoutNode: LayoutNode): void {
    // Only files can be added incrementally (directories are structural)
    if (layoutNode.node.type !== 'file') return;
    if (!layoutNode.parent) return;

    // Find parent physics node
    const parentDirNode = layoutNode.parent.node as DirectoryNode;
    const parentPhysicsNode = this.physicsNodes.get(parentDirNode);
    if (!parentPhysicsNode) return;

    // Calculate relative offset for this file (add to outer ring of parent)
    const existingFiles = this.fileOrbitInfo.filter(
      info => info.parentPhysicsNode === parentPhysicsNode
    );

    // Determine which ring to place this file in (Gource: ring 1 has 1 file, others use diameter × π)
    let maxFilesInRing = 1; // First ring: 1 file
    let diameter = 1;
    let distance = 0.0;
    let filesPlaced = 0;

    while (filesPlaced + maxFilesInRing <= existingFiles.length) {
      filesPlaced += maxFilesInRing;
      diameter++;
      distance += this.config.fileDiameter;
      maxFilesInRing = Math.max(1, Math.floor(diameter * Math.PI));
    }

    const posInRing = existingFiles.length - filesPlaced;
    const angle = (Math.PI * 2 / maxFilesInRing) * posInRing + (diameter - 1) * 0.5;

    const relativeOffset = new THREE.Vector2(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance
    );

    // Calculate absolute position
    layoutNode.position.x = parentPhysicsNode.position.x + relativeOffset.x;
    layoutNode.position.y = 0;
    layoutNode.position.z = parentPhysicsNode.position.z + relativeOffset.y;

    // Add to orbit tracking
    this.fileOrbitInfo.push({
      layoutNode,
      relativeOffset,
      parentPhysicsNode
    });

    this.fileLayoutNodes.push(layoutNode);
  }

  /**
   * Add a new edge to the layout (for incremental timeline updates)
   * Note: Edges are implicitly defined by parent-child relationships,
   * so this is a no-op for this layout strategy
   */
  addEdge(_parent: LayoutNode, _child: LayoutNode): void {
    // No-op: edges follow parent-child relationships automatically
  }

  /**
   * Remove a node from the layout (for incremental timeline updates)
   * @param layoutNode - The layout node to remove (must be a file)
   */
  removeNode(layoutNode: LayoutNode): void {
    // Only files can be removed incrementally
    if (layoutNode.node.type !== 'file') return;

    // Remove from orbit tracking
    const orbitIndex = this.fileOrbitInfo.findIndex(info => info.layoutNode === layoutNode);
    if (orbitIndex !== -1) {
      this.fileOrbitInfo.splice(orbitIndex, 1);
    }

    // Remove from file layout nodes
    const fileIndex = this.fileLayoutNodes.indexOf(layoutNode);
    if (fileIndex !== -1) {
      this.fileLayoutNodes.splice(fileIndex, 1);
    }
  }
}
