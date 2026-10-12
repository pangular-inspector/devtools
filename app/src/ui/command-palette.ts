import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { filterCommands, type PaletteCommand } from '../palette-filter';

let nextId = 0;

/**
 * The panel's own command palette: a modal dialog with a combobox that
 * filters a listbox of commands. Arrow keys move, Enter runs, Escape closes,
 * and focus goes back to where it was when the palette opened.
 */
@Component({
  selector: 'app-command-palette',
  template: `
    @if (open()) {
      <div class="backdrop" aria-hidden="true" (pointerdown)="close()"></div>
      <div
        class="palette"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="uid + '-title'"
        (keydown)="onKey($event)"
      >
        <h2 class="sr-only" [attr.id]="uid + '-title'">Command palette</h2>
        <div class="field">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #input
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            autocomplete="off"
            spellcheck="false"
            placeholder="Type a command or a tab…"
            [attr.aria-controls]="uid + '-list'"
            [attr.aria-activedescendant]="activeId()"
            [attr.aria-describedby]="uid + '-help'"
            aria-label="Command"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </div>
        <ul
          class="list"
          role="listbox"
          aria-label="Commands"
          [attr.id]="uid + '-list'"
          [hidden]="!results().length"
          (pointerdown)="$event.preventDefault()"
        >
          @for (command of results(); track command.id; let i = $index) {
            <li
              role="option"
              [attr.id]="uid + '-opt-' + i"
              [attr.aria-selected]="i === active()"
              [class.active]="i === active()"
              (pointermove)="active.set(i)"
              (click)="run(command)"
            >
              <span class="title">{{ command.title }}</span>
              @if (command.shortcut) {
                <kbd>{{ command.shortcut }}</kbd>
              }
              <span class="group">{{ command.group }}</span>
            </li>
          }
        </ul>
        @if (!results().length) {
          <p class="empty">No commands match “{{ query().trim() }}”.</p>
        }
        <p class="help" [attr.id]="uid + '-help'">
          <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to run, <kbd>Esc</kbd> to close
        </p>
        <p class="sr-only" role="status">{{ status() }}</p>
      </div>
    }
  `,
  styles: `
    @use 'mixins' as m;

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: color-mix(in srgb, var(--bg) 55%, transparent);
      backdrop-filter: blur(2px);
    }
    .palette {
      position: fixed;
      top: min(12vh, 96px);
      right: 0;
      left: 0;
      z-index: 101;
      display: flex;
      flex-direction: column;
      width: min(560px, calc(100vw - 32px));
      max-height: min(70vh, 520px);
      margin-inline: auto;
      @include m.panel(1);
      box-shadow: 0 24px 64px -24px rgba(0, 0, 0, 0.6);
      overflow: hidden;
      @include m.enter(0.18s);
    }
    .field {
      position: relative;
      flex-shrink: 0;
      padding: 10px;
      border-bottom: 1px solid var(--border);
    }
    .search-icon {
      position: absolute;
      top: 50%;
      left: 22px;
      width: 16px;
      height: 16px;
      transform: translateY(-50%);
      fill: none;
      stroke: var(--text-3);
      stroke-width: 2;
      pointer-events: none;
    }
    input {
      box-sizing: border-box;
      width: 100%;
      height: var(--control-h);
      padding: 0 12px 0 36px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text-strong);
      font: inherit;
      font-size: 14px;
      &::placeholder {
        color: var(--text-3);
      }
      &:focus {
        @include m.field-focus;
      }
    }
    .list {
      flex: 1;
      min-height: 0;
      margin: 0;
      padding: 6px;
      overflow-y: auto;
      list-style: none;
      &[hidden] {
        display: none;
      }
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: var(--control-h);
      padding: 0 10px;
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
    }
    li.active {
      background: var(--accent-soft);
      color: var(--text-strong);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .title {
      flex: 1;
      @include m.truncate;
    }
    .group {
      flex-shrink: 0;
      color: var(--text-2);
      font-size: 12px;
    }
    kbd {
      padding: 1px 6px;
      border: 1px solid var(--border-strong);
      border-radius: 4px;
      background: var(--surface-2);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 11px;
    }
    .empty {
      margin: 0;
      padding: 16px;
      color: var(--text-2);
    }
    .help {
      flex-shrink: 0;
      margin: 0;
      padding: 8px 12px;
      border-top: 1px solid var(--border);
      color: var(--text-2);
      font-size: 12px;
    }
    @media (max-width: 480px) {
      .group,
      .help {
        display: none;
      }
    }
  `,
})
export class CommandPalette {
  readonly commands = input<readonly PaletteCommand[]>([]);
  readonly open = model(false);
  /** The id of the command picked, sent after the palette closed and gave focus back. */
  readonly picked = output<string>();

  protected readonly uid = `cp${nextId++}`;
  readonly query = signal('');
  readonly results = computed(() => filterCommands(this.commands(), this.query()));
  readonly active = linkedSignal<number>(() => (this.results().length ? 0 : -1));
  protected readonly activeId = computed(() =>
    this.active() >= 0 ? `${this.uid}-opt-${this.active()}` : null,
  );
  protected readonly status = computed(() => {
    const count = this.results().length;
    if (!count) return 'No commands match.';
    return `${count} ${count === 1 ? 'command' : 'commands'}.`;
  });

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly injector = inject(Injector);
  private returnFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const active = document.activeElement;
        this.returnFocus =
          active instanceof HTMLElement && active !== document.body ? active : null;
        this.query.set('');
        afterNextRender(() => this.input()?.nativeElement.focus(), { injector: this.injector });
      });
    });
  }

  close(then?: () => void) {
    if (!this.open()) return;
    this.open.set(false);
    const back = this.returnFocus;
    this.returnFocus = null;
    afterNextRender(
      () => {
        if (back?.isConnected) back.focus();
        then?.();
      },
      { injector: this.injector },
    );
  }

  run(command: PaletteCommand) {
    this.close(() => this.picked.emit(command.id));
  }

  onKey(event: KeyboardEvent) {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!count) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.active.set((this.active() + step + count) % count);
        this.reveal();
        return;
      }
      case 'PageDown':
      case 'PageUp':
        event.preventDefault();
        if (!count) return;
        this.active.set(event.key === 'PageDown' ? count - 1 : 0);
        this.reveal();
        return;
      case 'Enter': {
        event.preventDefault();
        const command = this.results()[this.active()];
        if (command) this.run(command);
        return;
      }
      case 'Escape':
        event.preventDefault();
        // The popup closes on Escape too; this one belongs to the palette.
        event.stopPropagation();
        this.close();
        return;
      case 'Tab':
        // The input is the only stop in the dialog, so focus stays in it.
        event.preventDefault();
        return;
    }
  }

  private reveal() {
    afterNextRender(
      () => {
        const id = this.activeId();
        if (id) document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }
}
