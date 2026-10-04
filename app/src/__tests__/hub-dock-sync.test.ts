import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { followHubDocks, selectHubDock } from '../hub-dock-sync';

const KEY = '__DEVFRAME_HUB_CLIENT_CONTEXT__';

function fakeHub(selectedId: string | null = null) {
  const listeners = new Map<string, () => void>();
  const offs: string[] = [];
  const docks = {
    selectedId,
    getStateById: (id: string) =>
      id === 'pangular:missing'
        ? undefined
        : {
            events: {
              on: (_event: 'entry:activated', listener: () => void) => {
                listeners.set(id, listener);
                return () => offs.push(id);
              },
            },
          },
    switchEntry: vi.fn(async (_id?: string | null) => true),
  };
  return { docks, listeners, offs };
}

describe('hub dock sync', () => {
  let parent: Record<string, unknown>;

  beforeEach(() => {
    parent = {};
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports the dock the hub already has selected', () => {
    parent[KEY] = fakeHub('pangular:ngrx');
    const onView = vi.fn();
    followHubDocks(['angular', 'ngrx'], onView);
    expect(onView).toHaveBeenCalledOnce();
    expect(onView).toHaveBeenCalledWith('ngrx');
  });

  it('ignores a selected dock that belongs to another tool', () => {
    parent[KEY] = fakeHub('vite:inspect');
    const onView = vi.fn();
    followHubDocks(['angular', 'ngrx'], onView);
    expect(onView).not.toHaveBeenCalled();
  });

  it('follows dock activations and stops on cleanup', () => {
    const hub = fakeHub();
    parent[KEY] = hub;
    const onView = vi.fn();
    const stop = followHubDocks(['angular', 'ngrx', 'missing'], onView);
    hub.listeners.get('pangular:ngrx')?.();
    hub.listeners.get('pangular:angular')?.();
    expect(onView.mock.calls).toEqual([['ngrx'], ['angular']]);
    stop();
    expect(hub.offs).toEqual(['pangular:angular', 'pangular:ngrx']);
  });

  it('waits for the hub context to appear', () => {
    vi.useFakeTimers();
    const onView = vi.fn();
    followHubDocks(['angular'], onView);
    parent[KEY] = fakeHub('pangular:angular');
    vi.advanceTimersByTime(100);
    expect(onView).toHaveBeenCalledWith('angular');
  });

  it('stops retrying once cleaned up', () => {
    vi.useFakeTimers();
    const onView = vi.fn();
    const stop = followHubDocks(['angular'], onView);
    stop();
    parent[KEY] = fakeHub('pangular:angular');
    vi.advanceTimersByTime(1000);
    expect(onView).not.toHaveBeenCalled();
  });

  it('does nothing outside a frame', async () => {
    vi.spyOn(window, 'parent', 'get').mockReturnValue(window);
    const onView = vi.fn();
    expect(() => followHubDocks(['angular'], onView)()).not.toThrow();
    expect(await selectHubDock('angular')).toBe(false);
  });

  it('switches the hub to the matching dock', async () => {
    const hub = fakeHub();
    parent[KEY] = hub;
    expect(await selectHubDock('ngrx')).toBe(true);
    expect(hub.docks.switchEntry).toHaveBeenCalledWith('pangular:ngrx');
  });

  it('reports failure when the hub rejects the switch', async () => {
    const hub = fakeHub();
    hub.docks.switchEntry.mockRejectedValueOnce(new Error('gone'));
    parent[KEY] = hub;
    expect(await selectHubDock('ngrx')).toBe(false);
  });

  it('reports failure without a hub context', async () => {
    expect(await selectHubDock('ngrx')).toBe(false);
  });
});
