import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  linkedSignal,
  signal,
  type Signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { angularPageFor, injectAngularPages } from '../../angular-pages';
import { actionAllowed, actionBlockedMessage, panelConfig } from '../../devtools-config';
import { hostPageId } from '../../page-id';
import { rpcCall as call } from '../../rpc';
import { LiveFeed } from '../../ui/live-feed';
import type { SelectOption } from '../../ui/select';
import { reduxLiveStores, reduxLog, reduxPagesOf, type ReduxStoresPage } from '../redux-stores';
import type { EntryDetailAnswer } from '../store-entry-tabs';
import {
  changeCountText,
  pretty,
  sameNgrxLog,
  short,
  type LiveStore,
  type NgrxActionStat,
  type NgrxLogEntry,
  type NgrxLogKey,
  type NgrxPage,
  type NgrxState,
  type NgrxStoreEntry,
} from '../store-types';
import { CLASSIC_KINDS } from './store-format';

/**
 * The state the Store page and its sections share: the `ngrx-store` and `redux-stores` shared
 * states, the source scan, the selected page, store and log entries, the filter and the result
 * message. Provided by the page, so every section of one page reads the same signals.
 */
@Injectable()
export class StoreState {
  private rpcSource: Signal<DevframeRpcClient | null> = signal(null);
  readonly rpc = computed(() => this.rpcSource());
  readonly canRestore = computed(() => actionAllowed(this.rpc(), 'ngrx'));
  readonly restoreOff = actionBlockedMessage('ngrx');

  readonly filter = signal('');
  readonly kind = signal<string | null>(null);
  readonly sourceEntries = signal<NgrxStoreEntry[]>([]);
  readonly sourceLoaded = signal(false);
  readonly pages = signal<NgrxPage[]>([]);
  /** Pages with stores that report through the Redux DevTools API (`redux-stores` shared state). */
  readonly reduxPages = signal<ReduxStoresPage[]>([]);
  /** The NgRx pages, plus pages that only report other stores. */
  readonly allPages = computed<NgrxPage[]>(() => {
    const ngrx = this.pages();
    const known = new Set(ngrx.map((p) => p.pageId));
    const others = this.reduxPages()
      .filter((p) => !known.has(p.pageId))
      .map((p) => ({
        pageId: p.pageId,
        url: p.url,
        title: p.title,
        stores: [],
        classic: null,
        log: [],
        reportedAt: p.reportedAt,
      }));
    return [...ngrx, ...others];
  });
  readonly failed = signal(false);
  /** Whether the shared state has arrived, so the empty message doesn't show first. */
  readonly stateLoaded = signal(false);
  readonly selectedPageId = signal<string | null>(null);
  private readonly hostPageId = hostPageId();
  private readonly angularPages = injectAngularPages(() => this.rpc());
  /** The shown page's Angular version and debug API parts, for the unavailable note. */
  readonly angularPage = computed(() =>
    angularPageFor(this.angularPages(), this.page()?.pageId ?? this.hostPageId),
  );
  readonly maxLog = computed(() => panelConfig(this.rpc()).limits.changeLog);
  readonly selectedStoreId = signal<string | null>(null);
  readonly message = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe: (() => void) | null = null;
  private unsubscribeOthers: (() => void) | null = null;
  /** Focuses the toolbar filter; the page sets it. */
  focusFilter: () => void = () => {};

  readonly page = computed<NgrxPage | null>(() => {
    const pages = this.allPages();
    return (
      pages.find((p) => p.pageId === this.selectedPageId()) ??
      pages.find((p) => p.pageId === this.hostPageId) ??
      pages[0] ??
      null
    );
  });

  /** A page is connected, with stores or without: every page reports its Angular version. */
  readonly pageConnected = computed(() => !!this.page() || !!this.angularPage());

  /** The other stores of the shown page. */
  readonly reduxPage = computed(
    () => this.reduxPages().find((p) => p.pageId === this.page()?.pageId) ?? null,
  );

  private readonly logKey = computed<NgrxLogKey>(() => {
    const page = this.page();
    const store = this.store();
    // Another store's log has its own seq, so it is its own session.
    if (store?.redux) {
      return { pageId: `${page?.pageId}/${store.id}`, log: reduxLog(this.reduxPage(), store.id) };
    }
    return { pageId: page?.pageId ?? null, log: page?.log ?? [] };
  });

