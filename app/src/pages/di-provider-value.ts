import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { rpcCall } from '../rpc';
import { ValueStore, type ValueAnswer } from './component-value-store';
import { ValueTree, type TreeProp } from './component-value-tree';

/** What `request-provider-value` answers for the members of a provider. */
interface MembersAnswer {
  ok?: boolean;
  error?: string;
  type?: string;
  members?: { name: string; kind?: 'signal' | 'resource'; value: unknown }[];
  more?: number;
}

/** The member that stands for a value without members (a string, an array). */
const WHOLE_VALUE = '$value';

let nextId = 0;

/**
 * The current value of one provider in the Injectors view, behind a "Show
 * value" toggle. The page reads only an instance its injector already
 * created (it never creates one) and lists its own fields like component
 * properties: signals and resources unwrapped, methods left out, secret
 * names redacted, and nested levels read when they are opened.
 */
@Component({
  selector: 'app-provider-value',
  imports: [ValueTree],
  template: `
    <div class="bar">
      <button
        type="button"
        class="toggle"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="open() ? regionId : null"
        [attr.aria-label]="(open() ? 'Hide the value of ' : 'Show the value of ') + name()"
        (click)="toggle()"
      >
        <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        {{ open() ? 'Hide value' : 'Show value' }}
      </button>
      @if (open() && !loading()) {
        <button
          type="button"
          class="link"
          [attr.aria-label]="'Read the value of ' + name() + ' again'"
          (click)="load()"
        >
          Refresh
        </button>
      }
    </div>
    @if (open()) {
      <div class="value" [id]="regionId" role="region" [attr.aria-label]="'Value of ' + name()">
        @if (loading()) {
          <p class="muted" role="status">Reading from the page…</p>
        } @else if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        } @else if (props().length) {
          @if (type()) {
            <p class="muted">{{ type() }}, read from the page. Getters never run.</p>
          }
          <ul class="props">
            @for (p of props(); track p.prop) {
              <li class="prop">
                @if (p.prop !== whole) {
                  <span class="name mono"
                    >{{ p.name }}
                    @if (kinds()[p.prop]; as kind) {
                      <span class="kind">{{ kind }}</span>
                    }
                  </span>
                }
                <app-value-tree
                  [prop]="p"
                  [store]="store"
                  [componentId]="key()"
                  [pageId]="pageId()"
                  [rpc]="rpc()"
                />
              </li>
            }
          </ul>
          @if (more()) {
            <p class="muted">{{ more() }} more members are not listed.</p>
          }
        } @else {
          <p class="muted">No fields to show: the instance has only methods or getters.</p>
        }
      </div>
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      min-width: 0;
      margin-top: 6px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .toggle,
    .link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 28px;
      padding: 0 8px 0 4px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .link {
      padding: 0 8px;
      border-color: transparent;
      background: none;
      text-decoration: underline;
    }
    .toggle:hover,
    .link:hover {
      background: var(--surface-3);
    }
    .toggle:focus-visible,
    .link:focus-visible {
      @include m.focus-ring;
    }
    .chevron {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 150ms var(--ease);
    }
    .toggle[aria-expanded='true'] .chevron {
      transform: rotate(90deg);
    }
    .value {
      margin-top: 6px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
    }
    .props {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .prop {
      display: grid;
      gap: 2px;
      min-width: 0;
      font-size: 12px;
    }
    .name {
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    .kind {
      @include m.tint(accent);
      margin-left: 4px;
      padding: 0 6px;
      border-radius: 999px;
      font-size: 10px;
    }
    .muted {
      margin: 0 0 6px;
      color: var(--text-2);
      font-size: 12px;
    }
    .error {
      margin: 0;
      color: var(--danger-text);
      font-size: 12px;
    }
    @media (prefers-reduced-motion: reduce) {
      .chevron,
      .toggle,
      .link {
        transition: none;
      }
    }
  `,
})
export class ProviderValue {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly pageId = input<string | null>(null);
  readonly injectorId = input.required<string>();
  readonly token = input.required<string>();
  /** The provider's index in its injector's `providers`. */
  readonly index = input.required<number>();
  /** Tells apart providers of one token (multi providers), such as `(2 of 2)`. */
  readonly position = input('');
  /** The token, with its position when it repeats, for unique labels and region names. */
  protected readonly name = computed(() =>
    this.position() ? `${this.token()} ${this.position()}` : this.token(),
  );

  protected readonly regionId = `provider-value-${++nextId}`;
  protected readonly whole = WHOLE_VALUE;

  /** The provider this shows; another one closes it. */
  readonly key = computed(
    () => `${this.pageId()}|${this.injectorId()}|${this.index()}|${this.token()}`,
  );
  readonly open = linkedSignal<string, boolean>({ source: this.key, computation: () => false });
  readonly answer = linkedSignal<string, MembersAnswer | null>({
    source: this.key,
    computation: () => null,
  });
  readonly loading = signal(false);

  readonly error = computed(() => {
    const answer = this.answer();
    return answer && !answer.ok ? (answer.error ?? 'The page did not read it.') : '';
  });
  readonly type = computed(() => this.answer()?.type ?? '');
  readonly more = computed(() => this.answer()?.more ?? 0);
  readonly props = computed<TreeProp[]>(() =>
    (this.answer()?.members ?? []).map((member) => ({
      name: member.name === WHOLE_VALUE ? 'value' : member.name,
      prop: member.name,
      value: member.value,
    })),
  );
  readonly kinds = computed<Record<string, string>>(() =>
    Object.fromEntries(
      (this.answer()?.members ?? []).filter((m) => m.kind).map((m) => [m.name, m.kind!]),
    ),
  );

  /** Nested levels, read through `request-provider-value` with a path. */
  protected readonly store = new ValueStore((request) =>
    this.read({ path: [...request.path], limit: request.limit, depth: request.depth }),
  );

  private async read(request: {
    path: string[];
    limit?: number;
    depth?: number;
  }): Promise<ValueAnswer & MembersAnswer> {
    const pageId = this.pageId();
    if (!pageId) return { error: 'No live page to read from.' };
    try {
      return ((await rpcCall(this.rpc(), 'request-provider-value', {
        pageId,
        request: {
          injectorId: this.injectorId(),
          token: this.token(),
          index: this.index(),
          ...request,
        },
      })) ?? { error: 'The devtools server is not connected.' }) as ValueAnswer & MembersAnswer;
    } catch {
      return { error: 'The devtools server did not answer. Try again.' };
    }
  }

  toggle() {
    const open = !this.open();
    this.open.set(open);
    if (open && !this.answer()) void this.load();
  }

  /** Counts reads, so only the latest one's answer is shown. */
  private requests = 0;

  async load() {
    const key = this.key();
    const request = ++this.requests;
    this.loading.set(true);
    // A fresh read starts the nested levels over.
    this.store.follow({ rpc: null, pageId: null, componentId: `${key}#${Date.now()}` }, undefined);
    const answer = await this.read({ path: [] });
    // A newer read, or another provider, owns the view now.
    if (request !== this.requests || key !== this.key()) return;
    this.loading.set(false);
    this.answer.set(answer);
  }
}
