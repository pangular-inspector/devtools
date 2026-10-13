import { Component, computed, input } from '@angular/core';

type HeaderRecord = Record<string, string>;

/**
 * The request and response headers of one recorded call. The overlay and the
 * devtools server mask them before they reach the panel, so `[redacted]`
 * stands where a credential, cookie or secret was.
 */
@Component({
  selector: 'app-http-headers',
  template: `
    <div class="headers">
      @for (side of sides(); track side.id) {
        <section class="side" [attr.aria-labelledby]="side.id">
          <h4 [id]="side.id">{{ side.title }} ({{ side.rows.length }})</h4>
          @if (side.rows.length) {
            <dl>
              @for (row of side.rows; track row.name) {
                <div class="row">
                  <dt>{{ row.name }}</dt>
                  <dd [class.masked]="row.masked">{{ row.value }}</dd>
                </div>
              }
            </dl>
          } @else {
            <p class="none">{{ side.none }}</p>
          }
        </section>
      }
    </div>
    <p class="note">
      Request headers are the ones the call had when it reached <code>withPangular()</code>, before
      later interceptors added theirs. Credentials, cookies and secret values are masked.
    </p>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      margin-top: 12px;
    }
    .headers {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @media (max-width: 640px) {
      .headers {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    h4 {
      @include m.label;
      margin: 0 0 6px;
    }
    dl {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      font: 12px/1.5 var(--font-mono);
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      gap: 8px;
    }
    dt {
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    dd {
      margin: 0;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    dd.masked {
      color: var(--text-2);
      font-style: italic;
    }
    .none,
    .note {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
    }
    .note {
      margin-top: 8px;
    }
  `,
})
export class HttpHeadersView {
  /** Keeps the heading ids unique per call. */
  readonly callId = input('');
  readonly request = input<HeaderRecord | undefined>(undefined);
  readonly response = input<HeaderRecord | undefined>(undefined);

  readonly sides = computed(() => [
    {
      id: `req-headers-${this.callId()}`,
      title: 'Request headers',
      rows: rowsOf(this.request()),
      none: 'None recorded.',
    },
    {
      id: `res-headers-${this.callId()}`,
      title: 'Response headers',
      rows: rowsOf(this.response()),
      none: 'None recorded. A cross-origin response shows only the headers CORS exposes.',
    },
  ]);
}

function rowsOf(headers: HeaderRecord | undefined) {
  return Object.entries(headers ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value, masked: value.includes('[redacted]') }));
}
