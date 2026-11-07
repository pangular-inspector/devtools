import { appIdOf } from './http-hydration.ts';
import { decodePayload, type PayloadSummary } from './http-payload.ts';

/** What the page answers to a refetch: the new payload, or why there is none. */
export type PayloadRefetch = { payload: PayloadSummary; status: number } | { error: string };

/** The longest HTML a refetch reads, so a huge page can't stall the overlay. */
export const MAX_REFETCH_HTML = 5_000_000;

export interface RefetchEnv {
  fetch?: typeof fetch;
  parse?: (html: string) => Document | null;
}

const parseHtml = (html: string): Document | null =>
  typeof DOMParser === 'function' ? new DOMParser().parseFromString(html, 'text/html') : null;

/**
 * Asks the server to render `url` again, with the page's own cookies, and
 * reads the TransferState payload out of the HTML it sends. The HTML is
 * parsed into a detached document: its scripts don't run and nothing is
 * written into the app's page. The result is not masked yet; the caller
 * runs it through `sanitizePayload` before it leaves the page.
 */
export async function refetchPayload(url: string, env: RefetchEnv = {}): Promise<PayloadRefetch> {
  const fetchFn = env.fetch ?? (typeof fetch === 'function' ? fetch : undefined);
  const parse = env.parse ?? parseHtml;
  if (!fetchFn) return { error: 'This platform has no fetch, so the payload cannot be fetched.' };
  let response: Response;
  try {
    response = await fetchFn(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'text/html' },
    });
  } catch (error) {
    return { error: `The request failed: ${error instanceof Error ? error.message : 'unknown'}.` };
  }
  const type = response.headers.get('content-type') ?? '';
  if (!/html/i.test(type)) {
    return {
      error: `The server answered ${response.status} with ${type ? `\`${type.split(';')[0]}\`` : 'no content type'}, not HTML.`,
    };
  }
  const html = await response.text();
  if (html.length > MAX_REFETCH_HTML) {
    return { error: `The HTML is larger than ${MAX_REFETCH_HTML} characters, so it was not read.` };
  }
  const doc = parse(html);
  if (!doc) return { error: 'This platform cannot parse HTML, so the payload cannot be read.' };
  return { payload: decodePayload(doc, appIdOf(doc)), status: response.status };
}
