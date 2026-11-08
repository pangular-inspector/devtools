import { read, type AnyRecord, type NavigationRecord } from './router.ts';

/** An app whose guard and resolver runs a wrapper records: its Router and navigation list. */
export interface GuardTarget {
  router: AnyRecord;
  navigations: NavigationRecord[];
}

interface Wrapped {
  targets: GuardTarget[];
  uninstall: () => void;
}

// Each wrapper the overlay installed, with the apps it records for. Two apps
// on one page can share a guard (one class, or one routes array), and the
// guard is wrapped once, so its runs go to whichever of them is navigating.
const wrappers = new WeakMap<object, Wrapped>();

function detach(wrapper: object, target: GuardTarget): void {
  const wrapped = wrappers.get(wrapper);
  if (!wrapped) return;
  wrapped.targets = wrapped.targets.filter((t) => t !== target);
  if (wrapped.targets.length) return;
  wrappers.delete(wrapper);
  wrapped.uninstall();
}

/**
 * Keeps a wrapper the overlay just installed. `targets` is the live list the
 * wrapper records into. The returned function drops `target`; the last app
 * to let go puts the app's own function back with `uninstall`.
 */
export function keepWrapper(
  wrapper: object,
  targets: GuardTarget[],
  uninstall: () => void,
): () => void {
  const wrapped: Wrapped = { targets, uninstall };
  wrappers.set(wrapper, wrapped);
  const target = targets[0];
  // The list the wrapper reads is replaced on detach, so it reads it through here.
  return () => detach(wrapper, target);
}

/** The apps a wrapper records for right now. */
export function targetsOf(wrapper: object, fallback: GuardTarget[]): GuardTarget[] {
  return wrappers.get(wrapper)?.targets ?? fallback;
}

/**
 * Adds `target` to a wrapper another app installed. Returns the function that
 * removes it again, `undefined` when the app already records through it, and
 * `null` when the value is not a wrapper this overlay keeps.
 */
export function joinWrapper(value: unknown, target: GuardTarget): (() => void) | undefined | null {
  if (!value || (typeof value !== 'function' && typeof value !== 'object')) return null;
  const wrapped = wrappers.get(value);
  if (!wrapped) return null;
  if (wrapped.targets.some((t) => t.navigations === target.navigations)) return undefined;
  wrapped.targets = [...wrapped.targets, target];
  return () => detach(value, target);
}

function navigating(router: AnyRecord): boolean {
  return read(() => {
    const current =
      typeof router['currentNavigation'] === 'function'
        ? router['currentNavigation']()
        : router['getCurrentNavigation']?.();
    return !!current;
  }, false);
}

/**
 * The app a guard run belongs to: the only one, else the one with a
 * navigation in progress, preferring the one whose Router is navigating now.
 */
export function targetOfRun(targets: GuardTarget[]): GuardTarget | undefined {
  if (targets.length <= 1) return targets[0];
  const pending = targets.filter((t) => t.navigations.some((nav) => nav.outcome === 'pending'));
  if (pending.length <= 1) return pending[0] ?? targets[0];
  return pending.find((t) => navigating(t.router)) ?? pending[0];
}
