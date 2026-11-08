import { DOCUMENT } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import {
  curlSnippet,
  fetchSnippet,
  type SnippetCall,
} from '@pangular-inspector/devtools/internal/http-data';

/**
 * "Copy as fetch" and "Copy as cURL" for the call open in the preview. The
 * text is built from the masked copy the panel holds, so `[redacted]` stays
 * where a secret was. Nothing is sent: the panel only copies text.
 */
@Component({
  selector: 'app-call-copy',
  templateUrl: './call-copy.html',
  styleUrl: './call-copy.scss',
})
export class CallCopy {
  readonly call = input<SnippetCall | null>(null);
  /** Says what happened, for the parent's status line. */
  readonly done = output<string>();

  private readonly document = inject(DOCUMENT);

  async copy(kind: 'fetch' | 'curl') {
    const call = this.call();
    if (!call) return;
    const location = this.document.defaultView?.location;
    // The panel is served by the app's dev server unless it runs in the extension.
    const origin = /^https?:$/.test(location?.protocol ?? '') ? location!.origin : undefined;
    const text = kind === 'fetch' ? fetchSnippet(call, origin) : curlSnippet(call, origin);
    try {
      await this.document.defaultView!.navigator.clipboard.writeText(text);
      const masked = text.includes('[redacted]') ? ' Fill in the masked values first.' : '';
      this.done.emit(`Copied as ${kind === 'fetch' ? 'fetch' : 'cURL'}.${masked}`);
    } catch {
      this.done.emit('The clipboard is not available here.');
    }
  }
}
