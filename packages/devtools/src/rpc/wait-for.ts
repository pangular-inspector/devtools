import { defaultPage } from './default-page.ts';
// The `wait-for` agent tool: blocks until a condition holds on data the
// collectors already pushed (component tree, router, HTTP calls, errors), so
// an agent that clicked or navigated does not have to poll other tools in a
// loop. It only reads the server's stores and never sends anything to the page.

import type { ComponentPage, HttpPage } from '../types.ts';
import { urlGlobMatch } from '../url-glob.ts';
import type { MarkdownAnswer } from './agent-output.ts';
import { findComponents } from './component-tools.ts';
import type { ErrorGroup, ErrorsState } from './errors-tools.ts';
import { code, untrusted } from './forms-tools.ts';
import { byRecency, pageArgument, unknownPageText } from './pages.ts';
import type { RouterPage } from './router-tools.ts';

export const WAIT_CONDITIONS = [
  'component',
  'component-gone',
  'navigation',
  'http-call',
  'error',
  'form',
] as const;
export type WaitCondition = (typeof WAIT_CONDITIONS)[number];

export const WAIT_DEFAULT_MS = 5000;
export const WAIT_MIN_MS = 100;
export const WAIT_MAX_MS = 30_000;
/** How often the stores are read again, besides the change events. */
export const WAIT_POLL_MS = 200;
/** How often a long wait renews the activity lease, so pages keep pushing. */
export const WAIT_KEEP_ALIVE_MS = 2000;

export interface WaitForSources {
  /** Pages that report a component tree; left out when the Components inspector is off. */
  components?: () => Iterable<ComponentPage>;
  /** Pages that report the router; left out when the Router inspector is off. */
  router?: () => Iterable<RouterPage>;
  /** Pages that report HttpClient calls; left out when the HTTP inspector is off. */
  http?: () => Iterable<HttpPage>;
  /** What every page reported to the Errors inspector; left out when it is off. */
  errors?: () => ErrorsState;
  /**
   * Waits for a form condition (`form`, `until`, `after`) on the Forms
   * inspector's state; left out when it is off.
   */
  forms?: (args: Args, timeoutMs: number) => Promise<MarkdownAnswer>;
  /** Change events of the stores above: each takes a listener and returns its unsubscribe. */
  subscribe?: readonly ((listener: () => void) => () => void)[];
  /** Renews the activity lease while the tool waits. */
  keepAlive?: () => unknown;
  pollMs?: number;
  keepAliveMs?: number;
  now?: () => number;
}

interface Probe {
  /** Whether the condition holds now. */
  check(): boolean;
  /** One line on what was seen: the match after success, the last state on timeout. */
  state(): string;
  /** The answer carries text from the page (URLs, messages). */
  fromPage?: boolean;
}

type Args = Record<string, unknown>;

const SOURCE_OF: Record<WaitCondition, keyof WaitForSources> = {
  component: 'components',
  'component-gone': 'components',
  navigation: 'router',
  'http-call': 'http',
  error: 'errors',
  form: 'forms',
};

const INSPECTOR_OF: Record<WaitCondition, string> = {
  component: 'Components',
  'component-gone': 'Components',
  navigation: 'Router',
  'http-call': 'HTTP',
  error: 'Errors',
  form: 'Forms',
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

/** `timeoutMs` as given, kept between {@link WAIT_MIN_MS} and {@link WAIT_MAX_MS}. */
export function waitTimeout(value: unknown): number {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return WAIT_DEFAULT_MS;
  return Math.round(Math.min(Math.max(ms, WAIT_MIN_MS), WAIT_MAX_MS));
}

/**
 * Resolves `true` as soon as `check` holds, or `false` after `timeoutMs`. It
 * checks at once, on every change event and every `pollMs`, and removes its
 * timers and listeners before it resolves.
 */
export function waitUntil(
  check: () => boolean,
  options: {
    timeoutMs: number;
    pollMs?: number;
    subscribe?: readonly ((listener: () => void) => () => void)[];
    keepAlive?: () => unknown;
    keepAliveMs?: number;
  },
): Promise<boolean> {
  const holds = () => {
    try {
      return check();
    } catch {
      return false;
    }
  };
  if (holds()) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const unsubscribe: (() => void)[] = [];
    let settled = false;
    const finish = (met: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (alive) clearInterval(alive);
      for (const off of unsubscribe.splice(0)) {
        try {
          off();
        } catch {
          // A store that can't unsubscribe never fails the answer.
        }
      }
      resolve(met);
    };
    const test = () => {
      if (!settled && holds()) finish(true);
    };
    const timer = setTimeout(() => finish(holds()), options.timeoutMs);
    const poll = setInterval(test, options.pollMs ?? WAIT_POLL_MS);
    const keepAlive = options.keepAlive;
    const alive = keepAlive
      ? setInterval(() => {
          try {
            void Promise.resolve(keepAlive()).catch(() => {});
          } catch {
            // The lease never fails a wait.
          }
        }, options.keepAliveMs ?? WAIT_KEEP_ALIVE_MS)
      : undefined;
    for (const timerId of [timer, poll, alive]) (timerId as { unref?: () => void })?.unref?.();
    for (const subscribe of options.subscribe ?? []) {
      try {
        unsubscribe.push(subscribe(test));
      } catch {
        // Polling still covers a store without change events.
      }
    }
  });
}

