import { SSR_REQUEST_HEADER, ssrRegistry, touchSsrRequest } from './ssr-registry.ts';
import { runInSsrRequest } from './ssr-context.ts';
import {
  OVERRIDE_HEADER,
  SNIFF_BYTES,
  applyStateEdits,
  beginSsrTrace,
  clientRenderOverride,
  endSsrTrace,
  isHtmlType,
  mergeServerTiming,
  noteClientRender,
  ssrTimingEntries,
  stateEditsFor,
  wantsHtml,
  type SsrTrace,
} from './ssr-trace.ts';

/** Told to the user when the handler returned a body that was already compressed. */
export const FETCH_COMPRESSED_NOTE =
  'the body was already compressed: wrap the handler with withPangularSsr inside any compression';

export interface PangularSsrOptions {
  /** Path prefixes that are never traced, such as the hub base. */
  skip?: string[];
  /**
   * The app's browser build folder, which holds `index.csr.html`. Needed to
   * force a Client render from the panel. It is read with `node:fs` when an
   * override asks for it.
   */
  browserDistFolder?: string;
}

/** A web-standard request handler, such as `AngularAppEngine.handle` or `app.fetch`. */
export type WebRequestHandler<Args extends unknown[], Result> = (
  request: Request,
  ...rest: Args
) => Result | Promise<Result>;

function encoded(headers: Headers): boolean {
  const value = headers.get('content-encoding')?.trim().toLowerCase();
  return !!value && value !== 'identity';
}

function withHeaders(request: Request, change: (headers: Headers) => void): Request {
  const headers = new Headers(request.headers);
  change(headers);
  return new Request(request, { headers });
}

function pathOf(request: Request): string {
  try {
    const url = new URL(request.url);
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}

async function readShell(folder: string | undefined): Promise<string | undefined> {
  if (!folder) return undefined;
  try {
    const { readFile } = await import('node:fs/promises');
    const separator = folder.endsWith('/') || folder.endsWith('\\') ? '' : '/';
    return await readFile(`${folder}${separator}index.csr.html`, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * A copy of the response with `Server-Timing` merged in. Responses from `fetch()` or
 * `Response.redirect()` have headers that can't change, so the copy always gets new ones.
 */
function timedResponse(
  response: Response,
  body: BodyInit | null,
  timing: string[],
  change?: (headers: Headers) => void,
): Response {
  const headers = new Headers(response.headers);
  headers.set(
    'server-timing',
    mergeServerTiming([response.headers.get('server-timing') ?? undefined], timing),
  );
  change?.(headers);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * Counts and sniffs the body as it streams to the client, and ends the trace
 * when the last chunk is read or the client goes away.
 */
function tracedBody(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: Uint8Array) => void,
  onEnd: (aborted: boolean) => void,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          onEnd(false);
          return;
        }
        onChunk(value);
        controller.enqueue(value);
      } catch (error) {
        onEnd(true);
        controller.error(error);
      }
    },
    cancel(reason) {
      onEnd(true);
      return reader.cancel(reason);
    },
  });
}

/**
 * Traces the SSR requests a web-standard handler answers, the same way
 * `ssrMiddleware` does for Express: each HTML request gets an id, sent to the
 * render in the `x-pangular-ssr-id` request header and back to the browser in
 * `Server-Timing`, and the render is recorded for the SSR & HTTP tab.
 *
 * Wrap the handler that renders pages, such as
 * `withPangularSsr((request) => angularApp.handle(request))`. A `null` or
 * `undefined` answer (no matching route) passes through untraced. When the
 * http inspector is off, the wrapper calls the handler directly.
 */
