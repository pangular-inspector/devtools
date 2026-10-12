const PREF_KEY = 'pangular-pref';

/** The theme the viewer picked in Settings; `system` follows the hub or the system. */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * How the viewer arranged the tab bar in Settings. `order` lists tab ids in
 * the order they chose; tabs it doesn't name keep their default place after
 * the ones it does. Pinned tabs come first, and a pinned tab is never hidden.
 */
export interface TabLayout {
  order: string[];
  hidden: string[];
  pinned: string[];
}

export const DEFAULT_TAB_LAYOUT: TabLayout = { order: [], hidden: [], pinned: [] };

function read(name: string): string | null {
  try {
    return localStorage.getItem(`${PREF_KEY}:${name}`);
  } catch {
    return null;
  }
}

function write(name: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(`${PREF_KEY}:${name}`);
    else localStorage.setItem(`${PREF_KEY}:${name}`, value);
  } catch {
    // Blocked storage only forgets the preference on the next reload.
  }
}

export function storedThemePreference(): ThemePreference {
  const value = read('theme');
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function storeThemePreference(value: ThemePreference) {
  write('theme', value === 'system' ? null : value);
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 40,
  );
  return [...new Set(valid)].slice(0, 50);
}

export function storedTabLayout(): TabLayout {
  const raw = read('tabs');
  if (!raw) return DEFAULT_TAB_LAYOUT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_TAB_LAYOUT;
    // Anything in storage may be stale or hand edited, so each list is checked.
    const saved = parsed as Record<string, unknown>;
    return {
      order: ids(saved['order']),
      hidden: ids(saved['hidden']),
      pinned: ids(saved['pinned']),
    };
  } catch {
    return DEFAULT_TAB_LAYOUT;
  }
}

export function storeTabLayout(layout: TabLayout) {
  const empty = !layout.order.length && !layout.hidden.length && !layout.pinned.length;
  write('tabs', empty ? null : JSON.stringify(layout));
}

/** Passive mode, as the panel last set it. The popup on the page keeps its own copy. */
export function storedPassive(): boolean {
  return read('passive') === 'true';
}

export function storePassive(value: boolean) {
  write('passive', value ? 'true' : null);
}

/** `ids` in the viewer's order: pinned first, then the rest, each in `layout.order`. */
export function orderedTabIds(all: readonly string[], layout: TabLayout): string[] {
  const rank = (id: string) => {
    const index = layout.order.indexOf(id);
    return index < 0 ? layout.order.length + all.indexOf(id) : index;
  };
  const sorted = [...all].sort((a, b) => rank(a) - rank(b));
  const pinned = sorted.filter((id) => layout.pinned.includes(id));
  return [...pinned, ...sorted.filter((id) => !layout.pinned.includes(id))];
}

/**
 * The tabs of the bar in the viewer's order, without the hidden ones. `keep`
 * stays even when hidden, so the open tab is always in the bar.
 */
export function arrangeTabs<T extends { id: string }>(
  tabs: readonly T[],
  layout: TabLayout,
  keep?: string,
): T[] {
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  return orderedTabIds(
    tabs.map((tab) => tab.id),
    layout,
  )
    .filter((id) => id === keep || layout.pinned.includes(id) || !layout.hidden.includes(id))
    .map((id) => byId.get(id)!);
}

/**
 * Moves a tab one place up (`-1`) or down (`1`) among `all`, as Settings
 * shows them. A tab stays inside its section: pinned tabs move among the
 * pinned ones, the others among the others.
 */
export function moveTab(
  all: readonly string[],
  layout: TabLayout,
  id: string,
  delta: -1 | 1,
): TabLayout {
  const order = orderedTabIds(all, layout);
  const index = order.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return layout;
  const pinned = layout.pinned.includes(id);
  if (layout.pinned.includes(order[target]) !== pinned) return layout;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return { ...layout, order: next };
}

export function setTabHidden(layout: TabLayout, id: string, hidden: boolean): TabLayout {
  const rest = layout.hidden.filter((other) => other !== id);
  return {
    ...layout,
    hidden: hidden ? [...rest, id] : rest,
    pinned: hidden ? layout.pinned.filter((other) => other !== id) : layout.pinned,
  };
}

export function setTabPinned(
  all: readonly string[],
  layout: TabLayout,
  id: string,
  pinned: boolean,
): TabLayout {
  const rest = layout.pinned.filter((other) => other !== id);
  // Keep today's visible order, so pinning moves only the pinned tab.
  const order = orderedTabIds(all, layout);
  return {
    order,
    pinned: pinned ? [...rest, id] : rest,
    hidden: pinned ? layout.hidden.filter((other) => other !== id) : layout.hidden,
  };
}

/** Whether the viewer is on macOS or iOS, where `Mod` shortcuts use Cmd. */
export function isMacPlatform(): boolean {
  try {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform ?? nav.platform ?? '');
  } catch {
    return false;
  }
}

/**
 * Whether the panel runs in the popup on the app's page, which has dock
 * modes and passive mode. Only frames on the same origin can tell.
 */
export function inPopup(win: Window = window): boolean {
  try {
    for (let current = win; current !== current.parent; current = current.parent) {
      const root = current.frameElement?.getRootNode();
      if (root && 'host' in root && (root.host as Element | null)?.id === 'pangular-popup-root') {
        return true;
      }
    }
  } catch {
    // a frame on another origin; the popup can't be named
  }
  return false;
}
