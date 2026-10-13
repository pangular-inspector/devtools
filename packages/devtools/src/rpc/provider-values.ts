import { parsePath } from '../component-edit.ts';
import { shownPath } from '../component-values.ts';
import {
  toProviderValueRequest,
  WHOLE_VALUE,
  type ProviderMember,
  type ProviderValueResult,
} from '../provider-values.ts';
import type { InjectorPage, InjectorTreeNode } from '../types.ts';
import { untrusted } from './forms-tools.ts';
import { byRecency, PAGE_ARGUMENT, pageArgument, unknownPageText } from './pages.ts';
import { capped } from './router-tools.ts';

/** How long a read waits for its page to answer. */
export const PROVIDER_VALUE_TIMEOUT_MS = 5_000;

interface Deps {
  /** The pages that report an injector tree. */
  pages: () => Iterable<InjectorPage>;
  /** The page that reported last, for a tool call without `page`. */
  latest: () => InjectorPage | undefined;
  /** Sends an event to every connected page. */
  broadcast: (method: string, message: unknown) => void;
  /** Whether a result for `target` may come from the connection that sent it for `pageId`. */
  answersFor: (target: string, pageId: unknown) => boolean;
  timeoutMs?: number;
}

/**
 * Reads one level of a provider's value on its page: the panel's
 * `request-provider-value` RPC and the `read-provider-value` agent tool. The
 * server sends `provider-value` to the page and waits for its
 * `provider-value-result`, which only the connection that owns the page can
 * settle. The page reads only instances its injectors already created.
 */
export function createProviderValues(deps: Deps) {
  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  const answer = (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
    if (typeof message?.requestId !== 'string') return;
    const entry = pending.get(message.requestId);
    if (entry && deps.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
  };

  const request = (page: unknown, message: unknown) =>
    new Promise<ProviderValueResult>((resolve) => {
      const live = byRecency(deps.pages());
      if (typeof page !== 'string' || !page) {
        return resolve({ error: 'Pass the page id of the injector.' });
      }
      if (!live.some((entry) => entry.pageId === page)) {
        return resolve({ error: unknownPageText(page, live, 'an injector tree') });
      }
      const read = toProviderValueRequest(message);
      if (typeof read === 'string') return resolve({ error: read });
      const requestId = `pv${++seq}`;
      const timeoutMs = deps.timeoutMs ?? PROVIDER_VALUE_TIMEOUT_MS;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({
          error: `The page did not answer within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser, and its tab in the foreground?`,
        });
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, {
        pageId: page,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(toResult(result));
        },
      });
      deps.broadcast('provider-value', { requestId, pageId: page, request: read });
    });

  /** The read-provider-value agent tool. */
  const tool = {
    id: 'pangular:read-provider-value',
    description: READ_PROVIDER_VALUE_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description:
            'The provider token: a service class name or an InjectionToken description (CartStore, API_URL).',
        },
        injector: {
          type: 'string',
          description:
            'Optional. An injector id, Root, Platform, `Route: admin`, a tag or a component class name. Defaults to the first injector that provides the token, environment injectors first.',
        },
        path: {
          type: 'string',
          description:
            'Optional. A member, then keys or indexes, such as `items` or `cart.items[0]`. Omit for the list of members.',
        },
        depth: { type: 'number', description: 'With `path`: levels to read below it, 1 to 5.' },
        limit: {
          type: 'number',
          description: 'Most entries per object or list, 1 to 1000. Defaults to 30.',
        },
        page: PAGE_ARGUMENT,
      },
      required: ['token'],
    },
    handler: async (args: Record<string, unknown>): Promise<{ markdown: string }> => {
      const token = args?.['token'];
      if (typeof token !== 'string' || !token.trim() || token.length > 500) {
        return { markdown: 'Pass `token`: a service class name or an InjectionToken description.' };
      }
      const path = providerPath(args['path']);
      if (!path) {
        return { markdown: 'Pass `path` as a member name, or a path such as `cart.items[0]`.' };
      }
      const pages = [...deps.pages()];
      const requested = pageArgument(args);
      if (requested && !pages.some((page) => page.pageId === requested)) {
        return { markdown: unknownPageText(requested, pages, 'an injector tree') };
      }
      const page = requested ? pages.find((entry) => entry.pageId === requested) : deps.latest();
      if (!page) {
        return {
          markdown:
            'No page has reported an injector tree. Open the app in a browser with the overlay loaded; services show up once the page reports its injectors.',
        };
      }
      const injector = typeof args['injector'] === 'string' ? args['injector'] : undefined;
      const target = findProvider(page, token, injector);
      if ('error' in target) return { markdown: untrusted(target.error) };
      const whole = (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
      const result = await request(page.pageId, {
        injectorId: target.injectorId,
        token: target.token,
        index: target.index,
        path,
        depth: whole(args['depth']),
        limit: whole(args['limit']),
      });
      return { markdown: providerValueText(result, target, page.pageId) };
    },
  };

  return {
    answer,
    request,
    tool,
    /** Reads waiting for an answer, for tests. */
    pendingCount: () => pending.size,
  };
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function toMembers(value: unknown): ProviderMember[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (m): m is ProviderMember =>
        !!m && typeof m === 'object' && typeof (m as ProviderMember).name === 'string',
    )
    .slice(0, 200)
    .map((m) => ({
      name: m.name.slice(0, 200),
      ...(m.kind === 'signal' || m.kind === 'resource' ? { kind: m.kind } : {}),
      value: m.value,
    }));
}

