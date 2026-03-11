import * as THREE from 'three';
import { DirectoryNode } from './types';
import { ILayoutStrategy, LayoutNode, CameraDefaults } from './ILayoutStrategy';

/**
 * HierarchicalLayoutStrategy - 3D tree layout with vertical hierarchy
 *
 * Solar system metaphor: directories are planets, files orbit in rings around them.
 * Each directory uses full 360° circle for its children (no angular subdivision).
 */
export class HierarchicalLayoutStrategy implements ILayoutStrategy {
  /**
   * Calculate adaptive radius based on number of children
   * Keep orbits tight - files need to stay close to parent for visual grouping
   */
  calculateRadius(childCount: number): number {
    const baseRadius = 6;

    // Use sqrt scaling to keep files close even for dense directories
    // 35 files: 6 + sqrt(35) * 2.5 = ~20.8 radius
    return baseRadius + Math.sqrt(childCount) * 2.5;
  }

  /**
   * Calculate adaptive vertical spacing based on tree depth
   * Moderate spacing to keep parent-child relationship clear
   */
  calculateVerticalSpacing(level: number): number {
    // Moderate vertical spacing - close enough to see relationship
    const baseSpacing = 12;
    const depthFactor = Math.max(0.7, 1 - level * 0.1);
    return baseSpacing * depthFactor;
  }

  /**
   * Get default camera configuration for 3D hierarchical view
   */
  getCameraDefaults(): CameraDefaults {
    return {
      position: new THREE.Vector3(30, 30, 30),
      lookAt: new THREE.Vector3(0, 0, 0)
    };
  }

  /**
   * Layout tree nodes in 3D space
   * Solar system metaphor: directories are planets, files orbit in rings around them
   * Each directory uses full 360° circle for its children (no angular subdivision)
   */
  layoutTree(node: DirectoryNode, position: THREE.Vector3, level: number, _angleStart: number, _angleEnd: number, parentLayout?: LayoutNode): LayoutNode[] {
    const nodes: LayoutNode[] = [];

    const currentLayout: LayoutNode = { node, position, parent: parentLayout };
    nodes.push(currentLayout);

    if (node.children.length === 0) return nodes;

    // Single ring layout: full 360° circle for all children
    const radius = this.calculateRadius(node.children.length);
    const verticalSpacing = this.calculateVerticalSpacing(level);
    const angleStep = (Math.PI * 2) / node.children.length; // Full circle

    node.children.forEach((child, index) => {
      const angle = angleStep * index;
      const childPosition = new THREE.Vector3(
        position.x + Math.cos(angle) * radius,
        position.y - verticalSpacing,
        position.z + Math.sin(angle) * radius
      );

      if (child.type === 'directory') {
        // Subdirectory gets its own full circle for its children
        const childNodes = this.layoutTree(child, childPosition, level + 1, 0, Math.PI * 2, currentLayout);
        nodes.push(...childNodes);
      } else {
        // File node
        nodes.push({ node: child, position: childPosition, parent: currentLayout });
      }
    });

    return nodes;
  }
}
