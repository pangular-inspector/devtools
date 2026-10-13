import { Component, input, output } from '@angular/core';
import type { AngularPageInfo } from '@pangular-inspector/devtools/config';
import { AngularUnavailable } from '../ui/angular-unavailable';

export interface ForBlock {
  id: string;
  owner?: { id: string; name: string; tag: string };
  count: number;
  track: '$index' | 'item' | 'function' | null;
  hasEmptyBlock: boolean;
  showingEmpty: boolean;
  rootIds: string[];
}

const TRACK_LABEL: Record<string, string> = {
  $index: 'track $index',
  item: 'track item',
  function: 'track expression',
};

/**
 * The `@for` blocks list on the Components page, next to the defer blocks.
 * `blocks` is `undefined` when the page's Angular has no
 * `ɵgetControlFlowBlocks` (before 22.0), which the section says.
 */
@Component({
  selector: 'app-for-blocks',
  imports: [AngularUnavailable],
  template: `
    @if (blocks(); as list) {
      @if (list.length) {
        <section class="for" aria-labelledby="ct-for-title">
          <h2 id="ct-for-title" class="for-title">
            &#64;for blocks
            <span class="pill">{{ truncated() ? list.length + '+' : list.length }}</span>
          </h2>
          @if (truncated()) {
            <p class="note">The page has more &#64;for blocks than the {{ list.length }} listed.</p>
          }
          <ul class="for-list">
            @for (block of list; track block.id) {
              <li>
                <button
                  type="button"
                  class="for-row"
                  [attr.aria-disabled]="block.owner ? null : 'true'"
                  (click)="showOwner.emit(block)"
                  (focus)="highlight.emit(target(block))"
                  (blur)="highlight.emit(null)"
                  (mouseenter)="highlight.emit(target(block))"
                  (mouseleave)="highlight.emit(null)"
                >
                  <span class="name mono">{{ block.owner?.name ?? 'Unknown component' }}</span>
                  <span class="count">
                    {{ block.count }} {{ block.count === 1 ? 'item' : 'items' }}
                  </span>
                  @if (block.showingEmpty) {
                    <span class="flag empty">&#64;empty showing</span>
                  } @else if (block.hasEmptyBlock) {
                    <span class="flag">&#64;empty</span>
                  } @else if (block.count === 0) {
                    <span class="flag">renders nothing</span>
                  }
                  <span class="track mono">{{ trackLabel(block) }}</span>
                </button>
              </li>
            }
          </ul>
        </section>
      }
    } @else if (supported() === false) {
      <app-angular-unavailable
        class="for"
        [page]="angular()"
        capability="forBlocks"
        missing
        compact
      />
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .for {
      margin-top: 16px;
    }
    .for-title {
      @include m.label;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 8px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 16px;
      padding: 0 5px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0;
    }
    .note {
      margin: 0 0 8px;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    .for-list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .for-row {
      justify-content: flex-start;
      flex-wrap: wrap;
      width: 100%;
      height: auto;
      min-height: var(--control-h);
      padding: 6px 12px;
      background: var(--surface);
      border-color: var(--border);
      text-align: left;
    }
    .for-row:focus-visible {
      @include m.focus-ring;
    }
    .for-row[aria-disabled='true'] {
      cursor: default;
    }
    .name {
      min-width: 0;
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
      @include m.truncate;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .count {
      padding: 0 8px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      line-height: 18px;
    }
    .flag {
      padding: 0 6px;
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 10px;
    }
    .flag.empty {
      @include m.tint(warn);
    }
    .track {
      min-width: 0;
      color: var(--text-2);
      font-size: 12px;
      @include m.truncate;
    }
  `,
})
export class ForBlocksSection {
  /** The page's `@for` blocks, or `undefined` when it reports none at all. */
  readonly blocks = input<ForBlock[] | undefined>(undefined);
  readonly truncated = input(false);
  /** `false` when the page reports defer blocks but no `@for` blocks: its Angular is older than 22.0. */
  readonly supported = input<boolean | null>(null);
  /** The page's Angular version, which the unavailable note names. */
  readonly angular = input<AngularPageInfo | null>(null);
  readonly showOwner = output<ForBlock>();
  /** The element to highlight in the app, or `null` to clear it. */
  readonly highlight = output<string | null>();

  protected target(block: ForBlock): string | null {
    return block.rootIds[0] ?? block.owner?.id ?? null;
  }

  protected trackLabel(block: ForBlock): string {
    return block.track ? TRACK_LABEL[block.track] : 'track unknown';
  }
}
