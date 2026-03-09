import { IConfigurableVisualizer } from './configurable-visualizer';
import { CouplingLoader } from '../couplingLoader';
import { VisualizerConfiguration } from './visualizer-config';
import { FileNode, DirectoryNode, TreeNode } from '../types';
import { ColorMode } from '../colorModeManager';

/**
 * Event handlers for visualizer interactions
 */
export interface VisualizerEventHandlers {
  onFileClick: (file: FileNode) => void;
  onDirClick: (dir: DirectoryNode) => void;
  onHover: (node: TreeNode | null, event?: MouseEvent) => void;
}

/**
 * Apply configuration to a visualizer instance
 *
 * Thin adapter layer that bridges the pure configuration object
 * with the imperative visualizer API
 *
 * @param visualizer - Visualizer instance to configure
 * @param config - Configuration object with settings
 * @param couplingLoader - Optional coupling loader
 * @param handlers - Event handlers
 */
export function applyVisualizerConfig(
  visualizer: IConfigurableVisualizer,
  config: VisualizerConfiguration,
  couplingLoader: CouplingLoader | null,
  handlers: VisualizerEventHandlers
): void {
  // Apply theme
  visualizer.setTheme(config.theme);

  // Set coupling loader
  visualizer.setCouplingLoader(couplingLoader);

  // Wire up event handlers
  visualizer.setOnFileClick(handlers.onFileClick);
  visualizer.setOnDirClick(handlers.onDirClick);
  visualizer.setOnHover(handlers.onHover);

  // Apply optional settings (only if set)
  if (config.labelMode) {
    visualizer.setLabelMode(config.labelMode);
  }

  if (config.colorMode) {
    visualizer.setColorMode(config.colorMode as ColorMode);
  }

  if (config.viewMode) {
    console.log('🔧 Initializing view mode from localStorage:', config.viewMode);
    visualizer.setViewMode(config.viewMode);
  }

  // Apply layout strategy
  console.log('🔧 Initializing layout strategy');
  visualizer.setLayoutStrategy(config.layoutStrategy);
}
