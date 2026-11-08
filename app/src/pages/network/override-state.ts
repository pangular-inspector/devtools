import { Injectable, computed, inject, signal } from '@angular/core';
import { rpcCall as call } from '../../rpc';
import type { SelectOption } from '../../ui/select';
import {
  EMPTY_OVERRIDE,
  MAX_OVERRIDE_KEY,
  REDACTED_PART,
  pagePattern,
  type OverrideDraft,
  type PayloadEntry,
  type SsrOverride,
  type SsrOverrideKind,
} from './http-model';
import { NetworkState } from './network-state';

/** The SSR override form and list: the draft, its checks, and the saves to the server. */
@Injectable()
export class OverrideState {
  private readonly state = inject(NetworkState);

  /** True while an added override is being saved, so Add can't send it twice. */
  readonly addingOverride = signal(false);
  private overrideSaves = Promise.resolve(true);
  readonly overrideDraft = signal<OverrideDraft>({ ...EMPTY_OVERRIDE });
  /** Set when the draft came from a TransferState entry, so the form can explain the empty value. */
  readonly overrideFromPayload = signal<'http' | 'other' | null>(null);
  readonly overrideKindOptions: SelectOption<SsrOverrideKind>[] = [
    { value: 'render-error', label: 'Render error' },
    { value: 'client-render', label: 'Force Client render' },
    { value: 'state-edit', label: 'Edit TransferState entry' },
  ];

  readonly overrideValueError = computed(() => {
    const value = this.overrideDraft().value.trim();
    if (!value) return '';
    try {
      JSON.parse(value);
      return '';
    } catch {
      return 'The value must be valid JSON.';
    }
  });

  readonly overrideReady = computed(() => {
    const d = this.overrideDraft();
    if (!d.pattern.trim() || this.state.overrides().length >= 20) return false;
    if (d.kind === 'state-edit') return !!d.key.trim() && !this.overrideValueError();
    return true;
  });

  setOverrideDraft<K extends keyof OverrideDraft>(key: K, value: OverrideDraft[K]) {
    this.overrideDraft.update((d) => ({ ...d, [key]: value }));
    // The "filled in from the payload" note only describes the entry the form was filled from.
    if (key === 'kind' && value !== 'state-edit') this.overrideFromPayload.set(null);
  }

  patchOverride(key: keyof OverrideDraft, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.overrideDraft.update((d) => ({ ...d, [key]: value }));
    if (key === 'key') this.overrideFromPayload.set(null);
  }

  /**
   * The edit needs HTTP writes and a key the server keeps exactly: it trims keys and drops longer
   * ones than it accepts. A key with a redacted part can never match the real one.
   */
  canEditEntry(entry: PayloadEntry): boolean {
    const { key } = entry;
    return (
      this.state.canWrite() &&
      !!key &&
      key === key.trim() &&
      key.length <= MAX_OVERRIDE_KEY &&
      !REDACTED_PART.test(key)
    );
  }

  /**
   * Opens the SSR overrides form as a TransferState edit for this entry. The value stays empty:
   * the payload the panel holds is redacted and clipped, so copying it would write masks back.
   */
  editEntry(entry: PayloadEntry) {
    if (!this.canEditEntry(entry)) return;
    const page = this.state.selected();
    this.overrideDraft.set({
      ...EMPTY_OVERRIDE,
      kind: 'state-edit',
      pattern: page ? pagePattern(page.initialUrl ?? page.url) : '',
      key: entry.key,
    });
    this.overrideFromPayload.set(entry.http ? 'http' : 'other');
    this.state.message.set('Editing the TransferState entry in SSR overrides.');
    this.state.afterRender(() => {
      const target = this.state.query(
        this.overrideDraft().pattern ? '#override-value' : '#override-pattern',
      );
      target?.scrollIntoView?.({ block: 'center' });
      target?.focus();
    });
  }

  async addOverride(event: Event) {
    event.preventDefault();
    if (!this.overrideReady() || this.addingOverride()) return;
    const d = this.overrideDraft();
    const next: SsrOverride = {
      id: `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind: d.kind,
      pattern: d.pattern.trim(),
      enabled: true,
      ...(d.kind === 'render-error' && d.message.trim() ? { message: d.message.trim() } : {}),
      ...(d.kind === 'state-edit' ? { key: d.key.trim() } : {}),
      ...(d.kind === 'state-edit' && d.value.trim() ? { value: d.value.trim() } : {}),
    };
    this.addingOverride.set(true);
    const added = await this.saveOverrides(
      (overrides) => [...overrides, next],
      'Override added. Reload the page.',
    );
    this.addingOverride.set(false);
    if (added) {
      this.overrideDraft.set({ ...EMPTY_OVERRIDE, kind: d.kind });
      this.overrideFromPayload.set(null);
      this.state.query<HTMLInputElement>('#override-pattern')?.focus();
    }
  }

  toggleOverride(id: string) {
    void this.saveOverrides(
      (overrides) =>
        overrides.some((o) => o.id === id)
          ? overrides.map((o) => (o.id === id ? { ...o, enabled: !o.enabled } : o))
          : null,
      'Override updated. Reload the page.',
    );
  }

  async removeOverride(id: string) {
    let index = -1;
    const removed = await this.saveOverrides((overrides) => {
      index = overrides.findIndex((o) => o.id === id);
      return index < 0 ? null : overrides.filter((o) => o.id !== id);
    }, 'Override removed.');
    if (removed) {
      this.state.focusAfterRemove('[data-remove-override]', index, '#override-list-heading');
    }
  }

  /**
   * Saves run one after another, and each change is applied to the list the previous save left,
   * so two quick changes never start from the same old list. `change` returns null when its
   * override is gone by then.
   */
  private saveOverrides(
    change: (overrides: SsrOverride[]) => SsrOverride[] | null,
    done: string,
  ): Promise<boolean> {
    const save = this.overrideSaves.then(async () => {
      const next = change(this.state.overrides());
      if (!next) return false;
      try {
        const saved = await call(this.state.rpc(), 'set-ssr-overrides', next);
        this.state.overrides.set(Array.isArray(saved) ? (saved as SsrOverride[]) : next);
        this.state.announce(done);
        return true;
      } catch {
        this.state.message.set('Could not save the overrides.');
        return false;
      }
    });
    this.overrideSaves = save;
    return save;
  }
}
