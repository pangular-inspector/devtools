import { keepaliveDue } from './change-detection.ts';
import { CONSOLE_LEVELS, tapConsole, type ConsoleLevel } from './console-tap.ts';
import { elementById, elementId } from './element-id.ts';
import { enrichExplain, explainError, rawMessage, type RecentWrites } from './error-explain.ts';
import type { HydrationDebugNg } from './hydration.ts';
import { className } from './injector-tree.ts';
import { ngCodeOf, ngCodeUrl } from './ng-error-codes.ts';
import { providerOf, redactMessage, redactUrl, type RouterDebugApi } from './router.ts';
import { redactText, serialize } from './serialize.ts';
import { clip } from './text.ts';
import type {
  ConsoleEntry,
  ErrorGroup,
  ErrorOwner,
  ErrorSource,
  ErrorsReport,
} from './rpc/errors-tools.ts';

/** Error groups a page keeps; the least recent goes first. */
export const MAX_ERROR_GROUPS = 100;
/** Console entries a page keeps; the oldest goes first. */
export const MAX_CONSOLE_ENTRIES = 200;
export const MAX_MESSAGE = 500;
export const MAX_STACK = 4000;
const MAX_STACK_LINES = 40;
export const MAX_CONSOLE_TEXT = 500;
/** The same error object or value seen again this soon is the same occurrence. */
const SAME_OCCURRENCE_MS = 1000;
/** Elements walked to find a component by class name, once per new error. */
const MAX_OWNER_SCAN = 5000;
const PUSH_DELAY_MS = 250;
const VALUE_LIMITS = { depth: 3, keys: 10, items: 10, text: 200, budget: 100 };

type AnyRecord = Record<string, any>;

/** The parts of `window.ng` this collector reads. */
export interface ErrorsDebugNg extends RouterDebugApi, HydrationDebugNg {
  getComponent?: (el: Element) => unknown;
  getOwningComponent?: (el: Element) => unknown;
  getHostElement?: (component: unknown) => Element | null;
  getInjector?: (el: Element) => unknown;
}

interface Rpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
  };
}

export interface ErrorsCollector {
  /** Pushes what changed, or a keepalive when nothing did. */
  push(): Promise<void>;
  /** Stops pushing and tells the server the page left (`pagehide`). */
  leave(): void;
  /** Starts again after `leave` (a page restored from the back/forward cache). */
  resume(): void;
  stop(): void;
}

export interface ErrorsOptions {
  /** The refresh interval, so keepalives come before the server expires the page. */
  tickMs?: () => number;
  /** Where errors and rejections come from; the page's window by default. */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  now?: () => number;
  /** Recent named signal writes, for the NG0100 explainer (`error-explain.ts`). */
  writes?: RecentWrites;
  /**
   * Whether a panel or an agent watches (`page-lease.ts`). While it is false
   * the page keeps capturing but only sends keepalives; the next push after
   * it turns true sends everything captured meanwhile.
   */
  active?: () => boolean;
}

