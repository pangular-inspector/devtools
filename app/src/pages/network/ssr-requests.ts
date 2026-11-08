import { Component, inject } from '@angular/core';
import { RovingList } from '../../ui/roving-list';
import {
  callTone,
  compressedWith,
  guardVerdict,
  msLabel,
  overrideLabel,
  renderModeLabel,
  skipText,
  statusLabel,
  statusTone,
  type HttpCall,
} from './http-model';
import { NetworkState } from './network-state';

/** The SSR requests table of the Network page, with the detail of the selected request. */
@Component({
  selector: 'section[appSsrRequests]',
  imports: [RovingList],
  templateUrl: './ssr-requests.html',
  styleUrl: './ssr-requests.scss',
})
export class SsrRequests {
  private readonly state = inject(NetworkState);
  protected readonly requests = this.state.requests;
  protected readonly selected = this.state.selected;
  protected readonly selectedRequest = this.state.selectedRequest;
  protected readonly selectedRequestId = this.state.selectedRequestId;
  protected readonly requestCalls = this.state.requestCalls;
  protected readonly requestPage = this.state.requestPage;
  protected readonly refetched = this.state.refetched;

  protected readonly callTone = callTone;
  protected readonly compressedWith = compressedWith;
  protected readonly guardVerdict = guardVerdict;
  protected readonly msLabel = msLabel;
  protected readonly overrideLabel = overrideLabel;
  protected readonly renderModeLabel = renderModeLabel;
  protected readonly skipText = skipText;
  protected readonly statusLabel = statusLabel;
  protected readonly statusTone = statusTone;

  protected refetchReason(call: HttpCall): string {
    return this.state.refetchReason(call);
  }
}
