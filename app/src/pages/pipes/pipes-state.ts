import {
  DestroyRef,
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../../page-id';
import {
  RECORD_CONFIRM_MS,
  type AsyncUsageInfo,
  type LivePipeInfo,
  type PipeInfo,
  type PipeKind,
  type PipeLintFinding,
  type PipeSort,
  type PipeTarget,
  type PipesSnapshot,
} from './pipes-model';

/**
 * The state the Pipes page and its sections share: the source scan, the lint findings, the
 * `pipe-usage` shared state, the filters, the selected pipe and call recording. Provided by the
 * page, so every section of one page reads the same signals.
 */
@Injectable()
export class PipesState {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private rpcSource: Signal<DevframeRpcClient | null> = signal(null);
  readonly rpc = computed(() => this.rpcSource());
  private pageIdSource: Signal<string | null> = signal(null);

  readonly pipes = signal<PipeInfo[]>([]);
  readonly filter = signal('');
  readonly kind = signal<PipeKind | null>('all');
  readonly sort = signal<PipeSort | null>('source');
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly selected = signal<PipeInfo | null>(null);

  private readonly snapshot = signal<PipesSnapshot | undefined>(undefined);
  /** The live data of the page this tab shows, or every page merged. */
  private readonly shown = computed(() => {
    const snapshot = this.snapshot();
    // With several tabs reporting, show the one asked for or the one this panel belongs to.
    const pageId = this.livePageId();
    const own = pageId ? snapshot?.pages?.find((page) => page.pageId === pageId) : undefined;
    return own ?? snapshot;
  });
  readonly live = computed<LivePipeInfo[]>(() => this.shown()?.pipes ?? []);
  readonly async = computed<AsyncUsageInfo[]>(() => this.shown()?.async ?? []);
  /** Every `| async` usage, set only when the list was cut short. */
  readonly asyncTotal = computed(() => this.shown()?.asyncTotal);
  readonly lint = signal<PipeLintFinding[] | null>(null);
  readonly lintFailed = signal(false);
  readonly instrumentedPages = signal<string[]>([]);
  readonly instrumenting = computed(() => this.instrumentedPages().length > 0);
  readonly pendingRecord = signal<boolean | null>(null);
  readonly recordMessage = signal<string | null>(null);
  readonly recordLabel = computed(() => {
    const pending = this.pendingRecord();
    if (pending !== null) return pending ? 'Starting…' : 'Stopping…';
    return this.instrumenting() ? 'Stop recording' : 'Record calls';
  });
  private pendingTimer?: ReturnType<typeof setTimeout>;

  private readonly liveByName = computed(() => new Map(this.live().map((p) => [p.name, p])));

  /** The source scan plus the pipes seen only on the page, such as library pipes. */
  readonly allPipes = computed<PipeInfo[]>(() => {
    const pipes = this.pipes();
    const scanned = new Set(pipes.map((p) => p.name));
    const runtime: PipeInfo[] = this.live()
      .filter((p) => !scanned.has(p.name))
      .map((p) => ({
        name: p.name,
        className: p.className,
        file: '',
        line: 0,
        isStandalone: true,
        isPure: p.isPure,
        runtime: true,
      }));
    return runtime.length ? [...pipes, ...runtime] : pipes;
  });

  readonly filtered = computed(() => {
    const q = this.filter();
    const kind = this.kind() ?? 'all';
    const shown = this.allPipes().filter((p) => this.fitsKind(p, kind) && this.fitsQuery(p, q));
    const sort = this.sort() ?? 'source';
    if (sort === 'source') return shown;
    // Hottest first; pipes with no recorded calls keep source order at the end.
    const weight = (p: PipeInfo) => {
      const call = this.liveFor(p.name)?.call;
      if (!call) return -1;
      return sort === 'calls' ? call.callCount : (call.totalMs ?? 0);
    };
    return shown
      .map((p, index) => ({ p, index, weight: weight(p) }))
      .sort((a, b) => b.weight - a.weight || a.index - b.index)
      .map(({ p }) => p);
  });

  readonly pipesByName = computed(() => {
    const byName = new Map<string, PipeInfo[]>();
    for (const p of this.allPipes()) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
    return byName;
  });

  private unsubscribe?: () => void;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      clearTimeout(this.pendingTimer);
      this.highlight(null);
    });
  }

  /** Reads the client and the page to show from the page's inputs. */
  connect(rpc: Signal<DevframeRpcClient | null>, pageId: Signal<string | null>) {
    this.rpcSource = rpc;
    this.pageIdSource = pageId;
  }

  async refresh() {
    const client = this.rpc();
    if (!client) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const my = client.scope('pangular');
      const pipes = (await my.rpc.call('get-pipes')) as PipeInfo[];
      this.pipes.set(pipes);
      const sel = this.selected();
      if (sel) {
        const refreshed = this.allPipes().find((p) => p.name === sel.name && p.file === sel.file);
        this.selected.set(refreshed ?? null);
      }
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
    this.loadLint(client);
  }

  async loadLint(client: DevframeRpcClient) {
    this.lintFailed.set(false);
    try {
      const findings = (await client.scope('pangular').rpc.call('pipe-lint')) as PipeLintFinding[];
      this.lint.set(findings);
    } catch {
      this.lintFailed.set(true);
    }
  }

  async loadLive(client: DevframeRpcClient) {
    try {
      const state = await client.scope('pangular').rpc.sharedState('pipe-usage');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        const snapshot = value as PipesSnapshot | undefined;
        this.snapshot.set(snapshot);
        // A runtime-only pipe has nothing left to show once the page stops using it.
        const sel = this.selected();
        if (sel?.runtime && !this.liveByName().has(sel.name)) this.selected.set(null);
        const pages = snapshot?.instrumented ?? [];
        this.instrumentedPages.set(pages);
        if (this.pendingRecord() === pages.length > 0) this.settleRecord(null);
      };
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      // RPC not available
    }
  }

  private livePageId(): string | null {
    return this.pageIdSource() ?? hostPageId();
  }

  async toggleInstrument() {
    const client = this.rpc();
    if (!client || this.pendingRecord() !== null) return;
    const on = !this.instrumenting();
    this.recordMessage.set(null);
    this.pendingRecord.set(on);
    let result: { pages?: number } | undefined;
    try {
      // Start on this panel's page (or the latest page); stop every page that records.
      const request = on ? { pageId: this.livePageId() ?? undefined, on } : { on };
      result = (await client.scope('pangular').rpc.call('request-instrument-pipes', request)) as
        | { pages?: number }
        | undefined;
    } catch {
      this.settleRecord("Couldn't reach the devtools server. Try again.");
      return;
    }
    if (this.pendingRecord() !== on) return;
    if (result?.pages === 0) {
      this.settleRecord(
        'No page is connected. Open your app in the browser with the devtools running, then record again.',
      );
      return;
    }
    clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      if (this.pendingRecord() !== on) return;
      this.settleRecord(
        on
          ? 'No page confirmed recording. Reload the app and try again.'
          : 'No page confirmed it stopped recording. Reload the app to stop it.',
      );
    }, RECORD_CONFIRM_MS);
  }

  private settleRecord(message: string | null) {
    clearTimeout(this.pendingTimer);
    this.pendingRecord.set(null);
    if (message !== null) this.recordMessage.set(message);
  }

  liveFor(name: string): LivePipeInfo | undefined {
    return this.liveByName().get(name);
  }

  isSelected(pipe: PipeInfo): boolean {
    const sel = this.selected();
    return sel !== null && sel.name === pipe.name && sel.file === pipe.file;
  }

  select(pipe: PipeInfo) {
    this.selected.set(this.isSelected(pipe) ? null : pipe);
  }

  /** The listed pipe a lint finding is about: the one declared in the finding's file, or else
   * the first pipe with that name. Null when the pipe is not in the list. */
  pipeFor(finding: PipeLintFinding): PipeInfo | null {
    const matches = this.pipesByName().get(finding.pipe);
    if (!matches?.length) return null;
    return matches.find((p) => p.file === finding.file) ?? matches[0];
  }

  /** Selects a pipe from a lint finding, clearing only the filters that hide it, then scrolls
   * its row into view and moves focus to the detail heading. */
  showPipe(pipe: PipeInfo) {
    if (!this.fitsQuery(pipe, this.filter())) this.filter.set('');
    if (!this.fitsKind(pipe, this.kind() ?? 'all')) this.kind.set('all');
    this.selected.set(pipe);
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        host.querySelector<HTMLElement>('.row.selected')?.scrollIntoView?.({ block: 'nearest' });
        host.querySelector<HTMLElement>('#pipe-detail-title')?.focus();
      },
      { injector: this.injector },
    );
  }

  private fitsKind(p: PipeInfo, kind: PipeKind): boolean {
    if (kind === 'custom') return !p.builtin && !p.runtime;
    if (kind === 'builtin') return !!p.builtin;
    if (kind === 'runtime') return !!p.runtime;
    if (kind === 'impure') return !p.isPure;
    if (kind === 'live') return this.liveByName().has(p.name);
    if (kind === 'called') return !!this.liveByName().get(p.name)?.call;
    return true;
  }

  private fitsQuery(p: PipeInfo, filter: string): boolean {
    const q = filter.trim().toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.className.toLowerCase().includes(q) ||
      p.file.toLowerCase().includes(q)
    );
  }

  highlightPipe(live: LivePipeInfo | undefined) {
    this.highlight(live?.components.find((c) => c.targets?.length)?.targets?.[0]);
  }

  highlight(target: PipeTarget | null | undefined, reveal = false) {
    const client = this.rpc();
    if (!client) return;
    void client
      .scope('pangular')
      .rpc.call(
        'request-page-highlight',
        target ? { ...target, ...(reveal ? { reveal } : {}) } : null,
      )
      .catch(() => {});
  }
}