/** Page-reported pages narrowed to `page`, or a ready answer when `page` names none. */
function pick<T extends { pageId: string; reportedAt: number }>(
  all: Iterable<T>,
  page: string | undefined,
  what: string,
): { pages: T[] } | { answer: string } {
  const pages = byRecency(all);
  if (page && !pages.some((entry) => entry.pageId === page)) {
    return { answer: unknownPageText(page, pages, what) };
  }
  if (!pages.length) {
    return {
      answer: `No page reports ${what} right now, so there is nothing to wait on. Open the app in a browser with the overlay loaded, then call pangular:list-pages.`,
    };
  }
  return { pages: page ? pages.filter((entry) => entry.pageId === page) : pages };
}

function componentProbe(
  sources: WaitForSources,
  args: Args,
  page: string | undefined,
  gone: boolean,
): Probe | string {
  const selector = text(args['component']);
  if (!selector) {
    return 'Pass `component`: an instance id (e.g. c12), class name (e.g. ProductCard) or host tag (e.g. app-product-card).';
  }
  const read = () => pick(sources.components!(), page, 'a component tree');
  const first = read();
  if ('answer' in first) return first.answer;
  const hits = () => {
    const now = read();
    return 'pages' in now ? findComponents(now.pages, selector) : [];
  };
  const where = page ? ` on page ${code(page)}` : '';
  return {
    check: () => (gone ? hits().length === 0 : hits().length > 0),
    state: () => {
      const found = hits();
      if (!found.length) return `No component matches ${code(selector)}${where}.`;
      const [hit] = found;
      const more = found.length > 1 ? ` and ${found.length - 1} more` : '';
      return `${code(selector)} matches \`${hit!.node.name}\` (\`<${hit!.node.tag}>\`, instance \`${hit!.node.id}\` on page \`${hit!.pageId}\`)${more}.`;
    },
  };
}

function navigationProbe(sources: WaitForSources, args: Args, page: string | undefined) {
  const url = text(args['url']);
  const first = pick(sources.router!(), page, 'the router');
  if ('answer' in first) return first.answer;
  // Without `page`, the most recent page with a router snapshot, like pangular:navigate.
  const target = () => {
    const now = pick(sources.router!(), page, 'the router');
    if (!('pages' in now)) return undefined;
    return defaultPage(now.pages.filter((entry) => entry.snapshot)) ?? defaultPage(now.pages);
  };
  const pending = (entry: RouterPage) =>
    Boolean(entry.snapshot?.pending) || entry.navigations.at(-1)?.outcome === 'pending';
  return {
    fromPage: true,
    check: () => {
      const entry = target();
      if (!entry?.snapshot || pending(entry)) return false;
      return !url || urlGlobMatch(entry.snapshot.url, url);
    },
    state: () => {
      const entry = target();
      if (!entry?.snapshot) return 'The router has not reported a URL yet.';
      const last = entry.navigations.at(-1);
      const going = entry.snapshot.pending?.url ?? (pending(entry) ? last?.url : undefined);
      return `Page ${code(entry.pageId)} is at ${code(entry.snapshot.url)}${going ? `, navigating to ${code(going)}` : ', with no navigation in progress'}${last && !going ? ` (last navigation ${code(last.url)}: ${last.outcome})` : ''}.`;
    },
  } satisfies Probe;
}

