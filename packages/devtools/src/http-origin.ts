// Which Angular API most likely started an HttpClient call, read from the
// call stack when the request reaches `withPangular()`. A heuristic: it
// needs readable function names (development builds), so the panel and the
// agent tools say "likely".
//
// Names checked against @angular/core and @angular/common 22 (fesm2022):
// - `httpResource()` builds an `HttpResourceImpl`, whose loader subscribes to
//   HttpClient from `ResourceImpl.loadEffect` (`_resource-chunk.mjs`), so the
//   frames read `HttpResourceImpl.loaderFn` and `HttpResourceImpl.loadEffect`.
// - `resource()` and `rxResource()` run their loader or stream from the same
//   `loadEffect` on a plain `ResourceImpl`.
// - `@defer` renders its content in `applyDeferBlockState` or
//   `renderDeferBlockState` (`_debug_node-chunk.mjs`), so a request made while
//   the deferred content is created, such as in a constructor, has them on
//   the stack. One made later, in `ngOnInit` for example, does not.

export type CallOrigin = 'httpResource' | 'resource' | 'defer';

export const CALL_ORIGINS: readonly CallOrigin[] = ['httpResource', 'resource', 'defer'];

const HTTP_RESOURCE = /\bHttpResourceImpl\d*\b/;
const RESOURCE = /\bloadEffect\b/;
const DEFER =
  /\b(?:applyDeferBlockState|applyDeferBlockStateWithScheduling|renderDeferBlockState|renderDeferStateAfterResourceLoading)\d*\b/;

/** The origin a stack trace points to, the most specific first. */
export function originFromStack(stack: string | undefined): CallOrigin | undefined {
  if (!stack) return undefined;
  if (HTTP_RESOURCE.test(stack)) return 'httpResource';
  if (RESOURCE.test(stack)) return 'resource';
  if (DEFER.test(stack)) return 'defer';
  return undefined;
}

/** Frames to keep: the HttpClient and interceptor frames alone take a dozen. */
const STACK_FRAMES = 80;

/** The likely origin of the request being handled now. */
export function currentCallOrigin(): CallOrigin | undefined {
  const holder = Error as { stackTraceLimit?: number };
  const limit = holder.stackTraceLimit;
  try {
    if (typeof limit === 'number') holder.stackTraceLimit = STACK_FRAMES;
    return originFromStack(new Error().stack);
  } catch {
    return undefined;
  } finally {
    if (typeof limit === 'number') holder.stackTraceLimit = limit;
  }
}

/** A valid origin from a report, or undefined. */
export function sanitizeOrigin(value: unknown): CallOrigin | undefined {
  return CALL_ORIGINS.find((origin) => origin === value);
}

/** How the panel and agents name an origin: `likely httpResource`. */
export function originText(origin: CallOrigin): string {
  return `likely ${origin === 'defer' ? '@defer' : origin === 'resource' ? 'resource()' : 'httpResource()'}`;
}
