import { defineRpcFunction } from 'devframe';
import {
  classScopes,
  lineCounter,
  maskRegexes,
  maskStrings,
  matchDelimiter,
  sourceRoots,
  stripComments,
  walkFiles,
} from './source-scan.ts';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const ProviderEntrySchema = v.object({
  token: v.string(),
  source: v.string(),
  file: v.string(),
  line: v.number(),
  providedIn: v.optional(v.string()),
  type: v.string(),
});

export const getProviders = defineRpcFunction({
  name: 'get-providers',
  type: 'query',
  jsonSerializable: true,
  snapshot: true,
  args: [],
  returns: describable(v.array(ProviderEntrySchema)),
  agent: {
    description:
      'Scan source files for DI providers: @Injectable services, inject() calls, constructor parameters of decorated classes, and providers arrays. Returns token, file, and where it is provided. Call this to understand the DI architecture.',
    title: 'List Angular DI providers from source',
  },
  setup: (ctx) => ({
    handler: async () => scanProviders(ctx.cwd),
  }),
});

const DECORATOR_KEYWORDS = new Set([
  'Component',
  'NgModule',
  'Injectable',
  'Directive',
  'Pipe',
  'Service',
  'Input',
  'Output',
  'Inject',
  'Optional',
  'Self',
  'SkipSelf',
  'Host',
]);

// Maps provide*() helper functions to the tokens they register
const PROVIDE_FN_TO_TOKEN: Record<string, string> = {
  provideHttpClient: 'HttpClient',
  provideRouter: 'Router',
  provideAnimations: 'AnimationDriver',
  provideAnimationsAsync: 'AnimationDriver',
  provideClientHydration: 'ClientHydration',
  provideZoneChangeDetection: 'NgZone',
  provideZonelessChangeDetection: 'ChangeDetection (zoneless)',
  provideExperimentalZonelessChangeDetection: 'ChangeDetection (zoneless)',
  provideBrowserGlobalErrorListeners: 'ErrorHandler',
  provideServiceWorker: 'ServiceWorker',
  provideCheckNoChangesConfig: 'CheckNoChanges',
  provideExperimentalCheckNoChanges: 'CheckNoChanges',
  providePlatformInitializer: 'PlatformInitializer',
  provideAppInitializer: 'AppInitializer',
  provideEnvironmentInitializer: 'EnvironmentInitializer',
};

interface ProviderEntry {
  token: string;
  source: string;
  file: string;
  line: number;
  providedIn?: string;
  type: string;
}

function scanProviders(cwd: string): ProviderEntry[] {
  const entries: ProviderEntry[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, item) => {
      if (!item.endsWith('.ts') || item.endsWith('.spec.ts') || item.endsWith('.d.ts')) return;
      scanFile(full, cwd, entries);
    });
  }
  return entries;
}

