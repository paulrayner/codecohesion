import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GhostRenderer } from './GhostRenderer';
import { DirectoryNode, FileNode, TreeNode } from './types';
import { createMockFile } from './lib/test-fixtures';

/** Structural type for accessing GhostRenderer private state in tests */
interface GhostRendererInternals {
  ghostMeshes: Set<THREE.Mesh>;
  ghostEdges: Set<THREE.Line>;
}

describe('GhostRenderer', () => {
  let ghostRenderer: GhostRenderer;
  let scene: THREE.Scene;
  let fileObjects: Map<THREE.Object3D, FileNode>;
  let dirObjects: Map<THREE.Object3D, DirectoryNode>;
  let edges: THREE.Line[];
  let edgeNodeMap: Map<THREE.Line, { parent: TreeNode; child: TreeNode }>;

  beforeEach(() => {
    ghostRenderer = new GhostRenderer();
    scene = new THREE.Scene();
    fileObjects = new Map();
    dirObjects = new Map();
    edges = [];
    edgeNodeMap = new Map();
  });

  describe('clearGhosts', () => {
    it('should clear ghost meshes from scene and fileObjects', () => {
      // Create a mock ghost mesh
      const ghostMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1),
        new THREE.MeshBasicMaterial()
      );
      const fileNode: FileNode = createMockFile({ name: 'deleted.ts', path: 'src/deleted.ts' });

      scene.add(ghostMesh);
      fileObjects.set(ghostMesh, fileNode);

      // Manually add to ghost renderer's tracking (simulating internal state)
      (ghostRenderer as unknown as GhostRendererInternals).ghostMeshes.add(ghostMesh);

      // Call clearGhosts
      ghostRenderer.clearGhosts(scene, fileObjects, edges, edgeNodeMap);

      // Verify mesh removed from scene
      expect(scene.children).not.toContain(ghostMesh);
      // Verify mesh removed from fileObjects
      expect(fileObjects.has(ghostMesh)).toBe(false);
    });

    it('should clear ghost edges from scene, edges array, and edgeNodeMap', () => {
      const ghostEdge = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial()
      );

      scene.add(ghostEdge);
      edges.push(ghostEdge);
      edgeNodeMap.set(ghostEdge, { parent: {} as unknown as TreeNode, child: {} as unknown as TreeNode });

      // Manually add to ghost renderer's tracking
      (ghostRenderer as unknown as GhostRendererInternals).ghostEdges.add(ghostEdge);

      // Call clearGhosts
      ghostRenderer.clearGhosts(scene, fileObjects, edges, edgeNodeMap);

      // Verify edge removed from scene
      expect(scene.children).not.toContain(ghostEdge);
      // Verify edge removed from edges array
      expect(edges).not.toContain(ghostEdge);
      // Verify edge removed from edgeNodeMap
      expect(edgeNodeMap.has(ghostEdge)).toBe(false);
    });
  });

  describe('renderDeletedFiles', () => {
    it('should not render ghosts if timeline mode is off', () => {
      const deletedPaths = ['src/file.ts'];
      const prevTree: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [
          createMockFile({ name: 'file.ts', path: 'src/file.ts' }),
        ]
      };

      ghostRenderer.renderDeletedFiles(
        deletedPaths,
        prevTree,
        scene,
        fileObjects,
        dirObjects,
        edges,
        edgeNodeMap,
        'off'
      );

      // No ghosts should be added
      expect(scene.children.length).toBe(0);
    });

    it('should not render ghosts if timeline mode is v1', () => {
      const deletedPaths = ['src/file.ts'];
      const prevTree: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: []
      };

      ghostRenderer.renderDeletedFiles(
        deletedPaths,
        prevTree,
        scene,
        fileObjects,
        dirObjects,
        edges,
        edgeNodeMap,
        'v1'
      );

      // No ghosts should be added
      expect(scene.children.length).toBe(0);
    });

    it('should not render ghosts if prevTree is null', () => {
      const deletedPaths = ['src/file.ts'];

      ghostRenderer.renderDeletedFiles(
        deletedPaths,
        null,
        scene,
        fileObjects,
        dirObjects,
        edges,
        edgeNodeMap,
        'v2'
      );

      // No ghosts should be added
      expect(scene.children.length).toBe(0);
    });

    it('should not render ghosts if deletedPaths is empty', () => {
      const prevTree: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: []
      };

      ghostRenderer.renderDeletedFiles(
        [],
        prevTree,
        scene,
        fileObjects,
        dirObjects,
        edges,
        edgeNodeMap,
        'v2'
      );

      // No ghosts should be added
      expect(scene.children.length).toBe(0);
    });

    it('should render ghost mesh and edge for deleted file at root level', () => {
      // Setup: Create root directory mesh
      const rootMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      rootMesh.position.set(0, 0, 0);
      scene.add(rootMesh);

      const rootDir: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: []
      };
      dirObjects.set(rootMesh, rootDir);

      const prevTree: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [
          createMockFile({ name: 'deleted.ts', path: 'deleted.ts' }),
        ]
      };

      ghostRenderer.renderDeletedFiles(
        ['deleted.ts'],
        prevTree,
        scene,
        fileObjects,
        dirObjects,
        edges,
        edgeNodeMap,
        'v2'
      );

      // Should add ghost mesh and edge (total 3: root + ghost + edge)
      expect(scene.children.length).toBeGreaterThan(1);
      // Should add edge to edges array
      expect(edges.length).toBe(1);
      // Ghost mesh should be added to fileObjects
      expect(fileObjects.size).toBe(1);
    });

    it('should skip ghost rendering if parent directory does not exist', () => {
      const prevTree: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [
          {
            type: 'directory',
            name: 'deleted-dir',
            path: 'deleted-dir',
            children: [
              createMockFile({ name: 'file.ts', path: 'deleted-dir/file.ts' })
            ]
          }
        ]
      };

      // Parent directory 'deleted-dir' does not exist in current tree
      ghostRenderer.renderDeletedFiles(
        ['deleted-dir/file.ts'],
        prevTree,
        scene,
        fileObjects,
        dirObjects,
        edges,
        edgeNodeMap,
        'v2'
      );

      // No ghosts should be added (parent missing)
      expect(scene.children.length).toBe(0);
      expect(edges.length).toBe(0);
    });
  });

  describe('ghost positioning', () => {
    it('should calculate default position when no siblings exist', () => {
      const rootMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      rootMesh.position.set(0, 0, 0);
      scene.add(rootMesh);

      const rootDir: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [] // No siblings
      };
      dirObjects.set(rootMesh, rootDir);

      const prevTree: DirectoryNode = {
        type: 'directory',
        name: 'root',
        path: '',
        children: [
          createMockFile({ name: 'deleted.ts', path: 'deleted.ts' }),
        ]
      };

      ghostRenderer.renderDeletedFiles(
        ['deleted.ts'],
        prevTree,
        scene,
        fileObjects,
        dirObjects,
        edges,
        edgeNodeMap,
        'v2'
      );

      // Ghost should be positioned at default radius from parent
      const ghostMesh = Array.from(fileObjects.keys())[0] as THREE.Mesh;
      expect(ghostMesh).toBeDefined();
      expect(ghostMesh.position.length()).toBeCloseTo(10, 0); // Default radius = 10
    });
  });
});
