// Page side of the Errors explainers: reads what Angular puts in an NG0100, a
// hydration mismatch (NG0500 to NG0503) or a missing provider (NG0201,
// NullInjectorError) error, and adds what the page knows when the group is
// pushed: the component fields that hold the new value, the named signals
// written with it just before the check, and the hydration info Angular left
// on the component host. Nothing here writes to the app or runs its code.

import { readHydration, type HydrationDebugNg } from './hydration.ts';
import { isSecretName, REDACTED, redactText } from './serialize.ts';
import { clip } from './text.ts';
import type { ErrorExplain, ExplainWrite } from './rpc/error-explain-tools.ts';
import { MAX_DOM_TEXT, MAX_VALUE_TEXT } from './rpc/error-explain-tools.ts';
import type { SignalChange } from './types.ts';

type AnyRecord = Record<string, unknown>;

/** How far back a signal write counts as the one behind an NG0100. */
export const WRITE_WINDOW_MS = 2000;
/** Signal writes the page remembers for the explainer. */
export const MAX_RECENT_WRITES = 50;
/** Own fields of a component compared with the new value. */
const MAX_FIELDS = 200;
/** Longest error message read; Angular's hydration messages carry the DOM. */
const MAX_RAW_MESSAGE = 20_000;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The whole message of an error, before it is cut for the list. */
export function rawMessage(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, MAX_RAW_MESSAGE);
  const message = read(() => (value as AnyRecord | null)?.['message'], undefined);
  return typeof message === 'string' ? message.slice(0, MAX_RAW_MESSAGE) : '';
}

const HYDRATION_CODES = new Set(['NG0500', 'NG0501', 'NG0502', 'NG0503']);

/**
 * The compiled template function on a stack, such as `App_Template` or
 * `App_Conditional_2_Template`: the template the binding sits in.
 */
export function templateOf(stack: string | undefined): string | undefined {
  for (const line of (stack ?? '').split('\n').slice(0, 40)) {
    const match = /(?:^|[\s.@(])_?([A-Za-z$][\w$]*?_(?:[\w$]+_)*Template)(?![\w$])/.exec(line);
    if (match && !/_listener$/.test(match[1]!)) return clip(match[1]!, 120);
  }
  return undefined;
}

/** The parts of Angular's NG0100 message (`throwErrorIfNoChangesMode` in `@angular/core`). */
export function parseExpressionChanged(message: string): {
  binding?: string;
  previous: string;
  current: string;
  creation: boolean;
} | null {
  const match =
    /Previous value(?: for '([^']*)')?: '([\s\S]*?)'\. Current value: '([\s\S]*?)'\.(?=\s|$)/.exec(
      message,
    );
  if (!match) return null;
  return {
    ...(match[1] ? { binding: match[1] } : {}),
    previous: match[2]!,
    current: match[3]!,
    creation: /view has been created after its parent/.test(message),
  };
}

/** The paragraph after `label` in Angular's hydration message, up to the next blank line. */
function section(message: string, label: string): string | undefined {
  const start = message.indexOf(label);
  if (start < 0) return undefined;
  const rest = message.slice(start + label.length).replace(/^\s*\n/, '');
  const end = rest.search(/\n\s*\n/);
  const text = (end < 0 ? rest : rest.slice(0, end)).replace(/\s+$/, '');
  return text.trim() ? text : undefined;
}

/**
 * What Angular's hydration message says (`validateMatchingNode`,
 * `validateSiblingNodeExists`, `validateNodeExists` in `@angular/core`): its
 * first sentence, the DOM it expected and the DOM it found.
 */
