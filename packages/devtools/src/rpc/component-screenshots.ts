import { withMcpContent } from 'devframe';
import { MAX_SCREENSHOT_DATA, type ScreenshotResult } from '../component-screenshot.ts';
import { redactText } from '../serialize.ts';
import { clip } from '../text.ts';
import type { ComponentPage } from '../types.ts';
import { findComponents, otherMatchesText, truncationText } from './component-tools.ts';
import { untrusted } from './forms-tools.ts';
import { byRecency, needsDomText, pageArgument, unknownPageText } from './pages.ts';
import { refusal } from './refusal.ts';

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
    title: 'Screenshot a component',
    description:
      "A PNG (JPEG when large) of one component's host element as rendered now: `component` (instance id, class or tag) or `selector` (CSS). Drawn from computed styles without changing the app; secret fields and masked elements are hidden. At most 2000 px.",
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description:
            'Instance id (e.g. c12), class name (e.g. ProductCard) or host tag (e.g. app-root).',
        },
        selector: { type: 'string', description: 'A CSS selector, such as .card > h2.' },
        page: {
          type: 'string',
          description:
            'Page id, when more than one tab reports (see pangular:list-pages). Without it, ids, class names and tags are searched on every page, newest first; a CSS selector uses the newest page.',
        },
      },
    },
    handler: async (args: Record<string, unknown>): Promise<{ markdown: string }> => {
      const page = pageArgument(args);
      const all = byRecency(deps.pages());
      if (page && !all.some((entry) => entry.pageId === page)) {
        return { markdown: unknownPageText(page, all, 'a component tree') };
      }
      const asked = page ? all.find((entry) => entry.pageId === page) : undefined;
      const native = asked && needsDomText(asked.pageId, asked.platform, 'a screenshot');
      if (native) return { markdown: native };
      // A native app has no DOM to draw, so only browser pages are searched.
      const scope = (page ? all.filter((entry) => entry.pageId === page) : all).filter(
        (entry) => entry.roots.length > 0 && !needsDomText(entry.pageId, entry.platform, ''),
      );
      if (!scope.length) {
        const app = all.find((entry) => needsDomText(entry.pageId, entry.platform, ''));
        if (app) return { markdown: needsDomText(app.pageId, app.platform, 'a screenshot')! };
        return {
          markdown:
            'No page reports a component tree, so there is nothing to capture. Open the app in a browser with the devtools connected.',
        };
      }
      const component =
        typeof args?.['component'] === 'string' ? args['component'].trim() : undefined;
      const css = typeof args?.['selector'] === 'string' ? args['selector'].trim() : undefined;
      const selector = component ?? css ?? '';
      if (!selector || (component !== undefined && css !== undefined)) {
        return {
          markdown: refusal(
            'Pass one of `component` (an instance id, class name or host tag) or `selector` (a CSS selector).',
          ),
        };
      }
      const hits = component !== undefined ? findComponents(scope, component) : [];
      const [hit] = hits;
      if (component !== undefined && !hit) {
        const cut = truncationText(scope);
        return {
          markdown: refusal(
            `No component instance matches \`${component}\`${page ? ` on page \`${page}\`` : ''}, so nothing was captured. Pass an instance id, class name or host tag from pangular:list-components, or a CSS selector as \`selector\`.${cut ? ` ${cut}` : ''}`,
          ),
        };
      }
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
      // The image travels as its own MCP block next to the text. Devframe keeps
      // the blocks off the plain value, so the panel's RPC never carries the base64.
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