function httpProbe(sources: WaitForSources, args: Args, page: string | undefined) {
  const url = text(args['url']);
  const first = pick(sources.http!(), page, 'HttpClient calls');
  if ('answer' in first) return first.answer;
  // Calls already recorded when the wait starts don't count.
  const seen = new Set(first.pages.flatMap((entry) => entry.calls.map((call) => call.id)));
  const fresh = () => {
    const now = pick(sources.http!(), page, 'HttpClient calls');
    if (!('pages' in now)) return [];
    return now.pages.flatMap((entry) =>
      entry.calls
        .filter((call) => !seen.has(call.id))
        .map((call) => ({ pageId: entry.pageId, call })),
    );
  };
  const matching = () => fresh().filter(({ call }) => !url || urlGlobMatch(call.url, url));
  return {
    fromPage: true,
    check: () => matching().length > 0,
    state: () => {
      const [hit] = matching();
      if (hit) {
        const { call } = hit;
        const outcome = call.cancelled ? 'cancelled' : call.error ? 'failed' : String(call.status);
        return `${call.method} ${code(call.url)} on page ${code(hit.pageId)} finished: ${outcome} in ${call.durationMs}ms.`;
      }
      const count = fresh().length;
      if (!count) return 'No HttpClient call finished since the wait started.';
      return `${count} HttpClient call${count === 1 ? '' : 's'} finished since the wait started, none matching ${code(url ?? '')}.`;
    },
  } satisfies Probe;
}

function errorProbe(sources: WaitForSources, args: Args, page: string | undefined) {
  const wanted = text(args['code'])?.trim().toUpperCase();
  const pages = () => Object.values(sources.errors!().pages);
  const first = pick(pages(), page, 'errors');
  if ('answer' in first) return first.answer;
  // How often each group occurred when the wait started; a new group or a higher count is new.
  const before = new Map<string, number>();
  for (const entry of first.pages) {
    for (const group of Object.values(entry.errors)) {
      before.set(`${entry.pageId}\n${group.id}`, group.count);
    }
  }
  const fresh = () => {
    const now = pick(pages(), page, 'errors');
    if (!('pages' in now)) return [];
    const found: { pageId: string; group: ErrorGroup }[] = [];
    for (const entry of now.pages) {
      for (const group of Object.values(entry.errors)) {
        if (group.count <= (before.get(`${entry.pageId}\n${group.id}`) ?? 0)) continue;
        if (wanted && group.code?.toUpperCase() !== wanted) continue;
        found.push({ pageId: entry.pageId, group });
      }
    }
    return found.sort((a, b) => b.group.lastAt - a.group.lastAt);
  };
  return {
    fromPage: true,
    check: () => fresh().length > 0,
    state: () => {
      const [hit] = fresh();
      if (!hit) {
        return `No new error${wanted ? ` with code ${code(wanted)}` : ''} since the wait started.`;
      }
      const { group } = hit;
      const owner = group.owner
        ? ` in \`${group.owner.name}\` (instance \`${group.owner.id}\`)`
        : '';
      return `Error \`${group.id}\` on page ${code(hit.pageId)}${group.code ? ` (${group.code})` : ''}${owner}: ${code(group.message)}. pangular:explain-error with this id explains it.`;
    },
  } satisfies Probe;
}

function conditionLabel(condition: WaitCondition, args: Args): string {
  const selector = text(args['component']);
  const url = text(args['url']);
  const errorCode = text(args['code']);
  switch (condition) {
    case 'component':
      return `\`component\` ${code(selector ?? '')}`;
    case 'component-gone':
      return `\`component-gone\` ${code(selector ?? '')}`;
    case 'navigation':
      return url ? `\`navigation\` to ${code(url)}` : '`navigation`';
    case 'http-call':
      return url ? `\`http-call\` ${code(url)}` : '`http-call`';
    case 'error':
      return errorCode ? `\`error\` ${code(errorCode)}` : '`error`';
    case 'form':
      return '`form`';
  }
}

