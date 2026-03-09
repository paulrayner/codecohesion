import type { TreeVisualizer } from '../TreeVisualizer';
import type { RepositorySnapshot, FileNode, DirectoryNode, TimelineData } from '../types';
import type { DeltaReplayController } from '../DeltaReplayController';
import type { ColorMode } from '../colorModeManager';

export interface VisualizerState {
  currentVisualizer: TreeVisualizer | null;
  currentSnapshot: RepositorySnapshot | null;
  currentTimelineData: TimelineData | null;
  currentDeltaController: DeltaReplayController | null;
}

export interface SelectionState {
  lastClickedFile: FileNode | null;
  lastClickedDir: DirectoryNode | null;
  highlightCommitEnabled: boolean;
  currentHighlightedCommit: string | null;
  commitToFilesIndex: Map<string, FileNode[]>;
  pathToFileIndex: Map<string, FileNode>;
}

export interface RepoState {
  currentRepoBaseName: string;
  timelineAvailable: boolean;
}

export interface TimelineV1State {
  index: number;
  playing: boolean;
  intervalId: number | null;
  speed: number;
}

export interface TimelineModeState {
  savedColorModeBeforeTimeline: ColorMode | null;
  originalColorModeOptionText: Map<string, string>;
}

export interface AppState {
  visualizer: VisualizerState;
  selection: SelectionState;
  repo: RepoState;
  timelineV1: TimelineV1State;
  timelineMode: TimelineModeState;
}

export function createAppState(): AppState {
  return {
    visualizer: {
      currentVisualizer: null,
      currentSnapshot: null,
      currentTimelineData: null,
      currentDeltaController: null,
    },
    selection: {
      lastClickedFile: null,
      lastClickedDir: null,
      highlightCommitEnabled: true,
      currentHighlightedCommit: null,
      commitToFilesIndex: new Map(),
      pathToFileIndex: new Map(),
    },
    repo: {
      currentRepoBaseName: '',
      timelineAvailable: false,
    },
    timelineV1: {
      index: 0,
      playing: false,
      intervalId: null,
      speed: 1,
    },
    timelineMode: {
      savedColorModeBeforeTimeline: null,
      originalColorModeOptionText: new Map(),
    },
  };
}
