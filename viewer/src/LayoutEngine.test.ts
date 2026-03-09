import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { HierarchicalLayoutStrategy } from './HierarchicalLayoutStrategy';
import { DirectoryNode, FileNode } from './types';
import { LayoutNode } from './ILayoutStrategy';
import { createMockFile } from './lib/test-fixtures';

describe('HierarchicalLayoutStrategy', () => {
  let layoutEngine: HierarchicalLayoutStrategy;

  beforeEach(() => {
    layoutEngine = new HierarchicalLayoutStrategy();
  });

  describe('calculateRadius', () => {
    it('should return base radius for 0 children', () => {
      expect(layoutEngine.calculateRadius(0)).toBe(6);
    });

    it('should use sqrt scaling for child count', () => {
      // 1 child: 6 + sqrt(1) * 2.5 = 8.5
      expect(layoutEngine.calculateRadius(1)).toBeCloseTo(8.5, 1);
    });

    it('should scale correctly for 35 children', () => {
      // 35 children: 6 + sqrt(35) * 2.5 ≈ 20.8
      expect(layoutEngine.calculateRadius(35)).toBeCloseTo(20.8, 1);
    });

    it('should increase radius with more children', () => {
      const radius10 = layoutEngine.calculateRadius(10);
      const radius20 = layoutEngine.calculateRadius(20);
      const radius30 = layoutEngine.calculateRadius(30);

      expect(radius20).toBeGreaterThan(radius10);
      expect(radius30).toBeGreaterThan(radius20);
    });
  });

  describe('calculateVerticalSpacing', () => {
    it('should return base spacing for level 0', () => {
      // Level 0: 12 * max(0.7, 1 - 0 * 0.1) = 12 * 1 = 12
      expect(layoutEngine.calculateVerticalSpacing(0)).toBe(12);
    });

    it('should decrease spacing with depth', () => {
      // Level 1: 12 * max(0.7, 1 - 1 * 0.1) = 12 * 0.9 = 10.8
      expect(layoutEngine.calculateVerticalSpacing(1)).toBeCloseTo(10.8, 1);

      // Level 2: 12 * max(0.7, 1 - 2 * 0.1) = 12 * 0.8 = 9.6
      expect(layoutEngine.calculateVerticalSpacing(2)).toBeCloseTo(9.6, 1);
    });

    it('should have minimum spacing of 0.7 * baseSpacing', () => {
      // Very deep level: 12 * max(0.7, 1 - 10 * 0.1) = 12 * 0.7 = 8.4
      expect(layoutEngine.calculateVerticalSpacing(10)).toBeCloseTo(8.4, 1);
      expect(layoutEngine.calculateVerticalSpacing(100)).toBeCloseTo(8.4, 1);
    });
  });

  describe('layoutTree', () => {
    it('should layout single root directory', () => {
      const root: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: []
      };

      const position = new THREE.Vector3(0, 0, 0);
      const nodes = layoutEngine.layoutTree(root, position, 0, 0, Math.PI * 2);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].node).toBe(root);
      expect(nodes[0].position).toEqual(position);
      expect(nodes[0].parent).toBeUndefined();
    });

    it('should layout directory with single file', () => {
      const fileNode: FileNode = createMockFile({ name: 'test.ts', path: 'test.ts' });

      const root: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [fileNode]
      };

      const position = new THREE.Vector3(0, 10, 0);
      const nodes = layoutEngine.layoutTree(root, position, 0, 0, Math.PI * 2);

      expect(nodes).toHaveLength(2); // root + file
      expect(nodes[0].node).toBe(root);
      expect(nodes[1].node).toBe(fileNode);
      expect(nodes[1].parent).toBe(nodes[0]);

      // File should be at radius distance from parent
      const radius = layoutEngine.calculateRadius(1);
      const verticalSpacing = layoutEngine.calculateVerticalSpacing(0);
      const filePos = nodes[1].position;

      // Check distance (should be close to radius in XZ plane)
      const distance = Math.sqrt(
        Math.pow(filePos.x - position.x, 2) +
        Math.pow(filePos.z - position.z, 2)
      );
      expect(distance).toBeCloseTo(radius, 1);

      // Check vertical offset
      expect(filePos.y).toBeCloseTo(position.y - verticalSpacing, 1);
    });

    it('should layout multiple files in full circle', () => {
      const file1: FileNode = createMockFile({ name: 'file1.ts', path: 'file1.ts' });
      const file2: FileNode = createMockFile({ name: 'file2.ts', path: 'file2.ts' });

      const root: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [file1, file2]
      };

      const position = new THREE.Vector3(0, 10, 0);
      const nodes = layoutEngine.layoutTree(root, position, 0, 0, Math.PI * 2);

      expect(nodes).toHaveLength(3); // root + 2 files

      // Both files should be at same radius
      const radius = layoutEngine.calculateRadius(2);
      const file1Pos = nodes[1].position;
      const file2Pos = nodes[2].position;

      const dist1 = Math.sqrt(
        Math.pow(file1Pos.x - position.x, 2) +
        Math.pow(file1Pos.z - position.z, 2)
      );
      const dist2 = Math.sqrt(
        Math.pow(file2Pos.x - position.x, 2) +
        Math.pow(file2Pos.z - position.z, 2)
      );

      expect(dist1).toBeCloseTo(radius, 1);
      expect(dist2).toBeCloseTo(radius, 1);

      // Files should be 180 degrees apart (π radians)
      const angle1 = Math.atan2(file1Pos.z - position.z, file1Pos.x - position.x);
      const angle2 = Math.atan2(file2Pos.z - position.z, file2Pos.x - position.x);
      const angleDiff = Math.abs(angle2 - angle1);

      expect(angleDiff).toBeCloseTo(Math.PI, 1);
    });

    it('should layout nested directories recursively', () => {
      const file: FileNode = createMockFile({ name: 'nested.ts', path: 'subdir/nested.ts' });

      const subdir: DirectoryNode = {
        type: 'directory',
        name: 'subdir',
        path: 'subdir',
        children: [file]
      };

      const root: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [subdir]
      };

      const position = new THREE.Vector3(0, 10, 0);
      const nodes = layoutEngine.layoutTree(root, position, 0, 0, Math.PI * 2);

      expect(nodes).toHaveLength(3); // root + subdir + file

      expect(nodes[0].node).toBe(root);
      expect(nodes[1].node).toBe(subdir);
      expect(nodes[2].node).toBe(file);

      expect(nodes[1].parent).toBe(nodes[0]);
      expect(nodes[2].parent).toBe(nodes[1]);
    });

    it('should respect parent layout reference', () => {
      const file: FileNode = createMockFile({ name: 'test.ts', path: 'test.ts' });

      const root: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [file]
      };

      const mockParent: LayoutNode = { node: {} as unknown as DirectoryNode, position: new THREE.Vector3(0, 0, 0) };
      const position = new THREE.Vector3(0, 10, 0);
      const nodes = layoutEngine.layoutTree(root, position, 0, 0, Math.PI * 2, mockParent);

      expect(nodes[0].parent).toBe(mockParent);
    });
  });
});
