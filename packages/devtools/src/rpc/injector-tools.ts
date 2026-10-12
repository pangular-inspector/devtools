import { MAX_INJECTOR_NODES, NULL_INJECTOR_ID } from '../injector-tree.ts';
import { MAX_INJECTOR_DEPTH, MAX_REPORTED_INJECTORS } from './injector-report.ts';
import type { InjectorPage, InjectorTreeNode } from '../types.ts';
import { zoneModeText } from '../zone-mode.ts';
import { untrusted } from './forms-tools.ts';
import { countInjectors, largestFitting, outlineInjectors } from './injector-outline.ts';

export const MAX_TOOL_CHARS = 20_000;

/** Longest `selector` or `token` taken; answers echo them, so they must stay short. */
export const MAX_ARG_CHARS = 500;

export const NO_INJECTORS = `No injector data available. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`;

const NARROW = 'pass `selector` or `token` to narrow it down';

export interface InspectProvidersArgs {
  selector?: string;
  token?: string;
}

function flatten(nodes: InjectorTreeNode[], out: InjectorTreeNode[] = []): InjectorTreeNode[] {
  for (const node of nodes) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

const fits = (text: string) => text.length <= MAX_TOOL_CHARS;

/**
 * The whole tree when it fits in {@link MAX_TOOL_CHARS}. Otherwise element
 * injectors become an outline (names, kinds, provider and dependency counts),
 * and when even that is too long whole subtrees drop from the bottom. The
 * environment injectors always stay, in full when they take at most half the
 * budget, and as an outline otherwise, which drops its own subtrees from the
 * bottom when it is still too long. The JSON is never cut, so it always parses.
 */
function wholeTreeText(
  intro: string,
  roots: InjectorTreeNode[],
  environment: InjectorTreeNode[],
): string {
  const render = (note: string, elementJson: string, environmentJson: string) =>
    untrusted(
      `${intro}${note}\n\nElement injectors:\n\n${elementJson}\n\nEnvironment injectors:\n\n${environmentJson}`,
    );
  const environmentFull = JSON.stringify(environment);
  const full = render('', JSON.stringify(roots), environmentFull);
  if (fits(full)) return full;

  const total = countInjectors(roots);
  const elementsLeftOut = (dropped: number, of: number) =>
    ` ${dropped} of ${of} element injectors are left out, deepest first (\`moreChildren\` counts the children left out under an injector); ${NARROW}.`;
  const outlineNote = (environmentNote: string) =>
    `\n\nThe whole tree is longer than ${MAX_TOOL_CHARS} characters, so element injectors are shown as an outline: \`providers\` and \`dependencies\` are counts. To see providers and lookup paths, ${NARROW}.${environmentNote}`;
  const environmentOutlined =
    ' Environment injectors are outlined too; pass an environment injector name as `selector` to see its providers.';
  let environmentJson = environmentFull;
  let outlined = outlineNote('');
  if (environmentFull.length > MAX_TOOL_CHARS / 2) {
    environmentJson = JSON.stringify(outlineInjectors(environment));
    outlined = outlineNote(environmentOutlined);
    // Even with no element injectors the environment outline can be too long, so it drops
    // whole subtrees from the bottom too, the same way the element outline does.
    if (!fits(render(outlined, '[]', environmentJson))) {
      const envTotal = countInjectors(environment);
      const envPartial = (kept: number) => {
        const note = outlineNote(
          `${environmentOutlined} ${envTotal - kept} of ${envTotal} environment injectors are left out, deepest first.`,
        );
        return { note, json: JSON.stringify(outlineInjectors(environment, kept)) };
      };
      const fitsEnv = (kept: number) => {
        const { note, json } = envPartial(kept);
        return fits(render(`${note}${elementsLeftOut(total, total)}`, '[]', json));
      };
      ({ note: outlined, json: environmentJson } = envPartial(largestFitting(envTotal, fitsEnv)));
    }
  }
  const outline = render(outlined, JSON.stringify(outlineInjectors(roots)), environmentJson);
  if (fits(outline)) return outline;

  const partial = (kept: number) =>
    render(
      `${outlined}${elementsLeftOut(total - kept, total)}`,
      JSON.stringify(outlineInjectors(roots, kept)),
      environmentJson,
    );
  return partial(largestFitting(total, (kept) => fits(partial(kept))));
}

/** The answer when the text around the lists alone is longer than {@link MAX_TOOL_CHARS}. */
const TOO_LONG = `The answer does not fit in ${MAX_TOOL_CHARS} characters even without any injectors in it. Pass a shorter \`selector\` or \`token\`.`;

/**
 * Keeps the first items of every list, the same share of each, so `render`
 * fits in {@link MAX_TOOL_CHARS}. Whole items drop; no JSON is cut. When even
 * empty lists do not fit, answers {@link TOO_LONG}.
 */
function fitLists<T extends unknown[][]>(lists: T, render: (lists: T) => string): string {
  const full = render(lists);
  if (fits(full)) return full;
  const steps = 1000;
  const take = (step: number) =>
    lists.map((list) => list.slice(0, Math.ceil((list.length * step) / steps))) as T;
  const fitted = render(take(largestFitting(steps, (step) => fits(render(take(step))))));
  return fits(fitted) ? fitted : TOO_LONG;
}

/** ` Showing 3 of 40; narrow ...` when a list lost items to the budget. */
function shown(kept: unknown[], all: unknown[]): string {
  return kept.length < all.length
    ? ` Showing ${kept.length} of ${all.length} to stay within ${MAX_TOOL_CHARS} characters; ${NARROW} further.`
    : '';
}

/** Lower case with runs of spaces collapsed, so `route:  Admin` finds `Route: admin`. */
function loose(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Environment injectors match by id or by name (`Root`, `Platform`, `Route: admin`). */
function matchesEnvironment(node: InjectorTreeNode, selector: string): boolean {
  const { injector } = node;
  return (
    injector.type === 'environment' &&
    (injector.id === selector || loose(injector.name) === loose(selector))
  );
}

/** Each environment injector's ancestors, nearest first, from the nesting of the report. */
function environmentParents(
  nodes: InjectorTreeNode[],
  above: string[] = [],
  out = new Map<string, string[]>(),
): Map<string, string[]> {
  for (const node of nodes) {
    out.set(node.injector.id, above);
    environmentParents(node.children, [node.injector.id, ...above], out);
  }
  return out;
}

function matchesSelector(node: InjectorTreeNode, selector: string): boolean {
  const { injector } = node;
  if (injector.type !== 'element') return false;
  if (injector.id === selector || injector.componentId === selector) return true;
  if (injector.selector === selector) return true;
  const want = selector.replace(/^<|>$/g, '').toLowerCase();
  return (
    injector.name.toLowerCase() === want ||
    injector.component?.toLowerCase() === want ||
    !!injector.directives?.some((name) => name.toLowerCase() === want)
  );
}

/**
 * Answers `inspect-providers`: the whole tree when nothing narrows it, the
 * element or environment injectors a selector matches with their lookup paths
 * resolved, or where a token is provided and injected.
 */
export function inspectProvidersText(
  page: InjectorPage | undefined,
  args: InspectProvidersArgs,
): string {
  if (!page || (!page.roots.length && !page.environment.length)) return NO_INJECTORS;
  const { pageId, roots, environment } = page;
  const elements = flatten(roots);
  const environments = flatten(environment);
  const all = [...elements, ...environments];
  const byId = new Map(all.map((node) => [node.injector.id, node]));
  const nameOf = (id: string) =>
    id === NULL_INJECTOR_ID
      ? 'Null injector'
      : (byId.get(id)?.injector.name ?? '(not in the report)');
  const notes = page.truncated
    ? `\n\nThe page reported only part of its injector tree (it keeps at most ${MAX_INJECTOR_NODES} element injectors and ${MAX_REPORTED_INJECTORS} in all, and leaves out injectors nested more than ${MAX_INJECTOR_DEPTH} levels deep), so some injectors are missing from this answer and a lookup path or a provider can point to one that is not listed.`
    : '';

  const selector = args.selector?.trim();
  const token = args.token?.trim();
  if ((selector?.length ?? 0) > MAX_ARG_CHARS || (token?.length ?? 0) > MAX_ARG_CHARS) {
    return `\`selector\` and \`token\` take at most ${MAX_ARG_CHARS} characters each. Pass a tag name, a class name, an injector name or id, or a token name.`;
  }

  if (!selector && !token) {
    const zone = zoneModeText(page.zone, pageId);
    return wholeTreeText(
      `This is the injector tree for the whole page \`${pageId}\`. Element injectors list what each component and directive injected and which injector supplied it (\`providedBy\` is an injector id), and \`componentId\` is the component's id in the component tree. \`framework: true\` marks Angular's own injectors and providers. Environment injectors run from the platform down to the root and any route injectors; their \`dependencies\` list what the services they already created inject (\`from\` is the service). To look at one component or one token, ${NARROW}.${zone ? ` ${zone}` : ''}${notes}`,
      roots,
      environment,
    );
  }

  const matchedElements = selector
    ? elements.filter((node) => matchesSelector(node, selector))
    : [];
  const matchedEnvironments = selector
    ? environments.filter((node) => matchesEnvironment(node, selector))
    : [];
  const matched = [...matchedElements, ...matchedEnvironments];
  if (selector && !matched.length) {
    const list = (names: string[]) => names.map((name) => `\`${name}\``).join(', ');
    const tags = [...new Set(elements.map((node) => node.injector.name))].slice(0, 20);
    const envNames = [...new Set(environments.map((node) => node.injector.name))].slice(0, 10);
    return untrusted(
      `No element or environment injector on page \`${pageId}\` matches \`${selector}\`. Pass a tag name, a component or directive class name, an environment injector name, or an injector id. Tags on the page: ${list(tags)}. Environment injectors: ${envNames.length ? list(envNames) : 'none reported'}.${notes}`,
    );
  }

  const namedDependencies = (node: InjectorTreeNode) =>
    (node.dependencies ?? []).map((dep) =>
      dep.providedBy ? { ...dep, providedByName: nameOf(dep.providedBy) } : dep,
    );
  const resolve = (ids: string[]) =>
    ids.map((id) => ({
      id,
      name: nameOf(id),
      provides: byId.get(id)?.providers.map((provider) => provider.token) ?? [],
    }));

  const elementDetail = matchedElements.map((node) => {
    const { path, ...injector } = node.injector;
    return {
      injector,
      providers: node.providers,
      dependencies: namedDependencies(node),
      lookupPath: resolve(path ?? []),
    };
  });
  const parents = matchedEnvironments.length ? environmentParents(environment) : new Map();
  const environmentDetail = matchedEnvironments.map((node) => ({
    injector: node.injector,
    providers: node.providers,
    dependencies: namedDependencies(node),
    parents: resolve(parents.get(node.injector.id) ?? []),
  }));

  const want = token?.toLowerCase();
  const providedBy = want
    ? all.flatMap((node) =>
        node.providers
          .filter((provider) => provider.token.toLowerCase() === want)
          .map((provider) => ({
            id: node.injector.id,
            name: node.injector.name,
            type: node.injector.type,
            provider,
          })),
      )
    : [];
  const injectedBy = want
    ? (selector ? matched : all).flatMap((node) =>
        (node.dependencies ?? [])
          .filter((dep) => dep.token.toLowerCase() === want)
          .map((dep) => ({
            id: node.injector.id,
            name: node.injector.name,
            component: node.injector.component,
            from: dep.from,
            flags: dep.flags,
            providedBy: dep.providedBy,
            providedByName: dep.providedBy ? nameOf(dep.providedBy) : null,
          })),
      )
    : [];
  const where = selector ? ` among the injectors matching \`${selector}\`` : '';
  let missingToken = '';
  if (token && want && !providedBy.length && !injectedBy.length) {
    const similar = [
      ...new Set(
        all.flatMap((node) => [
          ...node.providers.map((provider) => provider.token),
          ...(node.dependencies ?? []).map((dep) => dep.token),
        ]),
      ),
    ]
      .filter((name) => name.toLowerCase().includes(want))
      .slice(0, 10);
    missingToken = `No injector on page \`${pageId}\` provides \`${token}\` and nothing injects it${where}.${
      similar.length ? ` Similar tokens: ${similar.map((name) => `\`${name}\``).join(', ')}.` : ''
    }`;
  }

  return fitLists(
    [elementDetail, environmentDetail, providedBy, injectedBy],
    ([elementShown, environmentShown, providedShown, injectedShown]) => {
      const sections: string[] = [];
      if (matchedElements.length) {
        sections.push(
          `Element injectors on page \`${pageId}\` matching \`${selector}\` (${matchedElements.length}). \`lookupPath\` lists the injectors Angular asks, in order, with the tokens each one provides.${shown(elementShown, elementDetail)}\n\n${JSON.stringify(elementShown)}`,
        );
      }
      if (matchedEnvironments.length) {
        sections.push(
          `Environment injectors on page \`${pageId}\` matching \`${selector}\` (${matchedEnvironments.length}). \`dependencies\` lists what the services this injector already created inject (\`from\` is the service, \`providedBy\` the injector that supplied it). \`parents\` lists the environment injectors Angular asks next, nearest first, with the tokens each one provides.${shown(environmentShown, environmentDetail)}\n\n${JSON.stringify(environmentShown)}`,
        );
      }
      if (missingToken) sections.push(missingToken);
      else if (token) {
        sections.push(
          `Token \`${token}\` on page \`${pageId}\`. \`providedBy\` lists the injectors whose own providers include it; \`injectedBy\` lists what injects it${where} and which injector supplied it (\`providedBy\` null means none did).${shown(providedShown, providedBy)}${shown(injectedShown, injectedBy)}\n\n${JSON.stringify({ providedBy: providedShown, injectedBy: injectedShown })}`,
        );
      }
      return untrusted(`${sections.join('\n\n')}${notes}`);
    },
  );
}
