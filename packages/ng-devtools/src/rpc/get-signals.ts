import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  ANNOTATION,
  classScopes,
  lineCounter,
  maskStrings,
  sourceRoots,
  stripComments,
  walkFiles,
} from './source-scan.ts';

const SignalEntrySchema = v.object({
  name: v.string(),
  kind: v.string(),
  file: v.string(),
  line: v.number(),
  component: v.optional(v.string()),
});

export const getSignals = defineRpcFunction({
  name: 'get-signals',
  type: 'query',
  jsonSerializable: true,
  snapshot: true,
  args: [],
  returns: describable(v.array(SignalEntrySchema)),
  agent: {
    description:
      'Scan source files for signal(), computed(), linkedSignal(), effect(), toSignal() and resource declarations (resource, httpResource, rxResource), plus signal inputs, models and queries. Returns name, kind, file, and line number. Call this to understand the reactive architecture before suggesting changes.',
    title: 'List Angular signals from source',
  },
  setup: (ctx) => ({
    handler: async () => scanSignals(ctx.cwd),
  }),
});

interface SignalEntry {
  name: string;
  kind: string;
  file: string;
  line: number;
  component?: string;
}

const KINDS: Record<string, string> = {
  signal: 'signal',
  computed: 'computed',
  linkedSignal: 'linkedSignal',
  effect: 'effect',
  resource: 'resource',
  httpResource: 'httpResource',
  rxResource: 'rxResource',
  toSignal: 'toSignal',
  input: 'input (signal)',
  model: 'model (signal)',
  viewChild: 'viewChild (signal)',
  viewChildren: 'viewChildren (signal)',
  contentChild: 'contentChild (signal)',
  contentChildren: 'contentChildren (signal)',
};

// One pass over the file: `name = fn(` or `name = fn.required(`, with the
// optional `.required` part of the same match so a required input is not also
// reported as a plain input. The name may be a private field and may carry a
// single line type annotation, as in `readonly total: Signal<number> =`. A
// `this.` prefix is a declaration too, but any other member assignment, as in
// `store.count = signal(0)`, is not, hence the lookbehind.
const SIGNAL_CALL = new RegExp(
  String.raw`(?<![\w$#.])(?:this\.)?(#?[$\w]+)\s*` +
    ANNOTATION +
    String.raw`=\s*(${Object.keys(KINDS).join('|')})(\.(?:required|text|blob|arrayBuffer))?\s*[<(]`,
  'g',
);

function scanSignals(cwd: string): SignalEntry[] {
  const entries: SignalEntry[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, item) => {
      if (!item.endsWith('.ts') || item.endsWith('.spec.ts') || item.endsWith('.d.ts')) return;
      try {
        entries.push(...signalsIn(readFileSync(full, 'utf-8'), relative(cwd, full)));
      } catch {
        // skip
      }
    });
  }
  return entries;
}

function signalsIn(content: string, relPath: string): SignalEntry[] {
  const source = stripComments(content);
  // A declaration quoted inside a template or a string is not code. Masking
  // keeps the length, so offsets into the two strings stay interchangeable.
  const code = maskStrings(source);
  const scopes = classScopes(code, source);
  const lineAt = lineCounter(code);

  const entries: SignalEntry[] = [];
  SIGNAL_CALL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SIGNAL_CALL.exec(code)) !== null) {
    const at = match.index;
    const [, name, fn, required] = match;
    entries.push({
      name,
      kind: required === '.required' ? `${fn}.required (signal)` : KINDS[fn],
      file: relPath,
      line: lineAt(at),
      component: scopes.find((scope) => at >= scope.start && at < scope.end)?.component,
    });
  }
  return entries;
}
