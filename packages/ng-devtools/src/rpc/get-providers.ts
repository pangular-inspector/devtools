import { defineRpcFunction } from 'devframe';
import {
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
  args: [],
  returns: describable(v.array(ProviderEntrySchema)),
  agent: {
    description:
      'Scan source files for DI providers: @Injectable services, inject() calls, and providers arrays. Returns token, file, and where it is provided. Call this to understand the DI architecture.',
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
        providedIn:
          /providedIn\s*:\s*(?:['"`](\w+)['"`]|([A-Za-z_$][\w$]*))/
            .exec(args)
            ?.slice(1)
            .find(Boolean) ?? (isService ? 'root' : undefined),
        type: 'injectable',
      });
    }

    // inject(Token) calls — covers `x = inject(T)`, `readonly x = inject(T)`, `private x = inject<T>()`
    for (const match of code.matchAll(
      /(?<![\w$])(?:(?:private|protected|public|readonly)\s+)*(\w+)\s*=\s*inject\s*(?:<[^>]*>)?\s*\(\s*(\w+)/g,
    )) {
      out.push({
        token: match[2],
        source: match[1],
        file: relPath,
        line: lineAt(match.index!),
        type: 'injection',
      });
    }

    // Constructor injection — @Inject(Token) or typed parameter
    for (const match of code.matchAll(
      /@Inject\(\s*(\w+)\s*\)\s*(?:private|protected|public|readonly|\s)*(\w+)/g,
    )) {
      out.push({
        token: match[1],
        source: match[2],
        file: relPath,
        line: lineAt(match.index!),
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
  return /providedIn\s*:\s*(?:['"`](\w+)['"`]|([A-Za-z_$][\w$]*))/
    .exec(args)
    ?.slice(1)
    .find(Boolean);
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
