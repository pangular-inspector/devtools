import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { angularMajor } from './angular-version.ts';
import {
  ANNOTATION,
  classScopes,
  lineCounter,
  maskStrings,
  matchDelimiter,
  skipString,
  sourceRoots,
  stripComments,
  walkFiles,
} from './source-scan.ts';

const ComponentSchema = v.object({
  selector: v.string(),
  className: v.string(),
  kind: v.picklist(['component', 'directive']),
  file: v.string(),
  line: v.number(),
  inputs: v.array(v.string()),
  outputs: v.array(v.string()),
  isStandalone: v.boolean(),
  // Only a component carries a change detection strategy.
  changeDetection: v.optional(
    v.union([v.literal('OnPush'), v.literal('Eager'), v.literal('unknown')]),
  ),
});

export const getComponents = defineRpcFunction({
  name: 'get-components',
  type: 'query',
  jsonSerializable: true,
  snapshot: true,
  args: [],
  returns: describable(v.array(ComponentSchema)),
  agent: {
    description:
      'Discover Angular components and directives by scanning source files for @Component and @Directive decorators. Returns one entry per decorated class: its class name, selector (empty when it has none, as with routed components), `kind` (component or directive), inputs, outputs, file and line. Count `kind` to tell components from directives. Call this to understand the component architecture.',
    title: 'List Angular components',
  },
  setup: (ctx) => ({
    // Resolved once per scan: Angular 22 made `OnPush` the implicit default,
    // so telling a component's effective strategy apart from an explicit one
    // needs the project's major version, not just its own source.
    handler: async () => scanComponents(ctx.cwd, angularMajor(ctx.cwd)),
  }),
});

type ChangeDetection = 'OnPush' | 'Eager' | 'unknown';

interface ComponentInfo {
  selector: string;
  className: string;
  /** `component` or `directive`: the scan covers both. */
  kind: 'component' | 'directive';
  file: string;
  line: number;
  inputs: string[];
  outputs: string[];
  isStandalone: boolean;
  /** The strategy in effect; absent for a directive, which has none. */
  changeDetection?: ChangeDetection;
}

function scanComponents(cwd: string, major: number | undefined): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, entry) => {
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) return;
      try {
        components.push(...componentsIn(readFileSync(full, 'utf-8'), relative(cwd, full), major));
      } catch {
        // skip
      }
    });
  }
  return components;
}

function componentsIn(
  content: string,
  relPath: string,
  major: number | undefined,
): ComponentInfo[] {
  const source = stripComments(content);
  // A decorator or a declaration quoted inside a template is not code.
  const code = maskStrings(source);

  const components: ComponentInfo[] = [];
  const lineAt = lineCounter(code);
  const scopes = classScopes(code, source);
  scopes.forEach((scope) => {
    if (!scope.kind || scope.kind === 'pipe') return;
    const body = code.slice(scope.start, scope.end);
    const kind = scope.kind;
    components.push({
      selector: scope.component ?? '',
      className: scope.className ?? '',
      kind,
      file: relPath,
      line: lineAt(scope.start),
      inputs: [...names(body, INPUT), ...decoratedNames(body, 'Input')],
      outputs: [...names(body, OUTPUT), ...decoratedNames(body, 'Output')],
      isStandalone: standaloneOf(scope.decoratorArgs, major),
      // A directive carries no change detection strategy of its own.
      ...(kind === 'component' ? changeDetectionFields(scope.decoratorArgs, major) : {}),
    });
  });
  return components;
}

