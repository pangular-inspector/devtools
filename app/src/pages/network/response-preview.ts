import { Component, inject, input } from '@angular/core';
import { HttpHeadersView } from '../http-headers';
import { RedactionCount } from '../../ui/redaction-count';
import { CallCopy } from './call-copy';
import { callTone, previewText, statusLabel, type HttpCall } from './http-model';
import { NetworkState } from './network-state';
import { RuleState } from './rule-state';

/**
 * The response preview of the selected call in the HTTP timeline. The timeline gives its host the
 * region role, the id the URL buttons point at and Escape to close.
 */
@Component({
  selector: 'div[appResponsePreview]',
  imports: [CallCopy, HttpHeadersView, RedactionCount],
  template: `
    @let detail = call();
    <div class="preview-head">
      <h3 id="preview-heading" tabindex="-1">Response preview</h3>
      <div class="preview-actions">
        @if (!detail.error && detail.preview) {
          <button
            type="button"
            class="ghost"
            [attr.aria-label]="'Copy the response of ' + detail.method + ' ' + detail.url"
            (click)="copyPreview(detail)"
          >
            Copy
          </button>
        }
        <app-call-copy [call]="detail" (done)="message.set($event)" />
        @if (!detail.nativeFetch) {
          <button
            type="button"
            class="ghost"
            aria-controls="rule-form"
            [disabled]="!canWrite()"
            [attr.aria-describedby]="canWrite() ? null : 'http-writes-off'"
            (click)="mockCall(detail)"
          >
            Mock this request
          </button>
        }
        <button type="button" class="ghost" (click)="closePreview()">Close</button>
      </div>
    </div>
    <p class="preview-meta">
      <span class="method">{{ detail.method }}</span>
      <span
        class="status"
        [class.ok]="callTone(detail) === 'ok'"
        [class.redirect]="callTone(detail) === 'redirect'"
        [class.bad]="callTone(detail) === 'bad'"
        >{{ statusLabel(detail) }}</span
      >
      <span class="preview-url" [title]="detail.url">{{ detail.url }}</span>
    </p>
    @if (detail.nativeFetch) {
      <p class="muted small">
        Made with <code>fetch()</code> directly, which skips the HttpClient interceptor, so a fault
        rule cannot mock it.
      </p>
    }
    @if (rulePatternOf(detail); as pattern) {
      <p class="preview-rule">
        Matched rule <code>{{ pattern }}</code>
      </p>
    }
    <app-redaction-count [value]="detail" />
    <!-- A named region, so the focusable scroll box says what it holds. -->
    <pre
      class="preview-body"
      tabindex="0"
      role="region"
      [attr.aria-label]="detail.error ? 'Response error' : 'Response body'"
      [class.error]="!!detail.error && !detail.cancelled"
      >{{ detail.error ?? previewText(detail) ?? '(no body)' }}</pre>
    <app-http-headers
      [callId]="detail.id"
      [request]="detail.requestHeaders"
      [response]="detail.responseHeaders"
    />
  `,
  styles: `
    @use 'network' as net;

    @include net.controls;
    @include net.status;
    @include net.pre;
    @include net.preview;
  `,
})
export class ResponsePreview {
  readonly call = input.required<HttpCall>();

  private readonly state = inject(NetworkState);
  private readonly ruleState = inject(RuleState);
  protected readonly canWrite = this.state.canWrite;
  protected readonly message = this.state.message;

  protected readonly callTone = callTone;
  protected readonly previewText = previewText;
  protected readonly statusLabel = statusLabel;

  protected rulePatternOf(call: HttpCall): string | null {
    return this.state.rulePatternOf(call);
  }

  protected copyPreview(call: HttpCall) {
    void this.state.copyPreview(call);
  }

  protected mockCall(call: HttpCall) {
    this.ruleState.mockCall(call);
  }

  protected closePreview() {
    this.state.closePreview();
  }
}
