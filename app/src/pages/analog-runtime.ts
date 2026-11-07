import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import { rpcTry as call } from '../rpc';
import { bytes } from './analog-build';

interface RuntimeValue {
  key: string;
  value: string;
  from: string;
  masked?: true;
  expression?: true;
}

export interface RuntimeConfigView {
  env: RuntimeValue[];
  runtimeConfig: RuntimeValue[];
  options: RuntimeValue[];
  configFile?: string;
}

interface CacheEntry {
  file: string;
  group: string;
  key: string;
  size: number;
  modifiedAt: number;
}

export interface NitroInternals {
  plugins: string[];
  tasks: { name: string; file: string }[];
  storage: { name: string; driver?: string; base?: string; from: 'storage' | 'devStorage' }[];
  cachedRules: { path: string; rule: string }[];
  cacheDirs: string[];
  entries: CacheEntry[];
  notes: string[];
}

export interface TaskResult {
  ok: boolean;
  name: string;
  status?: number;
  ms?: number;
  output?: string;
  error?: string;
}

interface PurgeResult {
  ok: boolean;
  removed: number;
  error?: string;
}

@Component({
  selector: 'app-analog-runtime',
  template: `
    <div class="stack">
      <p class="muted">
        What the app reads at runtime and what Nitro keeps between requests. Secret names, tokens
        and the names in <code>redaction.secretNames</code> are masked.
      </p>
      @if (loading() && !config()) {
        <p class="muted" role="status">Reading the runtime config…</p>
      } @else if (failed()) {
        <div class="note" data-tone="bad" role="alert">
          <p>Could not read the runtime config.</p>
          <button type="button" class="btn ghost" (click)="reload()">Retry</button>
        </div>
      } @else {
        @for (section of sections(); track section.id) {
          <section class="card" [attr.aria-labelledby]="'runtime-' + section.id">
            <h2 [id]="'runtime-' + section.id">{{ section.title }}</h2>
            @if (section.values.length) {
              <div
                class="table-wrap"
                role="region"
                [attr.aria-label]="section.title + ' values'"
                tabindex="0"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Key</th>
                      <th scope="col">Value</th>
                      <th scope="col">From</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of section.values; track v.key) {
                      <tr>
                        <td class="mono path">{{ v.key }}</td>
                        <td class="mono path">
                          {{ v.value }}
                          @if (v.masked) {
                            <span class="pill">masked</span>
                          }
                          @if (v.expression) {
                            <span class="pill">code</span>
                          }
                        </td>
                        <td class="muted small">{{ v.from }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="muted">{{ section.empty }}</p>
            }
          </section>
        }

        @if (nitro(); as n) {
          <section class="card" aria-labelledby="runtime-nitro">
            <h2 id="runtime-nitro">Nitro</h2>
            <dl class="facts">
              <dt>Plugins</dt>
              <dd>
                @for (p of n.plugins; track p) {
                  <span class="chip mono">{{ p }}</span>
                } @empty {
                  <span class="muted small">none under src/server/plugins</span>
                }
              </dd>
              <dt>Storage</dt>
              <dd>
                @for (m of n.storage; track m.from + m.name) {
                  <span class="chip mono"
                    >{{ m.name }}: {{ m.driver ?? 'computed'
                    }}{{ m.from === 'devStorage' ? ' (dev)' : '' }}</span
                  >
                } @empty {
                  <span class="muted small">no mounts in nitro.storage or nitro.devStorage</span>
                }
              </dd>
              <dt>Cached routes</dt>
              <dd>
                @for (r of n.cachedRules; track r.path) {
                  <span class="chip mono">{{ r.path }} · {{ r.rule }}</span>
                } @empty {
                  <span class="muted small">no isr, swr or cache rule</span>
                }
              </dd>
            </dl>

            <h3 id="nitro-tasks-heading">Tasks ({{ n.tasks.length }})</h3>
            @if (n.tasks.length) {
              <ul class="tasks" aria-labelledby="nitro-tasks-heading">
                @for (t of n.tasks; track t.name) {
                  <li>
                    <div class="row">
                      <span class="mono path">{{ t.name }}</span>
                      <span class="muted small file grow">{{ t.file }}</span>
                      <button
                        type="button"
                        class="btn ghost"
                        [disabled]="!canPurge() || runningTask() !== null"
                        [attr.aria-describedby]="canPurge() ? null : 'nitro-purge-off'"
                        [attr.aria-label]="'Run the task ' + t.name"
                        (click)="askTask(t.name)"
                      >
                        {{ runningTask() === t.name ? 'Running…' : 'Run' }}
                      </button>
                    </div>
                    @if (taskConfirm() === t.name) {
                      <div
                        class="note confirm"
                        role="alertdialog"
                        [attr.aria-labelledby]="'task-confirm-' + $index"
                      >
                        <p [id]="'task-confirm-' + $index">
                          Run {{ t.name }} on the dev server? A task can change data.
                        </p>
                        <label class="label" [for]="'task-payload-' + $index"
                          >Payload (JSON, optional)</label
                        >
                        <textarea
                          class="field mono"
                          rows="2"
                          placeholder='{"dryRun": true}'
                          [id]="'task-payload-' + $index"
                          [value]="taskPayload()"
                          (input)="taskPayload.set($any($event.target).value)"
                        ></textarea>
                        <div class="row">
                          <button
                            type="button"
                            class="btn primary"
                            id="task-run-confirm"
                            [disabled]="runningTask() !== null"
                            (click)="runTask(t.name)"
                          >
                            Run task
                          </button>
                          <button type="button" class="btn ghost" (click)="taskConfirm.set(null)">
                            Cancel
                          </button>
                        </div>
                      </div>
                    }
                    @if (taskResults()[t.name]; as r) {
                      <div class="task-result" role="status">
                        <p>
                          @if (r.status !== undefined) {
                            <span class="status" [attr.data-status]="r.ok ? 'good' : 'bad'">{{
                              r.status
                            }}</span>
                          }
                          @if (r.ms !== undefined) {
                            <span class="muted small tnum"> {{ r.ms }} ms</span>
                          }
                          @if (r.error) {
                            <span> {{ r.error }}</span>
                          }
                        </p>
                        @if (r.output) {
                          <pre class="code">{{ r.output }}</pre>
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
            } @else {
              <p class="muted small">No tasks under src/server/tasks.</p>
            }

            <div class="row head">
              <h3 id="nitro-cache-heading">Cache entries on disk ({{ n.entries.length }})</h3>
              @if (n.entries.length) {
                <button
                  type="button"
                  class="btn ghost danger"
                  [disabled]="!canPurge() || purging()"
                  [attr.aria-describedby]="canPurge() ? null : 'nitro-purge-off'"
                  (click)="ask(null)"
                >
                  Purge all
                </button>
              }
            </div>
            @if (!canPurge()) {
              <p id="nitro-purge-off" class="muted small">{{ purgeOff }}</p>
            }
            @if (confirming(); as c) {
              <div class="note confirm" role="alertdialog" aria-labelledby="nitro-confirm-text">
                <p id="nitro-confirm-text">
                  Delete {{ c.length === 1 ? 'this cache entry' : c.length + ' cache entries' }}?
                  The next request renders those routes again.
                </p>
                <div class="row">
                  <button type="button" class="btn danger" id="nitro-confirm" (click)="purge(c)">
                    Delete
                  </button>
                  <button type="button" class="btn ghost" (click)="confirming.set(null)">
                    Cancel
                  </button>
                </div>
              </div>
            }
            <p class="muted small" role="status">{{ message() }}</p>
            @if (n.entries.length) {
              <div
                class="table-wrap"
                role="region"
                aria-labelledby="nitro-cache-heading"
                tabindex="0"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Key</th>
                      <th scope="col">Group</th>
                      <th scope="col" class="num">Size</th>
                      <th scope="col"><span class="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (e of n.entries; track e.file) {
                      <tr>
                        <td class="mono path" [title]="e.file">{{ e.key }}</td>
                        <td>{{ e.group }}</td>
                        <td class="num">{{ size(e.size) }}</td>
                        <td class="num">
                          <button
                            type="button"
                            class="btn ghost"
                            [disabled]="!canPurge() || purging()"
                            [attr.aria-label]="'Purge ' + e.key"
                            (click)="ask([e.file])"
                          >
                            Purge
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="muted">
                @if (n.cacheDirs.length) {
                  The cache folders ({{ n.cacheDirs.join(', ') }}) hold no entries yet.
                } @else {
                  No Nitro cache folder in the project.
                }
              </p>
            }
            @for (note of n.notes; track note) {
              <p class="note">{{ note }}</p>
            }
          </section>
        }
      }
    </div>
  `,
  styles: `
    @use 'analog' as a;
    @include a.controls;
    :host {
      display: block;
    }
    .stack {
      display: grid;
      gap: 16px;
    }
    .head {
      justify-content: space-between;
    }
    .confirm {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }
    .tasks {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .task-result {
      display: grid;
      gap: 6px;
      margin-top: 6px;
    }
    code {
      padding: 1px 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-family: var(--mono);
      font-size: 12px;
    }
  `,
})
export class AnalogRuntime {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly config = signal<RuntimeConfigView | null>(null);
  readonly nitro = signal<NitroInternals | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly purging = signal(false);
  readonly message = signal('');
  /** The entries waiting for a Delete click. */
  readonly confirming = signal<string[] | null>(null);
  /** The task waiting for its Run click, the one running, and the last answer per task. */
  readonly taskConfirm = signal<string | null>(null);
  readonly taskPayload = signal('');
  readonly runningTask = signal<string | null>(null);
  readonly taskResults = signal<Record<string, TaskResult>>({});
  readonly canPurge = computed(() => actionAllowed(this.rpc(), 'analog'));
  protected readonly purgeOff = actionBlockedMessage('analog');
  protected readonly size = bytes;

