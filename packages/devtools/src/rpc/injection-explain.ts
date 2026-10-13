// `explain-injection`: walks the lookup path of a token from an element or
// environment injector the way Angular resolves it (`lookupTokenUsingNodeInjector`
// and `R3Injector.get` in `@angular/core`), honouring `self`, `skipSelf`,
// `host` and `optional`, and says at each injector whether it provides the
// token and why the lookup stops. It reads only the injector tree the page
// reported, so it never creates a service or runs app code.

import { NULL_INJECTOR_ID } from '../injector-tree.ts';
import type { InjectorPage, InjectorTreeNode, ProviderInfo } from '../types.ts';
import { code, untrusted } from './forms-tools.ts';
import { MAX_ARG_CHARS, NO_INJECTORS } from './injector-tools.ts';

export interface InjectionFlags {
  self?: boolean;
  skipSelf?: boolean;
  host?: boolean;
  optional?: boolean;
}

export interface ExplainInjectionArgs extends InjectionFlags {
  /** An element injector (tag, class name, component id, injector id) or an environment injector name. */
  selector?: string;
  token?: string;
}

/** What one injector on the path did with the token. */
export type InjectionStepStatus =
  /** It provides the token: the lookup ends here. */
  | 'provides'
  /** It was asked and does not provide the token. */
  | 'missing'
  /** It provides the token only in `viewProviders`, which this lookup can't see. */
  | 'hidden'
  /** `skipSelf`: Angular starts at the parent. */
  | 'skipped'
  /** The lookup stopped before it got here. */
  | 'not-asked'
  /** The page's Angular does not list providers, so it can't be told. */
  | 'unknown';

export interface InjectionStep {
  id: string;
  name: string;
  type: 'element' | 'environment' | 'null';
  /** The component on an element injector. */
  component?: string;
  status: InjectionStepStatus;
  reason: string;
  provider?: ProviderInfo;
}

export interface InjectionExplanation {
  pageId: string;
  token: string;
  flags: (keyof InjectionFlags)[];
  start: {
    id: string;
    name: string;
    type: InjectorTreeNode['injector']['type'];
    component?: string;
  };
  steps: InjectionStep[];
  /** `resolved`: an injector provides it; `null`: optional and not found; `error`: NG0201; `unknown`: no provider data. */
  outcome: 'resolved' | 'null' | 'error' | 'unknown';
  /** The id of the injector that provides the token. */
  resolvedBy?: string;
  summary: string;
  /** Before Angular 16.2 the path is rebuilt from the tree's nesting and may differ from Angular's. */
  approximate?: boolean;
  /** Other injectors the selector matched; the first one was used. */
  alsoMatched?: string[];
}

const FLAG_NAMES: (keyof InjectionFlags)[] = ['self', 'skipSelf', 'host', 'optional'];

