import type { DevframeHubContext } from '@devframes/hub/node';
import type {
  DevframeDockBadgeVariant,
  DevframeViewGroup,
  DevframeViewIframe,
} from '@devframes/hub/types';
import { PANGULAR_LOGO_DATA_URI, PANGULAR_PRIMARY_COLOR } from './brand.ts';
import {
  HUB_ALL_TOOLS,
  HUB_VIEWS,
  hubDockId,
  resolvePangularConfig,
  type HubView,
  type PangularInspector,
  type ResolvedPangularConfig,
} from './config.ts';

export { HUB_VIEWS, type HubView };

const NGRX_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="#BA2BD2" d="M12.024.017V0L12 .008L11.976 0v.017L.812 3.892l1.605 14.875l9.559 5.207V24l.024-.013l.024.013v-.026l9.559-5.207l1.605-14.875zm6.868 14.244q-1.64 3.948-6.031 4.166c-2.829 0-4.661-1.7-4.66-1.7q-1.745-1.359-2.398-3.417c-.695-.76-.702-.841-.774-1.145c-.072-.303.045-.388.249-.685q.204-.298.098-.85q-.26-.36-.3-1.128q0-.37.496-.783q.495-.413.607-.632q.083-.119.065-1.031q-.006-.897.995-.975c1-.08 1.565-.832 1.879-1.174c.21-.228.52-.339.91-.341c.551-.026 1.052.185 1.484.62c1.075-.055 2.176.235 3.292.863q2.379 1.414 2.596 3.055q-.257 2.158-5.788-.113q-2.895.819-2.846 3.552q0 2.508 2.422 3.643c-.787-.772-1.122-1.422-1.01-1.959q2.456 2.906 5.588 2.173c-.92.032-1.65-.264-2.198-.893q2.116-.05 3.998-1.972c-.724.576-1.482.794-2.284.657q3.26-2.563 2.307-5.98l-.002-.006a3.02 3.02 0 0 1 .788 2.03q.023 1.175-.795 2.477q.613-.478 1.413-2.047c.23 2.117-.625 3.724-2.574 4.825q.934-.085 2.473-1.23m-5.567-6.63a.319.319 0 1 1 .638 0a.319.319 0 0 1-.638 0"/></svg>',
)}`;

const ANGULAR_NATIVE_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0224f"/><stop offset="1" stop-color="#c4002d"/></linearGradient></defs><path d="M16 0C27.2 0 32 4.8 32 16S27.2 32 16 32 0 27.2 0 16 4.8 0 16 0Z" fill="url(#f)"/><g transform="translate(6.4 6.4) scale(0.8)" fill="#fff"><path d="M14.8486 0L23.138 16.8551L23.9996 3.99892L14.8486 0Z"/><path d="M16.9875 17.7114H7.01272L5.73926 20.627L12.0001 24L18.261 20.627L16.9875 17.7114Z"/><path d="M8.72168 13.9298H15.2812L11.9997 6.39575L8.72168 13.9298Z"/><path d="M9.15103 0L0 3.99892L0.861556 16.8551L9.15103 0Z"/></g></svg>',
)}`;

const DOCKS: {
  view: HubView;
  title: string;
  icon: string;
  inspector?: PangularInspector;
}[] = [
  { view: 'angular', title: 'Angular', icon: 'logos:angular-icon' },
  { view: 'ngrx', title: 'NgRx', icon: NGRX_ICON, inspector: 'ngrx' },
  { view: 'analog', title: 'Analog', icon: 'logos:analog', inspector: 'analog' },
  {
    view: 'angular-native',
    title: 'Angular Native',
    icon: ANGULAR_NATIVE_ICON,
    inspector: 'components',
  },
  { view: 'nativescript', title: 'NativeScript', icon: 'logos:nativescript' },
  { view: 'capacitor', title: 'Capacitor', icon: 'logos:capacitorjs-icon', inspector: 'capacitor' },
];

export function dockId(view: HubView): string {
  return hubDockId(view);
}

/** The dock that opens the full panel, with every tab, instead of one view. */
export const ALL_TOOLS_DOCK_ID = hubDockId(HUB_ALL_TOOLS);

/** The dock group that holds every Pangular dock behind one rail button. */
export const PANGULAR_GROUP_ID = hubDockId('group');

/** A dock's count of unseen items; `undefined` clears it. */
export interface HubDockBadge {
  text: string;
  variant: DevframeDockBadgeVariant;
  /** The worst unseen item, which the title names: `with errors` or `with warnings`. */
  severity?: 'error' | 'warning';
}

/** The views whose dock says when the tool has nothing to show yet. */
export const STATUS_VIEWS = ['analog', 'angular-native', 'capacitor'] as const;
export type StatusView = (typeof STATUS_VIEWS)[number];

/** Why a dock opens its setup steps instead of data, shown as the dock title. */
export const UNAVAILABLE_TITLES: Record<StatusView, string> = {
  analog: 'Analog: not an Analog app',
  'angular-native': 'Angular Native: no app connected',
  capacitor: 'Capacitor: no app connected',
};

/** Whether each tool has something to show; a missing view counts as available. */
export type HubDockAvailability = Partial<Record<StatusView, boolean>>;

