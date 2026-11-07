import { Component, computed, input, signal } from '@angular/core';

const MAX_CHILDREN = 200;

/**
 * One key of a JSON value as a lazy tree: objects and arrays are closed
 * `<details>` elements whose children render only once opened.
 */
@Component({
  selector: 'app-analog-value-node',
  template: `
    @if (isBranch()) {
      <details [open]="open()" (toggle)="open.set($any($event.target).open)">
        <summary>
          <span class="key">{{ name() }}</span>
          <span class="muted small">{{ summary() }}</span>
        </summary>
        @if (open()) {
          <ul role="list">
            @for (entry of entries(); track entry[0]) {
              <li><app-analog-value-node [name]="entry[0]" [value]="entry[1]" /></li>
            }
            @if (hidden()) {
              <li class="muted small">{{ hidden() }} more not shown</li>
            }
          </ul>
        }
      </details>
    } @else {
      <span class="leaf"
        ><span class="key">{{ name() }}</span
        >: <span class="value" [attr.data-type]="type()">{{ text() }}</span></span
      >
    }
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.6;
    }
    ul {
      margin: 0;
      padding-left: 18px;
      list-style: none;
      border-left: 1px solid var(--border);
    }
    summary {
      cursor: pointer;
      color: var(--text);
    }
    summary:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .key {
      color: var(--text-strong);
    }
    .muted {
      margin-left: 6px;
      color: var(--text-2);
    }
    .small {
      font-size: 12px;
    }
    .value {
      overflow-wrap: anywhere;
      color: var(--text);
    }
    .value[data-type='string'] {
      color: var(--ok-text, var(--text));
    }
  `,
})
export class AnalogValueNode {
  readonly name = input('value');
  readonly value = input<unknown>(undefined);
  readonly open = signal(false);
  readonly isBranch = computed(() => {
    const v = this.value();
    return !!v && typeof v === 'object';
  });
  readonly all = computed(() => {
    const v = this.value();
    if (!v || typeof v !== 'object') return [] as [string, unknown][];
    return Array.isArray(v)
      ? v.map((item, i) => [String(i), item] as [string, unknown])
      : Object.entries(v as Record<string, unknown>);
  });
  readonly entries = computed(() => this.all().slice(0, MAX_CHILDREN));
  readonly hidden = computed(() => Math.max(0, this.all().length - MAX_CHILDREN));
  readonly summary = computed(() => {
    const n = this.all().length;
    return Array.isArray(this.value()) ? `[${n}]` : `{${n} key${n === 1 ? '' : 's'}}`;
  });
  readonly type = computed(() => (this.value() === null ? 'null' : typeof this.value()));
  readonly text = computed(() => {
    const v = this.value();
    return typeof v === 'string' ? JSON.stringify(v) : String(v);
  });
}
