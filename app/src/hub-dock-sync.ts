const CLIENT_CONTEXT_KEY = '__DEVFRAME_HUB_CLIENT_CONTEXT__';
const DOCK_PREFIX = 'pangular:';

interface DockState {
  events: { on: (event: 'entry:activated', listener: () => void) => () => void };
}

interface HubClientContext {
  docks: {
    selectedId: string | null;
    getStateById: (id: string) => DockState | undefined;
    switchEntry: (id?: string | null) => Promise<boolean>;
  };
}

function hubContext(): HubClientContext | undefined {
  try {
    if (window.parent === window) return undefined;
    return (window.parent as unknown as Record<string, HubClientContext | undefined>)[
      CLIENT_CONTEXT_KEY
    ];
  } catch {
    return undefined;
  }
}

export function followHubDocks<T extends string>(
  views: readonly T[],
  onView: (view: T) => void,
  attempts = 50,
): () => void {
  const ctx = hubContext();
  if (!ctx) {
    if (attempts <= 0 || window.parent === window) return () => {};
    let stop = () => {};
    const timer = setTimeout(() => (stop = followHubDocks(views, onView, attempts - 1)), 100);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }
  const offs = views.map(
    (view) =>
      ctx.docks
        .getStateById(DOCK_PREFIX + view)
        ?.events.on('entry:activated', () => onView(view)) ?? (() => {}),
  );
  const selected = ctx.docks.selectedId;
  const current = views.find((view) => DOCK_PREFIX + view === selected);
  if (current) onView(current);
  return () => offs.forEach((off) => off());
}

export async function selectHubDock(view: string): Promise<boolean> {
  const ctx = hubContext();
  if (!ctx) return false;
  try {
    return await ctx.docks.switchEntry(DOCK_PREFIX + view);
  } catch {
    return false;
  }
}