export function parseHydrationMismatch(message: string): {
  summary?: string;
  expected?: string;
  actual?: string;
  external: boolean;
} {
  const body = message.replace(/^NG0\d+:\s*/, '');
  const summary = body.split(/\n\s*\n/)[0]?.trim();
  let expected = section(body, 'Angular expected this DOM:');
  const actual = section(body, 'Actual DOM is:');
  // NG0502 puts the expected DOM right after its first sentence, with no label.
  if (!expected && /expected an element to be present/.test(body)) {
    const next = body.split(/\n\s*\n/)[1]?.replace(/\s+$/, '');
    if (next && /^\s*[<#…]/.test(next)) expected = next;
  }
  return {
    ...(summary ? { summary: clip(summary, 500) } : {}),
    ...(expected ? { expected: clip(expected, MAX_DOM_TEXT) } : {}),
    ...(actual ? { actual: clip(actual, MAX_DOM_TEXT) } : {}),
    external: /third-party script or browser extension/.test(body),
  };
}

/** `InjectionToken API_URL` reads `API_URL`, like the Injectors tab names it. */
const bareToken = (name: string) => name.trim().replace(/^InjectionToken\s+/, '');

/**
 * The token, dependency path and source Angular puts in a missing provider
 * error: `NG0201: No provider found for \`Api\`. Source: Standalone[App]. Path:
 * App -> Api.` from 20.0 on, `R3InjectorError(AppModule)[Api -> Http]:
 * NullInjectorError: No provider for Http!` before, and `No provider for Api
 * found in NodeInjector` from an element injector.
 */
export function parseMissingProvider(
  message: string,
): { token: string; path?: string[]; source?: string } | null {
  let token =
    /No provider found for `([^`]+)`/.exec(message)?.[1] ??
    /No provider for (.+?)(?: found in [\w$]+|!)/.exec(message)?.[1];
  let path: string[] | undefined;
  let source: string | undefined;
  const newPath = / Path: (.+?)\.(?:\s|$)/.exec(message)?.[1];
  const oldError = /R3InjectorError\(([^)]*)\)\[([^\]]+)\]/.exec(message);
  if (newPath) path = newPath.split(' -> ');
  else if (oldError) path = oldError[2]!.split(' -> ');
  source =
    / Source: (.+?)\.(?: |$)/.exec(message)?.[1] ??
    oldError?.[1] ??
    / found in ([\w$]+)/.exec(message)?.[1];
  path = path?.map(bareToken).filter(Boolean);
  if (!token && path?.length) token = path.at(-1);
  if (!token) return null;
  return {
    token: clip(bareToken(token), 120),
    ...(path?.length ? { path: path.slice(0, 20).map((name) => clip(name, 120)) } : {}),
    ...(source ? { source: clip(source, 120) } : {}),
  };
}

/** The explainer of an error from its code, message and stack; `undefined` when it has none. */
export function explainError(
  ngCode: string | undefined,
  message: string,
  stack: string | undefined,
): ErrorExplain | undefined {
  if (ngCode === 'NG0100' || /ExpressionChangedAfterItHasBeenChecked/.test(message)) {
    const parts = parseExpressionChanged(message);
    if (!parts) return undefined;
    const masked = isSecretName(parts.binding);
    const template = templateOf(stack);
    return {
      kind: 'expression-changed',
      previous: masked ? REDACTED : clip(redactText(parts.previous), MAX_VALUE_TEXT),
      current: masked ? REDACTED : clip(redactText(parts.current), MAX_VALUE_TEXT),
      ...(parts.binding ? { binding: clip(parts.binding, 120) } : {}),
      ...(template ? { template } : {}),
      ...(masked ? { masked } : {}),
      ...(parts.creation ? { creation: true } : {}),
    };
  }
  if (
    (ngCode && HYDRATION_CODES.has(ngCode)) ||
    /^\s*(NG050\d:\s*)?During hydration/.test(message)
  ) {
    const parts = parseHydrationMismatch(message);
    return {
      kind: 'hydration-mismatch',
      ...(parts.summary ? { summary: redactText(parts.summary) } : {}),
      ...(parts.expected ? { expected: redactText(parts.expected) } : {}),
      ...(parts.actual ? { actual: redactText(parts.actual) } : {}),
      ...(parts.external ? { external: true } : {}),
    };
  }
  if (ngCode === 'NG0201' || /NullInjectorError|No provider (?:found )?for/.test(message)) {
    const parts = parseMissingProvider(message);
    if (!parts) return undefined;
    return {
      kind: 'missing-provider',
      token: redactText(parts.token),
      ...(parts.path ? { path: parts.path.map(redactText) } : {}),
      ...(parts.source ? { source: redactText(parts.source) } : {}),
    };
  }
  return undefined;
}

/** A value the way Angular prints it in NG0100 (`formatValue` in `@angular/core`). */
export function formatLikeAngular(value: unknown): string {
  let text = read(() => String(value), '');
  try {
    if (Array.isArray(value) || text === '[object Object]') text = JSON.stringify(value);
  } catch {
    // Angular keeps String(value) too.
  }
  return text.length > MAX_VALUE_TEXT ? `${text.slice(0, MAX_VALUE_TEXT)}…` : text;
}

/** The value of a signal without calling it, so no computed runs; `undefined` for anything else. */
function signalValue(value: unknown): { value: unknown } | undefined {
  if (typeof value !== 'function') return undefined;
  const key = read(
    () => Object.getOwnPropertySymbols(value).find((s) => s.description === 'SIGNAL'),
    undefined,
  );
  const node = key ? read(() => (value as unknown as AnyRecord)[key as never], undefined) : null;
  if (!node || typeof node !== 'object' || !('value' in node)) return undefined;
  return { value: read(() => (node as AnyRecord)['value'], undefined) };
}

/**
 * Own fields of a component that hold `current` now, as Angular prints it:
 * plain fields read through their descriptors (getters never run) and signals
 * read from their node.
 */
export function membersHolding(component: unknown, current: string): string[] {
  if (!component || typeof component !== 'object') return [];
  const out: string[] = [];
  const keys = read(() => Object.keys(component).slice(0, MAX_FIELDS), [] as string[]);
  for (const key of keys) {
    const descriptor = read(() => Object.getOwnPropertyDescriptor(component, key), undefined);
    if (!descriptor || !('value' in descriptor)) continue;
    const raw = descriptor.value;
    const sig = signalValue(raw);
    if (typeof raw === 'function' && !sig) continue;
    const value = sig ? sig.value : raw;
    if (formatLikeAngular(value) === current) out.push(key);
    if (out.length >= 10) break;
  }
  return out;
}

interface RecentWrite {
  signal: string;
  at: number;
  /** The value as Angular prints it in NG0100, taken from the raw value written. */
  text: string;
  stack?: string[];
}

/**
 * The named signal writes of the last moments, from the signal history's
 * `onChange`, for NG0100. Keeps {@link MAX_RECENT_WRITES}.
 */
export function createRecentWrites(max = MAX_RECENT_WRITES) {
  const writes: RecentWrite[] = [];
  let heard = false;
  return {
    /**
     * Pass to the signal history as (part of) `onChange`. `raw` is the value as
     * written; the serialized `change.value` stands in without it. A signal
     * with a secret name keeps its masked value, so it is never printed or matched.
     */
    add(_id: string | undefined, label: string, change: SignalChange, raw?: { value: unknown }) {
      if (change.source !== 'write') return;
      const value = raw && !isSecretName(label) ? raw.value : change.value;
      writes.push({
        signal: label,
        at: change.at,
        text: formatLikeAngular(value),
        ...(change.stack?.length ? { stack: change.stack } : {}),
      });
      if (writes.length > max) writes.splice(0, writes.length - max);
    },
    /** Marks that the page hears signal writes, once the write hook is installed. */
    listening() {
      heard = true;
    },
    get known() {
      return heard;
    },
    /**
     * Writes whose value prints like `current`, in the window before `at`, newest
     * first. When some were made to a signal named in `names` (the binding, the
     * fields that hold the value), only those are kept: the others merely share the value.
     */
    matching(at: number, current: string, names: readonly string[] = []): ExplainWrite[] {
      const found = writes.filter(
        (write) =>
          write.at <= at + 50 && at - write.at <= WRITE_WINDOW_MS && write.text === current,
      );
      const named = found.filter((write) => names.includes(write.signal));
      return (named.length ? named : found)
        .reverse()
        .slice(0, 5)
        .map(({ signal, at: when, stack }) => ({ signal, at: when, ...(stack ? { stack } : {}) }));
    },
  };
}

export type RecentWrites = ReturnType<typeof createRecentWrites>;

/**
 * Adds what the page knows once the group's component is found: for NG0100
 * the fields that hold the new value (values hidden when one has a secret
 * name) and the signal writes behind it; for a hydration mismatch the
 * expected and actual DOM Angular left on the host when the message had none.
 */
export function enrichExplain(
  explain: ErrorExplain,
  context: {
    at: number;
    component?: unknown;
    host?: Element | null;
    ng?: HydrationDebugNg;
    writes?: RecentWrites;
  },
): ErrorExplain {
  if (explain.kind === 'expression-changed') {
    const out = { ...explain };
    if (!out.masked && context.component) {
      const members = membersHolding(context.component, out.current);
      if (members.some(isSecretName)) {
        out.previous = REDACTED;
        out.current = REDACTED;
        out.masked = true;
      }
      if (members.length) out.members = members;
    }
    if (context.writes) {
      out.writesKnown = context.writes.known;
      if (!out.masked) {
        const names = [...(out.binding ? [out.binding] : []), ...(out.members ?? [])];
        const writes = context.writes.matching(context.at, explain.current, names);
        if (writes.length) out.writes = writes;
      }
    }
    return out;
  }
  if (
    explain.kind === 'hydration-mismatch' &&
    !explain.expected &&
    !explain.actual &&
    context.host
  ) {
    const info = readHydration(context.ng, context.host);
    if (info?.status === 'mismatched') {
      return {
        ...explain,
        ...(info.expected ? { expected: info.expected } : {}),
        ...(info.actual ? { actual: info.actual } : {}),
      };
    }
  }
  return explain;
}
