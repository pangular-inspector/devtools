import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RedactionCount } from '../../ui/redaction-count';
import { payloadLabel, statusTone, type PayloadEntry } from './http-model';
import { NetworkState } from './network-state';
import { OverrideState } from './override-state';
import { PayloadInsights } from './payload-insights';

/** The TransferState payload of the page selected on the Network page, with Refetch. */
@Component({
  selector: 'section[appTransferPayload]',
  imports: [JsonPipe, PayloadInsights, RedactionCount],
  templateUrl: './transfer-payload.html',
  styleUrl: './transfer-payload.scss',
})
export class TransferPayload {
  private readonly state = inject(NetworkState);
  private readonly overrideState = inject(OverrideState);
  protected readonly canWrite = this.state.canWrite;
  protected readonly selected = this.state.selected;
  protected readonly selectedPayload = this.state.selectedPayload;
  protected readonly refetching = this.state.refetching;

  protected readonly payloadLabel = payloadLabel;
  protected readonly statusTone = statusTone;

  protected refetchPayload(pageId: string) {
    void this.state.refetchPayload(pageId);
  }

  protected copyKey(key: string) {
    void this.state.copyKey(key);
  }

  protected canEditEntry(entry: PayloadEntry): boolean {
    return this.overrideState.canEditEntry(entry);
  }

  protected editEntry(entry: PayloadEntry) {
    this.overrideState.editEntry(entry);
  }
}
