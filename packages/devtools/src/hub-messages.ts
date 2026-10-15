import type {
  DevframeMessageEntryInput,
  DevframeMessageLevel,
  DevframeMessagesHost,
} from '@devframes/hub/types';
import {
  agentAllowed,
  agentInspector,
  agentSafety,
  type AgentSafety,
  type PangularInspector,
  type ResolvedPangularConfig,
} from './config.ts';
import { ALL_TOOLS_DOCK_ID, dockId, type HubDockBadge, type HubDocks } from './hub-docks.ts';
import { redactText } from './serialize.ts';
import { clip } from './text.ts';
import type { HydrationStats } from './types.ts';

/** The kinds of item the feed posts, as the message `category`. */
/** Whether a `change-detection` call changes the page rather than only reading it. */
function cdWrites(args: unknown): boolean {
  const call = (args ?? {}) as Record<string, unknown>;
  return (
    typeof call['record'] === 'string' ||
    typeof call['flash'] === 'boolean' ||
    typeof call['track'] === 'boolean' ||
    call['angularProfiling'] === true
  );
}

export const HUB_MESSAGE_CATEGORIES = {
  agent: 'agent',
  error: 'runtime',
  hydration: 'hydration',
} as const;

/** A page stops counting as reporting after this long without a report, and its seen items are dropped. */
export const FEED_PAGE_IDLE_MS = 10 * 60_000;
const MAX_PAGES = 200;
const MAX_KEYS_PER_PAGE = 500;
const MAX_POSTED = 500;
const MAX_PAGE_LABELS = 5;
const MAX_TITLE = 160;
const MAX_DETAIL = 600;

/** A failed navigation as the router collector reports it. */
export interface FeedNavigation {
  id?: unknown;
  startedAt?: unknown;
  outcome?: unknown;
  url?: unknown;
  errorCode?: unknown;
  reason?: unknown;
}

type AgentTool = { id: string; safety?: AgentSafety; handler: (args: any) => unknown };

export interface HubFeed {
  /** Wraps an agent tool so each write it completes posts a message. */
  wrapTool: <T extends AgentTool>(tool: T) => T;
  /** Posts the NG errors a page captured (forms setup errors and the like) that are new for it. */
  ngErrors: (pageId: string, inspector: PangularInspector, errors: readonly unknown[]) => void;
  /** Posts the failed navigations a page reported that are new for it. */
  navigations: (pageId: string, navigations: readonly FeedNavigation[]) => void;
  /** Posts the hydration mismatches and NG05xx messages a page reported that are new for it. */
  hydration: (pageId: string, stats: HydrationStats | null | undefined) => void;
  /** Gives the feed the docks to put unseen counts on. */
  attachDocks: (docks: HubDocks | undefined) => void;
  /** Clears the unseen count of a dock the panel opened; All tools clears every dock. */
  seen: (dockId: unknown) => void;
}

/** A dock's unseen items, with how many of them are errors and warnings. */
interface Unseen {
  count: number;
  errors: number;
  warnings: number;
}

interface Posted {
  id: string;
  count: number;
  pages: string[];
}

function messagesOf(ctx: unknown): DevframeMessagesHost | undefined {
  const messages = (ctx as { messages?: Partial<DevframeMessagesHost> } | null)?.messages;
  return messages && typeof messages.add === 'function'
    ? (messages as DevframeMessagesHost)
    : undefined;
}

/** A short stable id for a dedupe key (FNV-1a). */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const masked = (value: unknown, max: number) =>
  typeof value === 'string' && value ? clip(redactText(value.slice(0, max * 4)), max) : '';

const pageOf = (args: unknown) => {
  const page = (args as { page?: unknown } | null | undefined)?.page;
  return typeof page === 'string' && page && page.length < 50 ? page : undefined;
};

