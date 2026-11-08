import { Injectable, computed, inject, signal } from '@angular/core';
import { HELPER_TYPE, PROVIDING_TYPES, type SourceProvider } from './injector-model';
import { InjectorsState } from './injectors-state';

/**
 * What the Injectors page reads from the source scan: the provider groups shown without a live
 * page, the providers nothing on the page injected, and where each token is declared. Provided
 * by the page next to {@link InjectorsState}.
 */
@Injectable()
export class SourceScan {
  private readonly state = inject(InjectorsState);

  readonly groupedProviders = computed(() => {
    const q = this.state.normalizedQuery();
    const filtered = q
      ? this.state
          .sourceProviders()
          .filter((p) => p.token.toLowerCase().includes(q) || p.file.toLowerCase().includes(q))
      : this.state.sourceProviders();
    const groups: { type: string; label: string; items: SourceProvider[] }[] = [
      { type: 'root-provider', label: 'Root Providers (provide*)', items: [] },
      { type: 'injectable', label: 'Injectable Services', items: [] },
      { type: 'injection', label: 'inject() Calls', items: [] },
      { type: 'provider', label: 'Component Providers', items: [] },
      { type: HELPER_TYPE, label: 'Helpers (unresolved)', items: [] },
    ];
    for (const p of filtered) groups.find((g) => g.type === p.type)?.items.push(p);
    return groups.filter((g) => g.items.length > 0);
  });

  readonly sourceMatchCount = computed(() =>
    this.groupedProviders().reduce((sum, g) => sum + g.items.length, 0),
  );

  /** The unresolved provide*() helpers start collapsed; a search shows them. */
  readonly helpersOpen = signal(false);
  readonly helpersShown = computed(() => this.helpersOpen() || !!this.state.normalizedQuery());

  /**
   * Providers the source declares (`providers` entries and injectables) whose
   * token nothing on the shown page injected: no element injector and no
   * created service lists it among its dependencies. A `providedIn` service
   * that an environment injector already created counts as injected. Matched
   * by name, so this is only a hint.
   */
  readonly orphaned = computed<SourceProvider[]>(() => {
    const roots = this.state.roots();
    if (!roots.length) return [];
    const injected = new Set<string>();
    const created = new Set<string>();
    for (const node of this.state.index().map.values()) {
      for (const dep of node.dependencies ?? []) injected.add(dep.token);
      if (node.injector.type !== 'element') {
        for (const p of node.providers) created.add(p.token);
      }
    }
    const out: SourceProvider[] = [];
    const seen = new Set<string>();
    for (const p of this.state.sourceProviders()) {
      if (!PROVIDING_TYPES.has(p.type)) continue;
      // `Feature.Token` in source is the token `Token` on the page.
      const name = p.token.slice(p.token.lastIndexOf('.') + 1);
      if (injected.has(name) || (p.providedIn && created.has(name))) continue;
      const key = `${p.token}|${p.file}|${p.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  });
  readonly orphansOpen = signal(false);

  readonly orphanedText = computed(() => {
    const count = new Set(this.orphaned().map((p) => p.token)).size;
    return count === 1
      ? '1 provider in source is never injected on this page'
      : `${count} providers in source are never injected on this page`;
  });

  /**
   * Where the source scan declares each token: `providers` entries, injectable
   * classes and known provide*() functions, by token name (the last part of
   * `Feature.Token`). Joins the live Provides list to the source.
   */
  private readonly sourceByToken = computed(() => {
    const map = new Map<string, SourceProvider[]>();
    for (const p of this.state.sourceProviders()) {
      if (!PROVIDING_TYPES.has(p.type) && p.type !== 'root-provider') continue;
      const name = p.token.slice(p.token.lastIndexOf('.') + 1);
      let list = map.get(name);
      if (!list) map.set(name, (list = []));
      if (!list.some((q) => q.file === p.file && q.line === p.line)) list.push(p);
    }
    return map;
  });

  /** Up to three source places that declare `token`, and how many more. */
  sourceOf(token: string): { shown: SourceProvider[]; more: number } | null {
    const list = this.sourceByToken().get(token);
    if (!list?.length) return null;
    return { shown: list.slice(0, 3), more: Math.max(0, list.length - 3) };
  }
}
