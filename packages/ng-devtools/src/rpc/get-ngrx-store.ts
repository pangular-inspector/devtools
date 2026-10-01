import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  lineCounter,
  maskRegexes,
  maskStrings,
  matchDelimiter,
  sourceRoots,
  stripComments,
  walkFiles,
} from './source-scan.ts';

const NgrxStoreEntrySchema = v.object({
  name: v.string(),
  kind: v.picklist([
    'action',
    'reducer',
    'effect',
    'selector',
    'feature',
    'store-setup',
    'signal-store',
    'signal-state',
    'signal-method',
  ]),
  file: v.string(),
  line: v.number(),
  detail: v.optional(v.string()),
  types: v.optional(v.array(v.string())),
  members: v.optional(
    v.object({
      state: v.optional(v.array(v.string())),
      computed: v.optional(v.array(v.string())),
      methods: v.optional(v.array(v.string())),
      props: v.optional(v.array(v.string())),
      hooks: v.optional(v.array(v.string())),
      entities: v.optional(v.array(v.string())),
      rxMethods: v.optional(v.array(v.string())),
    }),
  ),
});

export const getNgrxStore = defineRpcFunction({
  name: 'get-ngrx-store',
  type: 'query',
  jsonSerializable: true,
  snapshot: true,
  args: [],
  returns: describable(v.array(NgrxStoreEntrySchema)),
  agent: {
    description:
      'Scan source files for NgRx declarations: @ngrx/store actions, reducers, effects, selectors, features and store setup, and @ngrx/signals signalStore, signalState and signalMethod. Each entry has name, kind, file and line. An action entry lists the action type strings of its createAction or createActionGroup call in `types` (for example "[Cart] Add Item"), when they are string literals. A signalStore entry also lists its members (withState keys, withComputed, withMethods, withProps, withHooks, withEntities and rxMethod names) in `members` and `detail`. Read the ng-devtools:ngrx-store resource for the live state and change log.',
    title: 'List NgRx store entries from source',
  },
  setup: (ctx) => ({
    handler: async () => scanNgrxStore(ctx.cwd),
  }),
});

interface NgrxStoreEntry {
  name: string;
  kind:
    | 'action'
    | 'reducer'
    | 'effect'
    | 'selector'
    | 'feature'
    | 'store-setup'
    | 'signal-store'
    | 'signal-state'
    | 'signal-method';
  file: string;
  line: number;
  detail?: string;
  /** Action type strings, for an `action` entry whose types are string literals. */
  types?: string[];
  members?: SignalStoreMembers;
}

export interface SignalStoreMembers {
  state?: string[];
  computed?: string[];
  methods?: string[];
  props?: string[];
  hooks?: string[];
  entities?: string[];
  rxMethods?: string[];
}