function scanFile(full: string, cwd: string, out: ProviderEntry[]) {
  try {
    const source = stripComments(readFileSync(full, 'utf-8'));
    // Identifiers quoted in a string, or spelled out in a pattern, are not
    // providers, so match against masked source. Masking keeps the length,
    // so offsets still line up.
    const code = maskRegexes(maskStrings(source));
    const relPath = relative(cwd, full);
    const lineAt = lineCounter(code);

    // @Injectable({ ... }) or @Service, matched in two steps: the decorator
    // name, then the class that follows it. Walking the argument list with a
    // bracket matcher keeps a comment or a trailing comma in there from
    // sending a single pattern into catastrophic backtracking.
    for (const decorator of code.matchAll(/@(Injectable|Service)\b/g)) {
      const at = decorator.index;
      let after = at + decorator[0].length;
      let args = '';

      const parenAt = code.indexOf('(', after);
      if (parenAt !== -1 && code.slice(after, parenAt).trim() === '') {
        const close = matchDelimiter(code, parenAt, '(', ')');
        // The value of `providedIn` is a string, so it is read from the
        // source rather than the copy with string contents masked out.
        args = source.slice(parenAt, close + 1);
        after = close + 1;
      }

      DECLARATION.lastIndex = skipDecorators(code, after);
      const declaration = DECLARATION.exec(code);
      if (!declaration) continue;

      const isService = decorator[1] === 'Service';
      out.push({
        token: declaration[1],
        source: 'class',
        file: relPath,
        line: lineAt(at),
        // @Service defaults to providedIn: 'root'
        // `providedIn` takes `'root'`, `'platform'`, `'any'`, or a class
        // such as `providedIn: FeatureModule`.
        providedIn: /providedIn\s*:/.test(args)
          ? providedInOf(args)
          : isService
            ? 'root'
            : undefined,
        type: 'injectable',
      });
    }

    const scopes = functionScopes(code);
    for (const call of injectCalls(code)) {
      out.push({
        token: call.token,
        source:
          assignedName(code, call.start) ?? enclosingName(scopes, call.start) ?? '(top level)',
        file: relPath,
        line: lineAt(call.start),
        type: 'injection',
      });
    }

    for (const param of constructorParams(code)) {
      out.push({
        token: param.token,
        source: param.name,
        file: relPath,
        line: lineAt(param.start),
        type: 'injection',
      });
    }

    // provide*() calls in app config — provideHttpClient(), provideRouter(), etc.
    for (const match of code.matchAll(/\b(provide\w+)\s*\(/g)) {
      const fnName = match[1];
      const token = PROVIDE_FN_TO_TOKEN[fnName];
      if (token) {
        out.push({
          token,
          source: fnName + '()',
          file: relPath,
          line: lineAt(match.index!),
          providedIn: 'root',
          type: 'root-provider',
        });
      }
    }

    for (const providersMatch of code.matchAll(/\b(?:providers|viewProviders)\s*:\s*\[/g)) {
      const openAt = providersMatch.index + providersMatch[0].lastIndexOf('[');
      const close = matchDelimiter(code, openAt, '[', ']');
      for (const element of topLevelElements(code, openAt + 1, close)) {
        const token = providedToken(element.text);
        if (!token || DECORATOR_KEYWORDS.has(token)) continue;
        out.push({
          token,
          source: 'providers array',
          file: relPath,
          line: lineAt(element.start),
          type: 'provider',
        });
      }
    }

    for (const match of code.matchAll(
      /(?:export\s+)?const\s+([\w$]+)\s*=\s*signalStore\s*(?:<[^>]*>)?\s*\(/g,
    )) {
      const open = match.index + match[0].length - 1;
      const first = /^\s*\{/.exec(code.slice(open + 1));
      if (!first) continue;
      const brace = open + 1 + first[0].length - 1;
      const providedIn = providedInOf(
        source.slice(brace, matchDelimiter(code, brace, '{', '}') + 1),
      );
      if (!providedIn) continue;
      out.push({
        token: match[1],
        source: 'signalStore',
        file: relPath,
        line: lineAt(match.index),
        providedIn,
        type: 'injectable',
      });
    }

    for (const match of code.matchAll(
      /(?:export\s+)?const\s+([\w$]+)\s*(?::[^=]{0,120})?=\s*new\s+InjectionToken\s*(?:<[^;]*?>)?\s*\(/g,
    )) {
      const open = match.index + match[0].length - 1;
      const providedIn = providedInOf(source.slice(open, matchDelimiter(code, open, '(', ')') + 1));
      if (!providedIn) continue;
      out.push({
        token: match[1],
        source: 'InjectionToken',
        file: relPath,
        line: lineAt(match.index),
        providedIn,
        type: 'injectable',
      });
    }
  } catch {
    // skip
  }
}

function providedInOf(args: string): string | undefined {
  const value = /providedIn\s*:\s*(?:['"`](\w+)['"`]|([A-Za-z_$][\w$]*))/
    .exec(args)
    ?.slice(1)
    .find(Boolean);
  return value === 'null' || value === 'undefined' ? undefined : value;
}

export function topLevelElements(
  code: string,
  from: number,
  to: number,
): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  let start = from;
  const flush = (end: number) => {
    const raw = code.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    if (raw.trim()) out.push({ text: raw.trim(), start: start + lead });
  };
  for (let i = from; i < to; i++) {
    const ch = code[i];
    if (pairs[ch]) i = matchDelimiter(code, i, ch, pairs[ch]);
    else if (ch === ',') {
      flush(i);
      start = i + 1;
    }
  }
  flush(to);
  return out;
}

export function providedToken(element: string): string | null {
  if (element.startsWith('...')) return null;
  if (element.startsWith('{')) {
    const body = element.slice(1, element.lastIndexOf('}'));
    for (const entry of topLevelElements(body, 0, body.length)) {
      const provide = /^provide\s*:\s*([\s\S]+)$/.exec(entry.text);
      if (!provide) continue;
      const value = provide[1].trim();
      const forward = /^forwardRef\s*\(\s*\(\s*\)\s*=>\s*([\w$.]+)/.exec(value);
      if (forward) return forward[1];
      return /^[A-Za-z_$][\w$.]*$/.test(value) ? value : null;
    }
    return null;
  }
  if (!/^[A-Z][\w$]*$/.test(element)) return null;
  return /^[A-Z0-9_]+$/.test(element) ? null : element;
}

/**
 * Past any further decorators on the same declaration. TypeScript allows more
 * than one, and the sticky `DECLARATION` match would otherwise stop at the
 * first of them and miss the class.
 */
function skipDecorators(code: string, from: number): number {
  let at = from;
  for (;;) {
    const next = /\S/.exec(code.slice(at));
    if (!next || code[at + next.index] !== '@') return at;
    const nameEnd =
      at + next.index + 1 + (/^[\w$]*/.exec(code.slice(at + next.index + 1))?.[0].length ?? 0);
    const paren = /\S/.exec(code.slice(nameEnd));
    if (paren && code[nameEnd + paren.index] === '(') {
      at = matchDelimiter(code, nameEnd + paren.index, '(', ')') + 1;
    } else {
      at = nameEnd;
    }
  }
}

/** Sticky, so the class after a decorator is found however far it sits. */
const DECLARATION = /\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/y;

const DECORATED = /@(Component|Directive|Injectable|Service|Pipe|NgModule)\b/g;
const KEYWORD_AHEAD = /^\s*(?:export|import|const|let|var|function|class|@)\b/;

function closeAngle(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (ch === '<') depth++;
    else if (ch === '>' && code[i - 1] !== '=' && --depth === 0) return i;
    else if (ch === ';' || ch === '{') return -1;
  }
  return -1;
}

/** Every `inject(Token)` call, generic arguments of any depth included. */
function injectCalls(code: string): { token: string; start: number }[] {
  const out: { token: string; start: number }[] = [];
  for (const match of code.matchAll(/(?<![\w$.])inject\s*(?=[<(])/g)) {
    let at = match.index + match[0].length;
    if (code[at] === '<') {
      const close = closeAngle(code, at);
      if (close === -1) continue;
      at = close + 1;
    }
    const open = /^\s*\(/.exec(code.slice(at, at + 200));
    if (!open) continue;
    const parenAt = at + open[0].length - 1;
    const [first] = topLevelElements(code, parenAt + 1, matchDelimiter(code, parenAt, '(', ')'));
    const token = first ? injectedToken(first.text) : null;
    if (token) out.push({ token, start: match.index });
  }
  return out;
}

function injectedToken(argument: string): string | null {
  const forward = /^forwardRef\s*\(\s*\(\s*\)\s*=>\s*([A-Za-z_$][\w$.]*)\s*\)$/.exec(argument);
  const reference =
    forward?.[1] ??
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?=\s*(?:!|as\b|$))/.exec(argument)?.[0];
  return reference && !/^this\b/.test(reference) ? reference : null;
}

/** The field or variable an `inject()` call is assigned to, as in `x = inject(T)`. */
function assignedName(code: string, at: number): string | undefined {
  const before = code.slice(Math.max(0, at - 200), at);
  return /([\w$]+)\s*!?(?::[^=;{}()]*)?(?<![=!<>])=\s*$/.exec(before)?.[1];
}

interface FunctionScope {
  name: string;
  start: number;
  end: number;
}

function expressionEnd(code: string, from: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  for (let i = from; i < code.length; i++) {
    const ch = code[i];
    if (pairs[ch]) i = matchDelimiter(code, i, ch, pairs[ch]);
    else if (ch === ';' || ch === ')' || ch === ']' || ch === '}') return i;
    else if (ch === '\n' && KEYWORD_AHEAD.test(code.slice(i, i + 40))) return i;
  }
  return code.length;
}

function bodyEnd(code: string, from: number): number {
  const brace = /^\s*\{/.exec(code.slice(from));
  return brace
    ? matchDelimiter(code, from + brace[0].length - 1, '{', '}')
    : expressionEnd(code, from);
}

/**
 * The classes, function declarations and functions assigned to a variable in
 * a file, so a bare `inject()` call can be credited to the one around it.
 */
function functionScopes(code: string): FunctionScope[] {
  const scopes: FunctionScope[] = classScopes(code, code).map((scope) => ({
    name: scope.className ?? 'anonymous class',
    start: scope.start,
    end: scope.end,
  }));
  for (const match of code.matchAll(/\bfunction\s*\*?\s*([\w$]+)\s*(?:<[^>]*>)?\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const brace = code.indexOf('{', matchDelimiter(code, open, '(', ')'));
    if (brace === -1) continue;
    scopes.push({
      name: match[1],
      start: match.index,
      end: matchDelimiter(code, brace, '{', '}'),
    });
  }
  for (const match of code.matchAll(
    /\b(?:const|let|var)\s+([\w$]+)\s*(?::[^=;]*?)?=\s*(?:async\s+)?(?=\(|function\b|[\w$]+\s*=>)/g,
  )) {
    let at = match.index + match[0].length;
    if (code.startsWith('function', at)) {
      const open = code.indexOf('(', at);
      if (open === -1) continue;
      at = matchDelimiter(code, open, '(', ')') + 1;
    } else {
      if (code[at] === '(') at = matchDelimiter(code, at, '(', ')') + 1;
      const arrow = /^\s*(?::[^=;{]*?)?=>|^[\w$]+\s*=>/.exec(code.slice(at));
      if (!arrow) continue;
      at += arrow[0].length;
    }
    scopes.push({ name: match[1], start: match.index, end: bodyEnd(code, at) });
  }
  return scopes;
}

function enclosingName(scopes: FunctionScope[], at: number): string | undefined {
  let best: FunctionScope | undefined;
  for (const scope of scopes) {
    if (scope.start <= at && at <= scope.end && (!best || scope.start >= best.start)) best = scope;
  }
  return best?.name;
}

/** The start of each class that carries an Angular decorator. */
function decoratedClasses(code: string): Set<number> {
  const out = new Set<number>();
  for (const decorator of code.matchAll(DECORATED)) {
    let after = decorator.index + decorator[0].length;
    const paren = /^\s*\(/.exec(code.slice(after));
    if (paren) after = matchDelimiter(code, after + paren[0].length - 1, '(', ')') + 1;
    DECLARATION.lastIndex = skipDecorators(code, after);
    const declaration = DECLARATION.exec(code);
    if (declaration) out.add(declaration.index + declaration[0].search(/\bclass\b/));
  }
  return out;
}

/**
 * The parameters of the constructor of each decorated class, with the token
 * Angular injects for them: the `@Inject(Token)` argument, or else the type.
 */
function constructorParams(code: string): { token: string; name: string; start: number }[] {
  const decorated = decoratedClasses(code);
  const out: { token: string; name: string; start: number }[] = [];
  for (const scope of classScopes(code, code)) {
    if (!decorated.has(scope.start)) continue;
    const ctor = /\bconstructor\s*\(/g;
    ctor.lastIndex = scope.start;
    const match = ctor.exec(code);
    if (!match || match.index > scope.end) continue;
    const open = match.index + match[0].length - 1;
    const close = matchDelimiter(code, open, '(', ')');
    for (const element of topLevelElements(code, open + 1, close)) {
      const param = injectedParam(element.text);
      if (param) out.push({ ...param, start: element.start });
    }
  }
  return out;
}

function injectedParam(text: string): { token: string; name: string } | null {
  let rest = text;
  let token: string | undefined;
  let injected = false;
  for (
    let decorator = /^@([\w$]+)\s*/.exec(rest);
    decorator;
    decorator = /^@([\w$]+)\s*/.exec(rest)
  ) {
    rest = rest.slice(decorator[0].length);
    if (!rest.startsWith('(')) continue;
    const close = matchDelimiter(rest, 0, '(', ')');
    if (decorator[1] === 'Inject') {
      injected = true;
      const arg = rest.slice(1, close).trim();
      token =
        /^forwardRef\s*\(\s*\(\s*\)\s*=>\s*([\w$.]+)/.exec(arg)?.[1] ??
        /^[A-Za-z_$][\w$.]*$/.exec(arg)?.[0];
    }
    rest = rest.slice(close + 1).trimStart();
  }
  const param =
    /^(?:(?:private|protected|public|readonly|override)\s+)*([\w$]+)\s*\??\s*(?::\s*([A-Za-z_$][\w$.]*))?/.exec(
      rest,
    );
  if (!param) return null;
  const type = param[2];
  if (injected && !token) return null;
  token ??= type && /^[A-Z]/.test(type) ? type : undefined;
  return token ? { token, name: param[1] } : null;
}