  readonly sections = computed(() => {
    const c = this.config();
    if (!c) return [];
    return [
      {
        id: 'env',
        title: 'import.meta.env',
        values: c.env,
        empty: 'No VITE_ or ANALOG_ keys in the .env files.',
      },
      {
        id: 'runtime-config',
        title: 'Nitro runtimeConfig',
        values: c.runtimeConfig,
        empty: `No nitro.runtimeConfig in ${c.configFile ?? 'vite.config'}.`,
      },
      { id: 'options', title: 'analog() options', values: c.options, empty: '' },
    ];
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      untracked(() => void this.fetch(client));
    });
  }

  reload() {
    void this.fetch(this.rpc());
  }

  private async fetch(client: DevframeRpcClient | null) {
    this.loading.set(true);
    const [config, nitro] = await Promise.all([
      call<RuntimeConfigView>(client, 'analog-runtime-config'),
      call<NitroInternals>(client, 'analog-nitro'),
    ]);
    this.config.set(config);
    this.nitro.set(nitro);
    this.failed.set(!config);
    this.loading.set(false);
  }

  askTask(name: string) {
    this.taskConfirm.set(name);
    this.taskPayload.set('');
    queueMicrotask(() => document.getElementById('task-run-confirm')?.focus());
  }

  async runTask(name: string) {
    // A Nitro task can change data, so a second click never starts it twice.
    if (this.runningTask() !== null) return;
    let payload: unknown;
    if (this.taskPayload().trim()) {
      try {
        payload = JSON.parse(this.taskPayload());
      } catch {
        this.taskResults.update((all) => ({
          ...all,
          [name]: { ok: false, name, error: 'The payload is not valid JSON.' },
        }));
        return;
      }
    }
    this.taskConfirm.set(null);
    this.runningTask.set(name);
    try {
      const result = await call<TaskResult>(this.rpc(), 'analog-run-nitro-task', {
        name,
        payload,
        confirm: true,
      });
      this.taskResults.update((all) => ({
        ...all,
        [name]: result ?? { ok: false, name, error: 'No answer from the devtools server.' },
      }));
    } finally {
      this.runningTask.set(null);
    }
  }

  ask(files: string[] | null) {
    const all = this.nitro()?.entries.map((e) => e.file) ?? [];
    this.confirming.set(files ?? all);
    this.message.set('');
    queueMicrotask(() => document.getElementById('nitro-confirm')?.focus());
  }

  async purge(files: string[]) {
    this.purging.set(true);
    this.confirming.set(null);
    try {
      const all = files.length === (this.nitro()?.entries.length ?? -1);
      const result = await call<PurgeResult>(this.rpc(), 'analog-nitro-purge', {
        files: all ? undefined : files,
        confirm: true,
      });
      if (!result?.ok) {
        this.message.set(result?.error ?? 'Could not purge the cache.');
      } else {
        this.message.set(
          `Deleted ${result.removed} cache entr${result.removed === 1 ? 'y' : 'ies'}.`,
        );
      }
      this.nitro.set(await call<NitroInternals>(this.rpc(), 'analog-nitro'));
    } finally {
      this.purging.set(false);
    }
  }
}
