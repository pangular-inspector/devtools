// Finds the Router on Angular before 16.2, which has neither
// `ng.ɵgetRouterInstance` (20.3.5+) nor `ng.ɵgetInjectorProviders` (16.2+),
// so the Router token can't be looked up by name. Components and router
// directives hold the Router in a field (`RouterLink.router`,
// `RouterLinkActive.router`, an app component that injects it), so the overlay
// reads it from there and then asks the root injector for that class, which
// gives the app's own Router. Nothing is created or called.

type AnyRecord = Record<string, unknown>;

export interface FallbackDebugApi {
  getInjector?(el: Element): unknown;
  getComponent?(el: Element): unknown;
  getDirectives?(el: Element): unknown[];
}

/** Elements checked per root, so a large page stays cheap. */
export const MAX_ROUTER_HOLDERS = 200;
/** Fields checked per instance. */
const MAX_FIELDS = 60;
/**
 * Elements likely to hold the Router: router links (the attribute, or the
 * `ng-reflect-` attribute dev builds add for a bound `[routerLink]`), outlets
 * and the component an outlet renders next to it.
 */
const HOLDER_SELECTOR = '[routerlink], [ng-reflect-router-link], router-outlet, router-outlet + *';

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function heldBy(instance: unknown, accept: (value: unknown) => boolean): AnyRecord | null {
  if (!instance || typeof instance !== 'object') return null;
  const keys = read(() => Object.keys(instance).slice(0, MAX_FIELDS), [] as string[]);
  for (const key of keys) {
    const value = read(() => (instance as AnyRecord)[key], undefined);
    if (accept(value)) return value as AnyRecord;
  }
  return null;
}

function holdersOf(root: Element): Element[] {
  const found = read(() => Array.from(root.querySelectorAll(HOLDER_SELECTOR)), [] as Element[]);
  return [root, ...found.slice(0, MAX_ROUTER_HOLDERS)];
}

/**
 * The Router a component or directive under one of `roots` holds, resolved
 * through that root's injector when it gives one back. Null when nothing on
 * the page holds a Router.
 */
export function routerHeldOnPage(
  ng: FallbackDebugApi,
  roots: Iterable<Element>,
  accept: (value: unknown) => boolean,
): AnyRecord | null {
  for (const root of roots) {
    for (const el of holdersOf(root)) {
      const instances = [
        read(() => ng.getComponent?.(el), null),
        ...read(() => ng.getDirectives?.(el) ?? [], [] as unknown[]),
      ];
      for (const instance of instances) {
        const held = heldBy(instance, accept);
        if (!held) continue;
        const ctor = read(() => held.constructor, undefined);
        const injector = read(
          () => ng.getInjector?.(root) as { get?(token: unknown, notFound: unknown): unknown },
          undefined,
        );
        const fromRoot =
          typeof ctor === 'function' && typeof injector?.get === 'function'
            ? read(() => injector.get!(ctor, null), null)
            : null;
        return accept(fromRoot) ? (fromRoot as AnyRecord) : held;
      }
    }
  }
  return null;
}
