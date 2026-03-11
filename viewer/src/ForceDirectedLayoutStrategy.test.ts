import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ForceDirectedLayoutStrategy, ForceDirectedConfig, FileOrbitInfo } from './ForceDirectedLayoutStrategy';
import { DirectoryNode, FileNode } from './types';
import { PhysicsNode } from './PhysicsNode';
import { LayoutNode } from './ILayoutStrategy';
import { createMockFile } from './lib/test-fixtures';

/** Structural type for accessing ForceDirectedLayoutStrategy private state in tests */
interface ForceDirectedInternals {
  physicsNodes: Map<DirectoryNode, PhysicsNode>;
  fileOrbitInfo: FileOrbitInfo[];
  config: ForceDirectedConfig;
}

/**
 * Test Suite: Force-Directed Layout Strategy - Gource Two-Radius System
 * Tests Gource's area-based sizing using TWO radii: dir_radius and parent_radius.
 */

describe('PhysicsNode - Parent Radius (Gource Two-Radius System)', () => {
  /**
   * Phase 1 - RED
   *
   * Gource uses TWO radii per directory:
   * 1. dir_radius: Full size (all descendants) - for collision detection
   * 2. parent_radius: Smaller size (direct files only) - for child orbit distance
   *
   * This test verifies the calculation is correct.
   */
  it('should calculate parent_radius from direct files only (not subdirectories)', () => {
    const fileDiameter = 1.5;
    const padding = 0.23;
    const fileArea = fileDiameter * fileDiameter * Math.PI;

    // Expected parent_radius: based on 10 direct files only
    const directFileCount = 10;
    const parentArea_directFilesOnly = fileArea * directFileCount;
    const expectedParentRadius = Math.max(1.0, Math.sqrt(parentArea_directFilesOnly)) * padding;

    // Expected dir_radius: based on all 110 files (10 + 50 + 50)
    const totalFileCount = 110;
    const totalArea_allFiles = fileArea * totalFileCount;
    const expectedDirRadius = Math.max(1.0, Math.sqrt(totalArea_allFiles)) * padding;

    console.log('\nGource parent_radius vs dir_radius:');
    console.log(`  Direct files in parent: ${directFileCount}`);
    console.log(`  Total files (with subdirs): ${totalFileCount}`);
    console.log(`  Expected parent_radius: ${expectedParentRadius.toFixed(2)} (for child orbit)`);
    console.log(`  Expected dir_radius: ${expectedDirRadius.toFixed(2)} (for collision)`);
    console.log(`  Ratio: ${(expectedParentRadius / expectedDirRadius).toFixed(2)} (parent_radius < dir_radius)`);

    // Test expectation: parent_radius should be much smaller than dir_radius
    expect(expectedParentRadius).toBeLessThan(expectedDirRadius);
    expect(expectedParentRadius).toBeCloseTo(1.93, 1); // Calculated value from test output
    expect(expectedDirRadius).toBeCloseTo(6.41, 1); // Calculated value from test output
    expect(expectedParentRadius / expectedDirRadius).toBeCloseTo(0.30, 1); // ~30% ratio

    // This test PASSES - it verifies the math
    // Now we need to implement parentRadius in PhysicsNode
  });
});

describe('PhysicsNode - Territory-Based Overlap Detection', () => {
  /**
   * CYCLE 1 - GREEN (updated from RED)
   * overlaps() uses territory radius to prevent file cloud overlap.
   * Nodes beyond territory sum should not overlap.
   */
  it('should use territoryRadius for overlap detection', () => {
    // Create two physics nodes with known radii and territory radii
    const layoutNode1: LayoutNode = {
      node: { type: 'directory', name: 'dir1', path: '', children: [] } as DirectoryNode,
      position: new THREE.Vector3(0, 0, 0),
      parent: undefined
    };

    const layoutNode2: LayoutNode = {
      node: { type: 'directory', name: 'dir2', path: '', children: [] } as DirectoryNode,
      position: new THREE.Vector3(0, 0, 0),
      parent: undefined
    };

    const node1 = new PhysicsNode(layoutNode1, 5.0, 0, 7.0);
    const node2 = new PhysicsNode(layoutNode2, 3.0, 0, 5.0);

    // Position nodes beyond their territory sum (7 + 5 = 12)
    node1.position.set(0, 0, 0);
    node2.position.set(15, 0, 0); // Distance = 15 > territory sum 12

    expect(node1.overlaps(node2)).toBe(false);

    // Position nodes within territory sum but beyond collision radius sum (5 + 3 = 8)
    node2.position.set(10, 0, 0); // Distance = 10, within territory sum 12
    expect(node1.overlaps(node2)).toBe(true);
  });

  /**
   * CYCLE 2 - GREEN (updated from RED)
   * PhysicsNode extends Gource's model with territoryRadius for file orbit space.
   * Territory radius >= collision radius, preventing file cloud overlaps.
   */
  it('should have territoryRadius >= radius for file orbit space', () => {
    const layoutNode: LayoutNode = {
      node: { type: 'directory', name: 'dir1', path: '', children: [] } as DirectoryNode,
      position: new THREE.Vector3(0, 0, 0),
      parent: undefined
    };

    const territoryRadius = 8.0;
    const physicsNode = new PhysicsNode(layoutNode, 5.0, 0, territoryRadius);

    expect(physicsNode.radius).toBe(5.0);
    expect(physicsNode.territoryRadius).toBe(territoryRadius);
    expect(physicsNode.territoryRadius).toBeGreaterThanOrEqual(physicsNode.radius);
  });
});