/** The page's answer, checked field by field: the page writes it. */
function toResult(result: unknown): ProviderValueResult {
  const r = (result ?? {}) as Record<string, unknown>;
  if (r['ok'] !== true) {
    return { error: text(r['error'], 2000) || 'The page did not read it.' };
  }
  const path = Array.isArray(r['path'])
    ? r['path'].filter((key): key is string => typeof key === 'string').slice(0, 32)
    : [];
  return {
    ok: true,
    token: text(r['token'], 500),
    type: text(r['type'], 200),
    path,
    ...(Array.isArray(r['members']) ? { members: toMembers(r['members']) } : {}),
    ...(typeof r['more'] === 'number' && r['more'] > 0 ? { more: Math.floor(r['more']) } : {}),
    ...('value' in r ? { value: r['value'] } : {}),
  };
}

function flatten(nodes: InjectorTreeNode[], out: InjectorTreeNode[] = []): InjectorTreeNode[] {
  for (const node of nodes) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

export interface ProviderTarget {
  injectorId: string;
  injectorName: string;
  token: string;
  index: number;
}

/**
 * Finds the provider an agent named: `injector` is an injector id, an
 * environment injector name (Root, Platform, Route: admin), a tag, or a
 * component class name or id; `token` is the provider's token name. Without
 * `injector`, the first injector that provides the token, environment
 * injectors first. Answers with what to pass instead when nothing matches.
 */
export function findProvider(
  page: InjectorPage,
  token: string,
  injector?: string,
): ProviderTarget | { error: string } {
  const want = token.trim().toLowerCase();
  const all = [...flatten(page.environment), ...flatten(page.roots)];
  const named = injector?.trim();
  const candidates = named
    ? all.filter((node) => {
        const info = node.injector;
        const lower = named.replace(/^<|>$/g, '').toLowerCase();
        return (
          info.id === named ||
          info.componentId === named ||
          info.name.toLowerCase() === lower ||
          info.component?.toLowerCase() === lower
        );
      })
    : all;
  if (named && !candidates.length) {
    return {
      error: `No injector on page \`${page.pageId}\` matches \`${named}\`. Pass an injector id, an environment injector name (Root, Platform, Route: …), a tag or a component class name; pangular:inspect-providers lists them.`,
    };
  }
  for (const node of candidates) {
    const index = node.providers.findIndex((p) => p.token.toLowerCase() === want);
    if (index >= 0) {
      return {
        injectorId: node.injector.id,
        injectorName: node.injector.name,
        token: node.providers[index].token,
        index,
      };
    }
  }
  const where = named
    ? `\`${named}\` does not provide`
    : `No injector on page \`${page.pageId}\` provides`;
  return {
    error: `${where} \`${token}\`. A service created on demand (\`providedIn: 'root'\`) is listed under Root once something injected it. pangular:inspect-providers with \`token\` shows where it is provided.`,
  };
}

/** `count.value` style path from the agent's `path` string; `null` when it does not parse. */
export function providerPath(path: unknown): string[] | null {
  if (path === undefined || path === '') return [];
  return parsePath(path);
}

/** The read-provider-value answer, as markdown. */
export function providerValueText(
  result: ProviderValueResult,
  target: ProviderTarget,
  pageId: string,
): string {
  const where = `\`${target.token}\` from ${target.injectorName} (\`${target.injectorId}\`) on page \`${pageId}\``;
  if (!result.ok) return untrusted(`Could not read ${where}. ${result.error}`);
  const json = (value: unknown) => {
    try {
      return JSON.stringify(value, null, 2) ?? 'undefined';
    } catch {
      return String(value);
    }
  };
  const legend =
    'A `{"$collapsed": type, "size": n}` value was not read: add its key to `path`, or raise `depth`. A `$more` count is how many entries the level did not list: raise `limit` to read them. Secret-looking names are redacted.';
  if (result.members) {
    const whole = result.members.length === 1 && result.members[0].name === WHOLE_VALUE;
    const body = whole
      ? json(result.members[0].value)
      : json(
          Object.fromEntries(
            result.members.map((m) => [m.kind ? `${m.name} (${m.kind})` : m.name, m.value]),
          ),
        );
    const more = result.more ? ` ${result.more} more members are not listed.` : '';
    const what = whole
      ? `The value of ${where} (\`${result.type}\`).`
      : `The members of ${where} (\`${result.type}\`): own fields, with signals and resources unwrapped and methods left out. Getters never run. Pass \`path\` (such as \`items[0]\`) to read one deeper.${more}`;
    return capped(
      untrusted(`${what} ${legend}\n\n\`\`\`json\n${body}\n\`\`\``),
      'pass a longer `path`, or a lower `depth` or `limit`',
    );
  }
  return capped(
    untrusted(
      `\`${shownPath(result.path)}\` of ${where}, read from the running page. ${legend}\n\n\`\`\`json\n${json(result.value)}\n\`\`\``,
    ),
    'pass a longer `path`, or a lower `depth` or `limit`',
  );
}

export const READ_PROVIDER_VALUE_DESCRIPTION =
  'Read the current value of a service or other provider that an injector on the running page already created: its own fields, with signals and resources unwrapped (marked `signal` or `resource`) and methods left out, each showing its first level. Nothing is created: an environment injector (Root, Platform, a route) answers only for a record that already holds an instance, and an element injector only for a token a component or directive on the page injected; otherwise the answer says it was not created yet. Getters never run, and secret-looking names are redacted. Pass `token` (a class name or InjectionToken description) and, when several injectors provide it, `injector` (an injector id, Root, Platform, `Route: admin`, a tag or a component class name; pangular:inspect-providers lists them). Pass `path` (such as `cart.items[0]`) to read deeper, with `depth` (1 to 5) and `limit` (entries per level, up to 1000). `page` picks the tab and defaults to the most recent. Live data only.';
