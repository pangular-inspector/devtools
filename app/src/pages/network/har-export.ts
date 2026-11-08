import { DOCUMENT } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import {
  harLog,
  type RecordedCall,
  type RecordedSsrRequest,
} from '@pangular-inspector/devtools/internal/http-data';

/** A file name for the export, from the page path: `pangular-shop-7.har`. */
export function harFileName(pageUrl: string | undefined): string {
  const slug = (pageUrl ?? '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `pangular-${slug || 'home'}.har`;
}

/**
 * Saves the timeline as a HAR file: the SSR request that served the page,
 * then its server and browser HttpClient calls. The panel only holds masked
 * values, so the file has them masked too.
 */
@Component({
  selector: 'app-har-export',
  templateUrl: './har-export.html',
  styleUrl: './har-export.scss',
})
export class HarExport {
  readonly calls = input<readonly RecordedCall[]>([]);
  readonly ssrRequest = input<RecordedSsrRequest | null>(null);
  readonly title = input('');
  readonly pageUrl = input<string | undefined>(undefined);
  /** Says what happened, for the parent's status line. */
  readonly done = output<string>();

  private readonly document = inject(DOCUMENT);

  save() {
    const calls = this.calls();
    if (!calls.length) return;
    const location = this.document.defaultView?.location;
    // The panel is served by the app's dev server unless it runs in the extension.
    const origin = /^https?:$/.test(location?.protocol ?? '') ? location!.origin : undefined;
    const har = harLog({
      calls,
      ssrRequest: this.ssrRequest(),
      title: this.title(),
      origin,
    });
    const url = this.document.defaultView?.URL?.createObjectURL?.(
      new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' }),
    );
    if (!url) {
      this.done.emit('Saving files is not available here.');
      return;
    }
    const link = this.document.createElement('a');
    link.href = url;
    link.download = harFileName(this.pageUrl());
    link.click();
    setTimeout(() => this.document.defaultView?.URL?.revokeObjectURL?.(url));
    const count = har.log.entries.length;
    this.done.emit(`Saved ${count} request${count === 1 ? '' : 's'} as ${link.download}.`);
  }
}
