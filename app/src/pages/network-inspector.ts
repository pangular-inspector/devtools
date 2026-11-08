import { Component, effect, inject, input } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { AppState } from '../ui/app-state';
import { Select } from '../ui/select';
import { rememberSelection } from '../view-memory';
import { CallTimeline } from './network/call-timeline';
import { FaultRules } from './network/fault-rules';
import { HarExport } from './network/har-export';
import { HttpLint } from './network/http-lint';
import {
  mocksOnServer,
  type HttpCall,
  type OverrideDraft,
  type PayloadEntry,
  type RuleDraft,
} from './network/http-model';
import { HydrationStats } from './network/hydration-stats';
import { NetworkState } from './network/network-state';
import { OverrideState } from './network/override-state';
import { RuleState } from './network/rule-state';
import { SsrOverrides } from './network/ssr-overrides';
import { SsrRequests } from './network/ssr-requests';
import { TransferPayload } from './network/transfer-payload';

/**
 * The Network page: the toolbar, and one section per part of the `http` shared state. The
 * sections live in `./network/` and share the page's {@link NetworkState}, {@link RuleState} and
 * {@link OverrideState}; the page keeps the members its tests and the shell read on itself.
 */
@Component({
  selector: 'app-network-inspector',
  imports: [
    AppState,
    CallTimeline,
    FaultRules,
    HarExport,
    HttpLint,
    HydrationStats,
    Select,
    SsrOverrides,
    SsrRequests,
    TransferPayload,
  ],
  providers: [NetworkState, RuleState, OverrideState],
  template: `
    <p class="page-intro">
      HttpClient calls made while rendering on the server and in the browser, from the live page and
      the devtools server, with hydration stats, the TransferState payload and fault injection.
    </p>
    @if (loading()) {
      <app-state kind="loading">Loading HTTP calls…</app-state>
    } @else if (failed()) {
      <app-state kind="error" (retry)="retry()">
        Could not reach the devtools server.
        <p detail>Check that the app's dev server is running with the devtools plugin.</p>
      </app-state>
    }

    <div class="toolbar" [hidden]="loading()">
      <div class="page-picker">
        <span id="page-picker-label">Page</span>
        <app-select
          labelledBy="page-picker-label"
          emptyText="No connected page"
          placeholder="No connected page"
          [options]="pageOptions()"
          [value]="selected()?.pageId ?? null"
          (valueChange)="selectPage($event)"
        />
      </div>
      <button
        type="button"
        [disabled]="!canWrite()"
        [attr.aria-describedby]="canWrite() ? null : 'http-writes-off'"
        (click)="clearCalls()"
      >
        Clear timeline
      </button>
      <app-har-export
        [calls]="timeline()"
        [ssrRequest]="pageSsrRequest()"
        [title]="selected()?.title ?? ''"
        [pageUrl]="selected()?.url"
        (done)="message.set($event)"
      />
      <p class="message" role="status">{{ message() }}</p>
    </div>

    <div class="grid" [hidden]="loading()">
      <section appSsrRequests class="panel wide" aria-labelledby="ssr-heading"></section>
      <section appCallTimeline class="panel wide" aria-labelledby="timeline-heading"></section>
      <section class="panel wide" aria-labelledby="lint-heading">
        <h2 id="lint-heading">HTTP lint</h2>
        <app-http-lint
          [calls]="selected()?.calls ?? []"
          [serverCalls]="renderServerCalls()"
          (open)="openCall($event)"
        />
      </section>
      <section appFaultRules class="panel" aria-labelledby="rules-heading"></section>
      <section appSsrOverrides class="panel" aria-labelledby="overrides-heading"></section>
      <section appHydrationStats class="panel" aria-labelledby="hydration-heading"></section>
      <section appTransferPayload class="panel wide" aria-labelledby="payload-heading"></section>
    </div>
  `,
  styles: `
    @use 'mixins' as m;
    @use 'network' as net;

    .page-intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }

    .toolbar[hidden],
    .grid[hidden] {
      display: none;
    }

    :host {
      display: block;
      color: var(--text);
      font-size: 13px;
    }
    .state {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
    }
    .state.error {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      @include m.tint(danger);
    }
    .state.error strong {
      font-weight: 600;
    }
    .state.error span {
      color: var(--text);
    }
    .state.error button {
      margin-top: 4px;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border-strong);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: 0 0 16px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    .toolbar .page-picker {
      display: flex;
      flex: 0 1 auto;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .page-picker > span {
      @include m.label;
    }
    .toolbar app-select {
      width: 280px;
      max-width: 420px;
    }
    .message {
      flex: 1 1 200px;
      min-width: 0;
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
      text-align: right;
    }
    .message:empty {
      display: none;
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .panel {
      @include m.panel;
      @include m.enter;
      min-width: 0;
      padding: 16px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    @include net.controls;
    @media (max-width: 760px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .toolbar .page-picker {
        flex: 1 1 100%;
      }
      .toolbar app-select {
        flex: 1 1 auto;
        width: auto;
        max-width: none;
      }
      .message {
        text-align: left;
      }
    }
  `,
})
export class NetworkInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);

  private readonly state = inject(NetworkState);
  private readonly ruleState = inject(RuleState);
  private readonly overrideState = inject(OverrideState);

  readonly canWrite = this.state.canWrite;
  readonly loading = this.state.loading;
  readonly failed = this.state.failed;
  readonly serverCalls = this.state.serverCalls;
  readonly pages = this.state.pages;
  readonly payloads = this.state.payloads;
  readonly requests = this.state.requests;
  readonly rules = this.state.rules;
  readonly overrides = this.state.overrides;
  readonly message = this.state.message;
  readonly selected = this.state.selected;
  readonly selectedCallId = this.state.selectedCallId;
  readonly selectedCall = this.state.selectedCall;
  readonly selectedRequestId = this.state.selectedRequestId;
  readonly refetched = this.state.refetched;
  readonly timeline = this.state.timeline;
  readonly sideFilter = this.state.sideFilter;
  readonly failedOnly = this.state.failedOnly;
  readonly pageOptions = this.state.pageOptions;
  readonly pageSsrRequest = this.state.pageSsrRequest;
  readonly renderServerCalls = this.state.renderServerCalls;

  readonly draft = this.ruleState.draft;
  readonly draftRule = this.ruleState.draftRule;
  readonly methodOptions = this.ruleState.methodOptions;

  readonly overrideDraft = this.overrideState.overrideDraft;
  readonly overrideFromPayload = this.overrideState.overrideFromPayload;
  readonly overrideReady = this.overrideState.overrideReady;
  readonly overrideValueError = this.overrideState.overrideValueError;

  readonly mocksOnServer = mocksOnServer;

  constructor() {
    this.state.connect(this.rpc);
    rememberSelection('network', this.selectedCallId);
    effect(() => {
      const client = this.rpc();
      if (client) void this.state.load(client);
    });
  }

  retry() {
    this.state.retry();
  }

  selectPage(pageId: string | null) {
    if (pageId) this.state.selectedPageId.set(pageId);
    this.selectedCallId.set(null);
    this.overrideFromPayload.set(null);
  }

  openCall(id: string) {
    this.state.openCall(id);
  }

  clearCalls() {
    return this.state.clearCalls();
  }

  copyPreview(call: HttpCall) {
    return this.state.copyPreview(call);
  }

  copyKey(key: string) {
    return this.state.copyKey(key);
  }

  setDraft<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    this.ruleState.setDraft(key, value);
  }

  addRule(event: Event) {
    return this.ruleState.addRule(event);
  }

  toggleRule(id: string) {
    this.ruleState.toggleRule(id);
  }

  removeRule(id: string) {
    return this.ruleState.removeRule(id);
  }

  setOverrideDraft<K extends keyof OverrideDraft>(key: K, value: OverrideDraft[K]) {
    this.overrideState.setOverrideDraft(key, value);
  }

  canEditEntry(entry: PayloadEntry): boolean {
    return this.overrideState.canEditEntry(entry);
  }

  addOverride(event: Event) {
    return this.overrideState.addOverride(event);
  }

  toggleOverride(id: string) {
    this.overrideState.toggleOverride(id);
  }

  removeOverride(id: string) {
    return this.overrideState.removeOverride(id);
  }

  /** Clears a repeated message first, so the live region speaks again for the same text. */
  protected announce(text: string) {
    this.state.announce(text);
  }
}