/** What the tool tells an agent, under 600 characters. */
export const WAIT_FOR_DESCRIPTION =
  'Wait until a condition holds instead of polling: `component` or `component-gone` (`component`), `navigation` (`url`), `http-call` (`url`), `error` (`code`) or `form` (`form`, `until`, `after`). Returns once it holds or after `timeoutMs` (default 5000, max 30000). Only reads.';

/**
 * The `pangular:wait-for` tool, offering only the conditions whose inspector
 * gave a source. Undefined when none did.
 */
export function createWaitForTool(sources: WaitForSources) {
  const conditions = WAIT_CONDITIONS.filter((condition) => sources[SOURCE_OF[condition]]);
  if (!conditions.length) return undefined;
  const now = sources.now ?? (() => Date.now());

  const handler = async (raw: Args | undefined): Promise<MarkdownAnswer> => {
    const args = raw && typeof raw === 'object' ? raw : {};
    const condition = args['condition'] as WaitCondition;
    if (
      typeof condition !== 'string' ||
      !(WAIT_CONDITIONS as readonly string[]).includes(condition)
    ) {
      return {
        markdown: `Pass \`condition\`: ${conditions.map((name) => `\`${name}\``).join(', ')}.`,
      };
    }
    if (!conditions.includes(condition)) {
      return {
        markdown: `\`${condition}\` needs the ${INSPECTOR_OF[condition]} inspector, which is turned off for agents in this server's config.`,
      };
    }
    if (condition === 'form') return sources.forms!(args, waitTimeout(args['timeoutMs']));
    const page = pageArgument(args);
    const probe =
      condition === 'component' || condition === 'component-gone'
        ? componentProbe(sources, args, page, condition === 'component-gone')
        : condition === 'navigation'
          ? navigationProbe(sources, args, page)
          : condition === 'http-call'
            ? httpProbe(sources, args, page)
            : errorProbe(sources, args, page);
    if (typeof probe === 'string') return { markdown: probe };

    const timeoutMs = waitTimeout(args['timeoutMs']);
    const started = now();
    const met = await waitUntil(probe.check, {
      timeoutMs,
      pollMs: sources.pollMs,
      subscribe: sources.subscribe,
      keepAlive: sources.keepAlive,
      keepAliveMs: sources.keepAliveMs,
    });
    const label = conditionLabel(condition, args);
    const answer = met
      ? `Condition ${label} holds after ${Math.max(0, now() - started)}ms. ${probe.state()}`
      : `Timed out after ${timeoutMs}ms waiting for ${label}. Last state: ${probe.state()}`;
    return { markdown: probe.fromPage ? untrusted(answer) : answer };
  };

  return {
    id: 'pangular:wait-for',
    title: 'Wait for a condition',
    description: WAIT_FOR_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        condition: { type: 'string', enum: [...conditions], description: 'What to wait for.' },
        component: {
          type: 'string',
          description:
            'For `component` and `component-gone`: instance id (e.g. c12), class name (e.g. ProductCard) or host tag.',
        },
        url: {
          type: 'string',
          description:
            'For `navigation` and `http-call`: text the URL contains; `*` matches anything and a leading `^` anchors it at the path start.',
        },
        code: {
          type: 'string',
          description: 'For `error`: only an error with this Angular code, such as NG0100.',
        },
        ...(conditions.includes('form')
          ? {
              form: {
                type: 'string',
                description:
                  'For `form`: form id or label from pangular:inspect-forms; every form without it.',
              },
              until: {
                type: 'string',
                enum: ['settled', 'valid', 'not-pending', 'submitted'],
                description:
                  'For `form`: `settled` (default: no pending async validation, debounce or submit in flight), `valid`, `not-pending`, or `submitted` after `after`.',
              },
              after: {
                type: 'number',
                description:
                  'For `form` with `until: "submitted"`: a marker from a forms tool answer.',
              },
            }
          : {}),
        timeoutMs: {
          type: 'number',
          description: `How long to wait, in ms (default ${WAIT_DEFAULT_MS}, at most ${WAIT_MAX_MS}).`,
        },
        page: {
          type: 'string',
          description:
            'Page id, when more than one tab reports (see pangular:list-pages). Without it, every page counts; `navigation` uses the default page.',
        },
      },
      required: ['condition'],
    },
    handler,
  };
}
