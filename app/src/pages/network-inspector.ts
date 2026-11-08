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
  templateUrl: './network-inspector.html',
  styleUrl: './network-inspector.scss',
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
