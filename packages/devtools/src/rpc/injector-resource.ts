import type { InjectorPage } from '../types.ts';
import { countInjectors, largestFitting, outlineInjectors } from './injector-outline.ts';
import { MAX_RESOURCE_CHARS, RESOURCE_UNTRUSTED, withUntrustedNotice } from './resource-text.ts';

/**
 * The `injector-tree` resource (and its per-page template). A real app's
 * root injector alone holds a hundred providers with their dependencies, so
 * the full tree rarely fits in {@link MAX_RESOURCE_CHARS}. Past it the
 * resource is an outline of every page's injectors (names, kinds, ids, and
 * provider and dependency counts), and when even that is too long, each page
 * keeps its injectors nearest the top. It never becomes a stub without
 * injectors.
 */
export function injectorResourceText(state: object, pages: Record<string, InjectorPage>): string {
  const json = JSON.stringify(withUntrustedNotice(state));
  if (json.length <= MAX_RESOURCE_CHARS) return json;
  const ids = Object.keys(pages);
  const totals = ids.map((id) => countInjectors([...pages[id]!.roots, ...pages[id]!.environment]));
  const render = (share: number) =>
    JSON.stringify({
      _untrusted: RESOURCE_UNTRUSTED,
      outline: true,
      note: `The full tree is ${json.length.toLocaleString('en-US')} characters, more than ${MAX_RESOURCE_CHARS.toLocaleString('en-US')}, so injectors are an outline: \`providers\` and \`dependencies\` are counts, and \`moreChildren\` counts injectors left out below one. Read an injector's providers with pangular:inspect-providers and \`selector\`.`,
      pages: Object.fromEntries(
        ids.map((id, i) => {
          const page = pages[id]!;
          const keep = Math.ceil((totals[i]! * share) / 1000);
          return [
            id,
            {
              environment: outlineInjectors(page.environment, keep),
              roots: outlineInjectors(page.roots, keep),
              injectors: totals[i],
              truncated: page.truncated === true,
              zone: page.zone ?? null,
            },
          ];
        }),
      ),
    });
  return render(largestFitting(1000, (share) => render(share).length <= MAX_RESOURCE_CHARS));
}
