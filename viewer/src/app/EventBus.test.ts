import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, AppEvent } from './EventBus';

// Minimal mock snapshot — tests only care about the shape, not the values.
const mockSnapshot = {
  tree: { path: '/', name: 'root', type: 'directory', children: [] },
} as unknown as import('../types').RepositorySnapshot;

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('on / emit', () => {
    it('delivers the emitted event to a registered listener', () => {
      const listener = vi.fn();
      bus.on('repo:loaded', listener);

      const event: AppEvent = { type: 'repo:loaded', repoName: 'my-repo', snapshot: mockSnapshot };
      bus.emit(event);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('passes the full typed payload to the callback', () => {
      let received: { repoName: string } | undefined;
      bus.on('repo:loaded', (event) => {
        received = { repoName: event.repoName };
      });

      bus.emit({ type: 'repo:loaded', repoName: 'acme', snapshot: mockSnapshot });

      expect(received).toEqual({ repoName: 'acme' });
    });
  });

  describe('unsubscribe', () => {
    it('stops delivering events after the returned unsubscribe fn is called', () => {
      const listener = vi.fn();
      const unsubscribe = bus.on('filter:changed', listener);

      bus.emit({ type: 'filter:changed' });
      expect(listener).toHaveBeenCalledOnce();

      unsubscribe();

      bus.emit({ type: 'filter:changed' });
      // Still only one call — the second emit should have been ignored.
      expect(listener).toHaveBeenCalledOnce();
    });

    it('is safe to call the unsubscribe fn more than once', () => {
      const listener = vi.fn();
      const unsubscribe = bus.on('filter:changed', listener);

      unsubscribe();
      // Calling a second time must not throw.
      expect(() => unsubscribe()).not.toThrow();

      bus.emit({ type: 'filter:changed' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('error isolation', () => {
    it('logs a thrown listener error and continues invoking subsequent listeners', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const throwingListener = vi.fn(() => {
        throw new Error('listener failure');
      });
      const safeListener = vi.fn();

      bus.on('filter:changed', throwingListener);
      bus.on('filter:changed', safeListener);

      bus.emit({ type: 'filter:changed' });

      // The safe listener must still have been called.
      expect(safeListener).toHaveBeenCalledOnce();

      // The error must have been logged with the event type in the message.
      expect(errorSpy).toHaveBeenCalledOnce();
      expect(errorSpy.mock.calls[0][0]).toContain("filter:changed");

      errorSpy.mockRestore();
    });
  });

  describe('type filtering', () => {
    it('does not invoke a listener registered for a different event type', () => {
      const repoListener = vi.fn();
      bus.on('repo:loaded', repoListener);

      // Emit a completely different event type.
      bus.emit({ type: 'filter:changed' });

      expect(repoListener).not.toHaveBeenCalled();
    });

    it('does not fire repo:loading listeners when repo:loaded is emitted', () => {
      const loadingListener = vi.fn();
      const loadedListener = vi.fn();

      bus.on('repo:loading', loadingListener);
      bus.on('repo:loaded', loadedListener);

      bus.emit({ type: 'repo:loaded', repoName: 'test', snapshot: mockSnapshot });

      expect(loadedListener).toHaveBeenCalledOnce();
      expect(loadingListener).not.toHaveBeenCalled();
    });
  });

  describe('multiple listeners', () => {
    it('invokes all listeners registered for the same event type', () => {
      const firstListener = vi.fn();
      const secondListener = vi.fn();
      const thirdListener = vi.fn();

      bus.on('colorMode:changed', firstListener);
      bus.on('colorMode:changed', secondListener);
      bus.on('colorMode:changed', thirdListener);

      bus.emit({ type: 'colorMode:changed', mode: 'fileType' });

      expect(firstListener).toHaveBeenCalledOnce();
      expect(secondListener).toHaveBeenCalledOnce();
      expect(thirdListener).toHaveBeenCalledOnce();
    });

    it('invokes listeners in the order they were registered', () => {
      const callOrder: number[] = [];

      bus.on('filter:changed', () => callOrder.push(1));
      bus.on('filter:changed', () => callOrder.push(2));
      bus.on('filter:changed', () => callOrder.push(3));

      bus.emit({ type: 'filter:changed' });

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('only removes the specific listener when unsubscribing, leaving others intact', () => {
      const keepListener = vi.fn();
      const removeListener = vi.fn();

      bus.on('filter:changed', keepListener);
      const unsubscribe = bus.on('filter:changed', removeListener);

      unsubscribe();
      bus.emit({ type: 'filter:changed' });

      expect(keepListener).toHaveBeenCalledOnce();
      expect(removeListener).not.toHaveBeenCalled();
    });
  });
});
