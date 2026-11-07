import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';

/** One group of dev server errors, as `rpc/server-errors-register.ts` keeps it. */
export interface ServerErrorGroup {
  id: string;
  kind: 'ssr' | 'vite';
  message: string;
  count: number;
  firstAt: number;
  lastAt: number;
  code?: string;
  stack?: string;
  url?: string;
  requestId?: string;
  plugin?: string;
  file?: string;
  line?: number;
  column?: number;
  frame?: string;
}

/** The groups of the `server-errors` shared state, most recent first; bad entries are dropped. */
export function serverErrorsOf(value: unknown): ServerErrorGroup[] {
  const errors = (value as { errors?: unknown } | null)?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (e): e is ServerErrorGroup =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as ServerErrorGroup).id === 'string' &&
      typeof (e as ServerErrorGroup).message === 'string' &&
      ((e as ServerErrorGroup).kind === 'ssr' || (e as ServerErrorGroup).kind === 'vite'),
  );
}

/** Where a group happened: the render's page, or the file and line Vite named. */
export function serverErrorPlace(group: ServerErrorGroup): string {
  if (group.kind === 'ssr') return group.url ? `Render of ${group.url}` : 'Server render';
  if (!group.file) return group.plugin ?? '';
  const line = group.line !== undefined ? `:${group.line}` : '';
  const column = group.line !== undefined && group.column !== undefined ? `:${group.column}` : '';
  return `${group.file}${line}${column}`;
}

/**
 * Errors the dev server hit that no page can report: a server render that
 * failed and Vite's transform and compile errors. Shows nothing while there
 * are none, so the Errors tab looks as before.
 */
@Component({
  selector: 'app-server-errors-section',
  template: `
    @if (errors().length) {
      <section class="server" aria-labelledby="server-errors-title">
        <div class="bar">
          <h2 id="server-errors-title">
            Server errors <span class="badge">{{ errors().length }}</span>
          </h2>
          <button type="button" class="small" (click)="clear()">Clear server errors</button>
        </div>
        <p class="muted">
          From the dev server: SSR renders that logged an error, and Vite transform and compile
          errors. Masked; each group expires 30 minutes after its last repeat.
        </p>
        <ol class="list" aria-label="Server errors, most recent first">
          @for (group of errors(); track group.id) {
            <li class="item">
              <div class="head">
                <span class="chip" [attr.data-tone]="group.kind === 'ssr' ? 'danger' : 'warn'">{{
                  group.kind === 'ssr' ? 'SSR' : 'Vite'
                }}</span>
                @if (group.count > 1) {
                  <span class="times">{{ group.count }}×</span>
                }
                <code class="message">{{ group.message }}</code>
              </div>
              <div class="meta">
                @if (place(group); as where) {
                  <code class="muted">{{ where }}</code>
                }
                @if (group.plugin && group.file) {
                  <span class="muted">{{ group.plugin }}</span>
                }
                @if (group.code) {
                  <span class="chip plain">{{ group.code }}</span>
                }
                <span class="muted">Last at {{ time(group.lastAt) }}</span>
              </div>
              @if (group.frame) {
                <details>
                  <summary>Code frame</summary>
                  <pre tabindex="0" aria-label="Code frame">{{ group.frame }}</pre>
                </details>
              }
              @if (group.stack) {
                <details>
                  <summary>Stack</summary>
                  <pre tabindex="0" aria-label="Stack trace">{{ group.stack }}</pre>
                </details>
              }
            </li>
          }
        </ol>
        <p class="sr-only" role="status">{{ status() }}</p>
      </section>
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
    }
    .server {
      margin: 0 0 16px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
    }
    .badge {
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 11px;
    }
    .muted {
      color: var(--text-2);
    }
    p.muted {
      margin: 6px 0 8px;
      line-height: 1.5;
    }
    code,
    pre {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .item {
      @include m.panel;
      display: grid;
      gap: 6px;
      min-width: 0;
      padding: 8px 12px;
    }
    .head {
      display: flex;
      gap: 8px;
      align-items: baseline;
      min-width: 0;
    }
    .message {
      min-width: 0;
      color: var(--text-strong);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .times {
      flex-shrink: 0;
      color: var(--danger-text);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      align-items: center;
      min-width: 0;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
    }
    .chip[data-tone='danger'] {
      @include m.tint(danger);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    .chip.plain {
      border-color: var(--border);
      background: var(--surface-2);
      color: var(--text-2);
    }
    details summary {
      width: fit-content;
      border-radius: 2px;
      color: var(--text-2);
      font-size: 12px;
      cursor: pointer;
    }
    details summary:focus-visible {
      @include m.focus-ring;
    }
    pre {
      max-height: 240px;
      margin: 6px 0 0;
      padding: 8px;
      overflow: auto;
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      white-space: pre;
    }
    pre:focus-visible {
      @include m.focus-ring(-2px);
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
  `,
})
export class ServerErrorsSection {
  readonly rpc = input<DevframeRpcClient | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe?: () => void;

  protected readonly time = time;
  protected readonly place = serverErrorPlace;

  readonly errors = signal<ServerErrorGroup[]>([]);
  readonly status = signal('');

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  async clear() {
    const client = this.rpc();
    if (!client) return;
    try {
      await client.scope('pangular').rpc.call('clear-server-errors');
      this.status.set('Server errors cleared.');
    } catch {
      this.status.set("Couldn't clear the server errors.");
    }
  }

  private async load(client: DevframeRpcClient) {
    try {
      const state = await client.scope('pangular').rpc.sharedState('server-errors');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.errors.set(serverErrorsOf(value));
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      // An older server has no server errors; the section stays hidden.
    }
  }
}