function flatten(nodes: InjectorTreeNode[], out: InjectorTreeNode[] = []): InjectorTreeNode[] {
  for (const node of nodes) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

/** Each node's ancestors in the report, nearest first. */
function ancestors(
  nodes: InjectorTreeNode[],
  above: string[] = [],
  out = new Map<string, string[]>(),
): Map<string, string[]> {
  for (const node of nodes) {
    out.set(node.injector.id, above);
    ancestors(node.children, [node.injector.id, ...above], out);
  }
  return out;
}

const loose = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

function matches(node: InjectorTreeNode, selector: string): boolean {
  const { injector } = node;
  if (injector.id === selector || injector.componentId === selector) return true;
  if (injector.type === 'environment') return loose(injector.name) === loose(selector);
  if (injector.type !== 'element') return false;
  if (injector.selector === selector) return true;
  const want = selector.replace(/^<|>$/g, '').toLowerCase();
  return (
    injector.name.replace(/^<|>$/g, '').toLowerCase() === want ||
    injector.component?.toLowerCase() === want ||
    !!injector.directives?.some((name) => name.toLowerCase() === want)
  );
}

/** Token names compare as written, then without case. */
function sameToken(a: string, b: string): boolean {
  return a === b || a.toLowerCase() === b.toLowerCase();
}

/**
 * Walks the lookup and returns each step, or a sentence saying why it can't
 * (`{ error }`). `reduced` is true when the page's Angular has no
 * `ɵgetInjectorProviders` (before 16.2), so providers are unknown.
 */
export function explainInjection(
  page: InjectorPage | undefined,
  args: ExplainInjectionArgs,
  reduced = false,
): InjectionExplanation | { error: string } {
  if (!page || (!page.roots.length && !page.environment.length)) return { error: NO_INJECTORS };
  const selector = args.selector?.trim() ?? '';
  const token = args.token?.trim() ?? '';
  if (!selector || !token) {
    return {
      error:
        'Pass `selector` (the component or element that injects, or an environment injector name such as Root) and `token` (the service class or InjectionToken name).',
    };
  }
  if (selector.length > MAX_ARG_CHARS || token.length > MAX_ARG_CHARS) {
    return { error: `\`selector\` and \`token\` take at most ${MAX_ARG_CHARS} characters each.` };
  }
  const elements = flatten(page.roots);
  const environments = flatten(page.environment);
  const all = [...elements, ...environments];
  const byId = new Map(all.map((node) => [node.injector.id, node]));
  const found = [
    ...elements.filter((node) => matches(node, selector)),
    ...environments.filter((node) => matches(node, selector)),
  ];
  const start = found[0];
  if (!start) {
    const tags = [
      ...new Set(elements.map((node) => node.injector.component ?? node.injector.name)),
    ];
    return {
      error: `No injector on page ${code(page.pageId)} matches ${code(selector)}. Pass a component class name, a tag, a component or injector id, or an environment injector name. On the page: ${tags
        .slice(0, 20)
        .map(code)
        .join(', ')}.`,
    };
  }
  const flags = FLAG_NAMES.filter((flag) => args[flag] === true);
  const fromElement = start.injector.type === 'element';

  // The path Angular asks. From 16.2 the page reports it; before, the nesting
  // of the report stands in: element ancestors, then the root's environment chain.
  let path = start.injector.path?.length ? [...start.injector.path] : [];
  let approximate = false;
  if (!path.length) {
    approximate = fromElement;
    const elementUp = fromElement ? (ancestors(page.roots).get(start.injector.id) ?? []) : [];
    const envParents = ancestors(page.environment);
    const firstEnv = fromElement
      ? (environments.find((node) => loose(node.injector.name) === 'root') ?? environments.at(-1))
      : start;
    const envChain = firstEnv
      ? [firstEnv.injector.id, ...(envParents.get(firstEnv.injector.id) ?? [])]
      : [];
    path = fromElement
      ? [start.injector.id, ...elementUp, ...envChain]
      : [start.injector.id, ...(envParents.get(start.injector.id) ?? [])];
    if (path.at(-1) !== NULL_INJECTOR_ID) path.push(NULL_INJECTOR_ID);
  }

  // `host`: Angular stops at the host of the component whose template declares the start.
  const boundary = fromElement ? start.injector.host : undefined;
  // Tokens some injection on the page resolved here: services created on demand,
  // such as `providedIn: 'root'`, are not in a provider list.
  const resolvedHere = (id: string) =>
    all.some((node) =>
      (node.dependencies ?? []).some((dep) => dep.providedBy === id && sameToken(dep.token, token)),
    );

  const steps: InjectionStep[] = [];
  let outcome: InjectionExplanation['outcome'] | undefined;
  let resolvedBy: string | undefined;
  let stopReason = '';
  let previousElement: InjectorTreeNode | undefined;
  let asked = 0;

  for (let i = 0; i < path.length; i++) {
    const id = path[i]!;
    const node = byId.get(id);
    const type: InjectionStep['type'] =
      id === NULL_INJECTOR_ID ? 'null' : (node?.injector.type ?? 'environment');
    const name =
      id === NULL_INJECTOR_ID ? 'Null injector' : (node?.injector.name ?? '(not in the report)');
    const base = {
      id,
      name,
      type,
      ...(node?.injector.component ? { component: node.injector.component } : {}),
    };
    if (outcome || stopReason) {
      steps.push({
        ...base,
        status: 'not-asked',
        reason: stopReason || 'The lookup already ended.',
      });
      continue;
    }
    if (i === 0 && args.skipSelf) {
      steps.push({
        ...base,
        status: 'skipped',
        reason: '`skipSelf`: Angular starts at the parent injector.',
      });
      if (args.self)
        stopReason = '`self` with `skipSelf`: nothing past the skipped injector is asked.';
      continue;
    }
    if (type === 'null') {
      outcome = args.optional ? 'null' : 'error';
      steps.push({
        ...base,
        status: 'missing',
        reason: args.optional
          ? 'Every injector was asked; `optional` makes the null injector return null.'
          : 'Every injector was asked; the null injector throws NG0201 (NullInjectorError).',
      });
      continue;
    }
    if (type === 'environment' && fromElement && (args.self || args.host)) {
      stopReason = `\`${args.self ? 'self' : 'host'}\`: a lookup from an element never asks environment injectors.`;
      outcome = args.optional ? 'null' : 'error';
      steps.push({ ...base, status: 'not-asked', reason: stopReason });
      continue;
    }
    asked++;
    const providers = node?.providers ?? [];
    const atBoundary = !!args.host && boundary === id;
    let status: InjectionStepStatus = 'missing';
    let reason = '';
    let provider: ProviderInfo | undefined;
    if (type === 'element') {
      // viewProviders are seen from the component's own view: by the component
      // itself (the first step) and when the lookup comes up from inside its view.
      const fromInside = i === 0 || previousElement?.injector.host === id;
      const canSeeView = fromInside && (i > 0 || !!node?.injector.component);
      const matching = providers.filter((p) => sameToken(p.token, token));
      const visible = matching.filter((p) =>
        atBoundary ? p.isViewProvider : canSeeView || !p.isViewProvider,
      );
      const isOwnClass =
        !!node &&
        (sameToken(node.injector.component ?? '', token) ||
          (!atBoundary && !!node.injector.directives?.some((d) => sameToken(d, token))));
      if (visible.length) {
        status = 'provides';
        provider = visible[0];
        reason = `Its ${provider!.isViewProvider ? 'viewProviders' : 'providers'} list the token (${provider!.type}).`;
      } else if (isOwnClass && i > 0) {
        status = 'provides';
        reason =
          'The token is the component or a directive on this element, so the instance itself is injected.';
      } else if (matching.length) {
        status = 'hidden';
        reason = atBoundary
          ? 'It provides the token in `providers`, but at the `host` boundary only `viewProviders` and the component itself count.'
          : 'It provides the token only in `viewProviders`, which projected content and elements outside its view can not see.';
      } else if (reduced && !providers.length) {
        status = 'unknown';
        reason = "This Angular version doesn't list element providers.";
      } else {
        reason = 'Not in its providers.';
      }
      previousElement = node;
    } else {
      const listed = providers.find((p) => sameToken(p.token, token));
      if (listed) {
        status = 'provides';
        provider = listed;
        reason = `Its providers list the token (${listed.type}).`;
      } else if (resolvedHere(id)) {
        status = 'provides';
        reason =
          "Not in its provider list, but another injection on the page got the token from here (a service created on demand, such as `providedIn: 'root'`).";
      } else if (reduced && !providers.length) {
        status = 'unknown';
        reason = "This Angular version doesn't list environment providers.";
      } else {
        reason =
          loose(name) === 'root'
            ? "Not in its providers, and nothing on the page got it from here yet. An `@Injectable({ providedIn: 'root' })` class would still be created here on first use; the page can't tell from the token name alone."
            : 'Not in its providers.';
      }
    }
    steps.push({ ...base, status, reason, ...(provider ? { provider } : {}) });
    if (status === 'provides') {
      outcome = 'resolved';
      resolvedBy = id;
      continue;
    }
    if (args.self && asked === 1) {
      stopReason = '`self`: only the first injector is asked.';
      if (!fromElement) {
        // R3Injector with `self` goes straight to the null injector.
        const nullIndex = path.indexOf(NULL_INJECTOR_ID);
        if (nullIndex > i) {
          for (let k = i + 1; k < nullIndex; k++) {
            const skipped = byId.get(path[k]!);
            steps.push({
              id: path[k]!,
              name: skipped?.injector.name ?? '(not in the report)',
              type: skipped?.injector.type ?? 'environment',
              status: 'not-asked',
              reason: stopReason,
            });
          }
          stopReason = '';
          i = nullIndex - 1;
          continue;
        }
      }
      outcome = args.optional ? 'null' : 'error';
      continue;
    }
    if (atBoundary) {
      stopReason = `\`host\`: the lookup stops at the host element of the component that declares ${code(start.injector.component ?? start.injector.name)}.`;
      outcome = args.optional ? 'null' : 'error';
    }
  }
  if (!outcome)
    outcome = steps.some((s) => s.status === 'unknown')
      ? 'unknown'
      : args.optional
        ? 'null'
        : 'error';
  if (outcome !== 'resolved' && steps.some((s) => s.status === 'unknown')) outcome = 'unknown';

  const startName = start.injector.component ?? start.injector.name;
  const by = resolvedBy ? byId.get(resolvedBy)?.injector : undefined;
  const flagText = flags.length ? ` with ${flags.map((flag) => `\`${flag}\``).join(', ')}` : '';
  const summary =
    outcome === 'resolved'
      ? `${code(token)} resolves${flagText} from ${code(startName)} at ${code(by?.component ?? by?.name ?? resolvedBy ?? '')}.`
      : outcome === 'null'
        ? `No injector Angular asks${flagText} provides ${code(token)}; \`optional\` makes the injection return null.`
        : outcome === 'unknown'
          ? `Whether ${code(token)} resolves from ${code(startName)} can't be told: the page's Angular doesn't list providers (16.2 and later do).`
          : `No injector Angular asks${flagText} provides ${code(token)}, so injecting it from ${code(startName)} throws NG0201 (NullInjectorError).`;
  return {
    pageId: page.pageId,
    token,
    flags,
    start: {
      id: start.injector.id,
      name: start.injector.name,
      type: start.injector.type,
      ...(start.injector.component ? { component: start.injector.component } : {}),
    },
    steps,
    outcome,
    ...(resolvedBy ? { resolvedBy } : {}),
    summary,
    ...(approximate ? { approximate } : {}),
    ...(found.length > 1
      ? { alsoMatched: found.slice(1, 11).map((node) => node.injector.id) }
      : {}),
  };
}

