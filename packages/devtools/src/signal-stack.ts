import { redactText } from './serialize.ts';

/** App frames kept per write. */
export const STACK_FRAMES = 3;
/** Frames V8 keeps while a write stack is taken; Angular and zone.js sit above the app's. */
const CAPTURE_DEPTH = 40;
const MAX_FRAME = 200;

/**
 * Frames that are not app code: Angular and other packages (also prebundled
 * as `@angular_core.js` or under `.vite/deps`), zone.js, rxjs, this package's
 * own overlay, and engine frames without a file.
 */
const NOT_APP_FILE =
  /@angular[/_]|node_modules|\.vite\/deps|(?<![\w-])rxjs(?![\w-])|(?<![\w-])zone\.js|(?<![\w-])zone-[\w-]*\.[mc]?js|(?<![\w-])signal-(history|stack|watch)\.[mc]?[jt]s|(packages|@pangular-inspector)[/_]devtools[/_](dist|src[/_](?!__tests__)|overlay)|<anonymous>|\(native\)/;

/**
 * Angular's signal write path and change detection, by function name, for a
 * build that bundles Angular into a chunk without a package path. Compiled
 * template listeners (`App_Template_button_click_0_listener`) stay: they say
 * which template event wrote the signal.
 */
const NOT_APP_FUNCTION =
  /^(signalSetFn|signalUpdateFn|linkedSignalSetFn|linkedSignalUpdateFn|runPostSignalSetFn|signalValueChanged|producer[A-Z]\w*|consumer[A-Z]\w*|ɵ\w*|set|update|Object\.(set|update)|signalFn\.(set|update)|wrapListener\w*|executeListenerWithErrorHandling|handleError|invokeTask|runTask|invoke|onInvoke\w*|ZoneDelegate\.\w+|_ZoneDelegate\.\w+|Zone\.\w+|_Zone\.\w+|globalCallback|globalZoneAwareCallback|refreshView|executeTemplate|detectChangesIn\w*|callHook\w*)$/;

/**
 * The stack of the code running now, or undefined when the engine gives none.
 * It raises `Error.stackTraceLimit` only for this call, since the app's frames
 * come after the overlay's hook, Angular's set path and zone.js.
 */
export function captureStack(): string | undefined {
  const holder = Error as { stackTraceLimit?: number };
  const limit = holder.stackTraceLimit;
  try {
    if (typeof limit === 'number' && limit < CAPTURE_DEPTH) holder.stackTraceLimit = CAPTURE_DEPTH;
    return new Error().stack;
  } catch {
    return undefined;
  } finally {
    if (typeof limit === 'number') holder.stackTraceLimit = limit;
  }
}

function frameOf(line: string): { name: string; where: string } {
  // V8: `at name (where)` or `at where`; Firefox and Safari: `name@where`.
  const match = line.match(/^(.*?)\s*\((.*)\)$/) ?? line.match(/^(.*?)@(.*)$/);
  const name = (match ? match[1]! : '').trim().replace(/^async\s+/, '');
  const where = (match ? match[2]! : line)
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^\/@fs\//, '/')
    .replace(/\?[^:]*(?=:\d)/, '');
  return { name, where };
}

/**
 * The first `max` app frames of a stack, as `name (file:line:column)` with the
 * origin and query strings removed, after the redaction helpers. Frames of
 * Angular, packages, zone.js and the overlay are skipped.
 */
export function appFrames(stack: string | undefined, max = STACK_FRAMES): string[] {
  if (!stack) return [];
  const frames: string[] = [];
  for (const raw of stack.split('\n')) {
    const line = raw.trim().replace(/^at\s+/, '');
    // The `Error` header, and lines that are not frames at all.
    if (!line || /^[\w$.]*Error(:|$)/.test(line) || !/[:@(]/.test(line)) continue;
    if (NOT_APP_FILE.test(line)) continue;
    const { name, where } = frameOf(line);
    const bare = name.replace(/^new\s+/, '');
    if (bare && NOT_APP_FUNCTION.test(bare)) continue;
    const text = name ? `${name.replace(/^_+/, '')} (${where})` : where;
    frames.push(redactText(text.slice(0, MAX_FRAME)));
    if (frames.length >= max) break;
  }
  return frames;
}
