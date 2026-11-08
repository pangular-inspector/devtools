import { Injectable, computed, inject, signal } from '@angular/core';
import type { SignalChange } from '@pangular-inspector/devtools/internal/types';
import { actionAllowed, actionBlockedMessage } from '../../devtools-config';
import { isNativePage } from '../../native-page';
import { isStaticReport } from '../../rpc';
import { jsonDiff, type JsonDiffEntry } from '../json-diff';
import {
  MAX_HISTORY,
  type RestoreResult,
  type SignalNode,
  type SourceSignal,
} from './signal-model';
import { SignalState } from './signal-state';

/**
 * The detail of the selected signal or resource: its value history with diffs and restore, the
 * source declaration it matches and why it may have no exact writes. Provided by the page next to
 * {@link SignalState}.
 */
@Injectable()
export class SignalDetailState {
  private readonly state = inject(SignalState);

  readonly selectedHistory = computed(() => {
    const id = this.state.selectedId();
    return id ? [...(this.state.graph()?.history?.[id] ?? [])].reverse() : [];
  });

  /**
   * Why history entries cannot be restored on the shown page, or '' when they
   * can: the same gate as component edits (a live browser page with
   * `actions.components` on).
   */
  readonly restoreBlocked = computed(() => {
    const client = this.state.rpc();
    if (isStaticReport(client)) return 'A saved report cannot write to the app.';
    const pageId = this.state.graph()?.pageId;
    if (isNativePage(pageId ? this.state.treePages()[pageId] : null)) {
      return 'It needs the app open in a browser.';
    }
    if (!actionAllowed(client, 'components')) return actionBlockedMessage('components');
    return '';
  });
  readonly restoring = signal(false);
  readonly restoreResult = signal<{ id: string; text: string; error: boolean } | null>(null);

  /** The node with this id when its history can be restored: a writable field of the shown component. */
  restorable(id: string): SignalNode | null {
    const g = this.state.graph();
    const node = g?.nodes.find((n) => n.id === id);
    if (!node?.locator) return null;
    if (node.locator.owner === 'service') {
      return g?.injector && node.locator.id === g.injector.id ? node : null;
    }
    return g?.component && node.locator.id === g.component.id ? node : null;
  }

  /** Writes the value the page kept for this entry back to the signal. */
  async restore(node: SignalNode, change: SignalChange, time: string) {
    const client = this.state.rpc();
    const pageId = this.state.graph()?.pageId;
    const locator = node.locator;
    if (!client || !pageId || !locator || this.restoring() || this.restoreBlocked()) return;
    this.restoring.set(true);
    let result: RestoreResult;
    try {
      result = ((await client.scope('pangular').rpc.call('request-signal-restore', {
        pageId,
        request: {
          component: locator.id,
          ...(locator.owner === 'service' ? { owner: 'service' } : {}),
          node: node.id,
          epoch: change.epoch,
        },
      })) ?? {}) as RestoreResult;
    } catch {
      result = { error: 'The devtools server did not answer. Try again.' };
    }
    this.restoring.set(false);
    this.restoreResult.set(
      result.ok
        ? {
            id: node.id,
            text: `Restored ${result.key ?? locator.key} to the value from ${time}.`,
            error: false,
          }
        : { id: node.id, text: result.error ?? 'The page did not restore it.', error: true },
    );
  }

  /**
   * What changed in each history entry of the selected node against the
   * entry before it, by epoch. Only for entries whose values are both
   * objects or arrays; a plain value already shows whole.
   */
  readonly diffs = computed(() => {
    const id = this.state.selectedId();
    const entries = id ? (this.state.graph()?.history?.[id] ?? []) : [];
    const out = new Map<number, JsonDiffEntry[]>();
    for (let i = 1; i < entries.length; i++) {
      const before = entries[i - 1]!.value;
      const after = entries[i]!.value;
      if (!before || !after || typeof before !== 'object' || typeof after !== 'object') continue;
      const diff = jsonDiff(before, after);
      if (diff.length) out.set(entries[i]!.epoch, diff);
    }
    return out;
  });

  diffLabel(kind: JsonDiffEntry['kind']): string {
    return kind === 'added' ? 'added' : kind === 'removed' ? 'removed' : 'changed';
  }

  /**
   * The source declaration of the selected live node, from the source scan:
   * declarations with the node's name and a matching kind, narrowed to the
   * shown component's selector when some are in it. One left is `exact`;
   * several are listed as `candidates`, since the name alone can't tell them
   * apart.
   */
  readonly sourceMatch = computed<{
    exact: SourceSignal | null;
    candidates: SourceSignal[];
  } | null>(() => {
    const node = this.state.selectedNode();
    const label = node?.label;
    if (!node || !label) return null;
    const kindMatches = (source: string) =>
      source === node.kind ||
      source.startsWith(`${node.kind} `) ||
      source.startsWith(`${node.kind}.`) ||
      (node.kind === 'signal' && source.startsWith('model')) ||
      (node.kind === 'computed' && source === 'toSignal');
    let found = this.state.sourceSignals().filter((s) => s.name === label && kindMatches(s.kind));
    const g = this.state.graph();
    const owner = g?.component?.tag ?? g?.element?.tag;
    const own = owner ? found.filter((s) => s.component === owner) : [];
    if (own.length) found = own;
    if (!found.length) return null;
    return found.length === 1
      ? { exact: found[0]!, candidates: [] }
      : { exact: null, candidates: found.slice(0, 5) };
  });

  /** Why a writable signal has no exact set entries, when the panel can tell. */
  readonly writeHint = computed(() => {
    const node = this.state.selectedNode();
    const g = this.state.graph();
    if (!node || !g || g.writeHook === false) return '';
    if (node.kind !== 'signal' && node.kind !== 'linkedSignal') return '';
    if (!node.label) {
      return "This signal has no name, so its history holds sampled values only. From Angular 20.1 the compiler names a signal that initializes a field or variable, so this one was likely made in a factory or helper. Pass a debugName in its options, for example signal(0, { debugName: 'count' }).";
    }
    const history = g.history?.[node.id] ?? [];
    if (history.some((c) => c.source === 'write') || !history.some((c) => c.source === 'sample')) {
      return '';
    }
    return 'Every change here was sampled. Writes are matched by name, kind, version and value, so another live signal with the same name and value can hide them.';
  });

  historySummary(id: string): string {
    const count = this.state.changeCount(id);
    const kept = this.state.graph()?.history?.[id]?.length ?? 0;
    if (!count) return 'No changes recorded yet. The entry below is the value seen first.';
    const changes = `${count} ${count === 1 ? 'change' : 'changes'} recorded`;
    const shown = kept >= MAX_HISTORY && count >= kept ? `, showing the last ${kept}` : '';
    return `${changes}${shown}, newest first.`;
  }
}
