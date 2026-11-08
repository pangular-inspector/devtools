import { Component, output } from '@angular/core';

/** The docs on a panel that can't reach its server. */
export const TROUBLESHOOTING_DOCS_URL =
  'https://pangular-inspector.dev/getting-started/troubleshooting/#the-panel-says-disconnected';

/** What the panel shows while it can't reach the devtools server. */
@Component({
  selector: 'app-connection-error',
  template: `
    <div class="connection-error" role="alert">
      <p>
        Can't reach the devtools server. Check that the dev server is running. The panel keeps
        trying to connect.
      </p>
      <div class="connection-actions">
        <button type="button" (click)="retry.emit()">Retry now</button>
        <a [href]="docsUrl" target="_blank" rel="noopener noreferrer"
          >Troubleshooting<span class="sr-only"> (opens in a new tab)</span></a
        >
      </div>
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    .connection-error {
      max-width: 60ch;
      margin: 0;
      padding: 12px 14px;
      border: 1px solid color-mix(in srgb, var(--danger) 36%, transparent);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      p {
        margin: 0 0 10px;
      }
      .connection-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
      }
      a {
        color: var(--accent);
        &:focus-visible {
          @include m.focus-ring;
        }
      }
      button {
        display: inline-flex;
        align-items: center;
        height: var(--control-h);
        padding: 0 14px;
        border: 1px solid var(--control-border);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
        color: var(--text);
        font: inherit;
        font-weight: 500;
        cursor: pointer;
        &:hover {
          background: var(--surface-3);
          border-color: var(--accent-line);
        }
        &:focus-visible {
          @include m.focus-ring;
        }
      }
    }
  `,
})
export class ConnectionError {
  readonly retry = output<void>();
  protected readonly docsUrl = TROUBLESHOOTING_DOCS_URL;
}
