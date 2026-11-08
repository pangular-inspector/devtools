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
  template: `
    <h2 id="payload-heading">TransferState payload</h2>
    @if (selected(); as page) {
      <div class="payload-tools">
        <button
          type="button"
          data-refetch-payload
          [disabled]="!canWrite() || refetching()"
          [attr.aria-describedby]="canWrite() ? 'refetch-hint' : 'http-writes-off refetch-hint'"
          (click)="refetchPayload(page.pageId)"
        >
          {{ refetching() ? 'Refetching…' : 'Refetch' }}
        </button>
        <span id="refetch-hint" class="muted small">
          Renders this URL again on the server, with this tab's cookies, and shows the payload it
          sends now. The tab does not reload.
        </span>
      </div>
    }
    @if (selectedPayload(); as payload) {
      @if (!payload.found) {
        <div class="empty">
          <p>No TransferState script: this page was not server rendered.</p>
        </div>
      } @else {
        <p class="muted small summary-line">
          {{ payload.entries.length }} entr{{ payload.entries.length === 1 ? 'y' : 'ies' }},
          {{ payload.size }} bytes
          @if (payload.refetchedAt) {
            <span class="tag" data-refetched>Refetched</span>
          }
        </p>
        @if (payload.error) {
          <p class="bad" role="alert">{{ payload.error }}</p>
        }
        <app-redaction-count [value]="payload.entries" />
        <app-payload-insights [size]="payload.size" [entries]="payload.entries" />
        <div class="entries">
          @for (entry of payload.entries; track entry.key) {
            <details>
              <summary>
                <span class="chevron" aria-hidden="true"></span>
                @if (payloadLabel(entry); as label) {
                  <span class="tag">{{ label }}</span>
                }
                @if (entry.http; as http) {
                  <span
                    class="tag"
                    [class.server]="statusTone(http.status) === 'ok'"
                    [class.fault]="statusTone(http.status) === 'bad'"
                    >HTTP {{ http.status }}</span
                  >
                  <span class="entry-key">{{ http.url ?? entry.key }}</span>
                } @else {
                  <span class="entry-key">{{ entry.key }}</span>
                }
                <span class="entry-size">{{ entry.size }} B</span>
              </summary>
              <div class="entry-key-row">
                <span class="entry-key-label">Key</span>
                <code class="entry-key-text">{{ entry.key }}</code>
                <div class="entry-actions">
                  <button
                    type="button"
                    class="ghost"
                    [attr.aria-label]="'Copy key ' + entry.key"
                    (click)="copyKey(entry.key)"
                  >
                    Copy
                  </button>
                  @if (canEditEntry(entry)) {
                    <button
                      type="button"
                      class="ghost"
                      [attr.aria-label]="'Edit in SSR overrides, key ' + entry.key"
                      (click)="editEntry(entry)"
                    >
                      Edit in SSR overrides
                    </button>
                  }
                </div>
              </div>
              <!-- Focusable so a long value can be scrolled with the keyboard. -->
              <pre tabindex="0" role="region" [attr.aria-label]="'Value of ' + entry.key">{{
                entry.value | json
              }}</pre>
            </details>
          }
        </div>
      }
    } @else {
      <div class="empty">
        <p>Open a page of the app to see its payload.</p>
      </div>
    }
  `,
  styles: `
    @use 'mixins' as m;
    @use 'network' as net;

    @include net.controls;
    @include net.status;
    @include net.pre;
    .summary-line {
      margin-bottom: 8px;
      font-variant-numeric: tabular-nums;
    }
    .payload-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-bottom: 12px;
    }
    .payload-tools .muted {
      flex: 1 1 240px;
      min-width: 0;
    }
    .entries {
      border-top: 1px solid var(--border);
    }
    details {
      border-bottom: 1px solid var(--border);
    }
    details pre {
      margin: 0 0 12px;
    }
    summary {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 6px 4px;
      border-radius: 4px;
      list-style: none;
      cursor: pointer;
      transition: background-color 0.15s var(--ease);
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary:hover {
      background: var(--surface-2);
    }
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 4px;
      border-right: 1.5px solid var(--text-3);
      border-bottom: 1.5px solid var(--text-3);
      transform: rotate(-45deg);
      transition: transform 0.15s var(--ease);
    }
    details[open] .chevron {
      transform: rotate(45deg);
    }
    .entry-key {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      font-family: var(--font-mono);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    summary:hover .entry-key {
      color: var(--accent);
    }
    .entry-key-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      min-width: 0;
      margin: 0 0 8px;
      padding: 0 4px;
    }
    .entry-key-label {
      @include m.label;
      flex: none;
    }
    .entry-key-text {
      flex: 1 1 200px;
      min-width: 0;
      color: var(--text-strong);
      overflow-wrap: anywhere;
      user-select: text;
    }
    .entry-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .entry-size {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
  `,
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
