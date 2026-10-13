import { MAX_SCREENSHOT_DATA, type ScreenshotResult } from '../component-screenshot.ts';
import { redactText } from '../serialize.ts';
import { clip } from '../text.ts';
import type { ComponentPage } from '../types.ts';
import { findComponents, otherMatchesText, truncationText } from './component-tools.ts';
import { untrusted } from './forms-tools.ts';
import { byRecency, pageArgument, unknownPageText } from './pages.ts';

/** How long a capture waits for its page; drawing a large component and its images takes a moment. */
export const SCREENSHOT_TIMEOUT_MS = 15_000;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

interface Deps {
  /** The pages that report a component tree. */
  pages: () => Iterable<ComponentPage>;
  /** Sends an event to every connected page. */
  broadcast: (method: string, message: unknown) => void;
  /** Whether a result for `target` may come from the connection that sent it for `pageId`. */
  answersFor: (target: string, pageId: unknown) => boolean;
  timeoutMs?: number;
}

/** An MCP content block: the image travels as its own block, next to the markdown. */
export type McpContent =
  { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

export interface ScreenshotAnswer {
  markdown: string;
  /** The MCP tool result content, read by the MCP adapter (see `patches/@devframes__agentic`). */
  mcpContent?: McpContent[];
}

/**
 * Adds the MCP content blocks as a non-enumerable property: the MCP adapter
 * reads them, and anything that serializes the result instead (the panel's
 * RPC, an adapter without `mcpContent` support) sees only the markdown, not
 * megabytes of base64.
 */
export function withMcpContent(
  answer: { markdown: string },
  blocks: McpContent[],
): ScreenshotAnswer {
  Object.defineProperty(answer, 'mcpContent', { value: blocks, enumerable: false });
  return answer;
}

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;

/** Checks what a page answered: only a PNG or JPEG in base64 under the size cap passes. */
export function toScreenshotResult(value: unknown): ScreenshotResult {
  const r = (value ?? {}) as Record<string, unknown>;
  if (r['ok'] !== true) {
    return {
      ok: false,
      error:
        typeof r['error'] === 'string'
          ? clip(redactText(r['error']), 500)
          : 'The page did not draw the component.',
    };
  }
  const mimeType = r['mimeType'];
  const data = r['data'];
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
    return { ok: false, error: 'The page answered with an image type other than PNG or JPEG.' };
  }
  if (
    typeof data !== 'string' ||
    !data ||
    data.length > MAX_SCREENSHOT_DATA ||
    !BASE64.test(data)
  ) {
    return {
      ok: false,
      error: 'The page answered with an image that is empty, too large or not base64.',
    };
  }
  return {
    ok: true,
    mimeType,
    data,
    width: num(r['width']),
    height: num(r['height']),
    cssWidth: num(r['cssWidth']),
    cssHeight: num(r['cssHeight']),
    masked: num(r['masked']),
    maskedText: num(r['maskedText']),
    notes: Array.isArray(r['notes'])
      ? r['notes']
          .filter((note): note is string => typeof note === 'string')
          .slice(0, 10)
          .map((note) => clip(redactText(note), 300))
      : [],
  };
}

/**
 * Component screenshots: the `screenshot-component` agent tool. The server
 * sends `component-screenshot` to the page and waits for its
 * `component-screenshot-result`, which only the connection that owns the page
 * can settle. The page draws a copy of the host element, so the app's DOM is
 * never changed.
 */