/** Lines that frame an answer instead of saying what happened: the untrusted-data notices, code fences and bare JSON brackets. */
const FRAME_LINE = /^(?:_.*_|```[\w-]*|[[\]{}(),\s]*)$/;

/** The lines of a tool's answer that say something, with headings and JSON keys made plain. */
function answerLines(result: unknown): string[] {
  const record = result as { markdown?: unknown } | null | undefined;
  const text =
    typeof result === 'string'
      ? result
      : typeof record?.markdown === 'string'
        ? record.markdown
        : '';
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !FRAME_LINE.test(line))
    .map((line) =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^"([^"]+)":\s*/, '$1: ')
        .replace(/,$/, '')
        .replace(/^([\w-]+): "(.*)"$/, '$1: $2'),
    );
}

/** The first line of a tool's answer that says what the write did, masked. */
function answerLine(result: unknown): string {
  return masked(answerLines(result)[0] ?? '', 200);
}

/**
 * How the write tools start an answer when they changed nothing: no page or
 * data to act on, a refusal (by the page, the config or a read-only agent), or
 * an argument to fix. The tools return these as text, not as errors.
 */
const NOTHING_DONE = [
  // The no-data openings the tools use; a bare `No` would also catch a
  // success such as "No longer paused".
  /^No (?:@ngrx|Analog|Capacitor|Content|HTTP|HttpClient|NgRx|SSR|ServerRoute|build|calls?|change|checks|components?|connected|content|devtools|element|error|field|file|forms?|history|injector|invalid|markdown|matching|navigations?|page|pages|part|pick|pipe|plugins?|prerender|problems|recent|recordings|route|routes|routed|router|rules?|server|signal|snapshot|store|submit|timed)\b/,
  /^Not dispatched\b/,
  /^Not done\b/,
  /^No query\b/,
  /^Refused\b/,
  /^error: /,
  /^Page `[^`]*` (?:reports|has) no\b/,
  /^\d+ (?:pages report|forms match)\b/,
  /\b(?:is turned off|is disabled) in the devtools config\b/,
  /^The agent is read-only\b/,
  /^(?:Pass|Provide|Give)\b/,
  /^`?[\w-]+`? (?:is required|must be)\b/,
  /^There are already \d+ rules\b/,
  /^The rule changes nothing\b/,
];

/** Whether a write tool's answer says it changed nothing, so the feed has nothing to post. */
export function changedNothing(result: unknown): boolean {
  const first = answerLines(result)[0];
  return first !== undefined && NOTHING_DONE.some((pattern) => pattern.test(first));
}

/** The dock that shows an inspector's data: its own dock when it has one, else Angular. */
function dockOf(inspector: PangularInspector | undefined): string {
  if (inspector === 'ngrx' || inspector === 'analog' || inspector === 'capacitor') {
    return dockId(inspector);
  }
  return dockId('angular');
}

/**
 * Posts what happens in the app to the hub's messages feed (`ctx.messages`):
 * agent writes, NG errors, failed navigations and hydration mismatches. An item
 * that comes back is counted on its first message instead of posted again, and
 * the dock that shows it carries a count of unseen items until it is opened.
 * Outside a hub, or for an inspector that is off, it posts nothing.
 */
export function createHubFeed(
  ctx: unknown,
  config: ResolvedPangularConfig,
  now: () => number = Date.now,
): HubFeed {
  const messages = messagesOf(ctx);
  const posted = new Map<string, Posted>();
  const pages = new Map<string, { keys: Set<string>; at: number }>();
  const unseen = new Map<string, Unseen>();
  let docks: HubDocks | undefined;

  messages?.events?.on('messages:removed', (id) => {
    for (const [key, entry] of posted) if (entry.id === id) posted.delete(key);
  });
  messages?.events?.on('messages:cleared', () => posted.clear());

  /** Whether `key` is new for the page; touches the page and forgets idle ones. */
  const firstOnPage = (pageId: string, key: string): boolean => {
    const at = now();
    for (const [id, page] of pages) {
      if (at - page.at > FEED_PAGE_IDLE_MS) pages.delete(id);
    }
    let page = pages.get(pageId);
    if (!page) {
      if (pages.size >= MAX_PAGES) pages.delete(pages.keys().next().value!);
      page = { keys: new Set(), at };
      pages.set(pageId, page);
    }
    page.at = at;
    if (page.keys.has(key)) return false;
    if (page.keys.size >= MAX_KEYS_PER_PAGE) page.keys.delete(page.keys.values().next().value!);
    page.keys.add(key);
    return true;
  };

  /** Red for any unseen error or warning; the title says which of the two. */
  const badgeOf = ({ count, errors, warnings }: Unseen): HubDockBadge | undefined => {
    if (count <= 0) return undefined;
    const severity = errors > 0 ? 'error' : warnings > 0 ? 'warning' : undefined;
    return {
      text: count > 99 ? '99+' : String(count),
      variant: severity ? 'danger' : 'info',
      ...(severity ? { severity } : {}),
    };
  };

  const renderBadges = () => {
    if (!docks) return;
    const total: Unseen = { count: 0, errors: 0, warnings: 0 };
    for (const id of docks.ids) {
      const item = unseen.get(id) ?? { count: 0, errors: 0, warnings: 0 };
      total.count += item.count;
      total.errors += item.errors;
      total.warnings += item.warnings;
      docks.setBadge(id, badgeOf(item));
    }
    docks.setBadge(docks.groupId, badgeOf(total));
  };

  const bump = (dock: string, level: DevframeMessageLevel) => {
    if (!docks) return;
    const target = docks.ids.includes(dock) ? dock : dockId('angular');
    const item = unseen.get(target) ?? { count: 0, errors: 0, warnings: 0 };
    item.count++;
    if (level === 'error') item.errors++;
    else if (level === 'warn') item.warnings++;
    unseen.set(target, item);
    renderBadges();
  };

  const post = (
    key: string,
    dock: string,
    input: { message: string; level: DevframeMessageLevel; category: string; detail?: string },
    pageId?: string,
  ) => {
    if (!messages) return;
    let entry = posted.get(key);
    if (!entry) {
      if (posted.size >= MAX_POSTED) posted.delete(posted.keys().next().value!);
      entry = { id: `pangular:${input.category}:${hash(key)}`, count: 0, pages: [] };
      posted.set(key, entry);
    }
    entry.count++;
    if (pageId && !entry.pages.includes(pageId)) {
      entry.pages.push(pageId);
      if (entry.pages.length > MAX_PAGE_LABELS) entry.pages.shift();
    }
    const pagesText = entry.pages.length ? `Page ${entry.pages.join(', ')}.` : '';
    const message: DevframeMessageEntryInput = {
      id: entry.id,
      message: entry.count > 1 ? `${input.message} (${entry.count} times)` : input.message,
      description: [input.detail, pagesText].filter(Boolean).join('\n\n') || undefined,
      level: input.level,
      category: input.category,
      labels: ['pangular', ...entry.pages.map((id) => `page:${id}`)],
      actions: [
        { id: 'open', label: 'Open in Pangular', kind: 'activate', activate: { dockId: dock } },
      ],
      // A toast for the first time an error shows up, not for each repeat.
      notify: input.level === 'error' && entry.count === 1,
    };
    // `add` with a known id updates the message in place.
    void messages.add(message).catch(() => undefined);
    bump(dock, input.level);
  };

  const agentWrite = (id: string, safety: AgentSafety, args: unknown, result: unknown) => {
    const name = id.replace(/^pangular:/, '');
    if (safety === 'read' || !agentAllowed({ id }, config)) return;
    // change-detection only writes when it starts, stops or clears a recording,
    // or turns a live view on or off.
    if (name === 'change-detection' && !cdWrites(args)) return;
    // hydration only acts when it turns the overlay on or off.
    if (
      name === 'hydration' &&
      typeof (args as { overlay?: unknown } | null)?.overlay !== 'boolean'
    ) {
      return;
    }
    // audit only runs something in the page when it runs axe.
    if (name === 'audit' && (args as { axe?: unknown } | null)?.axe !== true) return;
    if (changedNothing(result)) return;
    const page = pageOf(args);
    post(
      `agent:${name}:${page ?? ''}`,
      dockOf(agentInspector(id)),
      {
        message: `Agent ran ${name}`,
        level: 'info',
        category: HUB_MESSAGE_CATEGORIES.agent,
        detail: answerLine(result),
      },
      page,
    );
  };

  return {
    wrapTool: (tool) => {
      // A plugin tool declares its own tier; the built-in ones take it from AGENT_ENTRIES.
      const safety = tool.safety ?? agentSafety(tool.id, config);
      if (!messages || safety === 'read') return tool;
      return {
        ...tool,
        handler: async (args: unknown) => {
          const result = await tool.handler(args);
          try {
            agentWrite(tool.id, safety, args, result);
          } catch {
            // The feed never fails a tool call.
          }
          return result;
        },
      };
    },

    ngErrors: (pageId, inspector, errors) => {
      if (!messages || !config.inspectors[inspector]) return;
      for (const raw of errors.slice(0, 50)) {
        const text = masked(raw, MAX_DETAIL);
        if (!text) continue;
        const key = `ng:${inspector}:${text}`;
        if (!firstOnPage(pageId, key)) continue;
        post(
          key,
          dockOf(inspector),
          {
            message: clip(text.split('\n')[0]!, MAX_TITLE),
            level: 'error',
            category: HUB_MESSAGE_CATEGORIES.error,
            detail: text,
          },
          pageId,
        );
      }
    },

    navigations: (pageId, navigations) => {
      if (!messages || !config.inspectors.router) return;
      for (const nav of navigations.slice(-100)) {
        if (nav?.outcome !== 'failed') continue;
        if (!firstOnPage(pageId, `nav:${String(nav.id)}:${String(nav.startedAt)}`)) continue;
        const code = typeof nav.errorCode === 'string' ? clip(nav.errorCode, 20) : '';
        const reason = masked(nav.reason, MAX_TITLE);
        const url = masked(nav.url, 300);
        post(
          `router:${code}:${reason}`,
          dockOf('router'),
          {
            message: clip(
              ['Navigation failed', code && `(${code})`, reason && `: ${reason}`]
                .filter(Boolean)
                .join(' ')
                .replace(' :', ':'),
              MAX_TITLE,
            ),
            level: 'error',
            category: HUB_MESSAGE_CATEGORIES.error,
            detail: url ? `URL: ${url}` : undefined,
          },
          pageId,
        );
      }
    },

    hydration: (pageId, stats) => {
      if (!messages || !config.inspectors.http || !stats) return;
      for (const mismatch of stats.mismatches.slice(0, 20)) {
        const component = masked(mismatch.component, 200);
        const expected = masked(mismatch.expected, MAX_DETAIL);
        const actual = masked(mismatch.actual, MAX_DETAIL);
        const key = `mismatch:${component}|${expected}|${actual}`;
        if (!firstOnPage(pageId, key)) continue;
        post(
          key,
          dockOf('http'),
          {
            message: `Hydration mismatch at <${component}>`,
            level: 'error',
            category: HUB_MESSAGE_CATEGORIES.hydration,
            detail: [expected && `Expected: ${expected}`, actual && `Actual: ${actual}`]
              .filter(Boolean)
              .join('\n'),
          },
          pageId,
        );
      }
      for (const raw of stats.warnings.slice(0, 50)) {
        const text = masked(raw, MAX_DETAIL);
        if (!text) continue;
        const key = `hydration-warning:${text}`;
        if (!firstOnPage(pageId, key)) continue;
        post(
          key,
          dockOf('http'),
          {
            message: clip(text.split('\n')[0]!, MAX_TITLE),
            level: 'warn',
            category: HUB_MESSAGE_CATEGORIES.hydration,
            detail: text,
          },
          pageId,
        );
      }
    },

    attachDocks: (next) => {
      docks = next;
      renderBadges();
    },

    seen: (id) => {
      if (!docks || typeof id !== 'string') return;
      if (id === ALL_TOOLS_DOCK_ID || id === docks.groupId) unseen.clear();
      else if (docks.ids.includes(id)) unseen.delete(id);
      else return;
      renderBadges();
    },
  };
}
