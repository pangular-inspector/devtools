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
  templateUrl: './response-preview.html',
  styleUrl: './response-preview.scss',
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
