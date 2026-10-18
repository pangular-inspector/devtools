import { hubDockId } from '@pangular-inspector/devtools/internal/config';

const CLIENT_CONTEXT_KEY = '__DEVFRAME_HUB_CLIENT_CONTEXT__';

interface DockState {
  events: { on: (event: 'entry:activated', listener: () => void) => () => void };
}

interface HubClientContext {
  commands?: { openPalette?: (scopeId?: string | null) => void };
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
      ctx.docks.getStateById(hubDockId(view))?.events.on('entry:activated', () => onView(view)) ??
      (() => {}),
  );
  const selected = ctx.docks.selectedId;
  const current = views.find((view) => hubDockId(view) === selected);
  if (current) onView(current);
  return () => offs.forEach((off) => off());
}

/** Whether the panel runs inside the hub, which can switch its docks. */
export function inHub(): boolean {
  return !!hubContext();
}

export async function selectHubDock(view: string): Promise<boolean> {
  const ctx = hubContext();
  if (!ctx) return false;
  try {
    return await ctx.docks.switchEntry(hubDockId(view));
  } catch {
    return false;
  }
}

/**
 * Opens the hub's command palette, which lists the panel's commands through
 * `ctx.commands`. `false` outside the hub or when the hub has no palette.
 */
export function openHubPalette(): boolean {
  const open = hubContext()?.commands?.openPalette;
  if (typeof open !== 'function') return false;
  try {
    open();
    return true;
  } catch {
    return false;
  }
}