export function withPangularSsr<Args extends unknown[], Result extends Response | null | undefined>(
  handler: WebRequestHandler<Args, Result>,
  options: PangularSsrOptions = {},
): (request: Request, ...rest: Args) => Promise<Result> {
  const skip = options.skip ?? [];
  return async (request, ...rest) => {
    if (!ssrRegistry().record) return handler(request, ...rest);
    const url = pathOf(request);
    if (!wantsHtml(request.method, url, request.headers.get('accept'), skip)) {
      // Only an id this wrapper handed out may reach a render.
      const clean = request.headers.has(SSR_REQUEST_HEADER)
        ? withHeaders(request, (headers) => headers.delete(SSR_REQUEST_HEADER))
        : request;
      // Untraced, so its server calls never link to a render running alongside.
      return runInSsrRequest(undefined, () => handler(clean, ...rest));
    }
    const trace = beginSsrTrace(url)!;
    const finish = traceFinisher(trace, request.method, url);

    const forceClient = clientRenderOverride(url);
    const shell =
      forceClient &&
      noteClientRender(
        trace,
        forceClient,
        await readShell(options.browserDistFolder),
        'no index.csr.html: pass browserDistFolder to withPangularSsr',
      );
    if (shell) {
      const headers = new Headers({
        'content-type': 'text/html; charset=utf-8',
        [OVERRIDE_HEADER]: 'client-render',
      });
      const response = new Response(request.method === 'HEAD' ? null : shell, { headers });
      return finish.response(response) as Result;
    }

    const edits = stateEditsFor(url);
    const tagged = withHeaders(request, (headers) => {
      headers.set(SSR_REQUEST_HEADER, trace.id);
      // A browser that has the page sends its validators, and a prerendered page then answers
      // 304, which would leave the cached copy without the edit.
      if (edits.length) {
        headers.delete('if-none-match');
        headers.delete('if-modified-since');
      }
    });
    let response: Result;
    try {
      response = await runInSsrRequest(trace.id, () => handler(tagged, ...rest));
    } catch (error) {
      finish.failed();
      throw error;
    }
    if (!response) {
      finish.skipped();
      return response;
    }
    return (
      edits.length ? await finish.edited(response, edits) : finish.response(response)
    ) as Result;
  };
}

function traceFinisher(trace: SsrTrace, method: string, url: string) {
  let done = false;
  let renderMs = 0;
  let bytes = 0;
  let sniff = '';
  const decoder = new TextDecoder();

  const end = (status: number, headers: Headers, aborted: boolean) => {
    if (done) return;
    done = true;
    endSsrTrace(trace, {
      method,
      url,
      status,
      renderMs,
      bytes,
      sniff,
      header: (name) => headers.get(name) ?? undefined,
      compressed: encoded(headers),
      aborted,
    });
  };
  const count = (chunk: Uint8Array) => {
    touchSsrRequest(trace.active);
    bytes += chunk.byteLength;
    if (sniff.length < SNIFF_BYTES) {
      sniff += decoder.decode(chunk.subarray(0, SNIFF_BYTES), { stream: true });
    }
  };
  const stamp = () => {
    renderMs ||= Date.now() - trace.at;
    return ssrTimingEntries(trace, renderMs);
  };

  return {
    /** The handler answered: add `Server-Timing` and trace the body as it streams. */
    response(response: Response): Response {
      const timing = stamp();
      const { body } = response;
      if (!body) {
        const out = timedResponse(response, null, timing);
        end(out.status, out.headers, false);
        return out;
      }
      const headers = new Headers(response.headers);
      // A Response dropped unread never ends its trace: the sweep ends it as aborted.
      trace.active.abandon = () => end(response.status, headers, true);
      return timedResponse(
        response,
        tracedBody(body, count, (aborted) => end(response.status, headers, aborted)),
        timing,
      );
    },
    /** State-edit overrides matched: hold the HTML, edit its TransferState, then send it. */
    async edited(response: Response, edits: ReturnType<typeof stateEditsFor>): Promise<Response> {
      const held = new Uint8Array(await response.arrayBuffer());
      const isHtml = isHtmlType(response.headers.get('content-type'));
      const { out, edited } = applyStateEdits(trace, held, edits, {
        isHtml,
        compressed: isHtml && encoded(response.headers),
        compressedNote: FETCH_COMPRESSED_NOTE,
      });
      const body: Uint8Array<ArrayBuffer> =
        typeof out === 'string' ? new TextEncoder().encode(out) : new Uint8Array(out);
      count(body);
      const nullBody = response.status === 204 || response.status === 304;
      const sent = timedResponse(response, nullBody ? null : body, stamp(), (headers) => {
        headers.set(OVERRIDE_HEADER, 'state-edit');
        headers.set('content-length', String(body.byteLength));
        // The validators describe the unedited page. Kept, they would let the browser
        // revalidate its edited copy with a 304 after the override is removed.
        if (edited) {
          headers.delete('etag');
          headers.delete('last-modified');
        }
      });
      end(sent.status, sent.headers, false);
      return sent;
    },
    /** The handler threw: the framework answers 500. */
    failed() {
      end(500, new Headers(), false);
    },
    /** The handler had no page for this URL. */
    skipped() {
      done = true;
      ssrRegistry().active.delete(trace.id);
    },
  };
}