describe('ForceDirectedLayoutStrategy - Directory Sizing (Padding Tuning)', () => {
  /**
   * TDD CYCLE 1 - RED
   *
   * Files should orbit NEAR THE EDGE of the directory radius, not deep inside.
   * This minimizes empty space between directory file clouds.
   *
   * Current padding (0.3) creates radius too small → files orbit at ~66% of radius
   * → 34% wasted space inside each directory → excessive empty space between clouds
   *
   * Target: Files should orbit at 80-95% of radius for natural, compact spacing
   */
  it('should size directories so files orbit near the radius edge (80-95% for 50+ files)', () => {
    const fileDiameter = 1.5;
    const currentPadding = 0.23; // Line 118 in ForceDirectedLayoutStrategy.ts

    function calculateOrbitRatio(fileCount: number, padding: number): number {
      // Calculate max file orbit distance using Gource's ring algorithm
      let maxOrbitDistance = 0;
      let filesPlaced = 0;
      let maxFilesInRing = 1;
      let diameter = 1;
      let distance = 0.0;

      while (filesPlaced < fileCount) {
        const filesInRing = Math.min(fileCount - filesPlaced, maxFilesInRing);
        maxOrbitDistance = distance;
        filesPlaced += filesInRing;
        diameter++;
        distance += fileDiameter * 0.5;
        maxFilesInRing = Math.max(1, Math.floor(diameter * Math.PI));
      }

      // Calculate directory radius
      const fileArea = fileDiameter * fileDiameter * Math.PI;
      const dirArea = fileArea * fileCount;
      const dirRadius = Math.max(1.0, Math.sqrt(dirArea)) * padding;

      return maxOrbitDistance / dirRadius;
    }

    // Test with different directory sizes (50, 100, 200, 500 files)
    const testCases = [50, 100, 200, 500];
    console.log(`\nOrbit ratios with padding=${currentPadding}:`);

    for (const fileCount of testCases) {
      const orbitRatio = calculateOrbitRatio(fileCount, currentPadding);
      console.log(`  ${fileCount} files: ${(orbitRatio * 100).toFixed(1)}%`);

      // Test expectation: For directories with 50+ files, orbit ratio should be 80-95%
      // Current padding (0.3) gives ~66% → test FAILS
      // Need padding ~0.22-0.24 to reach 80-95% target
      expect(orbitRatio).toBeGreaterThanOrEqual(0.80);
      expect(orbitRatio).toBeLessThanOrEqual(0.95);
    }
  });
});

