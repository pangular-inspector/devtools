import { Component, computed, inject, input, signal, Service, type Signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { isStaticReport, rpcCall } from '../rpc';

export interface OpenInEditorAnswer {
  ok: boolean;
  error?: string;
}

/**
 * Opens source files in the developer's editor through the server's
 * `open-in-editor` RPC. Unavailable without a live server: in a static
 * report, or in the extension when no hub is connected.
 */
@Service()
export class EditorOpener {
  private readonly source = signal<Signal<DevframeRpcClient | null>>(signal(null));
  private readonly client = computed(() => this.source()());

  readonly available = computed(() => {
    const client = this.client();
    return !!client && !isStaticReport(client);
  });

  /** Follows the panel's connection. */
  use(client: Signal<DevframeRpcClient | null>) {
    this.source.set(client);
  }

  async open(file: string, line?: number): Promise<OpenInEditorAnswer> {
    if (!this.available()) return { ok: false, error: 'No server is connected.' };
    try {
      const answer = (await rpcCall(this.client(), 'open-in-editor', {
        file,
        ...(line ? { line } : {}),
      })) as OpenInEditorAnswer | null;
      if (answer?.ok) return { ok: true };
      return { ok: false, error: answer?.error ?? 'The server did not open it.' };
    } catch {
      return { ok: false, error: 'The server did not open it.' };
    }
  }
}

/** `file:line`, or `file` alone when the line is unknown. */
export function sourceText(file: string, line?: number | null): string {
  return line ? `${file}:${line}` : file;
}

/**
 * A file and line from the source. With a live server it is a button that
 * opens the file in the editor; otherwise it is plain text. The projected
 * content replaces the default `file:line` text.
 */
@Component({
  selector: 'app-source-link',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #text
      ><ng-content>{{ label() }}</ng-content></ng-template
    >
    @if (editor.available()) {
      <button
        type="button"
        class="source-link"
        [attr.aria-label]="'Open ' + label() + ' in your editor'"
        [title]="'Open ' + label() + ' in your editor'"
        (click)="open()"
      >
        <ng-container [ngTemplateOutlet]="text" />
      </button>
      @if (message()) {
        <!-- Only while there is something to say: an alert is announced when
             it is added, and a page can hold many of these links. -->
        <span class="message" role="alert">{{ message() }}</span>
      }
    } @else {
      <span class="source-text" [title]="label()"><ng-container [ngTemplateOutlet]="text" /></span>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: inline;
      min-width: 0;
    }
    .source-link {
      display: inline;
      padding: 0;
      border: 0;
      border-radius: 2px;
      background: none;
      color: inherit;
      font: inherit;
      text-align: inherit;
      text-decoration: underline dotted;
      text-underline-offset: 2px;
      cursor: pointer;
      overflow-wrap: anywhere;
    }
    .source-link:hover {
      color: var(--accent-text);
      text-decoration-style: solid;
    }
    .source-link:focus-visible {
      @include m.focus-ring;
    }
    .message {
      margin-left: 6px;
      color: var(--danger-text);
      font-family: var(--font-sans);
      font-size: 0.92em;
    }
  `,
})
export class SourceLink {
  protected readonly editor = inject(EditorOpener);
  readonly file = input.required<string>();
  readonly line = input<number | null | undefined>(undefined);
  protected readonly label = computed(() => sourceText(this.file(), this.line()));
  protected readonly message = signal('');

  async open() {
    this.message.set('');
    const answer = await this.editor.open(this.file(), this.line() ?? undefined);
    if (!answer.ok) this.message.set(`Not opened: ${answer.error}`);
  }
}
