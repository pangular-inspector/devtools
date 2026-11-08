import { Injectable, computed, inject, signal } from '@angular/core';
import {
  bare,
  sameSourceFile,
  type FormOwner,
  type LiveNode,
  type SourceComponent,
} from './component-model';
import { TreeState } from './tree-state';

/**
 * What the source declares: the components and directives of the source scan, the forms they
 * own, and the guesses that match a live instance or directive to a source file by class name.
 * Provided by the Components page.
 */
@Injectable()
export class SourceScan {
  private readonly tree = inject(TreeState);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly source = signal<SourceComponent[]>([]);
  readonly formOwners = signal<FormOwner[]>([]);
  readonly openKey = signal<string | null>(null);

  /** Why a location from the source scan is marked as a guess. */
  readonly guessTitle =
    'The page gave no exact location. This comes from the source scan, matched by class name.';

  private readonly sourceByClass = computed(() => {
    const map = new Map<string, SourceComponent[]>();
    for (const comp of this.source()) {
      const key = bare(comp.className);
      map.set(key, [...(map.get(key) ?? []), comp]);
    }
    return map;
  });

  readonly filteredSource = computed(() => {
    const q = this.tree.query();
    const all = this.source();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.selector.toLowerCase().includes(q) ||
        c.className.toLowerCase().includes(q) ||
        c.file.toLowerCase().includes(q),
    );
  });

  readonly sourceCounts = computed(() => {
    const components = this.source().filter((c) => c.kind === 'component').length;
    return { components, directives: this.source().length - components };
  });

  async refresh() {
    const client = this.tree.rpc();
    if (!client) return;
    this.loading.set(true);
    const my = client.scope('pangular');
    try {
      this.source.set((await my.rpc.call('get-components')) as SourceComponent[]);
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
    const owners = (await my.rpc.call('forms-owners').catch(() => [])) as FormOwner[];
    this.formOwners.set(owners ?? []);
  }

  formsIn(file: string) {
    return this.formOwners().filter((form) => form.file === file);
  }

  /**
   * The source scan components that may define this instance, for when the page gives no exact
   * location: the classes with its name, narrowed to those whose selector is its host tag when
   * any is. More than one means the scan cannot tell which file it is.
   */
  sourceCandidates(node: LiveNode): SourceComponent[] {
    const matches = (this.sourceByClass().get(bare(node.name)) ?? []).filter(
      (c) => c.kind === 'component',
    );
    const bySelector = matches.filter((c) => c.selector === node.tag);
    return bySelector.length ? bySelector : matches;
  }

  /**
   * The source scan entry of this instance: the one in the file the page names, or the only
   * candidate. Null when none matches or several may be it.
   */
  sourceFor(node: LiveNode): SourceComponent | null {
    const candidates = this.sourceCandidates(node);
    const exact = this.tree.detail()?.source;
    if (exact) return candidates.find((c) => sameSourceFile(c.file, exact.file)) ?? null;
    return candidates.length === 1 ? candidates[0] : null;
  }

  /**
   * The source scan directives a directive on the page may be, by class name. Angular gives
   * directives no debug location, so a match is only likely.
   */
  directiveSources(name: string): SourceComponent[] {
    return (this.sourceByClass().get(bare(name)) ?? []).filter((c) => c.kind === 'directive');
  }

  sourceKey(comp: SourceComponent) {
    return `${comp.file}#${comp.className}`;
  }

  sourceLabel(comp: SourceComponent) {
    if (!comp.selector) return bare(comp.className);
    return comp.kind === 'component' && /^[a-z][\w-]*$/i.test(comp.selector)
      ? `<${comp.selector}>`
      : comp.selector;
  }
}