interface Group extends ErrorGroup {
  key: string;
  /** Class names from the message and stack, for finding the owner later. */
  candidates: string[];
  /** When the explainer still waits for the owner and the signal writes, from the next push. */
  explainAt?: number;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isErrorLike(
  value: unknown,
): value is { name?: unknown; message?: unknown; stack?: unknown } {
  return (
    value instanceof Error ||
    (!!value &&
      typeof value === 'object' &&
      typeof read(() => (value as AnyRecord)['message'], undefined) === 'string' &&
      typeof read(() => (value as AnyRecord)['stack'], undefined) === 'string')
  );
}

/** A short, masked text for any value: strings as they are, others serialized. */
export function valueText(value: unknown, max = MAX_CONSOLE_TEXT): string {
  if (typeof value === 'string') return clip(redactText(value), max);
  if (isErrorLike(value)) {
    const name = read(() => String(value.name ?? 'Error'), 'Error');
    const message = read(() => String(value.message ?? ''), '');
    return clip(redactText(message ? `${name}: ${message}` : name), max);
  }
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return `[Function ${read(() => value.name, '') || 'anonymous'}]`;
  if (typeof value !== 'object' || value === null) return String(value);
  const safe = serialize(value, VALUE_LIMITS);
  const text = read(() => (typeof safe === 'string' ? safe : JSON.stringify(safe)), '[Unreadable]');
  // `serialize` masks secret field names; the text may still carry a token.
  return clip(redactText(text ?? ''), max);
}

/**
 * The text of a console call: `%c` styles dropped with their CSS argument,
 * other arguments joined like the console shows them.
 */
export function consoleText(args: readonly unknown[]): string {
  const parts = [...args];
  if (typeof parts[0] === 'string' && parts[0].includes('%c')) {
    const styles = parts[0].split('%c').length - 1;
    parts[0] = parts[0].replace(/%c/g, '');
    parts.splice(1, styles);
  }
  return clip(
    parts
      .map((part) => valueText(part))
      .join(' ')
      .trim(),
    MAX_CONSOLE_TEXT,
  );
}

function stackOf(value: unknown): string | undefined {
  const stack = read(() => (value as AnyRecord)?.['stack'], undefined);
  if (typeof stack !== 'string' || !stack.trim()) return undefined;
  const lines = stack.split('\n').slice(0, MAX_STACK_LINES).join('\n');
  return clip(redactText(lines), MAX_STACK);
}

const NOT_COMPONENTS = new Set([
  'Object',
  'Array',
  'Promise',
  'Function',
  'Error',
  'Zone',
  'ZoneDelegate',
  'ZoneTask',
  'HTMLElement',
  'EventTarget',
  'ErrorHandler',
]);

/**
 * Class names an error points at: the component Angular names in its message
 * ("used in the 'App' component template", "Expression location: App
 * component") first, then the classes of the stack frames, compiled template
 * functions (`App_Template`, `App_Conditional_2_Template_button_click_0_listener`)
 * included. Only names that turn out to be components on the page are used.
 */
export function ownerCandidates(message: string, stack: string | undefined): string[] {
  const names: string[] = [];
  const add = (raw: string | undefined) => {
    const name = raw?.replace(/^_+(?=[A-Za-z$])/, '');
    if (
      name &&
      /^[A-Za-z$][\w$]*$/.test(name) &&
      !NOT_COMPONENTS.has(name) &&
      !names.includes(name)
    ) {
      names.push(name);
    }
  };
  for (const match of message.matchAll(
    /(?:used in the '|in the template of |Expression location: |check the ")_?([A-Za-z$][\w$]*)['"]?(?: component)?/g,
  )) {
    add(match[1]);
  }
  // A missing provider names its requester first: `Path: App -> Api.` or `R3InjectorError(...)[App -> Api]`.
  const path = / Path: (.+?)\.(?:\s|$)/.exec(message)?.[1] ?? /\)\[([^\]]+)\]/.exec(message)?.[1];
  for (const name of path?.split(' -> ').slice(0, -1) ?? []) add(name.trim());
  for (const line of (stack ?? '').split('\n').slice(0, MAX_STACK_LINES)) {
    const fn =
      /^\s*at\s+(?:new\s+|async\s+)?([\w$.]+)/.exec(line)?.[1] ??
      /^([\w$.]+)@/.exec(line.trim())?.[1];
    if (!fn) continue;
    const [first] = fn.split('.');
    if (fn.includes('.')) add(first);
    // `App_Conditional_2_Template_button_click_0_listener`: every prefix ending before a `_`, longest first.
    const bare = first!.replace(/^_+/, '');
    if (/_(?:\w+_)*Template/.test(bare)) {
      const pieces = bare.split('_');
      for (let n = pieces.length - 1; n >= 1; n--) add(pieces.slice(0, n).join('_'));
    }
  }
  return names;
}

/**
 * Captures the page's errors and console calls: Angular's `ErrorHandler`
 * (wrapped, so the app's handler still runs), `window` `error` and
 * `unhandledrejection`, and every console level through the shared console
 * tap. Errors are grouped by message with a count, linked to the owning
 * component when it can be found, masked and capped, and pushed as
 * `push-errors` with the page id.
 */
