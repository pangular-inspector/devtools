import type { DeferLoadResult } from '../defer-load.ts';
import { actionBlockedMessage, type ResolvedPangularConfig } from '../config.ts';
import type { ComponentPage, DeferBlockInfo } from '../types.ts';
import { untrusted } from './forms-tools.ts';
import { byRecency, choosePageText, pageArgument, unknownPageText } from './pages.ts';
import { refusal } from './refusal.ts';

/** How long a load waits for its page to answer; it fetches the block's chunks first. */
export const DEFER_LOAD_TIMEOUT_MS = 15_000;

interface Deps {
  config: ResolvedPangularConfig;
  /** The pages that report a component tree, with their defer blocks. */
  pages: () => Iterable<ComponentPage>;
  /** Sends an event to the connection that owns the page. */
  broadcast: (method: string, message: unknown) => void;
  /** Whether a result for `target` may come from the connection that sent it for `pageId`. */
  answersFor: (target: string, pageId: unknown) => boolean;
  timeoutMs?: number;
}

export interface DeferLoadTool {
  id: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<{ markdown: string }>;
}

function withDeferBlocks(pages: Iterable<ComponentPage>) {
  return byRecency(pages).filter((page) => page.deferBlocks?.length);
}

function toResult(result: unknown): DeferLoadResult {
  const r = (result ?? {}) as Record<string, unknown>;
  if (r['ok'] === true) {
    return {
      ok: true,
      state: r['state'] === 'error' ? 'error' : 'complete',
      ...(r['already'] === true ? { already: true as const } : {}),
      ...(typeof r['renderError'] === 'string'
        ? { renderError: r['renderError'].slice(0, 500) }
        : {}),
    };
  }
  return {
    error: typeof r['error'] === 'string' ? r['error'].slice(0, 2000) : 'The page did not load it.',
  };
}

/** The answer of load-defer-block, as markdown. */
export function deferLoadText(
  result: DeferLoadResult,
  block: Pick<DeferBlockInfo, 'id' | 'owner'>,
  pageId: string,
): string {
  const where = `\`${block.id}\`${block.owner ? ` in ${block.owner.name}` : ''} on page \`${pageId}\``;
  if (!result.ok) return refusal(untrusted(`Defer block ${where} was not loaded. ${result.error}`));
  if (result.already) {
    return untrusted(`Defer block ${where} already shows its main content, so nothing was loaded.`);
  }
  const threw = result.renderError
    ? ` Change detection threw while it rendered: ${result.renderError}. Check pangular:list-errors.`
    : '';
  if (result.state === 'error') {
    return untrusted(
      `Loaded defer block ${where}, but its dependencies failed, so it shows its @error block. Check pangular:list-errors and the browser's network panel for the failed chunk.${threw}`,
    );
  }
  return untrusted(
    `Loaded defer block ${where}: its dependencies were fetched and it now shows its main content. Its own triggers did not fire, so this does not prove they work. Read pangular:defer-blocks again to see its new state.${threw}`,
  );
}

/**
 * The `load-defer-block` agent tool: makes one `@defer` block fetch its
 * dependencies and show its main content on the page, as if its trigger
 * fired. The server sends `defer-load` to the page that owns the block and
 * waits for its `defer-load-result`, which only that page's connection can
 * settle. Behind `actions.components`, checked here and again on the page.
 */
export function createDeferLoads(deps: Deps) {
  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  const answer = (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
    if (typeof message?.requestId !== 'string') return;
    const entry = pending.get(message.requestId);
    if (entry && deps.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
  };

  const request = (pageId: string, id: string) =>
    new Promise<DeferLoadResult>((resolve) => {
      const requestId = `l${++seq}`;
      const timeoutMs = deps.timeoutMs ?? DEFER_LOAD_TIMEOUT_MS;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({
          error: `No page answered within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser, and its tab in the foreground?`,
        });
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(toResult(result));
        },
      });
      deps.broadcast('defer-load', { requestId, pageId, id });
    });

  const tool: DeferLoadTool = {
    id: 'pangular:load-defer-block',
    title: 'Load a @defer block',
    description:
      'Make one live @defer block fetch its dependencies and show its main content now, as if its trigger fired (dev only). `block` is an id from pangular:defer-blocks. Dehydrated server HTML is left alone. Needs actions.components.',
    inputSchema: {
      type: 'object',
      properties: {
        block: {
          type: 'string',
          description: 'Defer block id from pangular:defer-blocks, such as d3.',
        },
        page: {
          type: 'string',
          description:
            'Page id, when more than one tab has that block id (see pangular:list-pages). Required then.',
        },
      },
      required: ['block'],
    },
    handler: async (args) => {
      if (!deps.config.actions.components) {
        return { markdown: refusal(actionBlockedMessage('components')) };
      }
      const id = typeof args['block'] === 'string' ? args['block'].trim() : '';
      if (!id || id.length > 100) {
        return { markdown: refusal('Pass `block`: a defer block id from pangular:defer-blocks.') };
      }
      const page = pageArgument(args);
      const live = withDeferBlocks(deps.pages());
      if (page && !live.some((entry) => entry.pageId === page)) {
        return { markdown: unknownPageText(page, live, 'defer blocks') };
      }
      const scope = page ? live.filter((entry) => entry.pageId === page) : live;
      const hits = scope.flatMap((entry) =>
        (entry.deferBlocks ?? [])
          .filter((block) => block.id === id)
          .map((block) => ({ pageId: entry.pageId, block })),
      );
      if (!hits.length) {
        return {
          markdown: refusal(
            live.length
              ? `No defer block \`${id}\`${page ? ` on page \`${page}\`` : ''}, so nothing was loaded. Read the ids with pangular:defer-blocks.`
              : 'No page reports defer blocks, so nothing was loaded. Open the app in a browser with the devtools connected.',
          ),
        };
      }
      if (hits.length > 1) {
        // A load changes the app, so it never picks one of several tabs on its own.
        const pages = new Set(hits.map((hit) => hit.pageId));
        return {
          markdown: choosePageText(
            live.filter((entry) => pages.has(entry.pageId)),
            `a defer block \`${id}\``,
          ),
        };
      }
      const [hit] = hits;
      const result = await request(hit.pageId, id);
      return { markdown: deferLoadText(result, hit.block, hit.pageId) };
    },
  };

  return {
    answer,
    tool,
    /** Loads waiting for an answer, for tests. */
    pendingCount: () => pending.size,
  };
}
