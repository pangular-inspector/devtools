import {
  PANEL_LINK_ITEMS,
  enabledPanelTabs,
  panelLinkHash,
  type PanelLink,
  type PanelTab,
  type ResolvedPangularConfig,
} from '../config.ts';
import { refusal } from './refusal.ts';

/** The broadcast that asks connected panels to open a link, without the `pangular:` prefix. */
export const OPEN_IN_PANEL_EVENT = 'open-in-panel';

export const OPEN_IN_PANEL_DESCRIPTION =
  'Gives the user a link that opens the devtools panel on one tab, optionally with one item selected, and switches open panels to it. `tab`: dashboard, components, routes, signals, injectors, store, queries, forms, pipes, network, errors, audit, analog or capacitor. `id` selects a component instance (components), the component whose injector to show (injectors) or a form id (forms). Pass `page` when more than one tab reports. Returns a markdown link: a full URL in hub mode, otherwise a hash.';

export interface OpenInPanelArgs {
  tab?: unknown;
  id?: unknown;
  page?: unknown;
}

export interface OpenInPanelContext {
  config: ResolvedPangularConfig;
  /** Where the hub serves the panel, such as `/__devframes/pangular/`; unknown without a hub. */
  panelBase?: string;
  /** The address of the page the link is for, or of the newest page, to take the origin from. */
  pageUrl?: string;
  /** The page ids that report now. */
  pages: string[];
}

export interface OpenInPanelResult {
  markdown: string;
  /** What the panels are asked to open, when the arguments are valid. */
  link?: PanelLink;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 200 ? trimmed : undefined;
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const origin = new URL(url).origin;
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}

/** Builds the `open-in-panel` answer and the link the panels should open. */
export function openInPanel(args: OpenInPanelArgs, context: OpenInPanelContext): OpenInPanelResult {
  const tabs = enabledPanelTabs(context.config);
  const tab = tabs.find((candidate) => candidate.id === args?.tab);
  if (!tab) {
    const known = tabs.map((candidate) => `\`${candidate.id}\``).join(', ');
    const asked = typeof args?.tab === 'string' && args.tab.trim() ? args.tab.slice(0, 40) : '';
    return {
      markdown: refusal(
        asked
          ? `There is no panel tab \`${asked}\`, or its inspector is turned off. Pass one of: ${known}.`
          : `Pass \`tab\`, the panel tab to open: one of ${known}.`,
      ),
    };
  }
  const id = text(args?.id);
  const page = text(args?.page);
  const selects = id !== undefined && PANEL_LINK_ITEMS[tab.id as PanelTab] !== undefined;
  const link: PanelLink = {
    tab: tab.id,
    ...(selects ? { id } : {}),
    ...(page ? { page } : {}),
  };
  const hash = panelLinkHash(link);
  const origin = originOf(context.pageUrl);
  const url = context.panelBase && origin ? `${origin}${context.panelBase}${hash}` : undefined;

  const lines = [`## Open in the panel: ${tab.label}`, ''];
  lines.push(url ? `[Open ${tab.label} in the panel](${url})` : `Panel hash: \`${hash}\``);
  if (!url) {
    lines.push(
      '',
      context.panelBase
        ? `Add the hash to the panel's address, such as \`${context.panelBase}${hash}\` on the app's server.`
        : "Add the hash to the panel's address.",
    );
  }
  lines.push('');
  if (selects) lines.push(`It selects ${PANEL_LINK_ITEMS[tab.id as PanelTab]}: \`${id}\`.`);
  else if (id)
    lines.push(`The ${tab.label} tab has no item selection, so the link opens the tab only.`);
  if (page && !context.pages.includes(page)) {
    lines.push(
      `No page with id \`${page}\` reports now. The panel selects the item once that page reports. See list-pages.`,
    );
  }
  lines.push('Open panels were asked to switch to it.');
  return { markdown: lines.join('\n'), link };
}