export interface HubDocks {
  /** The ids of the registered docks, in rail order. The group is not one of them. */
  ids: string[];
  /** The id of the group the docks belong to. */
  groupId: string;
  /**
   * Marks a tool's dock as having data or not. The hub re-sends every dock to
   * every client on an update, so this only updates when the state changes.
   */
  setAvailable: (view: StatusView, available: boolean) => void;
  /**
   * Sets or clears the badge of a dock or of the group. Only updates the hub
   * when the badge changes.
   */
  setBadge: (id: string, badge: HubDockBadge | undefined) => void;
}

function isHub(ctx: unknown): ctx is DevframeHubContext {
  return !!ctx && typeof ctx === 'object' && 'docks' in ctx && 'frames' in ctx;
}

function isStatusView(view: HubView): view is StatusView {
  return (STATUS_VIEWS as readonly string[]).includes(view);
}

function withStatus(
  entry: DevframeViewIframe,
  view: HubView,
  available: boolean,
): DevframeViewIframe {
  if (available || !isStatusView(view)) return entry;
  // The title only: a badge would cover the icon and read as a count.
  return { ...entry, title: UNAVAILABLE_TITLES[view] };
}

const SEVERITY_NOTES = { error: ', with errors', warning: ', with warnings' } as const;

/** The dock title with its badge, as `Angular (2 new, with errors)`. */
export function badgeTitle(title: string, badge: HubDockBadge): string {
  const note = badge.severity ? SEVERITY_NOTES[badge.severity] : '';
  return `${title} (${badge.text} new${note})`;
}

export function registerHubDocks(
  ctx: unknown,
  id: string,
  config: ResolvedPangularConfig = resolvePangularConfig(),
  initial: HubDockAvailability = {},
): HubDocks | undefined {
  if (!isHub(ctx)) return undefined;
  const base = ctx.frames.find((frame) => frame.id === id)?.base;
  if (!base) return undefined;
  // One rail button for every Pangular dock. Picking it opens the member
  // picked last, or All tools the first time.
  const group: DevframeViewGroup = {
    type: 'group',
    id: PANGULAR_GROUP_ID,
    title: 'Pangular',
    icon: PANGULAR_LOGO_DATA_URI,
    category: 'framework',
    defaultChildId: ALL_TOOLS_DOCK_ID,
    accentColor: PANGULAR_PRIMARY_COLOR,
  };
  ctx.docks.register(group);
  // Lower orders come first on the rail. The full panel shares the views'
  // frame, and the panel switches between them in place when a dock is picked.
  const allTools: DevframeViewIframe = {
    type: 'iframe',
    id: ALL_TOOLS_DOCK_ID,
    title: 'All tools',
    icon: PANGULAR_LOGO_DATA_URI,
    category: 'framework',
    defaultOrder: -1,
    url: base,
    frameId: 'pangular',
    groupId: group.id,
  };
  ctx.docks.register(allTools);
  const ids = [allTools.id];
  const plain = new Map<string, DevframeViewIframe | DevframeViewGroup>([
    [group.id, group],
    [allTools.id, allTools],
  ]);
  const views = new Map<string, HubView>();
  const available = new Map<StatusView, boolean>();
  const badges = new Map<string, HubDockBadge>();
  const render = (entryId: string) => {
    const entry = plain.get(entryId)!;
    const badge = badges.get(entryId);
    const view = views.get(entryId);
    const shown =
      view && entry.type === 'iframe' && isStatusView(view)
        ? withStatus(entry, view, available.get(view) ?? true)
        : entry;
    if (!badge) return shown;
    // The hub labels the button with the title alone, so the count goes there
    // too for screen readers.
    return {
      ...shown,
      title: badgeTitle(shown.title, badge),
      badge: badge.text,
      badgeVariant: badge.variant,
    };
  };
  DOCKS.forEach((dock, index) => {
    if (dock.inspector && !config.inspectors[dock.inspector]) return;
    const entry: DevframeViewIframe = {
      type: 'iframe',
      id: dockId(dock.view),
      title: dock.title,
      icon: dock.icon,
      category: 'framework',
      defaultOrder: index,
      url: `${base}?view=${dock.view}`,
      frameId: 'pangular',
      groupId: group.id,
    };
    plain.set(entry.id, entry);
    views.set(entry.id, dock.view);
    if (isStatusView(dock.view)) available.set(dock.view, initial[dock.view] ?? true);
    ctx.docks.register(render(entry.id));
    ids.push(entry.id);
  });
  return {
    ids,
    groupId: group.id,
    setAvailable: (view, has) => {
      if (!available.has(view) || available.get(view) === has) return;
      available.set(view, has);
      // A whole entry, so the plain title replaces the explaining one.
      ctx.docks.update(render(dockId(view)));
    },
    setBadge: (entryId, badge) => {
      if (!plain.has(entryId)) return;
      const current = badges.get(entryId);
      if (
        current?.text === badge?.text &&
        current?.variant === badge?.variant &&
        current?.severity === badge?.severity
      ) {
        return;
      }
      if (badge) badges.set(entryId, badge);
      else badges.delete(entryId);
      ctx.docks.update(render(entryId));
    },
  };
}