  /**
   * Counts the change logs this view has shown. It moves on when `page()` switches to another
   * page (including the fallback when the chosen page closes) and when the app reloads, which
   * keeps the `pageId` but restarts `seq` at 1, so a seq picked before means another entry now.
   */
  readonly logSession = linkedSignal<NgrxLogKey, number>({
    source: this.logKey,
    computation: (key, previous) =>
      !previous ? 0 : sameNgrxLog(previous.source, key) ? previous.value : previous.value + 1,
  });

  // Two selection cursors so clicking an event never swaps out the per-store
  // change-log detail: the change log keeps its own highlighted row, the
  // Events section keeps its own, and each shows its detail in-place.
  // All three are seqs, so they reset whenever the change log is another one.
  readonly selectedChangeSeq = linkedSignal<number, number | null>({
    source: this.logSession,
    computation: () => null,
  });
  readonly selectedEventSeq = linkedSignal<number, number | null>({
    source: this.logSession,
    computation: () => null,
  });
  readonly confirmSeq = linkedSignal<number, number | null>({
    source: this.logSession,
    computation: () => null,
  });

  readonly pageOptions = computed<SelectOption[]>(() =>
    this.allPages().map((p) => ({ value: p.pageId, label: p.title || p.url, hint: p.url })),
  );

  readonly liveStores = computed<LiveStore[]>(() => {
    const page = this.page();
    if (!page) return [];
    const stores: LiveStore[] = page.stores.map((info) => ({
      id: info.id,
      label: info.name ?? info.references[0] ?? info.className,
      kind: info.kind,
      scope: info.scope,
      signal: info,
    }));
    if (page.classic) {
      stores.push({
        id: 'store',
        label: 'Store',
        kind: 'store',
        scope: page.classic.scope,
        classic: page.classic,
      });
    }
    stores.push(...reduxLiveStores(this.reduxPage()));
    return stores;
  });

  readonly filteredStores = computed(() => {
    const f = this.filter().trim().toLowerCase();
    if (!f) return this.liveStores();
    return this.liveStores().filter(
      (s) =>
        s.label.toLowerCase().includes(f) ||
        s.kind.includes(f) ||
        (s.signal?.stateKeys ?? []).some((k) => k.toLowerCase().includes(f)) ||
        this.logOf(s).some((e) => e.type.toLowerCase().includes(f)),
    );
  });

  readonly store = computed<LiveStore | null>(() => {
    const stores = this.liveStores();
    return stores.find((s) => s.id === this.selectedStoreId()) ?? stores[0] ?? null;
  });

  readonly stateText = computed(() => {
    const store = this.store();
    if (!store) return '';
    return pretty(
      store.signal ? store.signal.state : store.redux ? store.redux.state : store.classic?.state,
    );
  });

  /** The serialized state of the selected store, for the state tree. */
  readonly stateValue = computed<unknown>(() => {
    const store = this.store();
    if (!store) return undefined;
    return store.signal
      ? store.signal.state
      : store.redux
        ? store.redux.state
        : store.classic?.state;
  });

  /** The paths the newest change of the selected store wrote, marked in the state tree. */
  readonly changedPaths = computed<string[]>(() => {
    const store = this.store();
    const log = store ? this.logOf(store) : [];
    let newest: NgrxLogEntry | undefined;
    for (let i = log.length - 1; i >= 0 && !newest; i--) if (log[i].diff.length) newest = log[i];
    return (newest?.diff ?? []).map((d) => d.path);
  });

  /** The selected store's action stats, most frequent first. */
  readonly storeStats = computed<NgrxActionStat[]>(() => {
    const store = this.store();
    if (!store || store.redux) return [];
    const stats = this.page()?.stats;
    return Array.isArray(stats) ? stats.filter((s) => s.storeId === store.id) : [];
  });
  readonly hasLoop = computed(() => this.storeStats().some((s) => s.loop));

  private readonly skippedSeqs = computed(
    () =>
      new Set(Array.isArray(this.page()?.classic?.skipped) ? this.page()!.classic!.skipped : []),
  );