const NGRX_PATTERNS: { pattern: RegExp; kind: NgrxStoreEntry['kind'] }[] = [
  // Actions
  { pattern: /export\s+const\s+(\w+)\s*=\s*createAction\s*\(/g, kind: 'action' },
  { pattern: /(\w+)\s*=\s*createActionGroup\s*\(/g, kind: 'action' },

  // Reducers
  { pattern: /export\s+const\s+(\w+)\s*=\s*createReducer\s*\(/g, kind: 'reducer' },

  // Effects
  { pattern: /([\w$]+)\s*=\s*createEffect\s*\(/g, kind: 'effect' },

  // Selectors
  { pattern: /export\s+const\s+(\w+)\s*=\s*createSelector\s*\(/g, kind: 'selector' },
  {
    pattern: /export\s+const\s+(\w+)\s*=\s*createFeatureSelector\s*[<(]/g,
    kind: 'selector',
  },

  // Features (createFeature)
  { pattern: /export\s+const\s+(\w+)\s*=\s*createFeature\s*\(/g, kind: 'feature' },

  // Store setup
  { pattern: /(provideStore)\s*\(/g, kind: 'store-setup' },
  { pattern: /(provideState)\s*\(/g, kind: 'store-setup' },
  { pattern: /(provideEffects)\s*\(/g, kind: 'store-setup' },
  { pattern: /StoreModule\.(forRoot|forFeature)\s*\(/g, kind: 'store-setup' },
  { pattern: /EffectsModule\.(forRoot|forFeature)\s*\(/g, kind: 'store-setup' },

  // NgRx Signals
  { pattern: /(?:export\s+)?const\s+(\w+)\s*=\s*signalStore\s*\(/g, kind: 'signal-store' },
  { pattern: /(\w+)\s*[=:]\s*signalState\s*[<(]/g, kind: 'signal-state' },
  { pattern: /(\w+)\s*[=:]\s*signalMethod\s*[<(]/g, kind: 'signal-method' },
];

export function scanNgrxStore(cwd: string): NgrxStoreEntry[] {
  const entries: NgrxStoreEntry[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, item) => {
      if (!item.endsWith('.ts') || item.endsWith('.spec.ts') || item.endsWith('.d.ts')) return;
      scanFile(full, cwd, entries);
    });
  }
  // Deduplicate by name+file+line (guards against overlapping patterns)
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.name}:${e.file}:${e.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scanFile(full: string, cwd: string, out: NgrxStoreEntry[]) {
  try {
    const raw = readFileSync(full, 'utf-8');
    // The gate runs on the real text: an import specifier is a string, so a
    // masked copy would hide the very marker it looks for.

    // Quick check: skip files that don't reference ngrx
    if (
      !raw.includes('@ngrx/') &&
      !raw.includes('createAction') &&
      !raw.includes('createReducer') &&
      !raw.includes('createEffect') &&
      !raw.includes('createSelector') &&
      !raw.includes('createFeature') &&
      !raw.includes('signalStore') &&
      !raw.includes('signalState') &&
      !raw.includes('signalMethod')
    ) {
      return;
    }

    // Comments, strings and regex literals are not code: a commented out
    // store, or a call quoted in a template or a pattern, is not part of
    // the app.
    const content = maskRegexes(maskStrings(stripComments(raw)));
    const lineAt = lineCounter(content);
    const relPath = relative(cwd, full);

    for (const { pattern, kind } of NGRX_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const lineNum = lineAt(match.index);
        const name = match[1];

        // For StoreModule/EffectsModule, use the full match as name
        const displayName =
          kind === 'store-setup' &&
          (match[0].includes('StoreModule') || match[0].includes('EffectsModule'))
            ? match[0].replace(/\s*\($/, '')
            : name;

        const entry: NgrxStoreEntry = { name: displayName, kind, file: relPath, line: lineNum };
        if (kind === 'action') {
          const open = match.index + match[0].length - 1;
          const types = match[0].includes('createActionGroup')
            ? actionGroupTypes(content, raw, open)
            : [stringAt(content, raw, open + 1)].filter((t): t is string => !!t);
          if (types.length) {
            entry.types = types;
            entry.detail = types.join(', ');
          }
        }
        if (kind === 'signal-store') {
          const open = content.indexOf('(', match.index + match[0].length - 1);
          const members = signalStoreMembers(content, raw, open);
          if (members) {
            entry.members = members;
            entry.detail = describeMembers(members);
          }
        }
        out.push(entry);
      }
    }
  } catch {
    // skip unreadable files
  }
}

const FEATURES: Record<string, keyof SignalStoreMembers> = {
  withState: 'state',
  withComputed: 'computed',
  withMethods: 'methods',
  withProps: 'props',
  withHooks: 'hooks',
  withEntities: 'entities',
};

function splitTop(text: string): { text: string; start: number }[] {
  const parts: { text: string; start: number }[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push({ text: text.slice(start, i), start });
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) parts.push({ text: text.slice(start), start });
  return parts;
}

function skipSpace(content: string, at: number): number {
  while (at < content.length && /\s/.test(content[at])) at++;
  return at;
}

function stringAt(content: string, raw: string, at: number): string | undefined {
  const start = skipSpace(content, at);
  const quote = content[start];
  if (quote !== "'" && quote !== '"' && quote !== '`') return undefined;
  const end = content.indexOf(quote, start + 1);
  if (end < 0) return undefined;
  const text = raw.slice(start + 1, end);
  return quote === '`' && text.includes('${') ? undefined : unescapeLiteral(text);
}

const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
  0: '\0',
};

function unescapeLiteral(text: string): string {
  return text.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(\r\n|[\s\S]))/g,
    (_, braced: string, hex4: string, hex2: string, ch: string) => {
      const code = braced ?? hex4 ?? hex2;
      if (code) return String.fromCodePoint(parseInt(code, 16));
      if (ch === '\n' || ch === '\r' || ch === '\r\n' || ch === '\u2028' || ch === '\u2029')
        return '';
      return ESCAPES[ch] ?? ch;
    },
  );
}

function actionGroupTypes(content: string, raw: string, open: number): string[] {
  const at = skipSpace(content, open + 1);
  if (content[at] !== '{') return [];
  const close = matchDelimiter(content, at, '{', '}');
  let source: string | undefined;
  let events = -1;
  for (const part of splitTop(content.slice(at + 1, close))) {
    const key = /^\s*(source|events)\s*:\s*/.exec(part.text);
    if (!key) continue;
    const value = at + 1 + part.start + key[0].length;
    if (key[1] === 'source') source = stringAt(content, raw, value);
    else if (content[value] === '{') events = value;
  }
  if (!source || events < 0) return [];
  const end = matchDelimiter(content, events, '{', '}');
  const types: string[] = [];
  for (const part of splitTop(content.slice(events + 1, end))) {
    const name =
      stringAt(content, raw, events + 1 + part.start) ??
      /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(part.text)?.[1];
    if (name) types.push(`[${source}] ${name}`);
  }
  return types;
}

function objectKeys(content: string, open: number): { key: string; value: string }[] {
  const close = matchDelimiter(content, open, '{', '}');
  const keys: { key: string; value: string }[] = [];
  for (const part of splitTop(content.slice(open + 1, close))) {
    const text = part.text.trim();
    if (text.startsWith('...')) continue;
    const match =
      /^(?:async\s+)?(?:(?:get|set)\s+(?=[\w$]))?\*?\s*([A-Za-z_$][\w$]*)\s*(?=[:(<]|$)/.exec(text);
    if (match) keys.push({ key: match[1], value: text.slice(match[0].length) });
  }
  return keys;
}

function resultObject(content: string, start: number, end: number): number {
  let i = start;
  while (i < end && /\s/.test(content[i])) i++;
  if (content[i] === '{') return i;
  const arrow = content.indexOf('=>', i);
  if (arrow < 0 || arrow >= end) return -1;
  let j = arrow + 2;
  while (j < end && /\s/.test(content[j])) j++;
  if (content[j] === '(') {
    j++;
    while (j < end && /\s/.test(content[j])) j++;
    return content[j] === '{' ? j : -1;
  }
  if (content[j] !== '{') return -1;
  const body = content.slice(j, end);
  const ret = /\breturn\s*\{/.exec(body);
  return ret ? j + ret.index + ret[0].length - 1 : -1;
}

function stateKeys(content: string, start: number, end: number): string[] {
  const at = resultObject(content, start, end);
  if (at >= 0) return objectKeys(content, at).map((k) => k.key);
  const name = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(content.slice(start, end))?.[1];
  if (!name) return [];
  const decl = new RegExp(
    `\\b(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*(?::[^=]+)?=\\s*\\{`,
  ).exec(content);
  return decl ? objectKeys(content, decl.index + decl[0].length - 1).map((k) => k.key) : [];
}

function entityNames(raw: string, start: number, end: number, generic: string): string[] {
  const text = raw.slice(start, end);
  const entity = /entity\s*:\s*type\s*<\s*([\w$.]+)/.exec(text)?.[1] ?? generic;
  const collection = /collection\s*:\s*['"`]([\w$-]+)['"`]/.exec(text)?.[1];
  const label = entity || 'entity';
  return [collection ? `${collection}: ${label}` : label];
}

export function signalStoreMembers(
  content: string,
  raw: string,
  open: number,
): SignalStoreMembers | undefined {
  if (open < 0 || content[open] !== '(') return undefined;
  const close = matchDelimiter(content, open, '(', ')');
  const members: SignalStoreMembers = {};
  const add = (key: keyof SignalStoreMembers, names: string[]) => {
    if (!names.length) return;
    const list = (members[key] ??= []);
    for (const name of names) if (!list.includes(name)) list.push(name);
  };
  for (const part of splitTop(content.slice(open + 1, close))) {
    const base = open + 1 + part.start;
    const feature = /^\s*(with\w+)\s*(?:<([^()]*)>)?\s*\(/.exec(part.text);
    const kind = feature && FEATURES[feature[1]];
    if (!feature || !kind) continue;
    const argOpen = base + feature[0].length - 1;
    const argClose = matchDelimiter(content, argOpen, '(', ')');
    if (kind === 'state') {
      add('state', stateKeys(content, argOpen + 1, argClose));
    } else if (kind === 'entities') {
      add('entities', entityNames(raw, argOpen + 1, argClose, (feature[2] ?? '').trim()));
    } else {
      const at = resultObject(content, argOpen + 1, argClose);
      if (at < 0) continue;
      const keys = objectKeys(content, at);
      add(
        kind,
        keys.map((k) => k.key),
      );
      if (kind === 'methods') {
        add(
          'rxMethods',
          keys.filter((k) => /^\s*:\s*rxMethod\b/.test(k.value)).map((k) => k.key),
        );
      }
    }
  }
  return Object.keys(members).length ? members : undefined;
}

const MEMBER_LABELS: [keyof SignalStoreMembers, string][] = [
  ['state', 'state'],
  ['computed', 'computed'],
  ['methods', 'methods'],
  ['rxMethods', 'rxMethod'],
  ['props', 'props'],
  ['hooks', 'hooks'],
  ['entities', 'entities'],
];

export function describeMembers(members: SignalStoreMembers): string {
  return MEMBER_LABELS.filter(([key]) => members[key]?.length)
    .map(([key, label]) => `${label}: ${members[key]!.join(', ')}`)
    .join('; ');
}