const STATUS_TEXT: Record<InjectionStepStatus, string> = {
  provides: 'provides it',
  missing: 'not provided',
  hidden: 'hidden',
  skipped: 'skipped',
  'not-asked': 'not asked',
  unknown: 'unknown',
};

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

/** The markdown answer of `pangular:explain-injection`. */
export function explainInjectionText(result: InjectionExplanation | { error: string }): string {
  if ('error' in result) return result.error;
  const rows = result.steps.map(
    (step, index) =>
      `| ${index + 1} | ${cell(code(step.name))}${step.component ? ` ${cell(code(step.component))}` : ''} | ${step.type} | ${STATUS_TEXT[step.status]} | ${cell(step.reason)} |`,
  );
  const notes = [
    result.approximate
      ? "The page's Angular has no `ɵgetInjectorResolutionPath` (16.2 and later), so this path is rebuilt from the nesting of the injector tree: element ancestors as rendered, then the root's environment injectors. Projected content resolves from where it is declared, so its real path can differ."
      : '',
    result.alsoMatched?.length
      ? `The selector matched ${result.alsoMatched.length + 1} injectors; this is the first. Others: ${result.alsoMatched.map(code).join(', ')}.`
      : '',
  ].filter(Boolean);
  return untrusted(
    [
      `**${result.summary}**`,
      '',
      `Lookup of ${code(result.token)} from ${code(result.start.component ?? result.start.name)} (${code(result.start.id)}) on page ${code(result.pageId)}, flags: ${result.flags.length ? result.flags.join(', ') : 'none'}. Read from the injector tree the page reported; nothing was created or injected.`,
      '',
      '| Step | Injector | Kind | Result | Why |',
      '| --- | --- | --- | --- | --- |',
      ...rows,
      ...(notes.length ? ['', ...notes] : []),
    ].join('\n'),
  );
}

