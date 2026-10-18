import type { ComponentEditKind, ComponentEditResult } from '../component-edit.ts';
import { MAX_EDIT_JSON } from '../component-edit.ts';
import { actionBlockedMessage, type ResolvedPangularConfig } from '../config.ts';
import type { ComponentPage } from '../types.ts';
import { findComponents, otherMatchesText, truncationText } from './component-tools.ts';
import { code, untrusted } from './forms-tools.ts';
import { byRecency, choosePageText, pageArgument, unknownPageText } from './pages.ts';
import { refusal } from './refusal.ts';

/** How long a write waits for its page to answer. */
export const EDIT_TIMEOUT_MS = 10_000;

export interface ComponentEditMessage {
  id?: unknown;
  path?: unknown;
  value?: unknown;
  kind?: unknown;
}

interface Deps {
  config: ResolvedPangularConfig;
  /** The pages that report a component tree. */
  pages: () => Iterable<ComponentPage>;
  /** Sends an event to every connected page. */
  broadcast: (method: string, message: unknown) => void;
  /** Whether a result for `target` may come from the connection that sent it for `pageId`. */
  answersFor: (target: string, pageId: unknown) => boolean;
  timeoutMs?: number;
}

export interface ComponentEditTool {
  id: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<{ markdown: string }>;
}

function liveOnly(pages: Iterable<ComponentPage>) {
  return byRecency(pages).filter((page) => page.roots.length > 0);
}

/** The write request, or why it cannot be sent. */
function toRequest(message: unknown): ComponentEditMessage | string {
  const m = (message ?? {}) as ComponentEditMessage;
  if (typeof m.id !== 'string' || !m.id || m.id.length > 100) {
    return 'Pass the instance id of a component.';
  }
  if (typeof m.path !== 'string' || !m.path || m.path.length > 500) {
    return 'Pass a property name, or a path such as user.name.';
  }
  if (m.kind !== undefined && m.kind !== 'property' && m.kind !== 'signal') {
    return 'kind must be property or signal.';
  }
  if (m.value === undefined) return 'Pass a JSON value.';
  let json: string | undefined;
  try {
    json = JSON.stringify(m.value);
  } catch {
    json = undefined;
  }
  if (json === undefined) return 'The value must be JSON.';
  if (json.length > MAX_EDIT_JSON) {
    return `The value is longer than ${MAX_EDIT_JSON} characters of JSON.`;
  }
  return { id: m.id, path: m.path, value: JSON.parse(json), kind: m.kind };
}

/**
 * Writes to components on the page: the panel's `request-component-edit`
 * RPC and the `set-component-property` and `set-signal` agent tools. The
 * server sends `component-edit` to the page and waits for its
 * `component-edit-result`, which only the connection that owns the page can
 * settle.
 */
