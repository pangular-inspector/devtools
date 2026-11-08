import {
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
  type OnDestroy,
  type Signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../../page-id';
import { rpcCall as call } from '../../rpc';
import { actionAllowed, actionBlockedMessage, panelConfig } from '../../devtools-config';
import { LiveFeed } from '../../ui/live-feed';
import { sortRows, type SortState } from '../../ui/sort-header';
import type { SelectOption } from '../../ui/select';
import {
  isFailed,
  pathOf,
  previewText,
  skipText,
  type HttpCall,
  type HttpPage,
  type HttpPayload,
  type HttpRule,
  type HttpSide,
  type HttpState,
  type SsrOverride,
  type SsrRequest,
} from './http-model';

/**
 * The state the Network page and its sections share: the `http` and `http-payloads` shared
 * states, the selected page, call and SSR request, the timeline filters and the toolbar message.
 * Provided by the page, so every section of one page reads the same signals.
 */
@Injectable()
export class NetworkState implements OnDestroy {
  private rpcSource: Signal<DevframeRpcClient | null> = signal(null);
  readonly rpc = computed(() => this.rpcSource());
  readonly canWrite = computed(() => actionAllowed(this.rpc(), 'http'));
  readonly writesOff = actionBlockedMessage('http');

  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly serverCalls = signal<HttpCall[]>([]);
  readonly pages = signal<HttpPage[]>([]);
  readonly payloads = signal<Record<string, HttpPayload>>({});
  readonly serverDropped = signal(0);
  readonly requests = signal<SsrRequest[]>([]);
  readonly rules = signal<HttpRule[]>([]);
  readonly overrides = signal<SsrOverride[]>([]);
  readonly message = signal('');
  readonly refetching = signal(false);

  private readonly hostPageId = hostPageId();
  readonly selectedPageId = linkedSignal<HttpPage[], string | null>({
    source: () => this.pages(),
    computation: (pages, previous) =>
      previous?.value && pages.some((p) => p.pageId === previous.value)
        ? previous.value
        : (pages.find((p) => p.pageId === this.hostPageId)?.pageId ?? pages[0]?.pageId ?? null),
  });
  readonly selectedCallId = signal<string | null>(null);

  private unsubscribe: (() => void)[] = [];
  private destroyed = false;
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly selected = computed(
    () => this.pages().find((p) => p.pageId === this.selectedPageId()) ?? null,
  );

  private readonly pageRequestId = computed(() => this.selected()?.ssrRequestId ?? null);
  readonly selectedRequestId = linkedSignal<string | null>(() => this.pageRequestId());

  readonly selectedPayload = computed(() => {
    const pageId = this.selectedPageId();
    return pageId ? (this.payloads()[pageId] ?? null) : null;
  });

  readonly maxCalls = computed(() => panelConfig(this.rpc()).limits.httpCalls);

  readonly droppedCalls = computed(() => (this.selected()?.dropped ?? 0) + this.serverDropped());

  readonly pageServerCalls = computed(() => {
    const initialUrl = this.selected()?.initialUrl;
    if (!initialUrl) return this.serverCalls();
    return this.serverCalls().filter((c) => !c.pageUrl || c.pageUrl === initialUrl);
  });

  /** The server calls of the SSR request that served the selected page, for the HTTP lint. */
  readonly renderServerCalls = computed(() => {
    const id = this.pageRequestId();
    return id ? this.serverCalls().filter((c) => c.requestId === id) : [];
  });

  /** Every call of the selected page as it arrives, newest first. */
  private readonly liveTimeline = computed(() =>
    [...this.pageServerCalls(), ...(this.selected()?.calls ?? [])].sort((a, b) => b.at - a.at),
  );
  /** Pause holds the timeline as it is while the app keeps calling. */
  readonly callFeed = new LiveFeed<HttpCall>({
    name: 'network',
    source: this.liveTimeline,
    key: (c) => `${c.side}:${c.id}`,
    scope: this.selectedPageId,
  });
  readonly timeline = computed(() => [...this.callFeed.items()]);
  /** The column the call table is sorted by; `null` keeps newest first. */
  readonly callSort = signal<SortState | null>(null);

  readonly callQuery = signal('');
  /** The timeline as a table of every call, or a waterfall of the client calls by navigation. */
  readonly timelineView = signal<'table' | 'waterfall'>('table');
  readonly waterfallCalls = computed(() => this.visibleCalls().filter((c) => c.side === 'client'));
  readonly sideFilter = signal<HttpSide | 'all' | null>('all');
  readonly failedOnly = signal(false);
  readonly sideOptions: SelectOption<HttpSide | 'all'>[] = [
    { value: 'all', label: 'All sides' },
    { value: 'server', label: 'SSR' },
    { value: 'client', label: 'Client' },
  ];

  readonly visibleCalls = computed(() => {
    const query = this.callQuery().trim().toLowerCase();
    const side = this.sideFilter() ?? 'all';
    const failedOnly = this.failedOnly();
    const matching = this.timeline().filter(
      (c) =>
        (side === 'all' || c.side === side) &&
        (!failedOnly || isFailed(c)) &&
        (!query ||
          `${c.method} ${c.url}`.toLowerCase().includes(query) ||
          `${c.method} ${pathOf(c.url)}`.toLowerCase().includes(query)),
    );
    return sortRows(matching, this.callSort(), {
      method: (c) => c.method,
      url: (c) => c.url,
      status: (c) => (c.cancelled || !c.status ? undefined : c.status),
      time: (c) => c.durationMs,
    }) as HttpCall[];
  });

  /**
   * The count, announced only when a filter changes. The visible count also changes with every
   * call the app makes, which would make a screen reader talk while the user uses the app.
   */
  /** What the view shows out of every call: the waterfall shows only client calls. */
  readonly countText = computed(() => {
    const total = this.timeline().length;
    if (this.timelineView() !== 'waterfall') return `${this.visibleCalls().length} of ${total}`;
    const client = this.waterfallCalls().length;
    return `${client} client ${client === 1 ? 'call' : 'calls'} of ${total}`;
  });
  readonly filterStatus = computed(() => {
    this.callQuery();
    this.sideFilter();
    this.failedOnly();
    this.timelineView();
    // A filter change that keeps the same counts still gets announced: the text flips a
    // trailing no-break space so the live region sees a change.
    this.filterFlip = !this.filterFlip;
    const text = untracked(() => this.countText());
    return this.filterFlip ? `${text} ` : text;
  });
  private filterFlip = true;

  /** Follows the visible rows, so the preview hides while filters hide its call. */
  readonly selectedCall = computed(
    () => this.visibleCalls().find((c) => c.id === this.selectedCallId()) ?? null,
  );

  /** The SSR request that served the selected page, for the HAR export. */
  readonly pageSsrRequest = computed(
    () => this.requests().find((r) => r.id === this.pageRequestId()) ?? null,
  );

  readonly selectedRequest = computed(
    () => this.requests().find((r) => r.id === this.selectedRequestId()) ?? null,
  );

  readonly requestCalls = computed(() => {
    const id = this.selectedRequest()?.id;
    return id ? this.serverCalls().filter((c) => c.requestId === id) : [];
  });

  readonly requestPage = computed(() => {
    const id = this.selectedRequest()?.id;
    return id ? (this.pages().find((p) => p.ssrRequestId === id) ?? null) : null;
  });

  readonly refetched = computed(() => {
    const request = this.selectedRequest();
    const page = this.requestPage();
    if (!request || !page) return [];
    const fetched = new Set(
      this.requestCalls()
        .filter((c) => c.status)
        .map((c) => `${c.method} ${pathOf(c.url)}`),
    );
    return page.calls.filter(
      (c) =>
        c.side === 'client' &&
        // The page's own fetch() never goes through the transfer cache, so it is no cache miss.
        !c.nativeFetch &&
        !c.cacheHit &&
        !c.mocked &&
        c.at >= request.at &&
        fetched.has(`${c.method} ${pathOf(c.url)}`),
    );
  });

  readonly pageOptions = computed<SelectOption[]>(() =>
    this.pages().map((page) => ({ value: page.pageId, label: page.title || page.url })),
  );

  /** Reads the RPC client from the page's `rpc` input. Called once, by the page. */
  connect(rpc: Signal<DevframeRpcClient | null>) {
    this.rpcSource = rpc;
  }

  async load(client: DevframeRpcClient) {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const rpc = client.scope('pangular').rpc;
      const [state, payloads] = await Promise.all([
        rpc.sharedState('http'),
        rpc.sharedState('http-payloads'),
      ]);
      if (this.destroyed) return;
      const apply = (value: unknown) => {
        const snapshot = value as HttpState | undefined;
        this.serverCalls.set(snapshot?.serverCalls ?? []);
        this.serverDropped.set(snapshot?.serverDropped ?? 0);
        this.requests.set([...(snapshot?.requests ?? [])].reverse());
        this.pages.set(snapshot?.pages ?? []);
        this.rules.set(snapshot?.rules ?? []);
        this.overrides.set(snapshot?.ssrOverrides ?? []);
      };
      const applyPayloads = (value: unknown) =>
        this.payloads.set(
          (value as { pages?: Record<string, HttpPayload> } | undefined)?.pages ?? {},
        );
      apply(state.value());
      applyPayloads(payloads.value());
      this.stopListening();
      this.unsubscribe = [state.on('updated', apply), payloads.on('updated', applyPayloads)];
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.stopListening();
  }

  private stopListening() {
    for (const stop of this.unsubscribe.splice(0)) stop();
  }

  refetchReason(call: HttpCall): string {
    const key = `${call.method} ${pathOf(call.url)}`;
    const matches = this.requestCalls().filter((c) => `${c.method} ${pathOf(c.url)}` === key);
    const first = matches[0];
    // Several matching server calls with different outcomes can't be paired, so name no reason.
    return first?.cacheSkip && matches.every((c) => c.cacheSkip === first.cacheSkip)
      ? skipText(first.cacheSkip)
      : '';
  }

  rulePatternOf(call: HttpCall): string | null {
    if (call.rulePattern) return call.rulePattern;
    if (!call.ruleId) return null;
    return this.rules().find((rule) => rule.id === call.ruleId)?.pattern ?? null;
  }

  clearCallFilters() {
    this.callQuery.set('');
    this.sideFilter.set('all');
    this.failedOnly.set(false);
    this.query<HTMLInputElement>('#timeline-search')?.focus();
  }

  openCall(id: string) {
    this.selectedCallId.set(id);
    this.afterRender(() => this.query('#preview-heading')?.focus());
  }

  closePreview() {
    const id = this.selectedCallId();
    this.selectedCallId.set(null);
    if (!id) return;
    const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('button[data-call-id]');
    [...buttons].find((button) => button.dataset['callId'] === id)?.focus();
  }

  async copyPreview(call: HttpCall) {
    const text = previewText(call);
    if (!text) return;
    await this.copy(text);
  }

  async copyKey(key: string) {
    await this.copy(key);
  }

  private async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.message.set('Copied.');
    } catch {
      this.message.set('The clipboard is not available here.');
    }
  }

  async clearCalls() {
    try {
      await call(this.rpc(), 'clear-http-calls');
      // A paused feed holds the old calls, so show the cleared list.
      this.callFeed.resume();
      this.selectedCallId.set(null);
      this.message.set('Timeline cleared.');
    } catch {
      this.message.set('Could not clear the timeline.');
    }
  }

  /** Asks the page to render its URL again on the server and push the payload it gets. */
  async refetchPayload(pageId: string) {
    if (this.refetching()) return;
    this.refetching.set(true);
    try {
      const result = (await call(this.rpc(), 'request-http-payload-refetch', { pageId })) as
        { error?: string; found?: boolean; entries?: number; status?: number } | null | undefined;
      if (!result) this.announce('Could not reach the devtools server.');
      else if (result.error) this.announce(result.error);
      else if (!result.found) {
        this.announce(`The server answered ${result.status} without a TransferState payload.`);
      } else {
        const count = result.entries ?? 0;
        this.announce(`Refetched: ${count} entr${count === 1 ? 'y' : 'ies'}.`);
      }
    } catch {
      this.announce('Could not refetch the payload.');
    } finally {
      this.refetching.set(false);
    }
  }

  /** Clears a repeated message first, so the live region speaks again for the same text. */
  announce(text: string) {
    if (this.message() !== text) {
      this.message.set(text);
      return;
    }
    this.message.set('');
    // A newer message set before the render wins over this restore.
    this.afterRender(() => {
      if (this.message() === '') this.message.set(text);
    });
  }

  /** The first element of the page that matches `selector`, in any section. */
  query<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return this.host.nativeElement.querySelector<T>(selector);
  }

  /**
   * The removed row's button is gone, so focus moves to the Remove button that took its place,
   * the one before it when the last row went, or the list heading when the list is empty.
   */
  focusAfterRemove(buttons: string, index: number, heading: string) {
    this.afterRender(() => {
      const host = this.host.nativeElement;
      const remaining = host.querySelectorAll<HTMLElement>(buttons);
      const next = remaining[Math.min(index, remaining.length - 1)];
      (next ?? host.querySelector<HTMLElement>(heading))?.focus();
    });
  }

  afterRender(run: () => void) {
    afterNextRender(run, { injector: this.injector });
  }
}