  readonly computedEntries = computed(() =>
    Object.entries(this.store()?.signal?.computed ?? {}).map(([key, value]) => ({
      key,
      value: short(value, 160),
      full: pretty(value),
    })),
  );

  /** Pause holds the selected store's log as it is while the app keeps changing it. */
  readonly logFeed = new LiveFeed<NgrxLogEntry>({
    name: 'store-log',
    source: () => {
      const store = this.store();
      return store ? this.logOf(store) : [];
    },
    key: (entry) => entry.seq,
    newest: 'last',
    scope: () => `${this.store()?.id ?? ''}:${this.logSession()}`,
  });

  readonly storeLog = computed<NgrxLogEntry[]>(() => {
    const f = this.filter().trim().toLowerCase();
    return this.logFeed
      .items()
      .filter((e) => !f || e.type.toLowerCase().includes(f) || this.storeMatches(f))
      .slice()
      .reverse();
  });

  /** The selected store's state changes, oldest first, for the session tools. */
  readonly sessionEntries = computed<NgrxLogEntry[]>(() => {
    const store = this.store();
    // Sessions and generated tests are NgRx only: other stores have no past states to read.
    if (!store || store.redux) return [];
    return (this.page()?.log ?? []).filter((e) => e.storeId === store.id && e.source !== 'event');
  });

  /** Reads the State and full Diff of a past entry from the shown page. */
  readonly loadEntry = async (seq: number): Promise<EntryDetailAnswer> => {
    const pageId = this.page()?.pageId;
    if (!pageId) return { error: 'No live page to read from.' };
    return ((await call(this.rpc(), 'request-ngrx-history', {
      pageId,
      request: { type: 'entry', seq },
    })) ?? { error: 'The devtools server is not connected.' }) as EntryDetailAnswer;
  };

  /** A store's log entries, oldest first. */
  private logOf(store: LiveStore): NgrxLogEntry[] {
    if (store.redux) return reduxLog(this.reduxPage(), store.id);
    return (this.page()?.log ?? []).filter((e) => e.storeId === store.id);
  }

  readonly hasEvents = computed(() => (this.page()?.log ?? []).some((e) => e.source === 'event'));

  readonly pageEvents = computed<NgrxLogEntry[]>(() => {
    const f = this.filter().trim().toLowerCase();
    return (this.page()?.log ?? [])
      .filter((e) => e.source === 'event' && (!f || e.type.toLowerCase().includes(f)))
      .slice()
      .reverse();
  });

  readonly changeEntry = computed<NgrxLogEntry | null>(() => {
    const seq = this.selectedChangeSeq();
    if (seq === null) return null;
    return this.storeLog().find((e) => e.seq === seq) ?? null;
  });

  readonly eventEntry = computed<NgrxLogEntry | null>(() => {
    const seq = this.selectedEventSeq();
    if (seq === null) return null;
    return this.pageEvents().find((e) => e.seq === seq) ?? null;
  });

  readonly actionTypes = computed(() => {
    const types = new Set<string>();
    for (const entry of this.sourceEntries()) for (const type of entry.types ?? []) types.add(type);
    for (const entry of this.page()?.log ?? []) {
      if (entry.source === 'store' && entry.action !== undefined) types.add(entry.type);
    }
    return [...types].sort().slice(0, 200);
  });

  readonly usesSignals = computed(() =>
    this.sourceEntries().some((e) => e.kind === 'signal-store' || e.kind === 'signal-state'),
  );
  readonly usesClassic = computed(() =>
    this.sourceEntries().some((e) => CLASSIC_KINDS.has(e.kind)),
  );

  readonly filteredEntries = computed(() => {
    const f = this.filter().trim().toLowerCase();
    const kind = this.kind();
    return this.sourceEntries().filter(
      (e) =>
        (!kind || e.kind === kind) &&
        (!f ||
          e.name.toLowerCase().includes(f) ||
          e.kind.includes(f) ||
          (e.detail ?? '').toLowerCase().includes(f)),
    );
  });

