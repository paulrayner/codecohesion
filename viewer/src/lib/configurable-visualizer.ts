import { ILayoutStrategy } from '../ILayoutStrategy';
import { CouplingLoader } from '../couplingLoader';
import { FileNode, DirectoryNode, TreeNode } from '../types';
import { ColorMode } from '../colorModeManager';

/**
 * Minimal interface for a visualizer that can be configured via applyVisualizerConfig.
 *
 * Defined in lib/ to avoid importing the concrete TreeVisualizer god object.
 * TreeVisualizer implements this interface implicitly (structural typing).
 */
export interface IConfigurableVisualizer {
  setTheme(theme: 'light' | 'dark'): void;
  setCouplingLoader(loader: CouplingLoader | null): void;
  setOnFileClick(handler: (file: FileNode) => void): void;
  setOnDirClick(handler: (dir: DirectoryNode) => void): void;
  setOnHover(handler: (node: TreeNode | null, event?: MouseEvent) => void): void;
  setLabelMode(mode: 'always' | 'hover'): void;
  setColorMode(mode: ColorMode): void;
  setViewMode(mode: 'navigate' | 'overview'): void;
  setLayoutStrategy(strategy: ILayoutStrategy): void;
}