export const EXPLAIN_INJECTION_DESCRIPTION =
  "How Angular resolves `token` for `selector` (a component, element or environment injector) at run time: each injector on the lookup path in order, up to the platform and the null injector, whether it provides the token and why the lookup stops. Honours `self`, `skipSelf`, `host` and `optional`, and notes tokens hidden in `viewProviders`. For NG0201 / NullInjectorError, pass the component and token from pangular:explain-error. Reads the reported injector tree, so nothing is created; a `providedIn: 'root'` service counts once something got it. Uses `page` or the most recent page.";

const FLAG_SCHEMA = (text: string) => ({ type: 'boolean', description: text }) as const;

export const EXPLAIN_INJECTION_SCHEMA = {
  type: 'object',
  properties: {
    selector: {
      type: 'string',
      description:
        'Where the injection happens: a component or directive class name (CardComponent), a tag (app-card), a component id from the component tree or an error owner (c12), an injector id, or an environment injector name (Root, Route: admin) for a service. At most 500 characters.',
    },
    token: {
      type: 'string',
      description:
        'The token, as the Injectors tab names it: a class name (HttpClient) or an InjectionToken description (API_URL). At most 500 characters.',
    },
    self: FLAG_SCHEMA('`inject(T, { self: true })` / `@Self()`: ask only the first injector.'),
    skipSelf: FLAG_SCHEMA('`{ skipSelf: true }` / `@SkipSelf()`: start at the parent injector.'),
    host: FLAG_SCHEMA(
      '`{ host: true }` / `@Host()`: stop at the host element of the declaring component.',
    ),
    optional: FLAG_SCHEMA('`{ optional: true }` / `@Optional()`: null instead of NG0201.'),
    page: {
      type: 'string',
      description:
        'Page id, when more than one tab reports (see pangular:list-pages). Defaults to the most recent.',
    },
  },
  required: ['selector', 'token'],
} as const;