export function standaloneOf(
  decoratorArgs: string | undefined,
  major: number | undefined,
): boolean {
  const key = decoratorArgs ? topLevelKey(decoratorArgs, STANDALONE_KEY) : undefined;
  if (decoratorArgs && key) {
    const start = key.index + key[0].length;
    const value = decoratorArgs.slice(start, valueEnd(decoratorArgs, start)).trim();
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return major === undefined || major >= 19;
}

/**
 * The `changeDetection` a component declares, read the same way `selector`
 * is: found in the masked `decoratorArgs`, so a key spelled inside a template
 * or comment can't match. Only a member access ending in `.OnPush`/`.Eager`/
 * `.Default`, or the bare literal `0`/`1`, is trusted; anything else — a
 * variable, a call, a ternary — is `'unknown'` rather than guessed at.
 */
function changeDetectionFields(
  decoratorArgs: string | undefined,
  major: number | undefined,
): { changeDetection?: ChangeDetection } {
  const declared = declaredChangeDetection(decoratorArgs);
  if (declared === undefined) {
    // Nothing written: Angular 22+ defaults to OnPush, <=21 to Eager (then
    // called `Default`). An unknown major can't be resolved either way.
    if (major === undefined) return { changeDetection: 'unknown' };
    return { changeDetection: major >= 22 ? 'OnPush' : 'Eager' };
  }
  if (declared === 'unresolved') return { changeDetection: 'unknown' };
  return { changeDetection: declared === 'Default' ? 'Eager' : declared };
}

const CHANGE_DETECTION_KEY = /(?<![\w$.])changeDetection\s*:/g;
const STANDALONE_KEY = /(?<![\w$.])standalone\s*:/g;
// The whole value, optionally qualified (`ChangeDetectionStrategy.OnPush`,
// `core.ChangeDetectionStrategy.OnPush`) or a bare `OnPush` import alias.
const STRATEGY_VALUE =
  /^(?:(?:[$\w]+\s*\.\s*)*ChangeDetectionStrategy\s*\.\s*)?(OnPush|Eager|Default)$/;

function declaredChangeDetection(
  decoratorArgs: string | undefined,
): 'OnPush' | 'Eager' | 'Default' | 'unresolved' | undefined {
  if (!decoratorArgs) return undefined;
  const key = topLevelKey(decoratorArgs);
  if (!key) return undefined;

  const valueStart = key.index + key[0].length;
  const value = decoratorArgs.slice(valueStart, valueEnd(decoratorArgs, valueStart)).trim();

  if (value === '0') return 'OnPush';
  if (value === '1') return 'Default';
  // Matching the whole value keeps `cond ? X.OnPush : X.Eager` from being
  // read as whichever name happens to appear first.
  return (
    (STRATEGY_VALUE.exec(value)?.[1] as 'OnPush' | 'Eager' | 'Default' | undefined) ?? 'unresolved'
  );
}

/**
 * The `changeDetection:` key of the decorator's own object literal. Args look
 * like `({ ... })`, so a property of the component sits at depth 2; a match
 * nested deeper, such as inside `providers`, belongs to something else.
 */
function topLevelKey(
  args: string,
  pattern: RegExp = CHANGE_DETECTION_KEY,
): RegExpExecArray | undefined {
  const depthAt = new Map<number, number>();
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    depthAt.set(i, depth);
    if (ch === '"' || ch === "'" || ch === '`') i = skipString(args, i);
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
  }
  pattern.lastIndex = 0;
  for (const key of args.matchAll(pattern)) {
    if (depthAt.get(key.index) === 2) return key;
  }
  return undefined;
}

/**
 * End of a decorator property's value: the next top-level `,` or the `}`
 * closing the object, whichever comes first. Nested brackets, such as a call
 * argument list, are skipped so a value like `Eager /* comment *\/` — or any
 * later property — isn't cut into.
 */
function valueEnd(args: string, from: number): number {
  let depth = 0;
  for (let i = from; i < args.length; i++) {
    const ch = args[i];
    if (ch === '"' || ch === "'" || ch === '`') i = skipString(args, i);
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return i;
      depth--;
    } else if (ch === ',' && depth === 0) return i;
  }
  return args.length;
}

function names(body: string, pattern: RegExp): string[] {
  pattern.lastIndex = 0;
  return [...body.matchAll(pattern)].map((match) => match[1]);
}

// `name = input(`, `name = input<T>(` and `name = input.required(`, optionally
// behind a modifier or a type annotation, as in `readonly name: InputSignal<T> =`.
const INPUT = new RegExp(
  String.raw`(?<![\w$#.])(?:this\.)?(#?[$\w]+)\s*` +
    ANNOTATION +
    String.raw`=\s*(?:input|model)(?:\.required)?\s*[<(]`,
  'g',
);
const OUTPUT = new RegExp(
  String.raw`(?<![\w$#.])(?:this\.)?(#?[$\w]+)\s*` + ANNOTATION + String.raw`=\s*output\s*[<(]`,
  'g',
);
// A member can carry modifiers and an accessor keyword before its name:
// `@Input() set value(v)` declares `value`, not `set`.
const MEMBER_PREFIX = String.raw`(?:(?:readonly|public|private|protected|override|declare|static|abstract|get|set|async)\s+)*`;
const DECORATED_MEMBER = new RegExp(String.raw`\s+` + MEMBER_PREFIX + String.raw`([$\w]+)`, 'y');

function decoratedNames(body: string, decorator: 'Input' | 'Output'): string[] {
  const found: string[] = [];
  const opening = new RegExp(String.raw`@${decorator}\(`, 'g');
  let match: RegExpExecArray | null;
  while ((match = opening.exec(body)) !== null) {
    const close = matchDelimiter(body, match.index + match[0].length - 1, '(', ')');
    DECORATED_MEMBER.lastIndex = close + 1;
    const name = DECORATED_MEMBER.exec(body)?.[1];
    if (name) found.push(name);
  }
  return found;
}