export function createComponentEdits(deps: Deps) {
  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  const answer = (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
    if (typeof message?.requestId !== 'string') return;
    const entry = pending.get(message.requestId);
    if (entry && deps.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
  };

  /** Sends one write to one page. Without `page`, only when exactly one page reports components. */
  const request = (page: unknown, message: unknown) =>
    new Promise<ComponentEditResult>((resolve) => {
      if (!deps.config.actions.components) {
        return resolve({ error: actionBlockedMessage('components') });
      }
      const live = liveOnly(deps.pages());
      if (typeof page === 'string' && page) {
        if (!live.some((entry) => entry.pageId === page)) {
          return resolve({ error: unknownPageText(page, live, 'a component tree') });
        }
      } else if (live.length !== 1) {
        // A write changes the app, so it never picks one of several tabs on its own.
        return resolve({
          error: live.length
            ? choosePageText(live, 'a component tree')
            : 'No page reports a component tree. Open the app in a browser.',
        });
      }
      const edit = toRequest(message);
      if (typeof edit === 'string') return resolve({ error: edit });
      const pageId = typeof page === 'string' && page ? page : live[0].pageId;
      const requestId = `e${++seq}`;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({
          error: `No page answered within ${Math.round((deps.timeoutMs ?? EDIT_TIMEOUT_MS) / 1000)}s. Is the app open in a browser, and its tab in the foreground?`,
        });
      }, deps.timeoutMs ?? EDIT_TIMEOUT_MS);
      timer.unref?.();
      pending.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(toResult(result));
        },
      });
      deps.broadcast('component-edit', { requestId, pageId, request: edit });
    });

  const tool = (kind: ComponentEditKind): ComponentEditTool => {
    return {
      id: kind === 'signal' ? 'pangular:set-signal' : 'pangular:set-component-property',
      title: kind === 'signal' ? 'Set a signal' : 'Set a component property',
      description:
        kind === 'signal'
          ? 'Set a writable signal (signal, linkedSignal, model) on a live component instance with `.set()` (dev only): `property` names the signal, or a path inside its value. `component` must match one instance. Needs actions.components.'
          : 'Set a property or input (`property`, or a path such as user.name) on a live component instance and run change detection (dev only). Not for signals (use set-signal). `component` must match one instance. Needs actions.components.',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            description: 'Instance id (e.g. c12), class name (e.g. ProductCard) or host tag.',
          },
          // Both tools name a field on the component: a signal, or a property or input.
          property:
            kind === 'signal'
              ? { type: 'string', description: 'Signal property, or a path inside its value.' }
              : {
                  type: 'string',
                  description: 'Property or input name, or a path such as user.name.',
                },
          value: { description: 'The new value, as JSON.' },
          page: {
            type: 'string',
            description:
              'Page id, when more than one tab reports (see pangular:list-pages). Required then.',
          },
        },
        required: ['component', 'property', 'value'],
      },
      handler: async (args) => {
        const page = pageArgument(args);
        const live = liveOnly(deps.pages());
        if (page && !live.some((entry) => entry.pageId === page)) {
          return { markdown: unknownPageText(page, live, 'a component tree') };
        }
        if (!live.length) {
          return {
            markdown: refusal(
              'No page reports a component tree, so nothing was written. Open the app in a browser with the devtools connected.',
            ),
          };
        }
        const selector = typeof args['component'] === 'string' ? args['component'] : '';
        if (!selector)
          return { markdown: refusal('Pass `component`: an instance id, class name or tag.') };
        const scope = page ? live.filter((entry) => entry.pageId === page) : live;
        const hits = findComponents(scope, selector);
        // Without `page`, the write goes to the one page that has the target;
        // when several pages do, the caller picks one.
        const hitPages = new Set(hits.map((hit) => hit.pageId));
        if (!page && live.length > 1 && hitPages.size !== 1) {
          return {
            markdown: choosePageText(
              hitPages.size ? live.filter((entry) => hitPages.has(entry.pageId)) : live,
              hitPages.size ? `a component that matches ${code(selector)}` : 'a component tree',
            ),
          };
        }
        if (!hits.length) {
          const cut = truncationText(scope);
          return {
            markdown: refusal(
              `No component instance matches \`${selector}\`${page ? ` on page \`${page}\`` : ''}, so nothing was written. Pass an instance id, class name or host tag from the pangular:component-tree resource.${cut ? ` ${cut}` : ''}`,
            ),
          };
        }
        if (hits.length > 1) {
          return {
            markdown: refusal(
              untrusted(
                `${otherMatchesText(hits, selector).replace(/ This used the first one; pass an instance id to pick another\.$/, '')} A write needs one instance, so nothing was written. Pass an instance id.`,
              ),
            ),
          };
        }
        const [hit] = hits;
        const result = await request(hit.pageId, {
          id: hit.node.id,
          path: args['property'],
          value: args['value'],
          kind,
        });
        return { markdown: editResultText(result, hit.node.id, hit.pageId) };
      },
    };
  };

  return {
    answer,
    request,
    tools: [tool('property'), tool('signal')],
    /** Writes waiting for an answer, for tests. */
    pendingCount: () => pending.size,
  };
}

function toResult(result: unknown): ComponentEditResult {
  const r = (result ?? {}) as Record<string, unknown>;
  if (r['ok'] === true && (r['kind'] === 'property' || r['kind'] === 'signal')) {
    return {
      ok: true,
      kind: r['kind'],
      component: typeof r['component'] === 'string' ? r['component'].slice(0, 200) : 'Component',
      path: typeof r['path'] === 'string' ? r['path'].slice(0, 500) : '',
      value: r['value'],
    };
  }
  return {
    error:
      typeof r['error'] === 'string' ? r['error'].slice(0, 2000) : 'The page did not write it.',
  };
}

/** The answer of set-component-property and set-signal, as markdown. */
export function editResultText(result: ComponentEditResult, id: string, pageId: string): string {
  if (!result.ok) {
    return refusal(
      untrusted(`Nothing was written to instance \`${id}\` on page \`${pageId}\`. ${result.error}`),
    );
  }
  const how =
    result.kind === 'signal' ? 'with `.set()`' : 'and ran change detection with `ng.applyChanges`';
  let json: string;
  try {
    json = JSON.stringify(result.value, null, 2) ?? 'undefined';
  } catch {
    json = String(result.value);
  }
  return untrusted(
    `Set \`${result.path}\` on \`${result.component}\` (instance \`${id}\` on page \`${pageId}\`) ${how}. It now holds:\n\n\`\`\`json\n${json}\n\`\`\``,
  );
}
