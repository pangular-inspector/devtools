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

const ComponentSchema = v.object({
  selector: v.string(),
  className: v.string(),
  kind: v.picklist(['component', 'directive']),
  file: v.string(),
  line: v.number(),
  inputs: v.array(v.string()),
  outputs: v.array(v.string()),
  isStandalone: v.boolean(),
});

export const getComponents = defineRpcFunction({
  name: 'get-components',
  type: 'query',
  jsonSerializable: true,
  args: [],
  returns: describable(v.array(ComponentSchema)),
  agent: {
    description:
      'Discover Angular components and directives by scanning source files for @Component and @Directive decorators. Returns one entry per decorated class: its class name, selector (empty when it has none, as with routed components), `kind` (component or directive), inputs, outputs, file and line. Count `kind` to tell components from directives. Call this to understand the component architecture.',
    title: 'List Angular components',
  },
  setup: (ctx) => ({
    handler: async () => scanComponents(ctx.cwd),
  }),
});

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
}

function scanComponents(cwd: string): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, entry) => {
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) return;
      try {
        components.push(...componentsIn(readFileSync(full, 'utf-8'), relative(cwd, full)));
      } catch {
        // skip
      }
    });
  }
  return components;
}

function componentsIn(content: string, relPath: string): ComponentInfo[] {
  const source = stripComments(content);
  // A decorator or a declaration quoted inside a template is not code.
  const code = maskStrings(source);

  const components: ComponentInfo[] = [];
  const lineAt = lineCounter(code);
  const scopes = classScopes(code, source);
  scopes.forEach((scope) => {
    if (!scope.kind || scope.kind === 'pipe') return;
    const body = code.slice(scope.start, scope.end);
    components.push({
      selector: scope.component ?? '',
      className: scope.className ?? '',
      kind: scope.kind,
      file: relPath,
      line: lineAt(scope.start),
      inputs: [...names(body, INPUT), ...names(body, INPUT_DECORATOR)],
      outputs: [...names(body, OUTPUT), ...names(body, OUTPUT_DECORATOR)],
      isStandalone: !/\bstandalone\s*:\s*false\b/.test(scope.decoratorArgs ?? ''),
    });
  });
  return components;
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
const INPUT_DECORATOR = new RegExp(
  String.raw`@Input\([^)]*\)\s+` + MEMBER_PREFIX + String.raw`([$\w]+)`,
  'g',
);
const OUTPUT_DECORATOR = new RegExp(
  String.raw`@Output\([^)]*\)\s+` + MEMBER_PREFIX + String.raw`([$\w]+)`,
  'g',
);