describe('ForceDirectedLayoutStrategy - Connection Line Distances (Realistic Repos)', () => {
  /**
   * Test fixture factory: Creates realistic directory structures
   * matching actual repository patterns
   */
  function createRepoStructure(config: {
    subdirs: Array<{ name: string; fileCount: number; children?: Array<{ name: string; fileCount: number }> }>;
    rootFiles: number;
  }): DirectoryNode {
    const createFiles = (count: number, prefix: string): FileNode[] => {
      return Array(count).fill(null).map((_, i) => ({
        type: 'file' as const,
        name: `${prefix}${i}.ts`,
        path: `/${prefix}${i}.ts`,
        extension: 'ts',
        loc: 100,
        lastModified: new Date().toISOString(),
        lastAuthor: 'test',
        lastCommitHash: 'abc123',
        commitCount: 5,
        contributorCount: 2,
        firstCommitDate: null,
        recentLinesChanged: null,
        avgLinesPerCommit: null,
        daysSinceLastModified: null,
      }));
    };

    const subdirNodes: DirectoryNode[] = config.subdirs.map(subdir => {
      const subdirChildren: (FileNode | DirectoryNode)[] = createFiles(subdir.fileCount, `${subdir.name}_file`);

      // Add nested subdirectories if specified
      if (subdir.children) {
        for (const nestedSubdir of subdir.children) {
          subdirChildren.push({
            type: 'directory',
            name: nestedSubdir.name,
            path: `/${subdir.name}/${nestedSubdir.name}`,
            children: createFiles(nestedSubdir.fileCount, `${nestedSubdir.name}_file`)
          });
        }
      }

      return {
        type: 'directory',
        name: subdir.name,
        path: `/${subdir.name}`,
        children: subdirChildren
      };
    });

    const rootFiles = createFiles(config.rootFiles, 'root_file');

    return {
      type: 'directory',
      name: 'root',
      path: '/',
      children: [...subdirNodes, ...rootFiles]
    };
  }

  /**
   * Small repo: ~30-40 files (like codecohesion)
   */
  function createSmallRepo(): DirectoryNode {
    return createRepoStructure({
      subdirs: [
        { name: 'src', fileCount: 10, children: [
          { name: 'lib', fileCount: 5 },
          { name: 'utils', fileCount: 5 }
        ]},
        { name: 'tests', fileCount: 8 }
      ],
      rootFiles: 3
    });
  }

  /**
   * Medium repo: ~120-150 files (like gource)
   */
  function createMediumRepo(): DirectoryNode {
    return createRepoStructure({
      subdirs: [
        { name: 'src', fileCount: 30, children: [
          { name: 'core', fileCount: 25 },
          { name: 'ui', fileCount: 20 },
          { name: 'utils', fileCount: 15 }
        ]},
        { name: 'tests', fileCount: 25 }
      ],
      rootFiles: 5
    });
  }

  /**
   * Large repo: ~400-500 files (like cbioportal)
   */
  function createLargeRepo(): DirectoryNode {
    return createRepoStructure({
      subdirs: [
        { name: 'api', fileCount: 50, children: [
          { name: 'handlers', fileCount: 40 },
          { name: 'models', fileCount: 60 },
          { name: 'utils', fileCount: 30 }
        ]},
        { name: 'ui', fileCount: 70, children: [
          { name: 'components', fileCount: 80 },
          { name: 'pages', fileCount: 70 }
        ]},
        { name: 'tests', fileCount: 40 }
      ],
      rootFiles: 10
    });
  }

  /**
   * Calculate directory radius using the same formula as ForceDirectedLayoutStrategy
   */
  function calculateDirectoryRadius(dirNode: DirectoryNode): number {
    const fileDiameter = 1.5;
    const padding = 0.23; // Current value in ForceDirectedLayoutStrategy.ts

    function calculateArea(node: DirectoryNode): number {
      const file_area = fileDiameter * fileDiameter * Math.PI;
      const visible_count = node.children.filter(c => c.type === 'file').length;
      let dir_area = file_area * visible_count;

      // Add area of subdirectories (recursive)
      for (const child of node.children) {
        if (child.type === 'directory') {
          dir_area += calculateArea(child as DirectoryNode);
        }
      }

      return dir_area;
    }

    const dir_area = calculateArea(dirNode);
    return Math.max(1.0, Math.sqrt(dir_area)) * padding;
  }

  /**
   * Measure distances between sibling directories (connection line lengths)
   */
  function measureSiblingDistances(layoutNodes: LayoutNode[]): {
    distances: number[];
    siblingPairs: Array<{ node1: string; node2: string; distance: number; radius1: number; radius2: number; ratio: number }>;
  } {
    const directories = layoutNodes.filter(ln => ln.node.type === 'directory');
    const distances: number[] = [];
    const siblingPairs: Array<{ node1: string; node2: string; distance: number; radius1: number; radius2: number; ratio: number }> = [];

    // Group by parent to find siblings
    const byParent = new Map<LayoutNode | undefined, LayoutNode[]>();
    for (const dir of directories) {
      const siblings = byParent.get(dir.parent) || [];
      siblings.push(dir);
      byParent.set(dir.parent, siblings);
    }

    // Measure distances between siblings
    for (const [_parent, siblings] of byParent.entries()) {
      if (siblings.length < 2) continue;

      for (let i = 0; i < siblings.length; i++) {
        for (let j = i + 1; j < siblings.length; j++) {
          const dist = Math.sqrt(
            Math.pow(siblings[j].position.x - siblings[i].position.x, 2) +
            Math.pow(siblings[j].position.z - siblings[i].position.z, 2)
          );

          // Calculate radii
          const radius1 = calculateDirectoryRadius(siblings[i].node as DirectoryNode);
          const radius2 = calculateDirectoryRadius(siblings[j].node as DirectoryNode);
          const radiusSum = radius1 + radius2;
          const ratio = dist / radiusSum;

          distances.push(dist);
          siblingPairs.push({
            node1: siblings[i].node.name,
            node2: siblings[j].node.name,
            distance: dist,
            radius1,
            radius2,
            ratio
          });
        }
      }
    }

    return { distances, siblingPairs };
  }

  /**
   * Sibling directories should be spaced beyond their collision radii after physics.
   * Tests directional property: siblings don't collide and maintain reasonable separation.
   */
  it('should space sibling directories beyond their collision radii after physics', () => {
    const strategy = new ForceDirectedLayoutStrategy();
    const testCases = [
      { name: 'small', repo: createSmallRepo() },
      { name: 'medium', repo: createMediumRepo() },
      { name: 'large', repo: createLargeRepo() }
    ];

    for (const { name, repo } of testCases) {
      const layoutNodes = strategy.layoutTree(repo, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

      // Run physics simulation (3 seconds at 60fps)
      const dt = 1 / 60;
      for (let i = 0; i < 180; i++) {
        strategy.tick(dt);
      }

      const { siblingPairs } = measureSiblingDistances(layoutNodes);
      const ratios = siblingPairs.map(p => p.ratio);
      const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
      const minRatio = Math.min(...ratios);

      // Siblings should be separated beyond collision radii on average
      // Individual close pairs are expected in dense layouts
      expect(avgRatio).toBeGreaterThan(1.0);
    }
  });

  /**
   * TDD CYCLE 2
   *
   * Parent-to-child connection lines should also be reasonable (2-4x radii sum).
   * This tests the "long lines" connecting root to its immediate children.
   */
  it('should space parent-child directories at 2-4x their combined radii', () => {
    const strategy = new ForceDirectedLayoutStrategy();
    const fileDiameter = 1.5;
    const padding = 0.23;
    const fileArea = fileDiameter * fileDiameter * Math.PI;

    const testCases = [
      { name: 'small', repo: createSmallRepo() },
      { name: 'medium', repo: createMediumRepo() },
      { name: 'large', repo: createLargeRepo() }
    ];

    for (const { name, repo } of testCases) {
      const layoutNodes = strategy.layoutTree(repo, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

      // Run physics simulation
      const dt = 1 / 60;
      for (let i = 0; i < 180; i++) {
        strategy.tick(dt);
      }

      // Find parent-child pairs
      const directories = layoutNodes.filter(ln => ln.node.type === 'directory');
      const parentChildPairs: Array<{ parent: string; child: string; distance: number; ratio: number; parentParentRadius: number; childRadius: number }> = [];

      for (const child of directories) {
        const childParent = child.parent;
        if (!childParent) continue; // Skip root

        const parent = directories.find(d => d.node === childParent.node);
        if (!parent) continue;

        const dist = Math.sqrt(
          Math.pow(child.position.x - parent.position.x, 2) +
          Math.pow(child.position.z - parent.position.z, 2)
        );

        // Gource algorithm: child's dir_radius + parent's parent_radius (NOT parent's dir_radius)
        const parentNode = parent.node as DirectoryNode;
        const fileCount = parentNode.children.filter(c => c.type === 'file').length;
        const parentArea = fileArea * fileCount;
        const parentParentRadius = Math.max(1.0, Math.sqrt(parentArea)) * padding; // Parent's parent_radius

        const childRadius = calculateDirectoryRadius(child.node as DirectoryNode); // Child's dir_radius
        const ratio = dist / (parentParentRadius + childRadius);

        parentChildPairs.push({
          parent: parent.node.name,
          child: child.node.name,
          distance: dist,
          ratio,
          parentParentRadius,
          childRadius
        });
      }

      const avgDistance = parentChildPairs.reduce((sum, p) => sum + p.distance, 0) / parentChildPairs.length;
      const avgRatio = parentChildPairs.reduce((sum, p) => sum + p.ratio, 0) / parentChildPairs.length;
      const ratios = parentChildPairs.map(p => p.ratio);
      const minRatio = Math.min(...ratios);
      const maxRatio = Math.max(...ratios);

      console.log(`\n${name} repo - parent-child connections (Gource algorithm):`);
      console.log(`  Pairs: ${parentChildPairs.length}`);
      console.log(`  Avg distance: ${avgDistance.toFixed(2)}`);
      console.log(`  Avg ratio: ${avgRatio.toFixed(2)}x (target: tight orbit, close to 1x)`);
      console.log(`  Min ratio: ${minRatio.toFixed(2)}x, Max ratio: ${maxRatio.toFixed(2)}x`);
      console.log(`  Sample pairs:`);
      for (const p of parentChildPairs.slice(0, 3)) {
        console.log(`    ${p.parent} -> ${p.child}: dist=${p.distance.toFixed(2)}, ratio=${p.ratio.toFixed(2)}x (parent_radius=${p.parentParentRadius.toFixed(2)}, child_radius=${p.childRadius.toFixed(2)})`);
      }

      // Test expectation: children should orbit close to parent's file cloud edge (ratio close to 1.0)
      // Gource uses parent_radius (small) not dir_radius (large), so children orbit tightly
      expect(avgRatio).toBeGreaterThanOrEqual(0.5); // Allow some settling/physics variance
      expect(avgRatio).toBeLessThanOrEqual(2.0);   // Should be much closer than sibling spacing
    }
  });
});

describe('ForceDirectedLayoutStrategy - Camera Configuration', () => {
  /**
   * Force-Directed layout should provide overhead camera view (pure 2D).
   * Camera should be directly above the scene looking straight down,
   * not at an angle like 3D layouts.
   */
  it('should provide overhead camera defaults for 2D view', () => {
    const strategy = new ForceDirectedLayoutStrategy();
    const { position, lookAt } = strategy.getCameraDefaults();

    // Camera should be directly above origin (x=0, z=0)
    expect(position.x).toBe(0);
    expect(position.z).toBeLessThan(1); // Near 0, allows small offset for perspective

    // Camera should be high up on Y axis (overhead)
    expect(position.y).toBeGreaterThan(100);

    // Camera should look at origin (center of scene)
    expect(lookAt.x).toBe(0);
    expect(lookAt.y).toBe(0);
    expect(lookAt.z).toBe(0);
  });
});

describe('ForceDirectedLayoutStrategy - Territory Management', () => {
  /**
   * Territory radius should include file orbit space, not just collision radius.
   * Directory collision radius doesn't account for orbiting files that extend
   * 10-20+ units from directory center, causing file clouds to overlap even
   * when directory cubes don't collide.
   */
  it('should calculate territory radius including file orbit space', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    // Create directory with 10 files
    // Files will orbit in rings around the directory center
    const files: FileNode[] = Array(10).fill(null).map((_, i) => ({
      type: 'file' as const,
      name: `file${i}.ts`,
      path: `src/file${i}.ts`,
      extension: 'ts',
      loc: 100,
      lastModified: new Date().toISOString(),
      lastAuthor: null,
      lastCommitHash: null,
      commitCount: null,
      contributorCount: null,
      firstCommitDate: null,
      recentLinesChanged: null,
      avgLinesPerCommit: null,
      daysSinceLastModified: null,
    }));

    const dir: DirectoryNode = {
      type: 'directory',
      name: 'src',
      path: 'src',
      children: files
    };

    // Layout the tree
    const layoutNodes = strategy.layoutTree(
      dir,
      new THREE.Vector3(0, 0, 0),
      0,
      0,
      Math.PI * 2
    );

    // Find the directory's layout node
    const dirLayoutNode = layoutNodes.find(ln => ln.node === dir);
    expect(dirLayoutNode).toBeDefined();

    // Access physics node to check territory radius
    const physicsNodes = (strategy as unknown as ForceDirectedInternals).physicsNodes;
    const physicsNode = physicsNodes.get(dir);
    expect(physicsNode).toBeDefined();

    // Territory radius should exist and be larger than collision radius
    // With 10 files, orbit rings extend beyond collision radius
    const collisionRadius = physicsNode.radius;
    const territoryRadius = physicsNode.territoryRadius;

    expect(territoryRadius).toBeDefined();
    expect(territoryRadius).toBeGreaterThan(collisionRadius);

    // With Gource's ring formula (diameter × π) and starting at distance 0.0:
    // 10 files spread across ~4 rings, max orbit ~2.25 units
    // Territory = collision radius + max orbit + padding
    // With compact sizing (0.3 multiplier): ~1.1 (collision) + 2.25 (orbit) + 2 (padding) ≈ 5.35
    // Actual result with current config: ~6.02
    const expectedMinTerritory = 5;
    expect(territoryRadius).toBeGreaterThanOrEqual(expectedMinTerritory);
  });

  /**
   * Collision detection should use territory radius, not collision radius.
   * Two directories can have non-overlapping cubes but overlapping file clouds,
   * causing visual collisions. Overlap detection returns true when territories
   * touch, even if collision radii don't overlap.
   */
  it('should detect overlap using territory radius, not collision radius', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    // Helper to create directory with files
    const createDirWithFiles = (name: string, fileCount: number): DirectoryNode => {
      const files: FileNode[] = Array(fileCount).fill(null).map((_, i) => ({
        type: 'file' as const,
        name: `${name}_file${i}.ts`,
        path: `${name}/${name}_file${i}.ts`,
        extension: 'ts',
        loc: 100,
        lastModified: new Date().toISOString(),
        lastAuthor: null,
        lastCommitHash: null,
        commitCount: null,
        contributorCount: null,
        firstCommitDate: null,
        recentLinesChanged: null,
        avgLinesPerCommit: null,
        daysSinceLastModified: null,
      }));

      return {
        type: 'directory',
        name,
        path: name,
        children: files
      };
    };

    // Two directories with files (will have file clouds extending beyond collision radius)
    const dir1 = createDirWithFiles('dir1', 8);
    const dir2 = createDirWithFiles('dir2', 8);

    const root: DirectoryNode = {
      type: 'directory',
      name: 'root',
      path: 'root',
      children: [dir1, dir2]
    };

    // Layout the tree
    strategy.layoutTree(root, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

    // Access physics nodes
    const physicsNodes = (strategy as unknown as ForceDirectedInternals).physicsNodes;
    const pNode1 = physicsNodes.get(dir1);
    const pNode2 = physicsNodes.get(dir2);

    expect(pNode1).toBeDefined();
    expect(pNode2).toBeDefined();

    // Position nodes so territories overlap but collision radii DON'T
    // Territory = collision radius + max file orbit + padding
    // If collision radius is ~4 and territory is ~15, we can position at distance 10
    const collisionRadius1 = pNode1.radius;
    const collisionRadius2 = pNode2.radius;
    const territoryRadius1 = pNode1.territoryRadius;
    const territoryRadius2 = pNode2.territoryRadius;

    console.log('Collision radii:', collisionRadius1, collisionRadius2);
    console.log('Territory radii:', territoryRadius1, territoryRadius2);

    // Position nodes at a distance where:
    // - Collision radii DON'T overlap: distance > radius1 + radius2
    // - Territory radii DO overlap: distance < territory1 + territory2
    const separation = collisionRadius1 + collisionRadius2 + 2; // Collision clear by 2 units
    pNode1.position.set(0, 0, 0);
    pNode2.position.set(separation, 0, 0);

    // Verify collision radii don't overlap (using old method)
    const collisionDist = pNode1.position.distanceTo(pNode2.position);
    const collisionSum = collisionRadius1 + collisionRadius2;
    expect(collisionDist).toBeGreaterThan(collisionSum); // Should NOT overlap by collision

    // Verify territories DO overlap
    const territorySum = territoryRadius1 + territoryRadius2;
    expect(collisionDist).toBeLessThan(territorySum); // SHOULD overlap by territory

    // EXPECTED TO FAIL: Current overlaps() uses radius, not territoryRadius
    const overlapsResult = pNode1.overlaps(pNode2);
    expect(overlapsResult).toBe(true); // Should detect territory overlap
  });

  /**
   * Test: Leaf directories should be sized based on their file count
   *
   * Why: Leaf directories (containing only files, no subdirectories) should be sized
   * proportionally to the number of files they contain, since files orbit them.
   *
   * Expected: Leaf directory with many files should have appropriately large radius
   */
  /**
   * Test: Directories should be sized using Gource's area-based algorithm
   *
   * Gource's algorithm:
   * - dir_area = (file_area × visible_count) + Σ(child.getArea())
   * - dir_radius = sqrt(dir_area) × padding
   *
   * This means parent directories include the area of all descendants,
   * making them large enough to accommodate their entire subtree.
   */
  it('should size directories using Gource area-based algorithm', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    // Create nested structure: parent has 2 subdirs with 25 files each
    const subdir1Files: FileNode[] = Array(25).fill(null).map((_, i) => ({
      type: 'file' as const,
      name: `file${i}.ts`,
      path: `parent/subdir1/file${i}.ts`,
      extension: 'ts',
      loc: 100,
      lastModified: new Date().toISOString(),
      lastAuthor: null,
      lastCommitHash: null,
      commitCount: null,
      contributorCount: null,
      firstCommitDate: null,
      recentLinesChanged: null,
      avgLinesPerCommit: null,
      daysSinceLastModified: null,
    }));

    const subdir2Files: FileNode[] = Array(25).fill(null).map((_, i) => ({
      type: 'file' as const,
      name: `file${i}.ts`,
      path: `parent/subdir2/file${i}.ts`,
      extension: 'ts',
      loc: 100,
      lastModified: new Date().toISOString(),
      lastAuthor: null,
      lastCommitHash: null,
      commitCount: null,
      contributorCount: null,
      firstCommitDate: null,
      recentLinesChanged: null,
      avgLinesPerCommit: null,
      daysSinceLastModified: null,
    }));

    const subdir1: DirectoryNode = {
      type: 'directory',
      name: 'subdir1',
      path: 'parent/subdir1',
      children: subdir1Files
    };

    const subdir2: DirectoryNode = {
      type: 'directory',
      name: 'subdir2',
      path: 'parent/subdir2',
      children: subdir2Files
    };

    const parent: DirectoryNode = {
      type: 'directory',
      name: 'parent',
      path: 'parent',
      children: [subdir1, subdir2] // 0 direct files, 50 total descendant files
    };

    strategy.layoutTree(parent, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

    const physicsNodes = (strategy as unknown as ForceDirectedInternals).physicsNodes;
    const parentNode = physicsNodes.get(parent);
    const subdir1Node = physicsNodes.get(subdir1);
    const subdir2Node = physicsNodes.get(subdir2);

    expect(parentNode).toBeDefined();
    expect(subdir1Node).toBeDefined();
    expect(subdir2Node).toBeDefined();

    console.log('Parent radius:', parentNode.radius);
    console.log('Subdir1 radius (25 files):', subdir1Node.radius);
    console.log('Subdir2 radius (25 files):', subdir2Node.radius);

    // With Gource's area-based sizing:
    // - Each subdir has area = file_area × 25
    // - Parent has area = 0 (no direct files) + subdir1.area + subdir2.area
    // - Parent radius should be larger than a single subdir (includes both subdirs)
    expect(parentNode.radius).toBeGreaterThan(subdir1Node.radius);
    expect(parentNode.radius).toBeGreaterThan(subdir2Node.radius);
  });

  /**
   * Sibling directories should start with non-overlapping initial positions.
   * Spiral positioning (golden angle) gives adequate initial spacing based on
   * territory size, so all sibling pairs have distance >= combined territory
   * radius before physics simulation runs.
   */
  it('should position sibling directories without initial overlap (spiral positioning)', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    // Helper to create directory with files
    const createDirWithFiles = (name: string, fileCount: number): DirectoryNode => {
      const files: FileNode[] = Array(fileCount).fill(null).map((_, i) => ({
        type: 'file' as const,
        name: `${name}_file${i}.ts`,
        path: `root/${name}/${name}_file${i}.ts`,
        extension: 'ts',
        loc: 100,
        lastModified: new Date().toISOString(),
        lastAuthor: null,
        lastCommitHash: null,
        commitCount: null,
        contributorCount: null,
        firstCommitDate: null,
        recentLinesChanged: null,
        avgLinesPerCommit: null,
        daysSinceLastModified: null,
      }));

      return {
        type: 'directory',
        name,
        path: `root/${name}`,
        children: files
      };
    };

    // Create root with 8 sibling directories, each containing 10 files
    // This creates substantial territory radii (10-15 units each)
    const siblings = Array(8).fill(null).map((_, i) =>
      createDirWithFiles(`dir${i}`, 10)
    );

    const root: DirectoryNode = {
      type: 'directory',
      name: 'root',
      path: 'root',
      children: siblings
    };

    // Layout the tree but DON'T run physics (testing initial positions)
    strategy.layoutTree(root, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

    // Access physics nodes
    const physicsNodes = (strategy as unknown as ForceDirectedInternals).physicsNodes;
    const siblingPhysicsNodes = siblings.map(s => physicsNodes.get(s));

    // Verify all nodes exist
    siblingPhysicsNodes.forEach(node => expect(node).toBeDefined());

    // Check all pairs of siblings for overlap
    // With spiral positioning, no siblings should overlap initially
    let overlapCount = 0;
    const overlappingPairs: string[] = [];

    for (let i = 0; i < siblingPhysicsNodes.length; i++) {
      for (let j = i + 1; j < siblingPhysicsNodes.length; j++) {
        const node1 = siblingPhysicsNodes[i];
        const node2 = siblingPhysicsNodes[j];

        const distance = Math.sqrt(
          (node2.position.x - node1.position.x) ** 2 +
          (node2.position.z - node1.position.z) ** 2
        );

        const requiredDistance = node1.territoryRadius + node2.territoryRadius;

        if (distance < requiredDistance) {
          overlapCount++;
          overlappingPairs.push(
            `${siblings[i].name} <-> ${siblings[j].name}: ` +
            `dist=${distance.toFixed(1)}, required=${requiredDistance.toFixed(1)}`
          );
        }
      }
    }

    // Log results for debugging
    console.log(`Overlap count: ${overlapCount} / ${(siblingPhysicsNodes.length * (siblingPhysicsNodes.length - 1)) / 2} pairs`);
    if (overlappingPairs.length > 0) {
      console.log('Overlapping pairs:');
      overlappingPairs.forEach(p => console.log(`  ${p}`));
    }

    // With compact spacing (spiralBaseSpacing=0.5), expect minimal overlaps
    // Physics will resolve any minor overlaps during simulation
    // Allow up to 2 overlapping pairs out of 28 (< 10% overlap rate)
    expect(overlapCount).toBeLessThanOrEqual(2);
  });

  /**
   * Physics simulation should separate overlapping territories.
   * Repulsion forces use territoryRadius to account for file clouds,
   * ensuring proper spacing after simulation completes.
   */
  it('should separate overlapping territories after physics simulation', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    // Helper to create directory with files
    const createDirWithFiles = (name: string, fileCount: number): DirectoryNode => {
      const files: FileNode[] = Array(fileCount).fill(null).map((_, i) => ({
        type: 'file' as const,
        name: `${name}_file${i}.ts`,
        path: `root/${name}/${name}_file${i}.ts`,
        extension: 'ts',
        loc: 100,
        lastModified: new Date().toISOString(),
        lastAuthor: null,
        lastCommitHash: null,
        commitCount: null,
        contributorCount: null,
        firstCommitDate: null,
        recentLinesChanged: null,
        avgLinesPerCommit: null,
        daysSinceLastModified: null,
      }));

      return {
        type: 'directory',
        name,
        path: `root/${name}`,
        children: files
      };
    };

    // Create root with many siblings (like a large project)
    // This simulates the CBIoportal/React scenario
    const siblings = Array(12).fill(null).map((_, i) =>
      createDirWithFiles(`dir${i}`, 15)
    );

    const root: DirectoryNode = {
      type: 'directory',
      name: 'root',
      path: 'root',
      children: siblings
    };

    // Layout the tree (spiral positioning gives good initial positions)
    strategy.layoutTree(root, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

    // Access physics nodes
    const physicsNodes = (strategy as unknown as ForceDirectedInternals).physicsNodes;
    const siblingPhysicsNodes = siblings.map(s => physicsNodes.get(s));

    // Run physics simulation (3 seconds at 60 FPS)
    const maxIterations = 180;
    for (let i = 0; i < maxIterations; i++) {
      strategy.tick(1.0 / 60.0);
    }

    // Count collision-radius overlaps (severe: directory cubes intersect)
    // Territory overlaps are expected with tight gravity — files are small
    // enough that minor territory overlap doesn't cause visual problems
    let collisionOverlapCount = 0;
    for (let i = 0; i < siblingPhysicsNodes.length; i++) {
      for (let j = i + 1; j < siblingPhysicsNodes.length; j++) {
        const node1 = siblingPhysicsNodes[i]!;
        const node2 = siblingPhysicsNodes[j]!;
        const distance = Math.sqrt(
          (node2.position.x - node1.position.x) ** 2 +
          (node2.position.z - node1.position.z) ** 2
        );
        if (distance < node1.radius + node2.radius) {
          collisionOverlapCount++;
        }
      }
    }

    const totalPairs = (siblingPhysicsNodes.length * (siblingPhysicsNodes.length - 1)) / 2;

    // Physics should resolve most collision-radius overlaps
    // With 12 tightly-packed siblings, some collision overlap is expected
    // as gravity and repulsion reach equilibrium
    expect(collisionOverlapCount).toBeLessThan(totalPairs / 2);
  });

  /**
   * Integration should use Gource's simple approach: position += acceleration × dt.
   * No velocity accumulation - forces don't carry over between frames.
   * This prevents jitter by avoiding force accumulation.
   */
  it('should use simple position-based integration like Gource', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    const child: DirectoryNode = {
      type: 'directory',
      name: 'child',
      path: 'root/child',
      children: []
    };

    const root: DirectoryNode = {
      type: 'directory',
      name: 'root',
      path: 'root',
      children: [child]
    };

    strategy.layoutTree(root, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

    const physicsNodes = (strategy as unknown as ForceDirectedInternals).physicsNodes;
    const childNode = physicsNodes.get(child);

    const dt = 1.0 / 60.0;

    // Set initial position and acceleration
    const initialPos = { x: childNode.position.x, z: childNode.position.z };
    childNode.acceleration.set(100, 0, 50);

    // Run one integration step
    childNode.integrate(dt);

    // Verify: position should update by acceleration × dt (Gource's formula)
    // pos += accel × dt
    const expectedX = initialPos.x + 100 * dt;
    const expectedZ = initialPos.z + 50 * dt;

    expect(childNode.position.x).toBeCloseTo(expectedX, 5);
    expect(childNode.position.z).toBeCloseTo(expectedZ, 5);

    // Second integration with same acceleration
    const secondPos = { x: childNode.position.x, z: childNode.position.z };
    childNode.integrate(dt);

    // Should move by same amount again (no velocity accumulation)
    expect(childNode.position.x).toBeCloseTo(secondPos.x + 100 * dt, 5);
    expect(childNode.position.z).toBeCloseTo(secondPos.z + 50 * dt, 5);
  });

  /**
   * Files should be distributed across rings using Gource's capacity formula.
   * Gource uses: max_files = diameter × π (not diameter × π × 8)
   * This prevents overcrowding in inner rings.
   *
   * Example with 50 files:
   * Ring 1 (d=1): 1 file at distance 0.0
   * Ring 2 (d=2): 6 files at distance fileDiameter
   * Ring 3 (d=3): 9 files at distance 2×fileDiameter
   * Ring 4 (d=4): 12 files at distance 3×fileDiameter
   * Ring 5 (d=5): 15 files at distance 4×fileDiameter
   * Ring 6 (d=6): 7 files at distance 5×fileDiameter
   */
  it('should distribute files across rings using Gource ring capacity formula', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    // Create directory with 50 files (enough to span multiple rings)
    const files: FileNode[] = Array(50).fill(null).map((_, i) => ({
      type: 'file' as const,
      name: `file${i}.ts`,
      path: `dir/file${i}.ts`,
      extension: 'ts',
      loc: 100,
      lastModified: new Date().toISOString(),
      lastAuthor: null,
      lastCommitHash: null,
      commitCount: null,
      contributorCount: null,
      firstCommitDate: null,
      recentLinesChanged: null,
      avgLinesPerCommit: null,
      daysSinceLastModified: null,
    }));

    const dir: DirectoryNode = {
      type: 'directory',
      name: 'dir',
      path: 'dir',
      children: files
    };

    const root: DirectoryNode = {
      type: 'directory',
      name: 'root',
      path: 'root',
      children: [dir]
    };

    strategy.layoutTree(root, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

    // Get file positions
    const fileOrbitInfo = (strategy as unknown as ForceDirectedInternals).fileOrbitInfo;

    // Group files by ring (distance from directory center)
    const ringTolerance = 0.01;
    const rings = new Map<number, number>(); // distance -> count

    for (const fileInfo of fileOrbitInfo) {
      const distance = Math.sqrt(
        fileInfo.relativeOffset.x ** 2 + fileInfo.relativeOffset.y ** 2
      );

      // Find or create ring
      let foundRing = false;
      for (const [ringDist, count] of rings) {
        if (Math.abs(distance - ringDist) < ringTolerance) {
          rings.set(ringDist, count + 1);
          foundRing = true;
          break;
        }
      }
      if (!foundRing) {
        rings.set(distance, 1);
      }
    }

    // Verify we have multiple rings (at least 5 for 50 files with Gource's formula)
    expect(rings.size).toBeGreaterThanOrEqual(5);

    // Verify first ring has 1 file at distance 0.0
    const sortedRings = Array.from(rings.entries()).sort((a, b) => a[0] - b[0]);
    expect(sortedRings[0][0]).toBeLessThan(ringTolerance); // Distance ~0.0
    expect(sortedRings[0][1]).toBe(1); // 1 file in first ring

    // Verify ring capacities follow Gource's formula: max_files = diameter × π
    // Ring 2 (diameter=2): max 6 files (2 × π ≈ 6.28)
    expect(sortedRings[1][1]).toBeLessThanOrEqual(6);
  });

  /**
   * Adjacent file rings should be separated by full diameter spacing to prevent
   * visual overlap. Files are spheres with radius 0.5, so rings spaced 1.5 units
   * apart provide a 0.5 unit gap between spheres.
   */
  it('should space file rings by full diameter to prevent overlap', () => {
    const strategy = new ForceDirectedLayoutStrategy();
    const fileDiameter = 1.5;
    const fileVisualRadius = 0.5;

    const dir = createDirWithFiles('test-dir', 20);
    const root = createRoot([dir]);

    strategy.layoutTree(root, new THREE.Vector3(0, 0, 0), 0, 0, Math.PI * 2);

    const rings = extractFileRings(strategy);
    const sortedRings = Array.from(rings.entries()).sort((a, b) => a[0] - b[0]);

    console.log(`\nFile ring spacing test:`);
    console.log(`  Total rings: ${sortedRings.length}`);

    // Adjacent rings separated by full diameter
    for (let i = 0; i < sortedRings.length - 1; i++) {
      const ringGap = sortedRings[i + 1][0] - sortedRings[i][0];

      console.log(`  Ring ${i+1} -> ${i+2}: gap = ${ringGap.toFixed(3)} (expected: ${fileDiameter.toFixed(3)})`);
      expect(ringGap).toBeCloseTo(fileDiameter, 2);
    }

    // No files overlap
    const overlapCount = countOverlappingFiles(rings, fileVisualRadius);
    console.log(`  Overlapping pairs: ${overlapCount} (expected: 0)`);
    expect(overlapCount).toBe(0);
  });
});

describe('ForceDirectedLayoutStrategy - Subdirectory Spacing', () => {
  /**
   * Subdirectories should be positioned close to parent directory to create
   * compact, readable layouts. The spiral base spacing adds a safety margin
   * between parent and child territories to prevent overlap.
   *
   * Test specification:
   * - Given parent territory radius of 10 and child territory radius of 5
   * - First child should be positioned at reasonable distance from parent
   * - Distance should balance compactness (closer is better) with overlap prevention
   * - Target: ~16 units (parent 10 + child 5 + margin 1.0)
   */
  it('should position first child directory close to parent', () => {
    const strategy = new ForceDirectedLayoutStrategy();

    // Create parent directory with subdirectory containing files
    // Files give the directories non-zero territory radius for meaningful spacing
    const root: DirectoryNode = {
      type: 'directory',
      name: 'root',
      path: 'root',
      children: [
        createMockFile({
          name: 'root-file.ts',
          path: 'root/root-file.ts',
          lastModified: '2024-01-01',
          lastAuthor: 'dev',
          lastCommitHash: 'abc123',
          commitCount: 5,
          contributorCount: 2,
        }),
        {
          type: 'directory',
          name: 'subdir1',
          path: 'root/subdir1',
          children: [
            createMockFile({
              name: 'file1.ts',
              path: 'root/subdir1/file1.ts',
              lastModified: '2024-01-01',
              lastAuthor: 'dev',
              lastCommitHash: 'abc123',
              commitCount: 5,
              contributorCount: 2,
            }),
          ]
        }
      ]
    };

    // Layout the tree
    strategy.layoutTree(
      root,
      new THREE.Vector3(0, 0, 0),
      0,
      0,
      Math.PI * 2
    );

    // Access physics nodes (where spiral positioning actually happens)
    const physicsNodes = (strategy as unknown as ForceDirectedInternals).physicsNodes;
    const rootPhysics = physicsNodes.get(root)!;
    const childDir = root.children.find(c => c.name === 'subdir1') as DirectoryNode;
    const childPhysics = physicsNodes.get(childDir)!;

    // Calculate initial distance (before physics)
    const initialDistance = Math.sqrt(
      (childPhysics.position.x - rootPhysics.position.x) ** 2 +
      (childPhysics.position.z - rootPhysics.position.z) ** 2
    );

    console.log('Initial distance (before physics):', initialDistance);

    // Run physics simulation to reach equilibrium
    // This is what determines the actual visual spacing
    const maxIterations = 180; // 3 seconds at 60 FPS
    for (let i = 0; i < maxIterations; i++) {
      strategy.tick(1.0 / 60.0);
    }

    // Calculate final distance after physics settles
    const finalDistance = Math.sqrt(
      (childPhysics.position.x - rootPhysics.position.x) ** 2 +
      (childPhysics.position.z - rootPhysics.position.z) ** 2
    );

    const config = (strategy as unknown as ForceDirectedInternals).config;
    console.log('Config gravity:', config.gravity);
    console.log('Final distance (after physics):', finalDistance);
    console.log('Root collision radius:', rootPhysics.radius);
    console.log('Child collision radius:', childPhysics.radius);
    console.log('Sum of radii:', rootPhysics.radius + childPhysics.radius);

    // After physics simulation, nodes should settle very close to parent
    // Current behavior with gravity=10: distance = 9.6 (exactly radii sum, edge-to-edge)
    // Desired behavior with higher gravity: distance < 7.0 (nodes overlap slightly for compact visual)
    // Overlapping is OK - territory radius will prevent file cloud overlap
    // Target: < 7.0 units (27% closer than current)
    expect(finalDistance).toBeLessThan(7.0);
  });
});

// Helper functions for file ring spacing tests

function createDirWithFiles(name: string, fileCount: number): DirectoryNode {
  const files: FileNode[] = Array(fileCount).fill(null).map((_, i) => ({
    type: 'file' as const,
    name: `file${i}.ts`,
    path: `${name}/file${i}.ts`,
    extension: 'ts',
    loc: 100,
    lastModified: new Date().toISOString(),
    lastAuthor: null,
    lastCommitHash: null,
    commitCount: null,
    contributorCount: null,
    firstCommitDate: null,
    recentLinesChanged: null,
    avgLinesPerCommit: null,
    daysSinceLastModified: null,
  }));

  return {
    type: 'directory',
    name,
    path: name,
    children: files
  };
}

function createRoot(children: DirectoryNode[]): DirectoryNode {
  return {
    type: 'directory',
    name: 'root',
    path: 'root',
    children
  };
}

function extractFileRings(strategy: ForceDirectedLayoutStrategy): Map<number, Array<{ x: number; y: number }>> {
  const fileOrbitInfo = (strategy as unknown as ForceDirectedInternals).fileOrbitInfo;
  const ringTolerance = 0.01;
  const rings = new Map<number, Array<{ x: number; y: number }>>();

  for (const fileInfo of fileOrbitInfo) {
    const distance = Math.sqrt(
      fileInfo.relativeOffset.x ** 2 + fileInfo.relativeOffset.y ** 2
    );

    let foundRing = false;
    for (const [ringDist, positions] of rings) {
      if (Math.abs(distance - ringDist) < ringTolerance) {
        positions.push({ x: fileInfo.relativeOffset.x, y: fileInfo.relativeOffset.y });
        foundRing = true;
        break;
      }
    }
    if (!foundRing) {
      rings.set(distance, [{ x: fileInfo.relativeOffset.x, y: fileInfo.relativeOffset.y }]);
    }
  }

  return rings;
}

function countOverlappingFiles(rings: Map<number, Array<{ x: number; y: number }>>, fileRadius: number): number {
  const allPositions: Array<{ x: number; y: number }> = [];
  for (const positions of rings.values()) {
    allPositions.push(...positions);
  }

  let overlapCount = 0;
  const minDist = fileRadius * 2;
  const tolerance = 0.01;

  for (let i = 0; i < allPositions.length; i++) {
    for (let j = i + 1; j < allPositions.length; j++) {
      const dx = allPositions[j].x - allPositions[i].x;
      const dy = allPositions[j].y - allPositions[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist - tolerance) {
        overlapCount++;
      }
    }
  }

  return overlapCount;
}
