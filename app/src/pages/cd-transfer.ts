import { Component, input, output, signal } from '@angular/core';
import {
  MAX_CD_IMPORT_BYTES,
  cdExportFile,
  cdTraceFile,
  parseCdImport,
} from '@pangular-inspector/devtools/cd-data';
import type { CdReport } from '@pangular-inspector/devtools/config';

/** A recording read from a file, checked like a page push. */
export interface CdImported {
  page: CdReport;
  fileName: string;
}

/** Saves `value` as a JSON file through a temporary link. */
function download(value: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // Some browsers (Firefox, extension panels) need the link in the document
  // and the URL alive until the download has read it.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Export the shown recording as JSON or as a Perfetto trace, or import a recording file. */
@Component({
  selector: 'app-cd-transfer',
  template: `
    <div class="transfer" role="group" aria-label="Export and import the recording">
      <button type="button" [disabled]="!hasCycles()" (click)="exportJson()">Export JSON</button>
      <button type="button" [disabled]="!hasCycles()" (click)="exportTrace()">
        Export trace (Perfetto)
      </button>
      <button type="button" (click)="file.click()">Import</button>
      <input #file type="file" accept=".json,application/json" hidden (change)="read(file)" />
    </div>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: contents;
    }
    .transfer {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    button {
      height: var(--control-h);
      padding: 0 12px;
      background: var(--surface-2);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    button:hover:not(:disabled) {
      background: var(--surface-3);
      border-color: var(--accent-line);
    }
    button:focus-visible {
      @include m.focus-ring;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .error {
      flex-basis: 100%;
      margin: 0;
      color: var(--danger-text);
      font-size: 12px;
    }
  `,
})
export class CdTransfer {
  /** The recording on screen: the page's, or an imported one. */
  readonly page = input<CdReport | null>(null);
  readonly maxCycles = input(200);
  readonly imported = output<CdImported>();

  protected readonly error = signal('');

  protected hasCycles(): boolean {
    return (this.page()?.cycles.length ?? 0) > 0;
  }

  exportJson() {
    const page = this.page();
    if (!page) return;
    download(cdExportFile(page, page.pageId), `change-detection-${page.pageId}.json`);
  }

  exportTrace() {
    const page = this.page();
    if (!page) return;
    download(cdTraceFile(page, page.pageId), `change-detection-${page.pageId}.trace.json`);
  }

  async read(input: HTMLInputElement) {
    const file = input.files?.[0];
    // Clear the input so picking the same file again still fires `change`.
    input.value = '';
    if (!file) return;
    if (file.size > MAX_CD_IMPORT_BYTES) {
      this.error.set(`${file.name}: The file is larger than 20 MB.`);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      this.error.set('Could not read the file.');
      return;
    }
    const result = parseCdImport(text, this.maxCycles());
    if (!result.ok) {
      this.error.set(`${file.name}: ${result.error}`);
      return;
    }
    this.error.set('');
    this.imported.emit({
      fileName: file.name,
      page: { ...result.recording, pageId: result.pageId, supported: true },
    });
  }
}