export function createComponentScreenshots(deps: Deps) {
  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  const answer = (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
    if (typeof message?.requestId !== 'string') return;
    const entry = pending.get(message.requestId);
    if (entry && deps.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
  };

  const request = (pageId: string, target: { id?: string; selector?: string }) =>
    new Promise<ScreenshotResult>((resolve) => {
      const requestId = `s${++seq}`;
      const timeoutMs = deps.timeoutMs ?? SCREENSHOT_TIMEOUT_MS;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({
          ok: false,
          error: `The page did not answer within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser, and its tab in the foreground?`,
        });
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(toScreenshotResult(result));
        },
      });
      deps.broadcast('component-screenshot', { requestId, pageId, ...target });
    });

  const tool = {
    id: 'pangular:screenshot-component',
    description:
      'An image (PNG, or JPEG when large) of one component\'s host element as rendered now. Pass `selector`: an instance id, class name, host tag or CSS selector. Without `page`, ids, class names and tags are searched on every page, newest first; a CSS selector uses the newest page. The page draws a copy from computed styles, so it works off screen and never changes the app. Password and secret fields, `data-private`, `.sentry-mask`, `.rr-mask` and `data-pangular="mask"` elements, and tokens in text are masked. Cross-origin images without CORS, iframes and web fonts are not drawn. At most 2000 px.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description:
            'Instance id (e.g. c12), class name (e.g. ProductCard), host tag (e.g. app-root) or CSS selector.',
        },
        page: {
          type: 'string',
          description:
            'Page id, when more than one tab reports (see pangular:list-pages). Without it, ids, class names and tags are searched on every page, newest first; a CSS selector uses the newest page.',
        },
        pageId: { type: 'string', description: 'Same as `page`.' },
      },
      required: ['selector'],
    },
    handler: async (args: Record<string, unknown>): Promise<ScreenshotAnswer> => {
      const page = pageArgument(args, 'pageId');
      const all = byRecency(deps.pages());
      if (page && !all.some((entry) => entry.pageId === page)) {
        return { markdown: unknownPageText(page, all, 'a component tree') };
      }
      const scope = (page ? all.filter((entry) => entry.pageId === page) : all).filter(
        (entry) => entry.roots.length > 0,
      );
      if (!scope.length) {
        return {
          markdown:
            'No page reports a component tree, so there is nothing to capture. Open the app in a browser with the devtools connected.',
        };
      }
      const selector = typeof args?.['selector'] === 'string' ? args['selector'].trim() : '';
      if (!selector) {
        return {
          markdown: 'Pass `selector`: an instance id, class name, host tag or CSS selector.',
        };
      }
      const hits = findComponents(scope, selector);
      const [hit] = hits;
      const pageId = hit?.pageId ?? scope[0]!.pageId;
      const result = await request(pageId, hit ? { id: hit.node.id } : { selector });
      const what = hit
        ? `\`${hit.node.name}\` (\`<${hit.node.tag}>\`, instance \`${hit.node.id}\`)`
        : `the first element matching \`${selector}\``;
      if (!result.ok) {
        const cut = hit ? '' : truncationText(scope);
        return {
          markdown: untrusted(
            `Could not capture ${what} on page \`${pageId}\`. ${result.error}${cut ? ` ${cut}` : ''}`,
          ),
        };
      }
      const masked = [
        result.masked ? `${result.masked} field(s) or marked element(s) masked` : '',
        result.maskedText ? `tokens masked in ${result.maskedText} text node(s)` : '',
      ].filter(Boolean);
      const others = otherMatchesText(hits, selector);
      const markdown = untrusted(
        [
          `Screenshot of ${what} on page \`${pageId}\`: ${result.cssWidth}×${result.cssHeight} CSS pixels, drawn at ${result.width}×${result.height} as ${result.mimeType}, from a copy of the element's DOM and computed styles.${masked.length ? ` ${masked.join('; ')}.` : ''}`,
          ...result.notes.map((note) => `- ${note}`),
          others,
        ]
          .filter(Boolean)
          .join('\n\n'),
      );
      return withMcpContent({ markdown }, [
        { type: 'text', text: markdown },
        { type: 'image', data: result.data, mimeType: result.mimeType },
      ]);
    },
  };

  return {
    answer,
    request,
    tool,
    /** Captures waiting for an answer, for tests. */
    pendingCount: () => pending.size,
  };
}
