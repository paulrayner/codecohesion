import { RepositorySnapshot, DirectoryNode, FileNode, TreeNode, CommitSnapshot } from '../types';
import { ColorMode } from '../colorModeManager';

/**
 * Discriminated union of all application-level events.
 *
 * Each variant carries only the payload relevant to that event type,
 * keeping subscribers from receiving unrelated data and allowing the
 * TypeScript compiler to narrow the payload type inside callbacks.
 */
export type AppEvent =
  | { type: 'repo:loaded'; repoName: string; snapshot: RepositorySnapshot }
  | { type: 'repo:loading'; repoName: string }
  | { type: 'tree:updated'; tree: DirectoryNode; commitIndex: number; totalCommits: number }
  | { type: 'filter:changed' }
  | { type: 'colorMode:changed'; mode: ColorMode }
  | { type: 'highlight:commit'; commitHash: string | null }
  | { type: 'node:clicked:file'; file: FileNode }
  | { type: 'node:clicked:dir'; dir: DirectoryNode }
  | { type: 'node:hovered'; node: TreeNode | null }
  | { type: 'timeline:modeEnabled' }
  | { type: 'timeline:modeDisabled' }
  | { type: 'timeline:commitChanged'; index: number; commit: CommitSnapshot; tree: DirectoryNode }
  | { type: 'coupling:loaded'; hasData: boolean };

type EventListener = (event: AppEvent) => void;

/**
 * Typed publish/subscribe event bus for coordinating loosely-coupled
 * application modules.
 *
 * Subscribers receive a narrowed payload via the `Extract` utility type,
 * so a listener registered for 'repo:loaded' sees only
 * `{ type: 'repo:loaded'; repoName: string; snapshot: RepositorySnapshot }`.
 *
 * Error isolation: a throwing listener does not prevent subsequent
 * listeners for the same event from running.
 */
export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();

  /**
   * Subscribe to a specific event type.
   *
   * @param eventType - The event type string to listen for.
   * @param callback  - Called with the narrowed event payload when the event fires.
   * @returns An unsubscribe function; call it to remove this listener.
   */
  on<T extends AppEvent['type']>(
    eventType: T,
    callback: (event: Extract<AppEvent, { type: T }>) => void
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    // Cast is safe: the callback's narrowed type is a subtype of EventListener.
    const cb = callback as EventListener;
    this.listeners.get(eventType)!.push(cb);

    return (): void => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(cb);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit an event to all registered listeners for that event type.
   *
   * Listeners are invoked in registration order. A listener that throws
   * is logged to `console.error` and execution continues with the next
   * listener, so one bad subscriber cannot silence others.
   */
  emit(event: AppEvent): void {
    const callbacks = this.listeners.get(event.type) ?? [];
    for (const cb of callbacks) {
      try {
        cb(event);
      } catch (error) {
        console.error(`Error in event listener for '${event.type}':`, error);
      }
    }
  }
}
