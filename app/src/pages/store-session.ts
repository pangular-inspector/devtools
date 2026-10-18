import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  Injector,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { rpcCall } from '../rpc';
import { Select, type SelectOption } from '../ui/select';
import { EntryTabs, type EntryDetailAnswer } from './store-entry-tabs';
import { pretty, type NgrxLogEntry } from './store-types';

/** What `import-ngrx-session` answers: the session's entries without their state changes. */
export interface ImportedSession {
  ok?: boolean;
  error?: string;
  id: string;
  store: { id: string; kind: string; name?: string };
  page?: { url?: string; title?: string };
  exportedAt: number;
  entries: Pick<
    NgrxLogEntry,
    'seq' | 'type' | 'timestamp' | 'action' | 'args' | 'origin' | 'causedByEvent'
  >[];
}

interface GeneratedTest {
  framework: string;
  file: string;
  code: string;
  notes: string[];
}

interface HistoryAnswer extends EntryDetailAnswer {
  message?: string;
  session?: { entries: unknown[] };
  test?: GeneratedTest;
}

/** Most bytes of a session file the panel reads before it sends it to the server. */
export const MAX_SESSION_FILE = 4_000_000;

/** Saves `text` as a file through a temporary link. */
function download(text: string, fileName: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Session tools for the selected store: export a range of its log with the
 * states it produced, import an exported session to read it here, and turn
 * a range (live or imported) into a Vitest spec. Reading and exporting change
 * nothing in the app, so they work with the NgRx write action off.
 */
@Component({
  selector: 'app-store-session',
  imports: [Select, EntryTabs],
  template: `
    <section class="session" aria-labelledby="ngrx-session-heading">
      <h4 id="ngrx-session-heading">Session</h4>
      <p class="intro">
        Export a range of this store's log with the state it produced, import a session file to read
        it here, or turn the range into a {{ framework }} spec. Values are redacted like the rest of
        the page.
      </p>
      @if (options().length) {
        <div class="range">
          <div class="field">
            <span id="ngrx-range-from" class="label">From</span>
            <app-select labelledBy="ngrx-range-from" [options]="options()" [(value)]="from" />
          </div>
          <div class="field">
            <span id="ngrx-range-to" class="label">To</span>
            <app-select labelledBy="ngrx-range-to" [options]="options()" [(value)]="to" />
          </div>
        </div>
      } @else {
        <p class="muted">No recorded changes on this store yet, so there is nothing to export.</p>
      }
      <div class="actions">
        <!-- aria-disabled while busy keeps focus on the button; the handlers ignore the click. -->
        <button
          type="button"
          class="btn"
          [disabled]="!canExport()"
          [attr.aria-disabled]="busy() ? 'true' : null"
          (click)="exportLive()"
        >
          Export session
        </button>
        <button
          #generateLive
          type="button"
          class="btn"
          [disabled]="!canExport()"
          [attr.aria-disabled]="busy() ? 'true' : null"
          (click)="generate(null)"
        >
          Generate test
        </button>
        <button
          #importButton
          type="button"
          class="btn"
          [attr.aria-disabled]="busy() ? 'true' : null"
          (click)="pickFile(file)"
        >
          Import session
        </button>
        <input
          #file
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Session file"
          (change)="read(file)"
        />
      </div>
      <p class="session-message" role="status">{{ message() }}</p>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      @if (test(); as t) {
        <div class="test" role="region" aria-labelledby="ngrx-test-heading">
          <div class="head">
            <h5 #testHeading id="ngrx-test-heading" tabindex="-1">
              Generated test ({{ t.framework }})
            </h5>
            <div class="actions">
              <button type="button" class="btn" (click)="copyTest()">Copy</button>
              <button type="button" class="btn" (click)="downloadTest()">Download</button>
              <button type="button" class="btn" (click)="closeTest()">Close</button>
            </div>
          </div>
          @if (t.notes.length) {
            <ul class="notes">
              @for (note of t.notes; track note) {
                <li>{{ note }}</li>
              }
            </ul>
          }
          <pre class="code" tabindex="0" [attr.aria-label]="'Test code, ' + t.file">{{
            t.code
          }}</pre>
        </div>
      }

      @if (imported(); as session) {
        <div class="imported" role="region" aria-labelledby="ngrx-imported-heading">
          <div class="head">
            <h5 id="ngrx-imported-heading">
              Imported: {{ session.store.name ?? session.store.id }}
              <span class="pill">{{ session.entries.length }}</span>
            </h5>
            <div class="actions">
              <button
                #generateImported
                type="button"
                class="btn"
                [attr.aria-disabled]="busy() ? 'true' : null"
                (click)="generate(session.id)"
              >
                Generate test
              </button>
              <button type="button" class="btn" (click)="closeImported()">Close</button>
            </div>
          </div>
          @if (session.page?.url; as url) {
            <p class="muted">Recorded on {{ url }}</p>
          }
          <ul class="entries" aria-label="Imported entries">
            @for (entry of session.entries; track entry.seq) {
              <li>
                <button
                  type="button"
                  class="entry"
                  [attr.aria-pressed]="entry.seq === importedSeq()"
                  (click)="importedSeq.set(entry.seq)"
                >
                  <span class="seq">#{{ entry.seq }}</span>
                  <span class="type">{{ entry.type }}</span>
                </button>
              </li>
            }
          </ul>
          @if (importedEntry(); as entry) {
            <app-entry-tabs
              idPrefix="ngrx-imported"
              [seq]="entry.seq"
              [loadDiff]="true"
              [loader]="importedLoader"
            >
              <div tab-action>
                @if (entry.action !== undefined) {
                  <p class="label">Action</p>
                  <pre class="code">{{ prettyText(entry.action) }}</pre>
                }
                @if (entry.args?.length) {
                  <p class="label">Arguments</p>
                  <pre class="code">{{ prettyText(entry.args) }}</pre>
                }
                @if (entry.action === undefined && !entry.args?.length) {
                  <p class="muted">No action or arguments were recorded for this entry.</p>
                }
              </div>
            </app-entry-tabs>
          }
        </div>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      min-width: 0;
    }
    .session {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    h4,
    h5 {
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
    }
    h5 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .intro,
    .muted {
      margin: 6px 0 10px;
      color: var(--text-2);
      font-size: 12px;
    }
    .range {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
    }
    .field {
      display: grid;
      flex: 1 1 160px;
      gap: 4px;
      min-width: 0;
    }
    .label {
      @include m.label;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .head .actions {
      margin-top: 0;
    }
    .btn {
      height: var(--control-h);
      padding: 0 14px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .btn:hover {
      background: var(--surface-3);
    }
    .btn:focus-visible {
      @include m.focus-ring;
    }
    .btn:disabled,
    .btn[aria-disabled='true'] {
      cursor: not-allowed;
      opacity: 0.6;
    }
    h5[tabindex='-1']:focus-visible {
      @include m.focus-ring;
    }
    .session-message {
      min-height: 1em;
      margin: 8px 0 0;
      color: var(--text-2);
      font-size: 12px;
    }
    .error {
      margin: 6px 0 0;
      color: var(--danger-text);
      font-size: 12px;
    }
    .test,
    .imported {
      margin-top: 12px;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .notes {
      margin: 8px 0;
      padding-left: 18px;
      color: var(--text-2);
      font-size: 12px;
    }
    .code {
      max-height: 360px;
      margin: 8px 0 0;
      padding: 10px 12px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre;
    }
    .code:focus-visible {
      @include m.focus-ring(-2px);
    }
    .pill {
      @include m.tint(accent);
      padding: 0 8px;
      border-radius: 999px;
      font-size: 11px;
    }
    .entries {
      display: grid;
      gap: 2px;
      max-height: 240px;
      margin: 8px 0 0;
      padding: 0;
      overflow: auto;
      list-style: none;
    }
    .entry {
      display: flex;
      gap: 8px;
      width: 100%;
      min-height: var(--control-h);
      padding: 4px 8px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--text);
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .entry:hover {
      background: var(--surface-2);
    }
    .entry[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
    }
    .entry:focus-visible {
      @include m.focus-ring(-2px);
    }
    .seq {
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .type {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    @media (prefers-reduced-motion: reduce) {
      .btn {
        transition: none;
      }
    }
  `,
})
export class StoreSession {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly pageId = input<string | null>(null);
  readonly storeId = input<string | null>(null);
  /** The store's entries that changed state, oldest first. */
  readonly entries = input<readonly NgrxLogEntry[]>([]);

  protected readonly framework = 'Vitest';

  readonly options = computed<SelectOption[]>(() =>
    this.entries().map((entry) => ({
      value: String(entry.seq),
      label: `#${entry.seq} ${entry.type}`,
    })),
  );
  /** The range follows the log: the first and the newest entry until one is picked. */
  readonly from = linkedSignal<readonly NgrxLogEntry[], string | null>({
    source: this.entries,
    computation: (entries, previous) =>
      previous?.value && entries.some((e) => String(e.seq) === previous.value)
        ? previous.value
        : entries[0]
          ? String(entries[0].seq)
          : null,
  });
  readonly to = linkedSignal<readonly NgrxLogEntry[], string | null>({
    source: this.entries,
    computation: (entries, previous) => {
      const last = entries.at(-1);
      const kept = previous?.value && entries.some((e) => String(e.seq) === previous.value);
      // Keep a picked end, but follow the newest entry while the end was the newest.
      const wasNewest = previous && previous.value === String(previous.source.at(-1)?.seq);
      return kept && !wasNewest ? previous.value : last ? String(last.seq) : null;
    },
  });

  private readonly injector = inject(Injector);
  private readonly generateLive = viewChild<ElementRef<HTMLButtonElement>>('generateLive');
  private readonly generateImported = viewChild<ElementRef<HTMLButtonElement>>('generateImported');
  private readonly importButton = viewChild<ElementRef<HTMLButtonElement>>('importButton');
  private readonly testHeading = viewChild<ElementRef<HTMLElement>>('testHeading');
  /** Which Generate test button made the shown test, so Close can return focus to it. */
  private testFrom: 'live' | 'imported' = 'live';
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly test = signal<GeneratedTest | null>(null);
  readonly imported = signal<ImportedSession | null>(null);
  readonly importedSeq = signal<number | null>(null);

  readonly canExport = computed(
    () => !!this.rpc() && !!this.pageId() && !!this.storeId() && this.entries().length > 0,
  );

  readonly importedEntry = computed(() => {
    const session = this.imported();
    const seq = this.importedSeq();
    return session?.entries.find((entry) => entry.seq === seq) ?? null;
  });

  private range() {
    const from = Number(this.from());
    const to = Number(this.to());
    const [low, high] = from <= to ? [from, to] : [to, from];
    return {
      storeId: this.storeId() ?? undefined,
      ...(Number.isFinite(low) ? { from: low } : {}),
      ...(Number.isFinite(high) ? { to: high } : {}),
    };
  }

  private async ask(message: Record<string, unknown>): Promise<HistoryAnswer> {
    try {
      return ((await rpcCall(this.rpc(), 'request-ngrx-history', message)) ?? {
        error: 'The devtools server is not connected.',
      }) as HistoryAnswer;
    } catch {
      return { error: 'The devtools server did not answer. Try again.' };
    }
  }

  protected readonly importedLoader = (seq: number): Promise<EntryDetailAnswer> => {
    const id = this.imported()?.id;
    return id
      ? this.ask({ session: id, request: { type: 'entry', seq } })
      : Promise.resolve({ error: 'No session is imported.' });
  };

  /** Focuses an element once the view has rendered the current state. */
  private focusAfterRender(target: () => ElementRef<HTMLElement> | undefined) {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
  async exportLive() {
    if (this.busy() || !this.canExport()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    const answer = await this.ask({
      pageId: this.pageId(),
      request: { type: 'export', ...this.range() },
    });
    this.busy.set(false);
    if (!answer.ok || !answer.session) {
      this.error.set(answer.error ?? 'Nothing was exported.');
      return;
    }
    download(
      JSON.stringify(answer.session, null, 2),
      `ngrx-session-${this.storeId()}.json`,
      'application/json',
    );
    this.message.set(answer.message ?? 'Exported the session.');
  }

  /** A spec from the live range, or from the whole imported session when `session` is set. */
  async generate(session: string | null) {
    if (this.busy() || (!session && !this.canExport())) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    const answer = await this.ask(
      session
        ? { session, request: { type: 'test' } }
        : { pageId: this.pageId(), request: { type: 'test', ...this.range() } },
    );
    this.busy.set(false);
    if (!answer.ok || !answer.test) {
      this.error.set(answer.error ?? 'No test was generated.');
      return;
    }
    this.test.set(answer.test);
    this.testFrom = session ? 'imported' : 'live';
    this.message.set(`Generated ${answer.test.file}.`);
    this.focusAfterRender(() => this.testHeading());
  }

  pickFile(input: HTMLInputElement) {
    if (!this.busy()) input.click();
  }
  async read(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set('');
    this.message.set('');
    if (file.size > MAX_SESSION_FILE) {
      this.error.set('The file is larger than 4 MB, so it was not imported.');
      return;
    }
    this.busy.set(true);
    let answer: ImportedSession | { error?: string } | null;
    try {
      answer = (await rpcCall(this.rpc(), 'import-ngrx-session', {
        session: await file.text(),
      })) as ImportedSession | { error?: string } | null;
    } catch {
      answer = { error: 'The devtools server did not answer. Try again.' };
    }
    this.busy.set(false);
    if (!answer || !('id' in answer) || !answer.ok) {
      this.error.set(
        `Not imported: ${(answer as { error?: string } | null)?.error ?? 'the devtools server is not connected.'}`,
      );
      return;
    }
    this.imported.set(answer);
    this.importedSeq.set(answer.entries[0]?.seq ?? null);
    this.message.set(`Imported ${answer.entries.length} entries from ${file.name}.`);
  }

  closeImported() {
    this.imported.set(null);
    this.importedSeq.set(null);
    if (this.testFrom === 'imported') this.testFrom = 'live';
    this.focusAfterRender(() => this.importButton());
  }
  /** Closes the test and returns focus to the Generate test button that made it. */
  closeTest() {
    this.test.set(null);
    const from = this.testFrom;
    this.focusAfterRender(() => {
      const live = this.generateLive();
      const imported = this.generateImported();
      if (from === 'imported' && imported) return imported;
      // A disabled button can't take focus; Import session always can.
      return live && !live.nativeElement.disabled ? live : this.importButton();
    });
  }

  async copyTest() {
    const test = this.test();
    if (!test) return;
    try {
      await navigator.clipboard.writeText(test.code);
      this.message.set('Copied the test.');
    } catch {
      this.message.set('The clipboard is not available here.');
    }
  }

  downloadTest() {
    const test = this.test();
    if (test) download(test.code, test.file, 'text/plain');
  }

  protected prettyText(value: unknown): string {
    return pretty(value);
  }
}
