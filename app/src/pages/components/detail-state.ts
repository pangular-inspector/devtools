import { Injectable, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import { ExtensionBridge, type SourceLocation } from '../../extension-bridge';
import { componentJson, hostPathText } from '../component-copy';
import { ValueFlash, flashKey } from '../component-value-flash';
import { ValueStore } from '../component-value-store';
import { nestedMatches } from '../component-value-state';
import type { Detail, LiveNode, Prop } from './component-model';
import { SourceScan } from './source-scan';
import { TreeState } from './tree-state';

/**
 * The selected component's detail: its opened value levels, the values filter, the values that
 * just changed, and the Chrome DevTools and copy actions with their messages. Provided by the
 * Components page, so the filter and the opened levels outlive one detail panel.
 */
@Injectable()
export class DetailState {
  private readonly tree = inject(TreeState);
  private readonly scan = inject(SourceScan);
  private readonly bridge = inject(ExtensionBridge);

  readonly actionMessage = linkedSignal<string | null, string>({
    source: this.tree.selectedId,
    computation: () => '',
  });
  /** What the last copy did, for the selected component only. */
  readonly copyMessage = linkedSignal<string | null, string>({
    source: this.tree.selectedId,
    computation: () => '',
  });
  /** Values of the selected component that changed in the last push, outlined for a second. */
  private readonly flash = new ValueFlash();

  readonly devtoolsActions = computed(
    () =>
      this.bridge.available &&
      !!this.tree.page() &&
      !this.tree.native() &&
      !this.tree.staticReport(),
  );

  /** Opened value levels of the selected component. */
  readonly values = new ValueStore();
  /** The detail's filter over input, output and property names and opened nested keys. */
  readonly propFilter = signal('');
  readonly propQuery = computed(() => this.propFilter().trim().toLowerCase());

  /** Inputs, outputs, properties and directive inputs the filter keeps, and how many. */
  readonly shownValues = computed(() => {
    const d = this.tree.detail();
    if (!d) return null;
    const query = this.propQuery();
    const named = (p: Prop) =>
      !query || p.name.toLowerCase().includes(query) || p.prop.toLowerCase().includes(query);
    const kept = (p: Prop, directive?: number) =>
      named(p) ||
      nestedMatches([p.prop], p.value, (path) => this.values.level(path, directive), query, 1)
        .length > 0;
    const inputs = d.inputs.filter((p) => kept(p));
    const outputs = d.outputs.filter(named);
    const properties = (d.properties ?? []).filter((p) => kept(p));
    const directives = d.directives
      .map((dir, index) => ({
        ...dir,
        index,
        inputs: dir.inputs.filter((p) => kept(p, index)),
        outputs: dir.outputs.filter(named),
      }))
      .filter((dir) => !query || dir.inputs.length || dir.outputs.length);
    const count =
      inputs.length +
      outputs.length +
      properties.length +
      directives.reduce((n, dir) => n + dir.inputs.length + dir.outputs.length, 0);
    return { inputs, outputs, properties, directives, count };
  });

  readonly valueTotal = computed(() => {
    const d = this.tree.detail();
    if (!d) return 0;
    return (
      d.inputs.length +
      d.outputs.length +
      (d.properties?.length ?? 0) +
      d.directives.reduce((n, dir) => n + dir.inputs.length + dir.outputs.length, 0)
    );
  });

  readonly propFilterStatus = computed(() => {
    if (!this.propQuery()) return '';
    const count = this.shownValues()?.count ?? 0;
    return count
      ? `${count} of ${this.valueTotal()} values match.`
      : 'No inputs, outputs or properties match.';
  });

  /** Lets the value store follow the selected component; run from an effect. */
  followValues() {
    const detail = this.tree.detail();
    const target = {
      rpc: this.tree.rpc(),
      pageId: this.tree.page()?.pageId ?? null,
      componentId: detail?.id ?? null,
    };
    untracked(() => this.values.follow(target, detail?.expanded));
  }

  /** Compares the selected component's values with the last push; run from an effect. */
  trackChanges() {
    const detail = this.tree.detail();
    const owner = detail ? `${this.tree.page()?.pageId ?? ''}|${detail.id}` : null;
    const values = new Map<string, unknown>();
    for (const p of detail?.inputs ?? []) values.set(flashKey('input', p.name), p.value);
    for (const p of detail?.properties ?? []) values.set(flashKey('property', p.name), p.value);
    detail?.directives.forEach((dir, index) => {
      for (const p of dir.inputs) values.set(flashKey('directive', p.name, index), p.value);
    });
    untracked(() => this.flash.update(owner, values));
  }

  /** Stops the change outlines, when the page is destroyed. */
  clearChanges() {
    this.flash.clear();
  }

  /** Whether a value of the detail changed in the last push, so it shows an outline. */
  flashed(section: 'input' | 'property' | 'directive', name: string, index?: number): boolean {
    return this.flash.changed().has(flashKey(section, name, index));
  }

  /**
   * The exact location the page gives, else the source scan's guess when only one class may be
   * it. Several candidates give null, so Open source falls back to the class itself.
   */
  whereOf(node: LiveNode): SourceLocation | null {
    const exact = this.tree.detail()?.source;
    if (exact) return exact;
    const candidates = this.scan.sourceCandidates(node);
    return candidates.length === 1 ? candidates[0] : null;
  }

  async revealInElements(node: LiveNode) {
    const pageId = this.tree.page()?.pageId;
    if (!pageId) return;
    this.actionMessage.set('');
    const result = await this.bridge.reveal(pageId, node.id);
    if (this.tree.selectedId() !== node.id) return;
    this.actionMessage.set(
      result.ok
        ? ''
        : 'Could not reveal it. The component must be rendered in the tab these DevTools inspect.',
    );
  }

  async openSource(node: LiveNode) {
    const pageId = this.tree.page()?.pageId;
    if (!pageId) return;
    const where = this.whereOf(node);
    this.actionMessage.set('');
    const result = await this.bridge.openSource(pageId, node.id, where);
    if (this.tree.selectedId() !== node.id) return;
    if (result.ok) return;
    this.actionMessage.set(
      where
        ? `Not found in Sources. Open ${where.file}:${where.line} in your editor.`
        : 'Could not open the source. The component must be rendered in the tab these DevTools inspect.',
    );
  }

  /** Copies only what the panel holds, which the page serialized and masked already. */
  async copyJson(detail: Detail) {
    await this.copy(detail.id, componentJson(detail), `Copied ${detail.name} as JSON.`);
  }

  async copyHostPath(detail: Detail) {
    await this.copy(
      detail.id,
      hostPathText(detail),
      detail.selector ? 'Copied the host selector.' : 'Copied the host path.',
    );
  }

  private async copy(id: string, text: string, done: string) {
    let message = done;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      message = 'The clipboard is not available here.';
    }
    if (this.tree.selectedId() === id) this.copyMessage.set(message);
  }
}
