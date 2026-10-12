// Names for the directives on a host, as the component tree shows them.

/** The most elements with directives but no component one collection lists. */
export const MAX_DIRECTIVE_HOSTS = 1000;
const MAX_ATTRIBUTES = 10;

/** `SelectorFlags.NOT` in `@angular/core`: a `:not()` part follows. */
const SELECTOR_NOT = 1;
/** `SelectorFlags.ATTRIBUTE`: the strings that follow are name and value pairs. */
const SELECTOR_ATTRIBUTE = 2;

/**
 * The first attribute name of a directive's selector, such as `routerLink`
 * for `a[routerLink]`, read from its compiled definition (`ɵdir.selectors`,
 * which the Forms collector reads too). Angular stores each selector as
 * `[tag, name, value, ..., flags, ...]`; a part after a `NOT` flag is left
 * out. Null for a selector with no attribute, such as `.my-class`.
 */
export function selectorAttribute(directive: object): string | null {
  const ctor = (directive as { constructor?: unknown }).constructor as
    { ɵdir?: { selectors?: unknown }; ɵcmp?: { selectors?: unknown } } | undefined;
  let selectors: unknown;
  try {
    selectors = ctor?.ɵdir?.selectors ?? ctor?.ɵcmp?.selectors;
  } catch {
    return null;
  }
  if (!Array.isArray(selectors)) return null;
  for (const selector of selectors) {
    if (!Array.isArray(selector)) continue;
    let mode = SELECTOR_ATTRIBUTE;
    for (let i = 1; i < selector.length; i++) {
      const part: unknown = selector[i];
      if (typeof part === 'number') {
        if (part & SELECTOR_NOT) break;
        mode = part;
        continue;
      }
      if (typeof part !== 'string') break;
      if (mode === SELECTOR_ATTRIBUTE) {
        if (part) return part;
        i++;
      }
    }
  }
  return null;
}

/** The selector attribute names of `directives`, without repeats. */
export function selectorAttributes(directives: object[]): string[] {
  const names = new Set<string>();
  for (const directive of directives) {
    const name = selectorAttribute(directive);
    if (name) names.add(name);
    if (names.size >= MAX_ATTRIBUTES) break;
  }
  return [...names];
}