export function attachErrors(
  my: Rpc,
  pageId: string,
  getNg: () => ErrorsDebugNg | undefined,
  options: ErrorsOptions = {},
): ErrorsCollector {
  const now = options.now ?? Date.now;
  const tickMs = options.tickMs ?? (() => 0);
  const target = options.target ?? (typeof window === 'undefined' ? undefined : window);
  const groups = new Map<string, Group>();
  const changedGroups = new Set<Group>();
  const consoleEntries: ConsoleEntry[] = [];
  const changedEntries = new Set<ConsoleEntry>();
  const seenObjects = new WeakMap<object, number>();
  let lastPrimitive: { value: unknown; at: number } | null = null;
  let nextGroup = 0;
  let nextEntry = 0;
  let droppedErrors = 0;
  let droppedConsole = 0;
  let removedIds: string[] = [];
  let full = true;
  let sentAt = 0;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let left = false;
  let stopped = false;
  let queue = Promise.resolve();
  let handler: { instance: AnyRecord; wrapped: Function; original: unknown; own: boolean } | null =
    null;
  let handlerRoot: Element | null = null;

  const schedulePush = () => {
    if (left || stopped || pushTimer) return;
    pushTimer = setTimeout(() => {
      pushTimer = undefined;
      void push().catch(() => {});
    }, PUSH_DELAY_MS);
  };

  /** True when this value was just recorded from another source (Angular forwards window errors to its handler). */
  const repeated = (value: unknown, at: number): boolean => {
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      const seen = seenObjects.get(value);
      seenObjects.set(value, at);
      return seen !== undefined && at - seen < SAME_OCCURRENCE_MS;
    }
    const same =
      lastPrimitive && lastPrimitive.value === value && at - lastPrimitive.at < SAME_OCCURRENCE_MS;
    lastPrimitive = { value, at };
    return !!same;
  };

  const ownerOfElement = (el: unknown): ErrorOwner | undefined => {
    const ng = getNg();
    if (!ng?.getOwningComponent || !ng.getHostElement || !(el instanceof Element)) return undefined;
    const component = read(() => ng.getOwningComponent!(el), null);
    if (!component || typeof component !== 'object') return undefined;
    const host = read(() => ng.getHostElement!(component), null);
    if (!(host instanceof Element)) return undefined;
    return { id: elementId(host), name: className((component as object).constructor) };
  };

  /** The element whose listener is running, when an error comes from an event handler. */
  const eventOwner = (): ErrorOwner | undefined => {
    const event = read(() => (globalThis as { event?: unknown }).event, undefined);
    if (!(typeof Event !== 'undefined' && event instanceof Event)) return undefined;
    return ownerOfElement(event.currentTarget) ?? ownerOfElement(event.target);
  };

  const ownerByName = (names: readonly string[]): ErrorOwner | undefined => {
    const ng = getNg();
    if (!names.length || !ng?.getComponent || typeof document === 'undefined') return undefined;
    const found = new Map<string, Element>();
    const walker = document.createTreeWalker(document.body ?? document.documentElement, 1);
    for (let n = 0, node = walker.currentNode; node && n < MAX_OWNER_SCAN; n++) {
      const component = read(() => ng.getComponent!(node as Element), null);
      if (component && typeof component === 'object') {
        const name = className((component as object).constructor);
        if (!found.has(name)) found.set(name, node as Element);
      }
      node = walker.nextNode() as Node;
    }
    for (const name of names) {
      const host = found.get(name);
      if (host) return { id: elementId(host), name };
    }
    return undefined;
  };

  const record = (value: unknown, source: ErrorSource, fallbackMessage?: string) => {
    if (stopped) return;
    const at = now();
    if (repeated(value, at)) return;
    let message = valueText(value, MAX_MESSAGE);
    if ((value === undefined || value === null) && fallbackMessage) {
      message = clip(redactText(fallbackMessage), MAX_MESSAGE);
    }
    const name = isErrorLike(value)
      ? read(() => String(value.name ?? 'Error'), 'Error')
      : undefined;
    const code = ngCodeOf(value, message);
    const key = `${code ?? ''}|${message}`;
    let group = groups.get(key);
    if (group) {
      group.count++;
      group.lastAt = at;
      if (!group.sources.includes(source)) group.sources.push(source);
    } else {
      const stack = stackOf(value);
      const explain = explainError(code, rawMessage(value), stack);
      group = {
        key,
        id: `e${++nextGroup}`,
        message,
        count: 1,
        firstAt: at,
        lastAt: at,
        sources: [source],
        candidates: ownerCandidates(message, stack),
        ...(name ? { name: clip(redactText(name), 80) } : {}),
        ...(code ? { code } : {}),
        ...(code && ngCodeUrl(code) ? { docUrl: ngCodeUrl(code) } : {}),
        ...(stack ? { stack } : {}),
        ...(explain ? { explain, explainAt: at } : {}),
      };
      groups.set(key, group);
      evictGroups();
    }
    if (!group.owner) {
      const owner = source === 'promise' ? undefined : eventOwner();
      if (owner) group.owner = owner;
    }
    changedGroups.add(group);
    schedulePush();
  };

  const evictGroups = () => {
    while (groups.size > MAX_ERROR_GROUPS) {
      let oldest: Group | undefined;
      for (const group of groups.values()) {
        if (!oldest || group.lastAt < oldest.lastAt) oldest = group;
      }
      if (!oldest) return;
      groups.delete(oldest.key);
      changedGroups.delete(oldest);
      removedIds.push(oldest.id);
      droppedErrors++;
    }
  };

  const onConsole = (level: ConsoleLevel, args: readonly unknown[]) => {
    if (stopped) return;
    // Angular's default ErrorHandler logs `console.error('ERROR', error)`: count
    // it as a handler error when the handler could not be wrapped.
    if (level === 'error' && args[0] === 'ERROR' && args.length === 2 && !handler) {
      record(args[1], 'handler');
    }
    const text = consoleText(args);
    if (!text || text.startsWith('[pangular]')) return;
    const at = now();
    const last = consoleEntries.at(-1);
    if (last && last.level === level && last.text === text) {
      last.count++;
      last.at = at;
      changedEntries.add(last);
      schedulePush();
      return;
    }
    const code = ngCodeOf(undefined, text);
    const docUrl = code ? ngCodeUrl(code) : undefined;
    const entry: ConsoleEntry = {
      id: ++nextEntry,
      level,
      text,
      at,
      count: 1,
      ...(code ? { code } : {}),
      ...(docUrl ? { docUrl } : {}),
    };
    consoleEntries.push(entry);
    changedEntries.add(entry);
    while (consoleEntries.length > MAX_CONSOLE_ENTRIES) {
      changedEntries.delete(consoleEntries.shift()!);
      droppedConsole++;
    }
    schedulePush();
  };

  const onError = (event: Event) => {
    const error = read(() => (event as ErrorEvent).error, undefined);
    const message = read(() => (event as ErrorEvent).message, '');
    record(error ?? undefined, 'window', message || 'Script error.');
  };
  const onRejection = (event: Event) => {
    record(
      read(() => (event as PromiseRejectionEvent).reason, undefined),
      'promise',
      'Unhandled promise rejection',
    );
  };

  /** Wraps the app's ErrorHandler once it exists; the app's own handler still runs first in line. */
  const wrapHandler = () => {
    if (handler && handlerRoot?.isConnected !== false) return;
    if (handler) unwrapHandler();
    const ng = getNg();
    if (!ng?.getInjector || typeof document === 'undefined') return;
    for (const root of Array.from(document.querySelectorAll('[ng-version]'))) {
      const injector = read(() => ng.getInjector!(root), null);
      if (!injector) continue;
      const instance = providerOf(
        ng,
        injector,
        'ErrorHandler',
        (value) =>
          typeof read(() => (value as AnyRecord)?.['handleError'], undefined) === 'function',
      );
      if (!instance) continue;
      const own = Object.hasOwn(instance, 'handleError');
      const original = instance['handleError'] as (...args: unknown[]) => unknown;
      const wrapped = function (this: unknown, ...args: unknown[]) {
        try {
          record(args[0], 'handler');
        } catch {
          // Recording never gets in the way of the app's handler.
        }
        return original.apply(this, args);
      };
      instance['handleError'] = wrapped;
      handler = { instance, wrapped, original, own };
      handlerRoot = root;
      return;
    }
  };

  const unwrapHandler = () => {
    if (!handler) return;
    const { instance, wrapped, original, own } = handler;
    if (instance['handleError'] === wrapped) {
      if (own) instance['handleError'] = original;
      else delete instance['handleError'];
    }
    handler = null;
    handlerRoot = null;
  };

  /** Finds owners and explainer details for new groups while what they read is still fresh. */
  const enrich = () => {
    for (const group of changedGroups) {
      if (group.owner || !group.candidates.length) continue;
      const owner = ownerByName(group.candidates);
      group.candidates = [];
      if (owner) group.owner = owner;
    }
    for (const group of changedGroups) {
      if (group.explainAt === undefined || !group.explain) continue;
      const ng = getNg();
      const host = group.owner ? elementById(group.owner.id) : null;
      const component =
        host && ng?.getComponent ? read(() => ng.getComponent!(host), null) : undefined;
      group.explain = read(
        () =>
          enrichExplain(group.explain!, {
            at: group.explainAt!,
            component,
            host,
            ng,
            writes: options.writes,
          }),
        group.explain,
      );
      delete group.explainAt;
    }
  };

  const report = (): ErrorsReport => {
    enrich();
    const all = full;
    const errors = [...(all ? groups.values() : changedGroups)].map(
      ({ key: _key, candidates: _candidates, explainAt: _explainAt, ...group }) => ({
        ...group,
        sources: [...group.sources],
      }),
    );
    const consoleOut = (
      all ? consoleEntries : consoleEntries.filter((e) => changedEntries.has(e))
    ).map((entry) => ({ ...entry }));
    return {
      pageId,
      full: all,
      url: redactUrl(read(() => location.pathname + location.search, '')),
      title: redactMessage(read(() => document.title, '')),
      handler: handler ? 'wrapped' : 'none',
      errors,
      ...(all ? {} : { removed: [...removedIds] }),
      console: consoleOut,
      ...(all ? {} : { firstConsoleId: consoleEntries[0]?.id ?? nextEntry + 1 }),
      dropped: { errors: droppedErrors, console: droppedConsole },
    };
  };

  /** Says the page is still there without sending what changed, for an idle page. */
  const keepalive = async () => {
    enrich();
    if (!keepaliveDue(sentAt, tickMs(), now())) return;
    sentAt = now();
    const answer = (await my.rpc.call('push-errors', {
      pageId,
      full: false,
      url: redactUrl(read(() => location.pathname + location.search, '')),
      title: redactMessage(read(() => document.title, '')),
      handler: handler ? 'wrapped' : 'none',
      errors: [],
      removed: [],
      console: [],
      dropped: { errors: droppedErrors, console: droppedConsole },
    } satisfies ErrorsReport)) as { known?: boolean } | undefined;
    if (answer?.known === false) {
      full = true;
      schedulePush();
    }
  };

  const pushOnce = async () => {
    if (left || stopped) return;
    wrapHandler();
    if (!full && options.active && !options.active()) return keepalive();
    const nothing = !full && !changedGroups.size && !changedEntries.size && !removedIds.length;
    if (nothing && !keepaliveDue(sentAt, tickMs(), now())) return;
    const payload = report();
    const sentGroups = [...changedGroups];
    const sentEntries = [...changedEntries];
    const sentRemoved = removedIds;
    changedGroups.clear();
    changedEntries.clear();
    removedIds = [];
    full = false;
    sentAt = now();
    let answer: { known?: boolean } | undefined;
    try {
      answer = (await my.rpc.call('push-errors', payload)) as { known?: boolean } | undefined;
    } catch (error) {
      for (const group of sentGroups) if (groups.has(group.key)) changedGroups.add(group);
      for (const entry of sentEntries)
        if (consoleEntries.includes(entry)) changedEntries.add(entry);
      removedIds = [...sentRemoved, ...removedIds];
      full = full || payload.full;
      throw error;
    }
    if (answer?.known === false) {
      full = true;
      schedulePush();
    }
  };

  const push = () => (queue = queue.then(pushOnce, pushOnce));

  const stopConsole = tapConsole(CONSOLE_LEVELS, onConsole);
  target?.addEventListener('error', onError);
  target?.addEventListener('unhandledrejection', onRejection);
  wrapHandler();

  return {
    push,
    leave() {
      if (left) return;
      left = true;
      clearTimeout(pushTimer);
      pushTimer = undefined;
      void my.rpc.call('forget-errors-page', pageId).catch(() => {});
    },
    resume() {
      left = false;
      full = true;
      schedulePush();
    },
    stop() {
      stopped = true;
      clearTimeout(pushTimer);
      stopConsole();
      target?.removeEventListener('error', onError);
      target?.removeEventListener('unhandledrejection', onRejection);
      unwrapHandler();
    },
  };
}