  readonly groupedEntries = computed(() => {
    const groups = new Map<string, number>();
    for (const e of this.sourceEntries()) groups.set(e.kind, (groups.get(e.kind) ?? 0) + 1);
    return [...groups.entries()].map(([kind, count]) => ({ kind, count }));
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      this.unsubscribeOthers?.();
    });
  }

  /** Reads the page's `rpc` input. */
  connect(rpc: Signal<DevframeRpcClient | null>) {
    this.rpcSource = rpc;
  }

  private storeMatches(f: string): boolean {
    const store = this.store();
    return !!store && store.label.toLowerCase().includes(f);
  }

  async load(client: DevframeRpcClient) {
    this.failed.set(false);
    call(client, 'get-ngrx-store')
      .then((entries) => this.sourceEntries.set(Array.isArray(entries) ? entries : []))
      .catch(() => this.sourceEntries.set([]))
      .finally(() => this.sourceLoaded.set(true));
    try {
      const state = await client.scope('pangular').rpc.sharedState('ngrx-store');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        const next = value as Partial<NgrxState> | undefined;
        this.pages.set(Array.isArray(next?.pages) ? next.pages : []);
        // A state the client hasn't loaded from the server yet says nothing.
        if (value !== undefined) this.stateLoaded.set(true);
      };
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      this.failed.set(true);
    }
    // Other stores are an addition: a server without them leaves the NgRx view as it is.
    try {
      const others = await client.scope('pangular').rpc.sharedState('redux-stores');
      if (this.destroyRef.destroyed) return;
      const applyOthers = (value: unknown) => this.reduxPages.set(reduxPagesOf(value));
      applyOthers(others.value());
      this.unsubscribeOthers?.();
      this.unsubscribeOthers = others.on('updated', applyOthers);
    } catch {
      this.reduxPages.set([]);
    }
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  selectPage(pageId: string | null) {
    this.selectedPageId.set(pageId);
    this.selectedStoreId.set(null);
    this.selectedChangeSeq.set(null);
    this.selectedEventSeq.set(null);
    this.confirmSeq.set(null);
    this.message.set('');
  }

  selectStore(id: string) {
    this.selectedStoreId.set(id);
    this.selectedChangeSeq.set(null);
    this.confirmSeq.set(null);
    this.message.set('');
  }

  selectChange(seq: number) {
    this.selectedChangeSeq.set(this.selectedChangeSeq() === seq ? null : seq);
    this.confirmSeq.set(null);
    this.message.set('');
  }

  copyState() {
    return this.copyText(this.stateText());
  }

  copyPath(path: string) {
    return this.copyText(path, `Copied the path ${path}.`);
  }

  copyDiff(entry: NgrxLogEntry) {
    return this.copyText(pretty(entry.diff));
  }

  private async copyText(text: string, done = 'Copied.') {
    try {
      await navigator.clipboard.writeText(text);
      this.message.set(done);
    } catch {
      this.message.set('The clipboard is not available here.');
    }
  }

  isSkipped(seq: number): boolean {
    return this.skippedSeqs().has(seq);
  }

  /** An @ngrx/store action Store DevTools still holds, or one it skips, can be skipped or included. */
  canToggle(entry: NgrxLogEntry): boolean {
    return (
      entry.source === 'store' &&
      entry.action !== undefined &&
      !!this.page()?.classic?.devtools &&
      (entry.restorable || this.isSkipped(entry.seq))
    );
  }

  canAgain(entry: NgrxLogEntry): boolean {
    return entry.source === 'store' && entry.action !== undefined;
  }

  /** Clears the filters from a no-match state and keeps focus on the filter box. */
  clearFilters() {
    this.filter.set('');
    this.kind.set(null);
    this.focusFilter();
  }

  /**
   * The row's log count. A Redux DevTools store logs what its library sent,
   * `@@INIT` included, so its entries are actions, not changes.
   */
  countText(item: LiveStore): string {
    const n = this.changeCount(item.id);
    const noun = item.redux ? (n === 1 ? 'action' : 'actions') : n === 1 ? 'change' : 'changes';
    return `${n} ${noun}`;
  }

  changeCount(id: string): number {
    const store = this.liveStores().find((s) => s.id === id);
    return store ? this.logOf(store).length : 0;
  }

  readonly changesLabel = changeCountText;
}
