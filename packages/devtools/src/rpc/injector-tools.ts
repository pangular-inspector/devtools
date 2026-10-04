import { MAX_INJECTOR_NODES, NULL_INJECTOR_ID } from '../injector-tree.ts';
import type { InjectorPage, InjectorTreeNode } from '../types.ts';
import { zoneModeText } from '../zone-mode.ts';

export const MAX_TOOL_CHARS = 20_000;

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

function capped(text: string): string {
  return text.length > MAX_TOOL_CHARS
    ? `${text.slice(0, MAX_TOOL_CHARS)}… (truncated at ${MAX_TOOL_CHARS} characters; ${NARROW})`
    : text;
}

function matchesSelector(node: InjectorTreeNode, selector: string): boolean {
  const { injector } = node;
  if (injector.type !== 'element') return false;
  if (injector.id === selector || injector.selector === selector) return true;
  const want = selector.replace(/^<|>$/g, '').toLowerCase();
  return (
    injector.name.toLowerCase() === want ||
    injector.component?.toLowerCase() === want ||
    !!injector.directives?.some((name) => name.toLowerCase() === want)
  );
}

/**
 * Answers `inspect-providers`: the whole tree when nothing narrows it, the
 * element injectors a selector matches with their lookup paths resolved, or
 * where a token is provided and injected.
 */
export function inspectProvidersText(
  page: InjectorPage | undefined,
  args: InspectProvidersArgs,
): string {
  if (!page?.roots.length) return NO_INJECTORS;
  const { pageId, roots, environment } = page;
  const elements = flatten(roots);
  const all = [...elements, ...flatten(environment)];
  const byId = new Map(all.map((node) => [node.injector.id, node]));
  const nameOf = (id: string) =>
    id === NULL_INJECTOR_ID
      ? 'Null injector'
      : (byId.get(id)?.injector.name ?? '(not in the report)');
  const notes = page.truncated
    ? `\n\nThe page has more than ${MAX_INJECTOR_NODES} element injectors and stopped reporting there, so injectors further down the page are missing from this answer.`
    : '';

  const selector = args.selector?.trim();
  const token = args.token?.trim();

  if (!selector && !token) {
    const zone = zoneModeText(page.zone, pageId);
    return capped(
      `This is the injector tree for the whole page \`${pageId}\`. Element injectors list what each component and directive injected and which injector supplied it (\`providedBy\` is an injector id). Environment injectors run from the platform down to the root and any route injectors; their \`dependencies\` list what the services they already created inject (\`from\` is the service). To look at one component or one token, ${NARROW}.${zone ? ` ${zone}` : ''}${notes}\n\nElement injectors:\n\n${JSON.stringify(roots)}\n\nEnvironment injectors:\n\n${JSON.stringify(environment)}`,
    );
  }

  const matched = selector ? elements.filter((node) => matchesSelector(node, selector)) : elements;
  if (selector && !matched.length) {
    const names = [...new Set(elements.map((node) => node.injector.name))].slice(0, 20);
    return `No element injector on page \`${pageId}\` matches \`${selector}\`. Pass a tag name, a component or directive class name, or an injector id. Tags on the page: ${names.map((name) => `\`${name}\``).join(', ')}.${notes}`;
  }

  const sections: string[] = [];
  if (selector) {
    const detail = matched.map((node) => {
      const { path, ...injector } = node.injector;
      return {
        injector,
        providers: node.providers,
        dependencies: (node.dependencies ?? []).map((dep) =>
          dep.providedBy ? { ...dep, providedByName: nameOf(dep.providedBy) } : dep,
        ),
        lookupPath: (path ?? []).map((id) => ({
          id,
          name: nameOf(id),
          provides: byId.get(id)?.providers.map((provider) => provider.token) ?? [],
        })),
      };
    });
    sections.push(
      `Element injectors on page \`${pageId}\` matching \`${selector}\` (${matched.length}). \`lookupPath\` lists the injectors Angular asks, in order, with the tokens each one provides.\n\n${JSON.stringify(detail)}`,
    );
  }

  if (token) {
    const want = token.toLowerCase();
    const providedBy = all.flatMap((node) =>
      node.providers
        .filter((provider) => provider.token.toLowerCase() === want)
        .map((provider) => ({
          id: node.injector.id,
          name: node.injector.name,
          type: node.injector.type,
          provider,
        })),
    );
    const injectedBy = (selector ? matched : all).flatMap((node) =>
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
    );
    const where = selector ? ` among the injectors matching \`${selector}\`` : '';
    if (!providedBy.length && !injectedBy.length) {
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
      sections.push(
        `No injector on page \`${pageId}\` provides \`${token}\` and nothing injects it${where}.${
          similar.length
            ? ` Similar tokens: ${similar.map((name) => `\`${name}\``).join(', ')}.`
            : ''
        }`,
      );
    } else {
      sections.push(
        `Token \`${token}\` on page \`${pageId}\`. \`providedBy\` lists the injectors whose own providers include it; \`injectedBy\` lists what injects it${where} and which injector supplied it (\`providedBy\` null means none did).\n\n${JSON.stringify({ providedBy, injectedBy })}`,
      );
    }
  }

  return capped(`${sections.join('\n\n')}${notes}`);
}
