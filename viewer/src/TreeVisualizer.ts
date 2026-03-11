import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { DirectoryNode, FileNode, TreeNode } from './types';
import { DIRECTORY_COLOR } from './colorScheme';
import { ColorMode, getColorForFile } from './colorModeManager';
import { FilterManager } from './filterManager';
import { CouplingLoader } from './couplingLoader';
import { CouplingEdge } from './coupling-types';
import { calculateDominantColor } from './lib/directory-color-aggregation';
import { calculateFramingPosition } from './lib/cameraPositioning';
import { calculateDirectorySize, calculateFileSize } from './lib/node-sizing';
import { shouldShowGrid } from './lib/grid-visibility';
import { shouldShowFog } from './lib/fog-visibility';
import { getCameraFOV, getControlsConfig, getDampingEnabled, computeMaxDistance, computeFogRange } from './lib/camera-configuration';
import { getRootYPosition, getCameraZOffset } from './lib/layout-positioning';
import { shouldHideDirectoryNodes } from './lib/directory-visibility';
import { GhostRenderer } from './GhostRenderer';
import { ILayoutStrategy, LayoutNode } from './ILayoutStrategy';
import { HierarchicalLayoutStrategy } from './HierarchicalLayoutStrategy';

interface DirectoryStats {
  totalLoc: number;
  filesByExtension: Record<string, number>;
  dominantExtension: string;
  dominantColor: number;
}

