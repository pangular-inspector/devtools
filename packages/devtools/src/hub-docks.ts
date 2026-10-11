import type { DevframeHubContext } from '@devframes/hub/node';
import type { DevframeViewIframe } from '@devframes/hub/types';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import {
  resolvePangularConfig,
  type PangularInspector,
  type ResolvedPangularConfig,
} from './config.ts';

export const HUB_VIEWS = [
  'angular',
  'ngrx',
  'analog',
  'angular-native',
  'nativescript',
  'capacitor',
] as const;
export type HubView = (typeof HUB_VIEWS)[number];

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
  return `pangular:${view}`;
}

/** The dock that opens the full panel, with every tab, instead of one view. */
export const ALL_TOOLS_DOCK_ID = 'pangular:all';

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
  /** The ids of the registered docks, in rail order. */
  ids: string[];
  /**
   * Marks a tool's dock as having data or not. The hub re-sends every dock to
   * every client on an update, so this only updates when the state changes.
   */
  setAvailable: (view: StatusView, available: boolean) => void;
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
  // The title only: the hub fades a badge with its button, so a badge would
  // fail the contrast check and cover the icon.
  return { ...entry, title: UNAVAILABLE_TITLES[view] };
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
  };
  ctx.docks.register(allTools);
  const ids = [allTools.id];
  const plain = new Map<StatusView, DevframeViewIframe>();
  const available = new Map<StatusView, boolean>();
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
    };
    if (isStatusView(dock.view)) {
      const has = initial[dock.view] ?? true;
      plain.set(dock.view, entry);
      available.set(dock.view, has);
      ctx.docks.register(withStatus(entry, dock.view, has));
    } else {
      ctx.docks.register(entry);
    }
    ids.push(entry.id);
  });
  return {
    ids,
    setAvailable: (view, has) => {
      const entry = plain.get(view);
      if (!entry || available.get(view) === has) return;
      available.set(view, has);
      // A whole entry, so the plain title replaces the explaining one.
      ctx.docks.update(withStatus(entry, view, has));
    },
  };
}
