import type { HttpRequest } from '@angular/common/http';
import {
  ANALOG_PAGE_HEADER,
  ANALOG_RENDER_HEADER,
  isAnalogEndpoint,
  sameOrigin,
} from './analog-call-tags.ts';
import { httpRegistry, type HttpSide } from './http-rules.ts';

/**
 * The request as sent on, with the header that ties it to its tab in the
 * Analog call log: in the browser, the page id on a same-origin request (a
 * custom header there adds no CORS preflight); on the server, the render id on
 * the render's own `/_analog` requests. Nothing is added when there is no id,
 * and the recorded call keeps the app's own headers.
 */
export function analogTagged<T>(
  req: HttpRequest<T>,
  side: HttpSide,
  render: () => string | undefined,
): HttpRequest<T> {
  try {
    if (side === 'client') {
      const pageId = httpRegistry().pageId;
      if (!pageId || req.headers.has(ANALOG_PAGE_HEADER)) return req;
      if (typeof location === 'undefined' || !sameOrigin(req.url, location)) return req;
      return req.clone({ setHeaders: { [ANALOG_PAGE_HEADER]: pageId } });
    }
    if (!isAnalogEndpoint(req.url)) return req;
    const renderId = render();
    return renderId ? req.clone({ setHeaders: { [ANALOG_RENDER_HEADER]: renderId } }) : req;
  } catch {
    return req;
  }
}