export class TreeVisualizer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private layoutNodes: LayoutNode[] = [];
  private fileObjects: Map<THREE.Object3D, FileNode> = new Map();
  private dirObjects: Map<THREE.Object3D, DirectoryNode> = new Map();
  private dirStats: Map<DirectoryNode, DirectoryStats> = new Map();
  private selectedObject: THREE.Object3D | null = null;
  private hoveredObjects: Set<THREE.Object3D> = new Set();
  private collapsedDirs: Set<DirectoryNode> = new Set();
  private focusedDirectory: DirectoryNode | null = null;
  private labelMode: 'always' | 'hover' = 'hover';
  private colorMode: ColorMode = 'fileType';
  private highlightedFiles: Set<string> = new Set();
  private highlightedFileTypes: Map<string, 'added' | 'modified' | 'deleted'> = new Map(); // Track type of highlighted files
  private deletedFileNodes: Map<string, FileNode> = new Map(); // Store metadata for deleted files (ghost nodes)
  private timelineMode: 'off' | 'v1' | 'v2' = 'off'; // Timeline mode: v1=spotlight, v2=additive
  private filterManager: FilterManager = new FilterManager(); // Filter manager for HEAD view only
  private viewMode: 'navigate' | 'overview' = 'navigate'; // View mode: navigate=depth-limited, overview=show all

  // Coupling cluster visualization
  private couplingLoader: CouplingLoader | null = null;
  private clusterCard: CSS2DObject | null = null; // Pre-created card element (reused, not recreated)
  private highlightedClusterFiles: Set<string> = new Set();
  private isMouseOverClusterCard: boolean = false; // Track if mouse is over the card

  // Ghost rendering for Timeline V2 deletions (extracted to GhostRenderer module)
  private ghostRenderer: GhostRenderer = new GhostRenderer();

  // Layout strategy for tree positioning (supports multiple layout algorithms)
  private layoutStrategy: ILayoutStrategy = new HierarchicalLayoutStrategy();
  private currentTree: DirectoryNode | null = null; // Store tree for re-layout when strategy changes

  // Grid helper for 3D spatial reference (hidden in 2D overhead view)
  private gridHelper: THREE.GridHelper | null = null;

  // Physics animation timing
  private lastFrameTime: number = 0;

  private edges: THREE.Line[] = [];
  private edgeNodeMap: Map<THREE.Line, { parent: TreeNode; child: TreeNode }> = new Map();
  private onFileClick?: (file: FileNode) => void;
  private onDirClick?: (dir: DirectoryNode) => void;
  private onHover?: (node: TreeNode | null, event?: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    this.scene.fog = new THREE.Fog(0x1a1a1a, 50, 200);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(30, 30, 30);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Label renderer for directory names
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    canvas.parentElement?.appendChild(this.labelRenderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Raycaster for mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Pre-create cluster card (reused, not recreated on each hover)
    const cardElement = document.createElement('div');
    cardElement.className = 'cluster-details-card';

    // Add mouse event listeners to track hover state
    cardElement.addEventListener('mouseenter', () => {
      this.isMouseOverClusterCard = true;
    });
    cardElement.addEventListener('mouseleave', () => {
      this.isMouseOverClusterCard = false;
      // Hide card when mouse leaves it
      this.hideClusterCard();
    });

    this.clusterCard = new CSS2DObject(cardElement);
    this.clusterCard.visible = false;
    // Don't add to scene - will be attached to mesh on hover

    // Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    canvas.addEventListener('click', this.onClick.bind(this));
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  /**
   * Set callback for file clicks
   */
  setOnFileClick(callback: (file: FileNode) => void) {
    this.onFileClick = callback;
  }

  /**
   * Set callback for directory clicks
   */
  setOnDirClick(callback: (dir: DirectoryNode) => void) {
    this.onDirClick = callback;
  }

  /**
   * Set callback for hover events
   */
  setOnHover(callback: (node: TreeNode | null, event?: MouseEvent) => void) {
    this.onHover = callback;
  }

  /**
   * Set coupling data loader for cluster visualization
   */
  setCouplingLoader(loader: CouplingLoader | null) {
    console.log('[ClusterCard] setCouplingLoader called', {
      hasLoader: !!loader,
      isLoaded: loader?.isLoaded()
    });
    this.couplingLoader = loader;
  }

  /**
   * Set label display mode
   */
  setLabelMode(mode: 'always' | 'hover') {
    this.labelMode = mode;

    // Update all existing labels, respecting parent mesh visibility
    this.dirObjects.forEach((_dirNode, mesh) => {
      const label = mesh.children.find(child => child instanceof CSS2DObject) as CSS2DObject | undefined;
      if (label && label.element instanceof HTMLDivElement) {
        if (mode === 'always') {
          // Only show label if parent mesh is visible
          if (mesh.visible) {
            label.element.style.visibility = 'visible';
            label.element.style.display = 'block';
          } else {
            label.element.style.visibility = 'hidden';
            label.element.style.display = 'none';
          }
        } else {
          // Hover mode: hide all labels initially
          label.element.style.visibility = 'hidden';
          label.element.style.display = 'none';
        }
      }
    });
  }

  /**
   * Set color mode and rebuild visualization
   */
  setColorMode(mode: ColorMode) {
    this.colorMode = mode;
    // Clear directory stats cache so dominant colors are recalculated for new mode
    this.dirStats.clear();
    if (this.layoutNodes.length > 0) {
      this.rebuildVisualization();
    }
  }

  /**
   * Set layout strategy and rebuild visualization
   * Switches between different layout algorithms (3D hierarchy, flat 2D, etc.)
   *
   * TDD RED PHASE - Failing specification:
   * Bug (user verified): Switching 2D→3D→2D keeps rotated view instead of overhead
   * Test steps that FAIL:
   *   1. Load in 2D mode → overhead view (0,150,0.1) ✓
   *   2. Switch to 3D → angled view (30,30,30) ✓
   *   3. Switch back to 2D → FAILS: keeps rotated view, SHOULD be overhead
   *
   * Expected (after GREEN phase):
   *   - 2D mode MUST always show overhead (0,150,0.1)
   *   - 3D mode MUST always show angle (30,30,30)
   *   - Mode switches MUST reset camera to mode default
   */
  setLayoutStrategy(strategy: ILayoutStrategy) {
    console.log('[setLayoutStrategy] ENTER - current camera:', this.camera.position.toArray());
    this.layoutStrategy = strategy;

    // Determine layout mode for all configuration decisions
    const is2DLayout = strategy.needsContinuousUpdate?.() ?? false;

    // Apply camera defaults for this layout
    const { position, lookAt } = strategy.getCameraDefaults();
    console.log('[setLayoutStrategy] Strategy defaults:', position.toArray(), 'lookAt:', lookAt.toArray());

    // Apply camera and controls configuration
    const fov = getCameraFOV(is2DLayout);
    const controlsConfig = getControlsConfig(is2DLayout);

    if (is2DLayout) {
      // Force-directed 2D: ensure true overhead view
      this.camera.up.set(0, 1, 0);
      this.camera.position.copy(position);
      this.camera.lookAt(lookAt);
      this.controls.target.copy(lookAt);
      this.controls.update();
      console.log('[setLayoutStrategy] 2D mode - saving state at:', this.camera.position.toArray());
      this.controls.saveState(); // Save (0,150,0.1) as OrbitControls home

      // Apply 2D-specific camera and controls settings
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.controls.enableRotate = controlsConfig.enableRotate;
    } else {
      // 3D layouts: standard camera setup
      this.camera.position.copy(position);
      this.camera.lookAt(lookAt);
      this.controls.target.copy(lookAt);
      this.controls.update();
      console.log('[setLayoutStrategy] 3D mode - saving state at:', this.camera.position.toArray());
      this.controls.saveState(); // Save (30,30,30) as OrbitControls home

      // Apply 3D-specific camera and controls settings
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.controls.enableRotate = controlsConfig.enableRotate;
    }

    // Apply fog based on layout mode (2D disables fog to prevent dimming when zoomed out).
    // Fog range is derived from current maxDistance so it scales with scene size.
    const bgColor = (this.scene.background as THREE.Color)?.getHex() ?? 0x1a1a1a;
    if (shouldShowFog(is2DLayout)) {
      const { near, far } = computeFogRange(this.controls.maxDistance);
      this.scene.fog = new THREE.Fog(bgColor, near, far);
    } else {
      this.scene.fog = null;
    }

    // Re-layout tree with new strategy (don't reset camera - we just did above)
    if (this.currentTree) {
      this.visualize(this.currentTree, false);
    }
  }

  /**
   * Set theme (light or dark)
   * Updates 3D scene background and fog colors (respects 2D mode fog setting)
   */
  setTheme(theme: 'light' | 'dark') {
    const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;
    const fogColor = theme === 'light' ? 0xf5f5f5 : 0x1a1a1a;

    this.scene.background = new THREE.Color(fogColor);

    // Only set fog if not in 2D mode (2D overhead view doesn't need fog).
    // Fog range is derived from current maxDistance so it scales with scene size.
    if (shouldShowFog(is2DLayout)) {
      const { near, far } = computeFogRange(this.controls.maxDistance);
      this.scene.fog = new THREE.Fog(fogColor, near, far);
    } else {
      this.scene.fog = null;
    }
  }

  /**
   * Set timeline mode
   * @param mode - 'off' (static), 'v1' (spotlight highlighting), 'v2' (additive/Gource-style)
   */
  setTimelineMode(mode: 'off' | 'v1' | 'v2') {
    this.timelineMode = mode;

    // Clear filters when entering timeline mode (filters only work in HEAD view)
    if (mode !== 'off') {
      this.filterManager.clearFilters();
    }

    if (this.layoutNodes.length > 0) {
      this.rebuildVisualization();
    }
  }

  /**
   * Set active filter categories (HEAD view only)
   * @param categories - Array of category names to show (e.g., ["High churn", "Very high churn"])
   */
  setFilter(categories: string[]) {
    // Filters only work in HEAD view (not timeline)
    if (this.timelineMode !== 'off') {
      console.warn('Filters are only available in HEAD view, not timeline mode');
      return;
    }

    this.filterManager.setActiveCategories(categories, this.colorMode);
    this.updateNodeVisibility();
  }

  /**
   * Clear all active filters
   */
  clearFilter() {
    this.filterManager.clearFilters();
    this.updateNodeVisibility();
  }

  /**
   * Check if filters are currently active
   */
  hasActiveFilters(): boolean {
    return this.filterManager.hasActiveFilters();
  }

  /**
   * Get current active filter categories
   */
  getActiveFilterCategories(): string[] {
    return this.filterManager.getActiveCategories();
  }

  /**
   * Set view mode (HEAD view only)
   * @param mode - 'navigate' (show depth 0-1 only) or 'overview' (show all depths)
   */
  setViewMode(mode: 'navigate' | 'overview') {
    this.viewMode = mode;
    if (this.layoutNodes.length > 0) {
      this.updateNodeVisibility();
    }
  }

  /**
   * Get current view mode
   */
  getViewMode(): 'navigate' | 'overview' {
    return this.viewMode;
  }

  /**
   * Update visibility of all nodes based on current filter state
   * Does NOT rebuild the scene, just shows/hides existing meshes
   */
  private updateNodeVisibility() {
    // Update file and directory mesh visibility
    for (const layoutNode of this.layoutNodes) {
      if (layoutNode.mesh) {
        const shouldHide = this.isNodeHidden(layoutNode);
        const material = (layoutNode.mesh as THREE.Mesh).material as THREE.MeshPhongMaterial;

        layoutNode.mesh.visible = !shouldHide;
        material.transparent = shouldHide;
        material.opacity = shouldHide ? 0.0 : (layoutNode.node.type === 'directory' ? 0.85 : 1.0);
        material.needsUpdate = true;

        // Update directory labels
        if (layoutNode.node.type === 'directory') {
          const label = layoutNode.mesh.children.find(child => child instanceof CSS2DObject) as CSS2DObject | undefined;
          if (label && label.element instanceof HTMLDivElement) {
            if (this.labelMode === 'always' && !shouldHide) {
              label.element.style.visibility = 'visible';
              label.element.style.display = 'block';
            } else {
              label.element.style.visibility = 'hidden';
              label.element.style.display = 'none';
            }
          }
        }
      }
    }

    // Update edge visibility
    for (const edge of this.edges) {
      const edgeInfo = this.edgeNodeMap.get(edge);
      if (!edgeInfo) continue;

      const parentLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.parent);
      const childLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.child);
      const shouldBeHidden = !parentLayout || !childLayout ||
                            this.isNodeHidden(parentLayout) ||
                            this.isNodeHidden(childLayout);

      edge.visible = !shouldBeHidden;
      const material = edge.material as THREE.LineBasicMaterial;
      material.opacity = shouldBeHidden ? 0.0 : 0.3;
      material.needsUpdate = true;
    }
  }

  /**
   * Highlight specific files by path
   */
  highlightFiles(filePaths: string[]) {
    this.highlightedFiles = new Set(filePaths);
    this.updateHighlighting();
  }

  /**
   * Highlight files with color-coding based on change type
   * @param addedFiles - Paths of newly added files (green connections)
   * @param modifiedFiles - Paths of modified files (orange connections)
   * @param deletedFiles - Paths of deleted files (red connections)
   * @param deletedFileNodes - Full FileNode metadata for deleted files (from previous keyframe)
   */
  highlightFilesByType(addedFiles: string[], modifiedFiles: string[], deletedFiles: string[] = [], deletedFileNodes: FileNode[] = []) {
    this.highlightedFiles = new Set([...addedFiles, ...modifiedFiles, ...deletedFiles]);
    this.highlightedFileTypes.clear();
    this.deletedFileNodes.clear();

    for (const path of addedFiles) {
      this.highlightedFileTypes.set(path, 'added');
    }
    for (const path of modifiedFiles) {
      this.highlightedFileTypes.set(path, 'modified');
    }
    for (const path of deletedFiles) {
      this.highlightedFileTypes.set(path, 'deleted');
    }

    // Store deleted file metadata for ghost rendering
    for (const fileNode of deletedFileNodes) {
      this.deletedFileNodes.set(fileNode.path, fileNode);
    }

    this.updateHighlighting();
  }

  /**
   * Clear all file highlighting
   */
  clearHighlight() {
    this.highlightedFiles.clear();
    this.highlightedFileTypes.clear();
    this.deletedFileNodes.clear();
    this.updateHighlighting();
  }

  /**
   * Update visual highlighting of files based on highlightedFiles set
   */
  private updateHighlighting() {
    // Iterate through all file meshes and update their appearance
    for (const [obj, fileNode] of this.fileObjects.entries()) {
      const mesh = obj as THREE.Mesh;
      if (!mesh.material || Array.isArray(mesh.material)) continue;
      const material = mesh.material as THREE.MeshPhongMaterial;

      if (this.highlightedFiles.size === 0) {
        // No highlighting active - restore normal appearance (may still be hidden)
        const layoutNode = this.layoutNodes.find(ln => ln.mesh === mesh);
        const isHidden = layoutNode ? this.isNodeHidden(layoutNode) : false;
        material.opacity = isHidden ? 0.0 : 1.0;
        material.transparent = isHidden;
        material.emissiveIntensity = 0.2;
        mesh.scale.set(1, 1, 1);
        mesh.visible = !isHidden;
      } else if (this.highlightedFiles.has(fileNode.path)) {
        // This file is highlighted - SUPER BRIGHT, scaled up, and FORCE VISIBLE
        material.opacity = 1.0;
        material.transparent = false;
        material.emissiveIntensity = 1.5; // Very bright glow

        // Check if this is a deleted file (should stay red)
        const fileType = this.highlightedFileTypes.get(fileNode.path);
        if (fileType === 'deleted') {
          // Keep red color for deletions
          material.emissive.setHex(0xe74c3c);
        } else {
          // Use current color mode to determine file color (not change type)
          const colorInfo = getColorForFile(fileNode, this.colorMode);
          material.emissive.setHex(parseInt(colorInfo.hex.replace('#', ''), 16));
        }

        mesh.scale.set(1.3, 1.3, 1.3); // Scale up 30%
        mesh.visible = true; // Force visible even if normally hidden
      } else {
        // This file is NOT highlighted
        if (this.timelineMode === 'v2') {
          // V2 (Gource-style): Keep normal appearance for non-highlighted files
          const layoutNode = this.layoutNodes.find(ln => ln.mesh === mesh);
          const isHidden = layoutNode ? this.isNodeHidden(layoutNode) : false;
          material.opacity = isHidden ? 0.0 : 1.0;
          material.transparent = isHidden;
          material.emissiveIntensity = 0.6; // Keep same brightness as initial render
          mesh.visible = !isHidden;
        } else {
          // V1 (or static with highlight commit on): Dim non-highlighted files (spotlight effect)
          material.opacity = 0.08;
          material.transparent = true;
          material.emissiveIntensity = 0.0;
          mesh.visible = true; // Keep visible but very dim
        }
        mesh.scale.set(1, 1, 1);
      }

      material.needsUpdate = true;
    }

    // Update edges to highlight connections to highlighted files
    for (const edge of this.edges) {
      const edgeInfo = this.edgeNodeMap.get(edge);
      if (!edgeInfo) continue;

      const material = edge.material as THREE.LineBasicMaterial;
      const childIsFile = edgeInfo.child.type === 'file';
      const childPath = childIsFile ? (edgeInfo.child as FileNode).path : '';

      // Find layout nodes to check if they're hidden
      const parentLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.parent);
      const childLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.child);
      const shouldBeHidden = !parentLayout || !childLayout ||
                            this.isNodeHidden(parentLayout) ||
                            this.isNodeHidden(childLayout);

      if (this.highlightedFiles.size === 0) {
        // No highlighting - make edges very dim to indicate no highlighting available
        // This prevents confusion in timeline mode when file lookup fails
        material.color.setHex(0xaaaaaa);
        material.opacity = shouldBeHidden ? 0.0 : 0.3;
        material.linewidth = 1;
        edge.visible = !shouldBeHidden;
      } else if (childIsFile && this.highlightedFiles.has(childPath)) {
        // Edge connects to highlighted file - make it BRIGHT, THICK, and VISIBLE
        // Color-code based on change type
        const fileType = this.highlightedFileTypes.get(childPath);
        if (fileType === 'added') {
          material.color.setHex(0x27ae60); // Green for additions (matches commit stats color)
        } else if (fileType === 'modified') {
          material.color.setHex(0xffff00); // Yellow for modifications
        } else if (fileType === 'deleted') {
          material.color.setHex(0xe74c3c); // Red for deletions
        } else {
          material.color.setHex(0xffff00); // Default to yellow (legacy support)
        }
        material.opacity = 1.0;
        material.linewidth = 3; // Note: linewidth may not work on all platforms
        edge.visible = true; // Force visible even if normally hidden
      } else if (this.deletedFileNodes.has(childPath)) {
        // SPECIAL CASE: Edge connects to a DELETED file (ghost node)
        // The file is not in the current tree, but we want to show its connection
        material.color.setHex(0xe74c3c); // Red for deletion
        material.opacity = 1.0;
        material.linewidth = 3;
        edge.visible = true; // Show the connection even though child is gone
      } else {
        // Edge doesn't connect to highlighted file
        if (this.timelineMode === 'v2') {
          // V2: Keep normal edge visibility (additive mode)
          material.color.setHex(0xaaaaaa);
          material.opacity = shouldBeHidden ? 0.0 : 0.3;
          material.linewidth = 1;
          edge.visible = !shouldBeHidden;
        } else {
          // V1: Make edge nearly invisible (spotlight mode)
          material.opacity = 0.05;
          edge.visible = true; // Keep visible but very dim
        }
      }

      material.needsUpdate = true;
    }
  }

  /**
   * Calculate statistics for a directory (total LOC, dominant file type, dominant color for current mode)
   */
  private calculateDirectoryStats(dir: DirectoryNode): DirectoryStats {
    const stats: DirectoryStats = {
      totalLoc: 0,
      filesByExtension: {},
      dominantExtension: 'no-extension',
      dominantColor: DIRECTORY_COLOR.numeric
    };

    const processNode = (node: TreeNode) => {
      if (node.type === 'file') {
        stats.totalLoc += node.loc;
        const ext = node.extension;
        stats.filesByExtension[ext] = (stats.filesByExtension[ext] || 0) + node.loc;
      } else {
        // Recursively process subdirectories
        for (const child of node.children) {
          processNode(child);
        }
      }
    };

    // Process all children
    for (const child of dir.children) {
      processNode(child);
    }

    // Find dominant extension by LOC (for backward compatibility)
    let maxLoc = 0;
    for (const [ext, loc] of Object.entries(stats.filesByExtension)) {
      if (loc > maxLoc) {
        maxLoc = loc;
        stats.dominantExtension = ext;
      }
    }

    // Calculate dominant color based on current color mode using extracted function
    stats.dominantColor = calculateDominantColor(dir, this.colorMode);

    return stats;
  }


  // Layout methods delegated to layout strategy
  // See ILayoutStrategy.ts and implementing classes for details

  /**
   * Check if a layout node should be hidden
   * Hidden if: ancestor is collapsed OR outside focus scope OR filtered out (HEAD view only)
   */
  private isNodeHidden(layoutNode: LayoutNode): boolean {
    // Check collapsed ancestors
    let current = layoutNode.parent;
    while (current) {
      if (current.node.type === 'directory' && this.collapsedDirs.has(current.node)) {
        return true;
      }
      current = current.parent;
    }

    // Check focus scope
    if (this.focusedDirectory === null) {
      // In timeline mode, disable depth-based hiding so all files can be highlighted
      if (this.timelineMode === 'off') {
        // HEAD mode: respect view mode setting
        if (this.viewMode === 'navigate') {
          // Navigate mode: show root + level 1 only (default behavior)
          const depth = this.getNodeDepth(layoutNode);
          if (depth > 1) return true;
        }
        // Overview mode: no depth-based hiding (show all depths)
      }
      // Timeline mode (v1 or v2): no depth-based hiding
    } else {
      // Focused: show only focused directory + its direct children
      if (!this.isInFocusScope(layoutNode)) {
        return true;
      }
    }

    // Filter check (HEAD view only)
    if (this.timelineMode === 'off' && this.filterManager.hasActiveFilters()) {
      if (layoutNode.node.type === 'file') {
        // Files: check if they match the filter
        const fileMatches = this.filterManager.matchesFilter(layoutNode.node, this.colorMode);

        // Exception: highlighted files (commit siblings) always visible
        if (!fileMatches && !this.highlightedFiles.has(layoutNode.node.path)) {
          return true; // Hide filtered-out files
        }
      } else if (layoutNode.node.type === 'directory') {
        // Directories: hide if NO descendants match filter
        const hasVisibleDescendants = this.filterManager.hasVisibleDescendants(layoutNode.node, this.colorMode);
        if (!hasVisibleDescendants) {
          return true; // Hide empty directories
        }
      }
    }

    return false;
  }

  /**
   * Get depth of a layout node in the tree
   */
  private getNodeDepth(layoutNode: LayoutNode): number {
    let depth = 0;
    let current = layoutNode.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Check if node is within focus scope
   */
  private isInFocusScope(layoutNode: LayoutNode): boolean {
    const node = layoutNode.node;

    // The focused directory itself
    if (node === this.focusedDirectory) {
      return true;
    }

    // All ancestors of focused directory (for context/navigation)
    if (this.isAncestorOfFocused(layoutNode)) {
      return true;
    }

    // Siblings of focused directory (at same level, not cluttering)
    if (this.isSiblingOfFocused(layoutNode)) {
      return true;
    }

    // All siblings of all ancestors (show all nodes at ancestor levels)
    if (this.isSiblingOfAncestor(layoutNode)) {
      return true;
    }

    // Direct children of focused directory
    if (layoutNode.parent && layoutNode.parent.node === this.focusedDirectory) {
      return true;
    }

    return false;
  }

  /**
   * Check if node is an ancestor of the focused directory
   */
  private isAncestorOfFocused(layoutNode: LayoutNode): boolean {
    if (!this.focusedDirectory) return false;

    // Find the focused layout node
    const focusedLayout = this.layoutNodes.find(ln => ln.node === this.focusedDirectory);
    if (!focusedLayout) return false;

    // Walk up from focused to see if we hit this node
    let current = focusedLayout.parent;
    while (current) {
      if (current.node === layoutNode.node) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /**
   * Check if node is a sibling of the focused directory (shares same parent)
   */
  private isSiblingOfFocused(layoutNode: LayoutNode): boolean {
    if (!this.focusedDirectory) return false;

    // Find the focused layout node
    const focusedLayout = this.layoutNodes.find(ln => ln.node === this.focusedDirectory);
    if (!focusedLayout) return false;

    // Same parent = siblings
    return layoutNode.parent === focusedLayout.parent && layoutNode.node !== this.focusedDirectory;
  }

  /**
   * Check if node is a sibling of any ancestor of the focused directory
   * This ensures all nodes at ancestor levels remain visible
   */
  private isSiblingOfAncestor(layoutNode: LayoutNode): boolean {
    if (!this.focusedDirectory) return false;

    // Find the focused layout node
    const focusedLayout = this.layoutNodes.find(ln => ln.node === this.focusedDirectory);
    if (!focusedLayout) return false;

    // Walk up ancestors and check if layoutNode is a sibling of any
    let current = focusedLayout.parent;
    while (current) {
      // Check if layoutNode shares the same parent as this ancestor
      if (layoutNode.parent === current.parent && layoutNode.node !== current.node) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /**
   * Create visual representation of the tree
   */
  private createVisuals(layoutNodes: LayoutNode[], maxFileLoc: number, maxDirLoc: number) {
    // Clear existing objects and CSS2D labels
    // CSS2DRenderer maintains DOM elements that need explicit cleanup
    while (this.labelRenderer.domElement.firstChild) {
      this.labelRenderer.domElement.removeChild(this.labelRenderer.domElement.firstChild);
    }
    this.scene.clear();
    this.fileObjects.clear();
    this.dirObjects.clear();

    // Re-add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Create edges first (so they render behind nodes)
    const edgeGroup = new THREE.Group();
    this.edges = [];
    this.edgeNodeMap.clear();

    for (const layoutNode of layoutNodes) {
      if (layoutNode.node.type === 'directory') {
        const dirNode = layoutNode.node;
        for (const child of dirNode.children) {
          const childLayout = layoutNodes.find(ln => ln.node === child);
          if (childLayout) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
              layoutNode.position,
              childLayout.position
            ]);

            // Start edges as hidden/dim if nodes are hidden
            const isHidden = this.isNodeHidden(layoutNode) || this.isNodeHidden(childLayout);
            const material = new THREE.LineBasicMaterial({
              color: 0xaaaaaa,
              transparent: true,
              opacity: isHidden ? 0.0 : 0.8,
              linewidth: 3 // Thicker connection lines
            });
            const line = new THREE.Line(geometry, material);
            line.visible = !isHidden;
            edgeGroup.add(line);

            // Store edge and its nodes for later highlighting
            this.edges.push(line);
            this.edgeNodeMap.set(line, { parent: dirNode, child });
          }
        }
      }
    }
    this.scene.add(edgeGroup);

    // Create nodes
    for (const layoutNode of layoutNodes) {
      const isHidden = this.isNodeHidden(layoutNode);

      if (layoutNode.node.type === 'file') {
        const fileNode = layoutNode.node;

        // Size calculation: uniform for 2D layouts, LOC-based for 3D
        const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;
        const normalizedSize = calculateFileSize(fileNode.loc, maxFileLoc, is2DLayout, this.timelineMode);

        // Color based on current mode
        const colorInfo = getColorForFile(fileNode, this.colorMode);
        const color = parseInt(colorInfo.hex.replace('#', ''), 16);

        // Use higher emissive intensity in timeline mode for better visibility
        const emissiveIntensity = this.timelineMode !== 'off' ? 0.6 : 0.2;

        const geometry = new THREE.SphereGeometry(normalizedSize, 16, 16);
        const material = new THREE.MeshPhongMaterial({
          color,
          emissive: color,
          emissiveIntensity,
          transparent: isHidden,
          opacity: isHidden ? 0.0 : 1.0
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(layoutNode.position);
        mesh.visible = !isHidden;

        this.scene.add(mesh);
        this.fileObjects.set(mesh, fileNode);
        layoutNode.mesh = mesh;
      } else {
        // Directory node - cube shape with aggregation coloring
        const dirNode = layoutNode.node;

        // In 2D mode, hide directory nodes to show only files
        const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;
        if (shouldHideDirectoryNodes(is2DLayout)) {
          // Skip mesh creation - directory exists in layout but has no visual representation
          continue;
        }

        // Get or calculate directory stats
        let stats = this.dirStats.get(dirNode);
        if (!stats) {
          stats = this.calculateDirectoryStats(dirNode);
          this.dirStats.set(dirNode, stats);
        }

        // Size calculation: uniform for 2D layouts, LOC-based for 3D
        const normalizedSize = calculateDirectorySize(stats.totalLoc, maxDirLoc, is2DLayout);

        // Color based on dominant color from stats (calculated per color mode)
        const color = stats.dominantColor;

        const geometry = new THREE.BoxGeometry(normalizedSize, normalizedSize, normalizedSize);
        const material = new THREE.MeshPhongMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: isHidden ? 0.0 : 0.85
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(layoutNode.position);
        mesh.visible = !isHidden;

        this.scene.add(mesh);
        this.dirObjects.set(mesh, dirNode);
        layoutNode.mesh = mesh;

        // Add text label above directory with collapse indicator
        const isCollapsed = this.collapsedDirs.has(dirNode);
        const indicator = isCollapsed ? '+ ' : '− ';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'dir-label';
        labelDiv.textContent = indicator + dirNode.name;
        labelDiv.style.color = '#ffffff';
        labelDiv.style.fontSize = '12px';
        labelDiv.style.fontFamily = 'monospace';
        labelDiv.style.padding = '2px 6px';
        labelDiv.style.background = 'rgba(0, 0, 0, 0.6)';
        labelDiv.style.borderRadius = '3px';
        labelDiv.style.whiteSpace = 'nowrap';

        // Set initial visibility based on label mode AND node visibility
        if (this.labelMode === 'hover' || isHidden) {
          labelDiv.style.visibility = 'hidden';
          labelDiv.style.display = 'none';
        }

        const label = new CSS2DObject(labelDiv);
        label.position.set(0, normalizedSize / 2 + 0.8, 0);
        mesh.add(label);
      }
    }

    // Create grid helper if not already created (provides spatial reference for 3D)
    if (!this.gridHelper) {
      this.gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
      this.gridHelper.position.y = -20;
      this.scene.add(this.gridHelper);
    }

    // Toggle grid visibility based on layout mode
    const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;
    this.gridHelper.visible = shouldShowGrid(is2DLayout);
  }


  /**
   * Calculate bounding box of all nodes
   */
  private calculateBoundingBox(nodes: LayoutNode[]): THREE.Box3 {
    const box = new THREE.Box3();
    for (const node of nodes) {
      box.expandByPoint(node.position);
    }
    return box;
  }

  /**
   * Auto-frame camera to fit entire tree
   *
   * Calculates camera position to frame bounding box, then saves the position
   * to OrbitControls so mode switches return to correct orientation.
   */
  private autoFrameCamera(boundingBox: THREE.Box3) {
    console.log('[autoFrameCamera] ENTER - current camera:', this.camera.position.toArray());
    // Extract bounding box data
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    const bbox = {
      center: { x: center.x, y: center.y, z: center.z },
      size: { x: size.x, y: size.y, z: size.z }
    };

    // Get camera defaults from layout strategy
    const cameraDefaults = this.layoutStrategy.getCameraDefaults();

    // Calculate camera position using pure function
    const config = calculateFramingPosition(bbox, cameraDefaults, this.camera.fov);

    // Determine layout mode for configuration decisions
    const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;

    // Debug: Log camera state BEFORE any changes
    const beforeQuat = this.camera.quaternion.toArray();
    console.log('[autoFrameCamera] BEFORE changes:');
    console.log('  position:', this.camera.position.toArray());
    console.log('  up:', this.camera.up.toArray());
    console.log('  quaternion:', beforeQuat);
    console.log('  target:', this.controls.target.toArray());
    console.log('  is2D:', is2DLayout);

    // For 2D Force-Directed layouts, set up vector FIRST (before position)
    // This matches the sequence in setLayoutStrategy() which works correctly
    if (is2DLayout) {
      console.log('[autoFrameCamera] Setting overhead orientation for 2D mode');
      this.camera.up.set(0, 1, 0);
    }

    // Apply damping configuration
    this.controls.enableDamping = getDampingEnabled(is2DLayout);

    // Apply camera position with Z offset for 2D mode
    const zOffset = getCameraZOffset(is2DLayout);
    this.camera.position.set(config.position.x, config.position.y, config.position.z + zOffset);

    // Apply lookAt and controls target
    this.camera.lookAt(config.target.x, config.target.y, config.target.z);
    this.controls.target.copy(new THREE.Vector3(config.target.x, config.target.y, config.target.z));

    console.log('[autoFrameCamera] BEFORE controls.update():');
    console.log('  camera.position:', this.camera.position.toArray());
    console.log('  camera.quaternion:', this.camera.quaternion.toArray());
    console.log('  controls.target:', this.controls.target.toArray());
    // Access OrbitControls internals (these are private but we can log them for debugging)
    console.log('  controls object:', this.controls);

    this.controls.update();

    console.log('[autoFrameCamera] AFTER controls.update():');
    console.log('  camera.position:', this.camera.position.toArray());
    console.log('  camera.quaternion:', this.camera.quaternion.toArray());

    // Debug: Log camera state AFTER changes but BEFORE saveState
    const afterQuat = this.camera.quaternion.toArray();
    console.log('[autoFrameCamera] AFTER changes, BEFORE saveState:');
    console.log('  position:', this.camera.position.toArray());
    console.log('  up:', this.camera.up.toArray());
    console.log('  quaternion:', afterQuat);
    console.log('  target:', this.controls.target.toArray());
    console.log('  quaternion changed?',
      beforeQuat[0] !== afterQuat[0] ||
      beforeQuat[1] !== afterQuat[1] ||
      beforeQuat[2] !== afterQuat[2] ||
      beforeQuat[3] !== afterQuat[3]);

    // Save camera state so OrbitControls home position matches actual camera position
    // Fixes bug where switching repos/modes loses overhead orientation (2D mode)
    if (config.shouldSaveState) {
      console.log('[autoFrameCamera] Calling saveState()...');
      this.controls.saveState();

      console.log('[autoFrameCamera] AFTER saveState:');
      console.log('  camera.quaternion:', this.camera.quaternion.toArray());

      // For 2D layouts, reset controls to sync internal spherical coordinates
      // This prevents controls.update() from reverting camera to old position
      if (is2DLayout) {
        console.log('[autoFrameCamera] Calling reset() to sync OrbitControls internal state...');
        this.controls.reset();
        console.log('[autoFrameCamera] AFTER reset:');
        console.log('  camera.quaternion:', this.camera.quaternion.toArray());
        console.log('  camera.position:', this.camera.position.toArray());

        // Enable animation loop debugging to see what controls.update() does
        this.debugControlsUpdate = true;
        this.debugFrameCount = 0;
        console.log('[autoFrameCamera] Enabled animation loop debugging for next 5 frames');
      }

      // CRITICAL TEST: Monitor what happens to the camera in subsequent frames
      let frameCount = 0;
      const savedQuat = this.camera.quaternion.clone();
      const savedPos = this.camera.position.clone();

      const monitorCamera = () => {
        frameCount++;
        const currentQuat = this.camera.quaternion;
        const currentPos = this.camera.position;

        const quatChanged = !savedQuat.equals(currentQuat);
        const posChanged = !savedPos.equals(currentPos);

        if (quatChanged || posChanged) {
          console.log(`[FRAME ${frameCount}] CAMERA CHANGED!`);
          if (quatChanged) {
            console.log('  Quaternion:', currentQuat.toArray());
          }
          if (posChanged) {
            console.log('  Position:', currentPos.toArray());
          }
        }

        if (frameCount < 60) {
          requestAnimationFrame(monitorCamera);
        } else {
          console.log('[MONITOR COMPLETE] Checked 60 frames');
        }
      };

      requestAnimationFrame(monitorCamera);
    } else {
      console.log('[autoFrameCamera] NOT saving state (shouldSaveState=false)');
    }
  }

  /**
   * Visualize repository tree
   * @param resetCamera - Whether to auto-frame the camera (default: true)
   */
  visualize(tree: DirectoryNode, resetCamera: boolean = true) {
    // Store tree for re-layout when strategy changes
    this.currentTree = tree;

    // Clear any ghost files from previous commit (Timeline V2 deletions)
    this.ghostRenderer.clearGhosts(this.scene, this.fileObjects, this.edges, this.edgeNodeMap);

    // Reset state when loading new repository
    this.focusedDirectory = null;
    this.collapsedDirs.clear();
    this.selectedObject = null;
    this.hoveredObjects.clear();

    // Calculate max LOC for normalization
    const maxFileLoc = this.findMaxLoc(tree);
    const maxDirLoc = this.findMaxDirectoryLoc(tree);

    // Determine layout mode for positioning decisions
    const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;

    // Layout the tree
    // Force-Directed layout uses Y=0 (true flat 2D), others use Y=10 (hierarchical)
    const rootY = getRootYPosition(is2DLayout);
    const rootPosition = new THREE.Vector3(0, rootY, 0);
    this.layoutNodes = this.layoutStrategy.layoutTree(tree, rootPosition, 0, 0, Math.PI * 2);

    // Create visuals
    this.createVisuals(this.layoutNodes, maxFileLoc, maxDirLoc);

    // Update edge positions to match current node positions (for Force-Directed layout)
    if (is2DLayout) {
      this.updateEdgePositions();
    }

    // Auto-frame camera to show entire tree (only visible nodes)
    if (resetCamera) {
      const visibleNodes = this.layoutNodes.filter(ln => !this.isNodeHidden(ln));
      const boundingBox = this.calculateBoundingBox(visibleNodes);
      this.autoFrameCamera(boundingBox);
    }

    // Set controls target to root position (center of rotation)
    // Only reset target on initial load to preserve user's pan during timeline playback
    if (resetCamera) {
      this.controls.target.copy(rootPosition);

      // In 3D mode, update controls to sync camera with new target
      // In 2D mode, skip update to avoid recalculating camera orientation (preserves overhead view)
      if (!is2DLayout) {
        this.controls.update();
      }
    }
  }

  /**
   * Update tree incrementally for timeline mode (preserves physics state)
   * Only updates/adds/removes changed nodes instead of rebuilding entire scene
   * @param newTree - The new tree state
   * @param addedPaths - Paths of newly added files
   * @param modifiedPaths - Paths of modified files (already exist, just update metadata)
   * @param deletedPaths - Paths of deleted files
   */
  updateTreeIncremental(
    newTree: DirectoryNode,
    addedPaths: string[],
    modifiedPaths: string[],
    deletedPaths: string[]
  ) {
    // Store tree for re-layout when strategy changes
    this.currentTree = newTree;

    // Build a path-to-node map for quick lookup in the new tree
    const pathToNode = new Map<string, TreeNode>();
    const buildPathMap = (node: TreeNode, parentPath: string = '') => {
      const currentPath = node.type === 'file'
        ? (node as FileNode).path
        : parentPath ? `${parentPath}/${node.name}` : node.name;

      pathToNode.set(currentPath, node);

      if (node.type === 'directory') {
        for (const child of node.children) {
          buildPathMap(child, currentPath);
        }
      }
    };
    buildPathMap(newTree);

    // Calculate max LOC for normalization
    const maxFileLoc = this.findMaxLoc(newTree);

    // Determine layout mode for positioning decisions
    const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;

    // Step 1: Remove deleted nodes and their edges
    for (const deletedPath of deletedPaths) {
      // Find and remove the layout node
      const layoutNodeIndex = this.layoutNodes.findIndex(
        ln => ln.node.type === 'file' && (ln.node as FileNode).path === deletedPath
      );

      if (layoutNodeIndex !== -1) {
        const layoutNode = this.layoutNodes[layoutNodeIndex];

        // Remove mesh from scene
        if (layoutNode.mesh) {
          this.scene.remove(layoutNode.mesh);
          this.fileObjects.delete(layoutNode.mesh);
        }

        // Remove from layout strategy (for Force-Directed physics)
        if (this.layoutStrategy.removeNode) {
          this.layoutStrategy.removeNode(layoutNode);
        }

        // Remove from layout nodes array
        this.layoutNodes.splice(layoutNodeIndex, 1);

        // Remove edges connected to this node
        this.edges = this.edges.filter(edge => {
          const edgeInfo = this.edgeNodeMap.get(edge);
          if (edgeInfo &&
              (edgeInfo.child === layoutNode.node || edgeInfo.parent === layoutNode.node)) {
            this.scene.remove(edge);
            this.edgeNodeMap.delete(edge);
            return false;
          }
          return true;
        });
      }
    }

    // Step 2: Add new nodes
    for (const addedPath of addedPaths) {
      const node = pathToNode.get(addedPath);
      if (!node || node.type !== 'file') continue;

      const fileNode = node as FileNode;

      // Find parent layout node
      const parentDirPath = addedPath.substring(0, addedPath.lastIndexOf('/'));
      const parentLayoutNode = this.layoutNodes.find(
        ln => ln.node.type === 'directory' && this.getNodePath(ln.node) === parentDirPath
      );

      if (!parentLayoutNode) continue;

      // Create new layout node with position near parent (physics will adjust)
      const newLayoutNode: LayoutNode = {
        node: fileNode,
        position: parentLayoutNode.position.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 5,  // Random offset around parent
            0,
            (Math.random() - 0.5) * 5
          )
        ),
        parent: parentLayoutNode,
        depth: (parentLayoutNode.depth ?? 0) + 1,
        mesh: undefined
      };

      // Add to layout strategy's internal state (for Force-Directed physics)
      if (this.layoutStrategy.addNode) {
        this.layoutStrategy.addNode(newLayoutNode);
      }

      // Create visual mesh
      const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;
      const normalizedSize = calculateFileSize(fileNode.loc, maxFileLoc, is2DLayout, this.timelineMode);

      const colorInfo = getColorForFile(fileNode, this.colorMode);
      const color = parseInt(colorInfo.hex.replace('#', ''), 16);
      const emissiveIntensity = this.timelineMode !== 'off' ? 0.6 : 0.2;

      const geometry = new THREE.SphereGeometry(normalizedSize, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity,
        transparent: false,
        opacity: 1.0
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(newLayoutNode.position);

      this.scene.add(mesh);
      this.fileObjects.set(mesh, fileNode);
      newLayoutNode.mesh = mesh;

      // Add to layout nodes
      this.layoutNodes.push(newLayoutNode);

      // Create edge from parent to new node
      const edgeGeometry = new THREE.BufferGeometry().setFromPoints([
        parentLayoutNode.position,
        newLayoutNode.position
      ]);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0xaaaaaa,
        transparent: true,
        opacity: 0.8,
        linewidth: 3
      });
      const edge = new THREE.Line(edgeGeometry, edgeMaterial);
      this.scene.add(edge);
      this.edges.push(edge);
      this.edgeNodeMap.set(edge, { parent: parentLayoutNode.node, child: fileNode });

      // Add edge to layout strategy (for Force-Directed physics)
      if (this.layoutStrategy.addEdge) {
        this.layoutStrategy.addEdge(parentLayoutNode, newLayoutNode);
      }
    }

    // Step 3: Update modified nodes (just metadata, position stays the same)
    for (const modifiedPath of modifiedPaths) {
      const node = pathToNode.get(modifiedPath);
      if (!node || node.type !== 'file') continue;

      const fileNode = node as FileNode;
      const layoutNode = this.layoutNodes.find(
        ln => ln.node.type === 'file' && (ln.node as FileNode).path === modifiedPath
      );

      if (layoutNode && layoutNode.mesh) {
        // Update node reference to point to new tree's node (with updated metadata)
        layoutNode.node = fileNode;
        this.fileObjects.set(layoutNode.mesh, fileNode);

        // Update color if needed (some color modes depend on metadata like churn)
        const colorInfo = getColorForFile(fileNode, this.colorMode);
        const color = parseInt(colorInfo.hex.replace('#', ''), 16);
        const material = (layoutNode.mesh as THREE.Mesh).material as THREE.MeshPhongMaterial;
        material.color.setHex(color);
        material.emissive.setHex(color);
        material.needsUpdate = true;
      }
    }

    // Step 4: Refresh ALL remaining file entries to point to new tree's FileNode objects.
    // Trees are cloned per-commit, so unchanged files have NEW FileNode instances in the
    // new tree. Without this step, fileObjects entries for unchanged files reference stale
    // objects from the previous tree, causing highlighting mismatches when paths are compared.
    const processedPaths = new Set([...addedPaths, ...modifiedPaths, ...deletedPaths]);
    for (const [mesh, oldFileNode] of this.fileObjects.entries()) {
      if (processedPaths.has(oldFileNode.path)) continue;

      const newNode = pathToNode.get(oldFileNode.path);
      if (newNode && newNode.type === 'file') {
        const newFileNode = newNode as FileNode;
        this.fileObjects.set(mesh, newFileNode);

        // Update layoutNode reference too
        const layoutNode = this.layoutNodes.find(ln => ln.mesh === mesh);
        if (layoutNode) {
          layoutNode.node = newFileNode;
        }
      }
    }

    // Update edge positions (for Force-Directed layout)
    if (is2DLayout) {
      this.updateEdgePositions();
    }
  }

  /**
   * Get full path for a tree node (helper for incremental updates)
   */
  private getNodePath(node: TreeNode): string {
    if (node.type === 'file') {
      return (node as FileNode).path;
    }

    // For directories, build path from name hierarchy
    const parts: string[] = [];
    let current: TreeNode | undefined = node;

    while (current) {
      if (current.name) {
        parts.unshift(current.name);
      }

      // Find parent
      const layoutNode = this.layoutNodes.find(ln => ln.node === current);
      current = layoutNode?.parent?.node;
    }

    return parts.join('/');
  }

  /**
   * Find maximum file LOC in tree (for file normalization)
   */
  private findMaxLoc(node: TreeNode): number {
    if (node.type === 'file') {
      return node.loc;
    }

    let max = 0;
    for (const child of node.children) {
      max = Math.max(max, this.findMaxLoc(child));
    }
    return max;
  }

  /**
   * Find maximum directory LOC in tree (for directory normalization)
   */
  private findMaxDirectoryLoc(node: TreeNode): number {
    if (node.type === 'file') {
      return 0;
    }

    // Get stats for this directory
    let stats = this.dirStats.get(node);
    if (!stats) {
      stats = this.calculateDirectoryStats(node);
      this.dirStats.set(node, stats);
    }

    let max = stats.totalLoc;

    // Check all child directories
    for (const child of node.children) {
      if (child.type === 'directory') {
        max = Math.max(max, this.findMaxDirectoryLoc(child));
      }
    }

    return max;
  }

  /**
   * Handle window resize
   */
  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Get objects for raycasting (excludes directories in 2D mode)
   */
  private getRaycastObjects(): THREE.Object3D[] {
    const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;
    const dirObjectsArray = shouldHideDirectoryNodes(is2DLayout)
      ? []
      : Array.from(this.dirObjects.keys());
    return [...Array.from(this.fileObjects.keys()), ...dirObjectsArray];
  }

  /**
   * Handle mouse move for hover effects
   * Files: highlight file + all ancestors
   * Directories: highlight directory + all ancestors + all descendants
   */
  private onMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.getRaycastObjects());

    // Reset previously hovered objects
    for (const mesh of this.hoveredObjects) {
      if (mesh !== this.selectedObject) {
        const mat = (mesh as THREE.Mesh).material as THREE.MeshPhongMaterial;
        const fileNode = this.fileObjects.get(mesh);
        const dirNode = this.dirObjects.get(mesh);

        // Reset to default emissive intensity
        if (fileNode) {
          mat.emissiveIntensity = 0.2;
        } else if (dirNode) {
          mat.emissiveIntensity = 0.3;
        }

        // Hide label if in hover mode
        if (this.labelMode === 'hover' && dirNode) {
          const label = mesh.children.find(child => child instanceof CSS2DObject) as CSS2DObject | undefined;
          if (label && label.element instanceof HTMLDivElement) {
            label.element.style.visibility = 'hidden';
            label.element.style.display = 'none';
          }
        }
      }
    }
    this.hoveredObjects.clear();

    // Highlight hovered and trigger callback
    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const fileNode = this.fileObjects.get(mesh);
      const dirNode = this.dirObjects.get(mesh);
      const node = fileNode || dirNode;

      if (node) {
        // Find the layout node for this mesh
        const layoutNode = this.layoutNodes.find(ln => ln.mesh === mesh);

        if (layoutNode) {
          // Highlight ancestors (for both files and directories)
          let current: LayoutNode | undefined = layoutNode;
          while (current) {
            if (current.mesh && current.mesh !== this.selectedObject) {
              const mat = (current.mesh.material as THREE.MeshPhongMaterial);
              mat.emissiveIntensity = 0.6;
              this.hoveredObjects.add(current.mesh);

              // Show label if in hover mode
              if (this.labelMode === 'hover') {
                const label = current.mesh.children.find(child => child instanceof CSS2DObject) as CSS2DObject | undefined;
                if (label && label.element instanceof HTMLDivElement) {
                  label.element.style.visibility = 'visible';
                  label.element.style.display = 'block';
                }
              }
            }
            current = current.parent;
          }

          // If hovering a directory, also highlight all descendants
          if (dirNode) {
            this.highlightDescendants(layoutNode);
          }

          // Show cluster card if hovering a file in cluster mode
          if (fileNode && this.colorMode === 'cluster') {
            this.showClusterCard(fileNode, mesh);
          } else if (!this.isMouseOverClusterCard) {
            // Only hide if mouse is not over the card
            this.hideClusterCard();
          }
        }

        // Trigger hover callback
        if (this.onHover) {
          this.onHover(node, event);
        }
      }
    } else {
      // No hover - hide cluster card (unless mouse is over the card itself)
      if (!this.isMouseOverClusterCard) {
        this.hideClusterCard();
      }

      if (this.onHover) {
        this.onHover(null);
      }
    }
  }

  /**
   * Recursively highlight all descendants of a directory
   */
  private highlightDescendants(layoutNode: LayoutNode) {
    if (layoutNode.node.type === 'directory') {
      const dirNode = layoutNode.node;

      // Find all child layout nodes
      for (const child of dirNode.children) {
        const childLayout = this.layoutNodes.find(ln => ln.node === child);
        if (childLayout && childLayout.mesh && childLayout.mesh !== this.selectedObject) {
          const mat = (childLayout.mesh.material as THREE.MeshPhongMaterial);
          mat.emissiveIntensity = 0.6;
          this.hoveredObjects.add(childLayout.mesh);

          // Recursively highlight descendants
          if (child.type === 'directory') {
            this.highlightDescendants(childLayout);
          }
        }
      }
    }
  }

  /**
   * Handle click for selection
   * Directories: toggle focus (drill down/up)
   * Files: show details
   */
  private onClick(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.getRaycastObjects());

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const file = this.fileObjects.get(mesh);
      const dir = this.dirObjects.get(mesh);

      if (dir) {
        // Toggle focus: drill down into directory or back up to parent
        if (this.focusedDirectory === dir) {
          // Already focused - go back to parent or root view
          const layoutNode = this.layoutNodes.find(ln => ln.node === dir);
          if (layoutNode && layoutNode.parent && layoutNode.parent.node.type === 'directory') {
            this.focusedDirectory = layoutNode.parent.node;
          } else {
            // No parent directory, go to overview
            this.focusedDirectory = null;
          }
        } else {
          // Focus on this directory
          this.focusedDirectory = dir;
        }

        // Rebuild visualization with new focus
        this.rebuildVisualization();

        // Still call the callback
        if (this.onDirClick) {
          this.onDirClick(dir);
        }
      } else if (file) {
        // Deselect previous
        if (this.selectedObject) {
          const mat = (this.selectedObject as THREE.Mesh).material as THREE.MeshPhongMaterial;
          const prevFile = this.fileObjects.get(this.selectedObject);
          mat.emissiveIntensity = prevFile ? 0.2 : 0.3;
        }

        // Select new
        this.selectedObject = mesh;
        const mat = (mesh as THREE.Mesh).material as THREE.MeshPhongMaterial;
        mat.emissiveIntensity = 0.8;

        if (this.onFileClick) {
          this.onFileClick(file);
        }
      }
    }
  }

  /**
   * Rebuild visualization (used after collapse/expand or focus change)
   */
  private rebuildVisualization() {
    const maxFileLoc = this.findMaxLoc(this.layoutNodes[0].node);
    const maxDirLoc = this.findMaxDirectoryLoc(this.layoutNodes[0].node);
    this.createVisuals(this.layoutNodes, maxFileLoc, maxDirLoc);

    // Adjust camera limits and fog to match the actual scene extent so that
    // large repositories are not clipped at the hardcoded 150-unit default.
    const boundingBox = this.calculateBoundingBox(this.layoutNodes);
    const sphere = new THREE.Sphere();
    boundingBox.getBoundingSphere(sphere);
    const maxDistance = computeMaxDistance(sphere.radius);
    this.controls.maxDistance = maxDistance;

    const is2DLayout = this.layoutStrategy.needsContinuousUpdate?.() ?? false;
    if (shouldShowFog(is2DLayout) && this.scene.fog) {
      const bgColor = (this.scene.background as THREE.Color)?.getHex() ?? 0x1a1a1a;
      const { near, far } = computeFogRange(maxDistance);
      this.scene.fog = new THREE.Fog(bgColor, near, far);
    }
  }

  // Debug flag to log controls.update() behavior
  private debugControlsUpdate = false;
  private debugFrameCount = 0;

  /**
   * Animation loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    // Physics update (for force-directed layouts)
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1); // Cap at 100ms

      if (this.layoutStrategy.tick && this.layoutStrategy.needsContinuousUpdate?.()) {
        this.layoutStrategy.tick(dt);
        this.updateMeshPositions();
        this.updateEdgePositions();
      }
    }
    this.lastFrameTime = now;

    // Debug: Log what controls.update() does to the camera
    if (this.debugControlsUpdate && this.debugFrameCount < 5) {
      this.debugFrameCount++;
      const beforeQuat = this.camera.quaternion.clone();
      const beforePos = this.camera.position.clone();

      this.controls.update();

      const afterQuat = this.camera.quaternion;
      const afterPos = this.camera.position;

      if (!beforeQuat.equals(afterQuat) || !beforePos.equals(afterPos)) {
        console.log(`[ANIMATE FRAME ${this.debugFrameCount}] controls.update() CHANGED camera!`);
        console.log('  BEFORE: quat =', beforeQuat.toArray(), 'pos =', beforePos.toArray());
        console.log('  AFTER:  quat =', afterQuat.toArray(), 'pos =', afterPos.toArray());
        console.log('  controls.enableDamping =', this.controls.enableDamping);
        console.log('  controls.target =', this.controls.target.toArray());
      } else {
        console.log(`[ANIMATE FRAME ${this.debugFrameCount}] controls.update() did NOT change camera`);
      }
    } else {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  /**
   * Start animation
   */
  start() {
    this.animate();
  }

  /**
   * Update mesh positions from layout nodes (for physics simulation)
   */
  private updateMeshPositions(): void {
    for (const layoutNode of this.layoutNodes) {
      if (layoutNode.mesh) {
        layoutNode.mesh.position.copy(layoutNode.position);
      }
    }
  }

  /**
   * Update edge positions to follow moving nodes (for physics simulation)
   */
  private updateEdgePositions(): void {
    for (const edge of this.edges) {
      const edgeInfo = this.edgeNodeMap.get(edge);
      if (!edgeInfo) continue;

      const parentLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.parent);
      const childLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.child);

      if (parentLayout && childLayout) {
        // Update edge geometry with current positions
        const positions = edge.geometry.attributes.position as THREE.BufferAttribute;
        positions.setXYZ(0, parentLayout.position.x, parentLayout.position.y, parentLayout.position.z);
        positions.setXYZ(1, childLayout.position.x, childLayout.position.y, childLayout.position.z);
        positions.needsUpdate = true;
      }
    }
  }

  // ============================================================================
  // CLUSTER VISUALIZATION (3D Floating Card + Highlighting)
  // ============================================================================

  /**
   * Show cluster details card for a file (updates pre-created card, doesn't recreate)
   */
  showClusterCard(file: FileNode, mesh: THREE.Mesh) {
    console.log('[ClusterCard] showClusterCard called', {
      file: file.path,
      hasLoader: !!this.couplingLoader,
      isLoaded: this.couplingLoader?.isLoaded(),
      colorMode: this.colorMode,
      hasCard: !!this.clusterCard
    });

    if (!this.couplingLoader || !this.couplingLoader.isLoaded() || this.colorMode !== 'cluster' || !this.clusterCard) {
      console.log('[ClusterCard] Early return - conditions not met');
      return;
    }

    // Get cluster info
    const clusterId = this.couplingLoader.getClusterForFile(file.path);
    console.log('[ClusterCard] Cluster ID:', clusterId);
    if (clusterId === null) return;

    const clusters = this.couplingLoader.getClusters();
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return;

    // Get coupling edges for this file
    const allEdges = this.couplingLoader.getEdges(0.1);
    const fileEdges = allEdges.filter(
      edge => edge.fileA === file.path || edge.fileB === file.path
    );
    fileEdges.sort((a, b) => b.coupling - a.coupling);
    // Show all coupled files (removed limit, scrolling will handle long lists)

    // Build HTML content
    let cardHTML = `
      <h4>📊 Coupling Cluster</h4>
      <div class="cluster-name">${cluster.name} (${cluster.fileCount} files)</div>
    `;

    if (fileEdges.length > 0) {
      cardHTML += '<div class="file-list">';
      for (const edge of fileEdges) {
        const otherFile = edge.fileA === file.path ? edge.fileB : edge.fileA;
        const fileName = otherFile.split('/').pop() || otherFile;
        const couplingPercent = Math.round(edge.coupling * 100);
        cardHTML += `
          <div class="file-item">
            <span class="file-name" title="${otherFile}">${fileName}</span>
            <span class="coupling-strength">${couplingPercent}%</span>
          </div>
        `;
      }
      cardHTML += '</div>';
    }

    // Update card content (reuse existing element, don't recreate)
    this.clusterCard.element.innerHTML = cardHTML;

    // Position card relative to mesh
    // Left by 1.5x card width (~12 units), up by card height (~4 units)
    this.clusterCard.position.set(-12, 6, 0);
    this.clusterCard.visible = true;

    // Attach to mesh (like directory labels)
    mesh.add(this.clusterCard);

    // Enable pointer events on CSS2DRenderer to allow scrolling
    this.labelRenderer.domElement.style.pointerEvents = 'auto';

    console.log('[ClusterCard] Card attached to mesh, visible:', this.clusterCard.visible);

    // Highlight cluster members
    this.highlightedClusterFiles = new Set(cluster.files);
    this.highlightClusterMembers(file, fileEdges);
  }

  /**
   * Hide cluster card
   */
  hideClusterCard() {
    if (this.clusterCard) {
      // Detach from mesh if attached
      if (this.clusterCard.parent) {
        this.clusterCard.parent.remove(this.clusterCard);
      }
      this.clusterCard.visible = false;

      // Restore pointer-events: none on CSS2DRenderer to avoid blocking 3D interactions
      this.labelRenderer.domElement.style.pointerEvents = 'none';
    }
    this.highlightedClusterFiles.clear();
    this.clearClusterHighlighting();
  }

  /**
   * Highlight all members of the current cluster
   */
  private highlightClusterMembers(focusFile: FileNode, topEdges: CouplingEdge[]) {
    for (const [mesh, fileNode] of this.fileObjects.entries()) {
      if (this.highlightedClusterFiles.has(fileNode.path)) {
        const material = (mesh as THREE.Mesh).material as THREE.MeshPhongMaterial;
        material.emissiveIntensity = fileNode.path === focusFile.path ? 1.2 : 0.8;
        (mesh as THREE.Mesh).scale.set(1.2, 1.2, 1.2);
      }
    }

    // Highlight edges to top coupled files
    for (const edge of topEdges) {
      const otherFile = edge.fileA === focusFile.path ? edge.fileB : edge.fileA;
      for (const [_mesh, fileNode] of this.fileObjects.entries()) {
        if (fileNode.path === otherFile) {
          for (const line of this.edges) {
            const edgeInfo = this.edgeNodeMap.get(line);
            if (edgeInfo &&
                ((edgeInfo.child as FileNode).path === focusFile.path ||
                 (edgeInfo.child as FileNode).path === otherFile)) {
              const material = line.material as THREE.LineBasicMaterial;
              material.color.setHex(0x4a9eff);
              material.opacity = 0.8;
              material.linewidth = 2;
              line.visible = true;
            }
          }
          break;
        }
      }
    }
  }

  /**
   * Clear cluster member highlighting
   */
  private clearClusterHighlighting() {
    for (const [mesh, _fileNode] of this.fileObjects.entries()) {
      const material = (mesh as THREE.Mesh).material as THREE.MeshPhongMaterial;
      material.emissiveIntensity = this.timelineMode !== 'off' ? 0.6 : 0.2;
      (mesh as THREE.Mesh).scale.set(1, 1, 1);
    }

    for (const line of this.edges) {
      const edgeInfo = this.edgeNodeMap.get(line);
      if (!edgeInfo) continue;

      const parentLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.parent);
      const childLayout = this.layoutNodes.find(ln => ln.node === edgeInfo.child);
      const shouldBeHidden = !parentLayout || !childLayout ||
                            this.isNodeHidden(parentLayout) ||
                            this.isNodeHidden(childLayout);

      const material = line.material as THREE.LineBasicMaterial;
      material.color.setHex(0xaaaaaa);
      material.opacity = shouldBeHidden ? 0.0 : 0.3;
      material.linewidth = 1;
      line.visible = !shouldBeHidden;
      material.needsUpdate = true;
    }
  }

  // ============================================================================
  // GHOST RENDERING FOR TIMELINE V2 DELETIONS
  // Delegated to GhostRenderer module
  // ============================================================================

  /**
   * Public API: Render deleted files as ghosts (Timeline V2 only)
   * @param deletedPaths - Paths of files being deleted
   * @param prevTree - Previous tree state (where files still exist)
   */
  renderDeletedFiles(deletedPaths: string[], prevTree: DirectoryNode | null) {
    this.ghostRenderer.renderDeletedFiles(
      deletedPaths,
      prevTree,
      this.scene,
      this.fileObjects,
      this.dirObjects,
      this.edges,
      this.edgeNodeMap,
      this.timelineMode
    );
  }
}