/** The arguments of the RPC function and the agent tool, checked. */
export function injectionArgs(raw: unknown): ExplainInjectionArgs & { page?: string } {
  const args = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const str = (key: string) => (typeof args[key] === 'string' ? (args[key] as string) : undefined);
  const page = str('page') ?? str('pageId');
  return {
    selector: str('selector'),
    token: str('token'),
    ...(page ? { page } : {}),
    ...Object.fromEntries(FLAG_NAMES.filter((flag) => args[flag] === true).map((f) => [f, true])),
  };
}

// Typed loosely like `errors-register.ts`, so devframe's own definitions fit.
type AnyRecord = Record<string, any>;

export interface InjectionExplainHost {
  register(definition: AnyRecord): void;
  agent: { registerTool(tool: AnyRecord): void };
  /** The injector tree of a page, or of the most recent page without one; `{ error }` for an unknown page. */
  page(pageId: string | undefined): { page?: InjectorPage; reduced: boolean } | { error: string };
}

/**
 * The `explain-injection` RPC function (the panel's Explain lookup) and the
 * `pangular:explain-injection` agent tool. Both read only.
 */
export function registerInjectionExplain(host: InjectionExplainHost): void {
  const run = (raw: unknown) => {
    const args = injectionArgs(raw);
    const picked = host.page(args.page);
    if ('error' in picked) return picked;
    return explainInjection(picked.page, args, picked.reduced);
  };
  host.register({
    name: 'explain-injection',
    type: 'query',
    jsonSerializable: true,
    handler: (raw: unknown) => run(raw),
  });
  host.agent.registerTool({
    id: 'pangular:explain-injection',
    description: EXPLAIN_INJECTION_DESCRIPTION,
    inputSchema: EXPLAIN_INJECTION_SCHEMA,
    handler: async (raw: unknown) => ({ markdown: explainInjectionText(run(raw)) }),
  });
}
