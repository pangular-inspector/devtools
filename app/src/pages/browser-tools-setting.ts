import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { isStaticReport, rpcCall } from '../rpc';

/** The server's `browser-tools` shared state: the switch and where the config started it. */
export interface BrowserToolsState {
  enabled: boolean;
  config: boolean;
}

export function browserToolsState(value: unknown): BrowserToolsState | null {
  if (!value || typeof value !== 'object') return null;
  const { enabled, config } = value as Record<string, unknown>;
  if (typeof enabled !== 'boolean') return null;
  return { enabled, config: config === true };
}

type Status = 'connecting' | 'loading' | 'ready' | 'unsupported' | 'failed';

/**
 * The Settings switch for the browser agent tools (`agent.browserTools`).
 * Unlike the other settings it belongs to the dev server: it applies to every
 * connected page right away and lasts until the server restarts.
 */
@Component({
  selector: 'app-browser-tools-setting',
  template: `
    <h2 id="settings-browser-agents">Browser agents</h2>
    <p class="hint" id="settings-browser-agents-hint">
      Registers the read-only agent tools on your app's page, so an agent that drives the browser
      finds them through WebMCP or Chrome DevTools for agents. Any script on the page can call them,
      so leave this off if the page loads scripts you don't trust.
    </p>
    <label class="switch-row">
      <input
        #toggle
        type="checkbox"
        role="switch"
        class="switch"
        [checked]="enabled()"
        [disabled]="!canChange()"
        [attr.aria-busy]="saving() ? 'true' : null"
        aria-describedby="settings-browser-agents-hint settings-browser-agents-status"
        (change)="set($any($event.target).checked)"
      />
      <span class="switch-label">Browser agent tools</span>
      <span class="state" aria-hidden="true">{{ enabled() ? 'On' : 'Off' }}</span>
    </label>
    <p class="hint" id="settings-browser-agents-status">
      @switch (status()) {
        @case ('connecting') {
          Waiting for the devtools server.
        }
        @case ('loading') {
          Loading the current setting.
        }
        @case ('unsupported') {
          @if (staticReport()) {
            This is a saved report, so there is no page to change. The switch works with a running
            dev server.
          } @else {
            This devtools server can't change it from the panel. Set
            <code>agent: {{ '{' }} browserTools: true {{ '}' }}</code> in the devtools config.
          }
        }
        @case ('failed') {
          The devtools server didn't answer.
        }
        @default {
          Applies right away to every page connected to this dev server, with no reload. It lasts
          until the server restarts, then <code>agent.browserTools</code> in the devtools config
          decides again ({{ configLabel() }}).
        }
      }
    </p>
    @if (error(); as message) {
      <div class="error" role="alert">
        <span>{{ message }}</span>
        <button type="button" class="action" (click)="retry()">Retry</button>
      </div>
    }
    <p class="sr-only" role="status">{{ announcement() }}</p>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    h2 {
      margin: 0 0 10px;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 650;
    }
    .hint {
      margin: 8px 0 12px;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    code {
      font-family: var(--font-mono);
    }
    .switch-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: var(--control-h);
      color: var(--text);
      cursor: pointer;
      &:has(.switch:disabled) {
        cursor: default;
      }
    }
    .switch-label {
      color: var(--text-strong);
      font-weight: 600;
    }
    .state {
      color: var(--text-2);
      font-size: 12px;
    }
    .switch {
      position: relative;
      flex: none;
      width: 36px;
      height: 20px;
      margin: 0;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      background: var(--surface-3);
      appearance: none;
      cursor: inherit;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
      &::before {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--text-2);
        content: '';
        transition:
          transform 150ms var(--ease),
          background-color 150ms var(--ease);
      }
      &:checked {
        border-color: var(--accent);
        background: var(--accent);
        &::before {
          background: var(--accent-ink);
          transform: translateX(16px);
        }
      }
      &:disabled {
        opacity: 0.6;
      }
      &:focus-visible {
        @include m.focus-ring;
      }
      @media (prefers-reduced-motion: reduce) {
        transition: none;
        &::before {
          transition: none;
        }
      }
    }
    .error {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 8px 12px;
      border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: var(--danger-text);
      font-size: 13px;
    }
    .action {
      display: inline-flex;
      align-items: center;
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      &:hover {
        background: var(--surface-3);
      }
      &:focus-visible {
        @include m.focus-ring;
      }
    }
  `,
})
export class BrowserToolsSetting {
  readonly rpc = input<DevframeRpcClient | null>(null);

  protected readonly state = signal<BrowserToolsState | null>(null);
  protected readonly status = signal<Status>('connecting');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly announcement = signal('');
  protected readonly staticReport = computed(() => isStaticReport(this.rpc()));
  protected readonly enabled = computed(() => this.state()?.enabled ?? false);
  /** Saving keeps the switch enabled: disabling it would drop keyboard focus. */
  protected readonly canChange = computed(() => this.status() === 'ready' && !this.staticReport());
  protected readonly configLabel = computed(() =>
    this.state()?.config ? 'on in this project' : 'off in this project',
  );

  private readonly toggle = viewChild<ElementRef<HTMLInputElement>>('toggle');
  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe: (() => void) | null = null;
  private attached: DevframeRpcClient | null = null;
  /** The value the last failed change tried to set, for Retry. */
  private pending: boolean | null = null;

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client && client !== this.attached) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  async set(enabled: boolean) {
    const client = this.rpc();
    if (!client || !this.canChange() || this.saving()) {
      this.syncBox();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const answer = browserToolsState(await rpcCall(client, 'set-browser-tools', { enabled }));
      if (!answer) throw new Error('no answer');
      this.pending = null;
      this.state.set(answer);
      this.say(
        answer.enabled
          ? 'Browser agent tools on. Connected pages register them.'
          : 'Browser agent tools off. Connected pages unregister them.',
      );
    } catch {
      this.pending = enabled;
      this.error.set(
        `Couldn't turn the browser agent tools ${enabled ? 'on' : 'off'}. Check that the dev server is running.`,
      );
    } finally {
      this.saving.set(false);
      this.syncBox();
    }
  }

  retry() {
    const client = this.rpc();
    if (!client) return;
    if (this.status() === 'ready' && this.pending !== null) {
      void this.set(this.pending);
      return;
    }
    this.error.set('');
    void this.load(client);
  }

  private async load(client: DevframeRpcClient) {
    this.attached = client;
    this.pending = null;
    this.status.set('loading');
    this.error.set('');
    this.unsubscribe?.();
    this.unsubscribe = null;
    try {
      const shared = await client.scope('pangular').rpc.sharedState('browser-tools');
      if (this.destroyRef.destroyed || this.attached !== client) return;
      const apply = (value: unknown) => {
        const next = browserToolsState(value);
        this.state.set(next);
        this.status.set(next && !isStaticReport(client) ? 'ready' : 'unsupported');
      };
      apply(shared.value());
      this.unsubscribe = shared.on('updated', apply);
    } catch {
      if (this.attached !== client) return;
      this.status.set('failed');
      this.error.set("Couldn't read the browser agent tools setting.");
    }
  }

  /** A refused or ignored change leaves the box as clicked, and the binding has nothing new to write. */
  private syncBox() {
    const box = this.toggle()?.nativeElement;
    if (box) box.checked = this.enabled();
  }

  private say(message: string) {
    this.announcement.update((current) => (current === message ? `${message} ` : message));
  }
}
