import type { HttpCall } from './http-rules.ts';
import { redactText, redactUrl } from './router.ts';
import { clip } from './text.ts';

/**
 * Hides secret query values, tokens and `redaction.secretNames` in a call's
 * URLs and error, the same way the router redacts its URLs.
 */
export function redactCall(call: HttpCall): HttpCall {
  return {
    ...call,
    url: redactUrl(call.url),
    ...(call.pageUrl === undefined ? {} : { pageUrl: redactUrl(call.pageUrl) }),
    ...(call.error === undefined ? {} : { error: clip(redactText(call.error), 500) }),
  };
}
