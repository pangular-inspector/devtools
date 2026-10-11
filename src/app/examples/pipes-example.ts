import { AsyncPipe, isPlatformBrowser, JsonPipe } from '@angular/common';
import { Component, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { BehaviorSubject, interval, map, of } from 'rxjs';
import { ExamplePage } from './example-page';
import { LegacyFormatModule } from './pipes/legacy-format.module';
import { ScaledPipe } from './pipes/scaled.pipe';
import { TimeAgoPipe } from './pipes/time-ago.pipe';
import { TruncatePipe } from './pipes/truncate.pipe';

@Component({
  selector: 'app-pipes-example',
  imports: [
    ExamplePage,
    TruncatePipe,
    TimeAgoPipe,
    LegacyFormatModule,
    JsonPipe,
    ScaledPipe,
    AsyncPipe,
  ],
  template: `
    <app-example-page heading="Pipes" tab="Pipes">
      <ng-container lead>
        <code>appTruncate</code> is a pure pipe: it only recomputes when its own arguments change.
        <code>appTimeAgo</code> is declared <code>pure: false</code>, so it recomputes on every
        change detection run and can drift on its own, without a new value to react to.
        <code>appLegacyFormat</code> is declared <code>standalone: false</code>, so it can only be
        used here because <code>LegacyFormatModule</code> declares and exports it and is imported
        above instead of the pipe class itself. The section below deliberately breaks a few rules
        the Pipes panel's Lint tab checks for — open it to see the findings.
      </ng-container>
      <ng-container hint>
        Edit the message, then watch "posted" advance by itself as the clock ticks.
      </ng-container>

      <textarea
        class="message"
        rows="2"
        [value]="message()"
        (input)="setMessage($event)"
        aria-label="Message, shown below truncated to 24 characters"
      ></textarea>

      <dl class="readouts">
        <dt>truncated (pure)</dt>
        <dd>{{ message() | appTruncate: 24 }}</dd>
        <dt>posted (impure)</dt>
        <dd>{{ postedAt() | appTimeAgo }}</dd>
        <dt>ticks</dt>
        <dd>{{ tick() }} <span class="hint-text">(forces the recompute above)</span></dd>
        <dt>legacy (module)</dt>
        <dd>{{ message() | appLegacyFormat | appTruncate: 24 }}</dd>
      </dl>

      <button type="button" (click)="repost()">Post again</button>

      <h3 class="lint-heading">Lint examples</h3>
      <p class="hint-text">
        Each readout below trips one of the Pipes panel's lint rules on purpose.
      </p>

      <ul class="posts">
        @for (post of posts(); track post.id) {
          <li>
            {{ post.text }} —
            <span class="hint-text">{{ post.at | appTimeAgo }}</span>
          </li>
        }
      </ul>
      <p class="hint-text rule-name">
        impure-pipe-in-for: <code>appTimeAgo</code> is impure and runs on every change-detection
        pass for every row above, not just when a row's own timestamp changes.
      </p>

      <dl class="readouts">
        <dt>message (debug)</dt>
        <dd class="mono">{{ message() | json }}</dd>
      </dl>
      <p class="hint-text rule-name">
        json-pipe-in-template: the <code>json</code> pipe above is a debugging aid, not something
        meant to ship.
      </p>

      <dl class="readouts">
        <dt>5 × factor</dt>
        <dd>{{ 5 | appScaled }}</dd>
      </dl>
      <p class="hint-text rule-name">
        signal-read-in-pure-pipe: <code>appScaled</code> is pure but reads a
        <code>factor</code> signal directly in <code>transform()</code>. Its memoization only tracks
        the <code>5</code> above, so a change to <code>factor</code> alone would never cause a
        recompute.
      </p>

      <h3 class="lint-heading">Async pipe</h3>
      <p class="hint-text">
        <code>clock$</code> is bound with <code>| async</code> twice below, so the Pipes panel's
        Async tab should show its latest value and flag a duplicate subscription.
        <code>status$</code> is bound once, for contrast — no warning there.
      </p>

      <dl class="readouts">
        <dt>clock (a)</dt>
        <dd>{{ clock$ | async }}</dd>
        <dt>clock (b)</dt>
        <dd>{{ clock$ | async }}</dd>
        <dt>status</dt>
        <dd>{{ status$ | async }}</dd>
      </dl>
    </app-example-page>
  `,
  styles: `
    .message {
      padding: 8px 10px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      resize: vertical;
    }
    .readouts {
      display: grid;
      grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
      gap: 4px 16px;
      margin: 0;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .hint-text {
      color: var(--muted);
      font-size: 13px;
      font-variant-numeric: normal;
    }
    .lint-heading {
      margin: 8px 0 0;
      font-size: 15px;
    }
    .rule-name {
      margin: 0 0 4px;
    }
    .posts {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .mono {
      font-family: monospace;
      font-size: 12px;
    }
    button {
      justify-self: start;
      padding: 6px 12px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      cursor: pointer;
    }
    :focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
  `,
})
export class PipesExample {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly message = signal(
    'Pangular Inspector now inspects pipes, not just components and signals.',
  );
  protected readonly postedAt = signal(Date.now());

  /** Read in the template so a change detection run happens every second,
   * without touching `postedAt` itself: that run is what gives the impure
   * pipe above a reason to recompute. */
  protected readonly tick = signal(0);

  protected readonly posts = signal([
    { id: 1, text: 'Shipped the pipes inspector.', at: Date.now() - 30_000 },
    { id: 2, text: 'Added live call counts.', at: Date.now() - 120_000 },
    { id: 3, text: 'Wrote the lint rules.', at: Date.now() - 600_000 },
  ]);

  /** Bound twice below with `| async`, on purpose: each binding subscribes
   * separately, so the Async tab should flag the second one as a duplicate
   * subscription to the same source. No interval during SSR, matching
   * `tick` above — there's no browser to clear it on navigation away. */
  protected readonly clock$ = this.isBrowser
    ? interval(1000).pipe(map((n) => `tick ${n}`))
    : of('(ticking disabled during SSR)');

  /** Bound once, for contrast with `clock$` above. */
  protected readonly status$ = new BehaviorSubject('online');

  /** Held in a field so the Signals tab lists it and so it can be destroyed
   * with the component. */
  private readonly _ticking = effect((onCleanup) => {
    if (!this.isBrowser) return;
    const id = setInterval(() => this.tick.update((value) => value + 1), 1000);
    onCleanup(() => clearInterval(id));
  });

  protected setMessage(event: Event) {
    this.message.set((event.target as HTMLTextAreaElement).value);
  }

  protected repost() {
    this.postedAt.set(Date.now());
  }
}
