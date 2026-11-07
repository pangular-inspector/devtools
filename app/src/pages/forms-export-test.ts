import { Component, input, linkedSignal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { FORMS_STYLES, formsCall, plain } from './forms-types';

/** The code of a ```ts block in an answer, or null when the answer has none. */
export function testCode(text: string | null): string | null {
  return (text ?? '').match(/```ts\n([\s\S]*)```\s*$/)?.[1] ?? null;
}

/** File name for a downloaded test: the form label in kebab case. */
export function testFileName(formId: string): string {
  const base = formId
    .split('@')[0]
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'form'}.spec.ts`;
}

/** Turns the recorded history of a form into a Playwright test to copy or download. */
@Component({
  selector: 'app-forms-export-test',
  template: `
    <div class="export" role="group" aria-label="Export the history as a test">
      <span class="label">Playwright test</span>
      <button type="button" class="small" (click)="run('copy')">Copy Playwright test</button>
      <button type="button" class="small" (click)="run('download')">Download test</button>
      <span class="status" role="status">{{ message() }}</span>
    </div>
  `,
  styles: `
    ${FORMS_STYLES}
    :host {
      display: block;
      min-width: 0;
    }
    .export {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    .label {
      @include m.label;
    }
    .status {
      color: var(--text-2);
      font-size: 13px;
    }
  `,
})
export class FormsExportTest {
  readonly formId = input.required<string>();
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly message = linkedSignal({ source: this.formId, computation: () => '' });

  async run(mode: 'copy' | 'download') {
    const formId = this.formId();
    const text = await formsCall<string>(this.rpc(), 'forms-explain', {
      kind: 'playwright',
      form: formId,
    });
    if (this.formId() !== formId) return;
    if (text === null) {
      this.message.set('The devtools server did not answer. Try again.');
      return;
    }
    const code = testCode(text);
    if (!code) {
      this.message.set(plain(text));
      return;
    }
    if (mode === 'download') {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/typescript' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = testFileName(formId);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      this.message.set(`Downloaded ${link.download}.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      this.message.set('Copied.');
    } catch {
      this.message.set('Clipboard is not available here.');
    }
  }
}
