// Which tab an Analog server call belongs to, decided on the dev server when
// the call is logged. Best source first:
//
// 1. the `x-pangular-page` header the app's dev interceptor sends on its own
//    same-origin requests;
// 2. the render id: the Vite plugin gives each page render an id, sends it to
//    the browser in Server-Timing and to the render's own `/_analog` requests
//    in `x-pangular-render`; the page reports the id, which ties the render
//    and its calls to the page;
// 3. the `Referer`, only when exactly one live page shows that path.
//
// Anything else stays untagged.

import {
  ANALOG_PAGE_HEADER,
  ANALOG_RENDER_HEADER,
  isPageTag,
  isRenderId,
  newRenderId,
} from './analog-call-tags.ts';

const MAX_RENDERS = 200;
/** How long a render id waits for its page to report it. */
export const RENDER_TTL_MS = 5 * 60_000;

const renders = new Map<string, { at: number; pageId?: string }>();
let pagesAt: ((path: string) => string[]) | undefined;

/** Installs how the log finds the live pages that show a path (from the Analog page reports). */
export function setPagesAtPath(find: ((path: string) => string[]) | undefined): void {
  pagesAt = find;
}

function prune(now: number) {
  for (const [id, render] of renders) {
    if (renders.size <= MAX_RENDERS && now - render.at <= RENDER_TTL_MS) break;
    renders.delete(id);
  }
}

/** A new render id for a page request, kept so the render's own requests can name it. */
export function beginRender(now = Date.now()): string {
  prune(now);
  const id = newRenderId();
  renders.set(id, { at: now });
  return id;
}

/** The page a render was tied to, or undefined. Undefined too for a render id this server never gave out. */
export function renderPage(id: string): string | undefined {
  return renders.get(id)?.pageId;
}

/**
 * Ties a render to the page that reported its id. The first page wins, so a
 * second tab can't take over a render it did not load. Returns whether the
 * render is now tied to `pageId`.
 */
export function bindRender(id: unknown, pageId: string): boolean {
  if (!isRenderId(id)) return false;
  const render = renders.get(id);
  if (!render) return false;
  render.pageId ??= pageId;
  return render.pageId === pageId;
}

/** Forgets the renders of the given pages, so their ids tag nothing more. */
export function forgetRenders(pageIds: readonly string[]): void {
  for (const [id, render] of renders) {
    if (render.pageId && pageIds.includes(render.pageId)) renders.delete(id);
  }
}

export function clearRenders(): void {
  renders.clear();
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function refererPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).pathname;
  } catch {
    return undefined;
  }
}

export interface CallTag {
  pageId?: string;
  renderId?: string;
}

/**
 * The page and render a logged request belongs to. A page request gets a new
 * render id (`render`) instead; its page is known once the page reports it.
 */
export function tagRequest(
  headers: Record<string, string | string[] | undefined>,
  kind: string,
  render?: string,
): CallTag {
  const tag: CallTag = {};
  const page = header(headers[ANALOG_PAGE_HEADER]);
  if (isPageTag(page)) tag.pageId = page;
  const renderId = render ?? header(headers[ANALOG_RENDER_HEADER]);
  if (isRenderId(renderId) && renders.has(renderId)) {
    tag.renderId = renderId;
    tag.pageId ??= renderPage(renderId);
  }
  // A document request's Referer is the page it came from, often another tab's.
  if (!tag.pageId && !tag.renderId && kind !== 'page') {
    const path = refererPath(header(headers['referer']));
    const pages = path ? (pagesAt?.(path) ?? []) : [];
    if (pages.length === 1) tag.pageId = pages[0];
  }
  return tag;
}
