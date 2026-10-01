import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

let nextId = 0;

@Component({
  selector: 'app-select',
  host: {
    class: 'app-select',
    '[class.open]': 'open()',
    '(document:pointerdown)': 'onOutside($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      role="combobox"
      aria-haspopup="listbox"
      [attr.id]="uid + '-trigger'"
      [attr.aria-controls]="uid + '-list'"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-labelledby]="labelledBy() || null"
      [attr.aria-activedescendant]="open() && active() >= 0 ? uid + '-opt-' + active() : null"
      [disabled]="disabled()"
      (click)="toggle()"
      (keydown)="onKey($event)"
      (blur)="onBlur($event)"
    >
      <span class="value" [class.placeholder]="!current()">
        {{ current()?.label ?? placeholder() }}
      </span>
      @if (current()?.hint) {
        <span class="value-hint">{{ current()!.hint }}</span>
      }
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    @if (open()) {
      <ul
        #list
        class="list"
        role="listbox"
        tabindex="-1"
        [attr.id]="uid + '-list'"
        [attr.aria-labelledby]="labelledBy() || uid + '-trigger'"
        [class.up]="dropUp()"
        animate.enter="list-in"
      >
        @for (opt of options(); track opt.value; let i = $index) {
          <li
            role="option"
            [attr.id]="uid + '-opt-' + i"
            [attr.aria-selected]="opt.value === value()"
            [attr.aria-disabled]="opt.disabled || null"
            [class.active]="i === active()"
            [class.selected]="opt.value === value()"
            (pointerenter)="active.set(i)"
            (pointerdown)="$event.preventDefault()"
            (click)="choose(i)"
          >
            <svg class="check" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 5 5 9-10" />
            </svg>
            <span class="label">{{ opt.label }}</span>
            @if (opt.hint) {
              <span class="hint">{{ opt.hint }}</span>
            }
          </li>
        } @empty {
          <li class="empty" role="option" aria-disabled="true">{{ emptyText() }}</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      min-width: 0;
      vertical-align: middle;
    }
    .trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-width: 0;
      height: var(--control-h, 34px);
      padding: 0 10px 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition:
        border-color 150ms var(--ease),
        box-shadow 150ms var(--ease),
        background-color 150ms var(--ease);
    }
    .trigger:hover:not(:disabled) {
      border-color: color-mix(in srgb, var(--border-strong) 55%, var(--text-3));
    }
    .trigger:focus-visible,
    :host(.open) .trigger {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    .trigger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .value {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .value.placeholder {
      color: var(--text-3);
    }
    .value-hint {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      color: var(--text-3);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chevron {
      flex: none;
      width: 14px;
      height: 14px;
      fill: none;
      stroke: var(--text-3);
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 150ms var(--ease);
    }
    :host(.open) .chevron {
      transform: rotate(180deg);
      stroke: var(--accent);
    }
    .list {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 50;
      box-sizing: border-box;
      min-width: 100%;
      max-width: min(480px, calc(100vw - 24px));
      max-height: 280px;
      margin: 0;
      padding: 4px;
      overflow: auto;
      list-style: none;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      box-shadow:
        0 16px 40px -12px rgb(0 0 0 / 0.7),
        0 0 0 1px rgb(0 0 0 / 0.2);
      overscroll-behavior: contain;
    }
    .list.up {
      top: auto;
      bottom: calc(100% + 6px);
    }
    .list-in {
      animation: list-in 140ms var(--ease) both;
    }
    @keyframes list-in {
      from {
        opacity: 0;
        transform: translateY(-4px) scale(0.98);
      }
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      padding: 0 10px 0 8px;
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
    }
    li.active {
      background: var(--surface-3);
    }
    li.selected {
      color: var(--text-strong);
      font-weight: 600;
    }
    li[aria-disabled='true'] {
      color: var(--text-3);
      cursor: default;
    }
    .check {
      flex: none;
      width: 14px;
      height: 14px;
      fill: none;
      stroke: var(--accent);
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
      visibility: hidden;
    }
    li.selected .check {
      visibility: visible;
    }
    .label {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .hint {
      flex: none;
      max-width: 50%;
      overflow: hidden;
      color: var(--text-3);
      font-size: 12px;
      font-weight: 400;
      text-overflow: ellipsis;
    }
    .empty {
      justify-content: center;
    }
    @media (prefers-reduced-motion: reduce) {
      .list-in {
        animation: none;
      }
      .chevron {
        transition: none;
      }
    }
  `,
})
export class Select<T extends string = string> {
  readonly options = input.required<readonly SelectOption<T>[]>();
  readonly value = model<T | null>(null);
  readonly placeholder = input('Select…');
  readonly ariaLabel = input('');
  readonly labelledBy = input('');
  readonly disabled = input(false);
  readonly emptyText = input('Nothing to choose');

  protected readonly uid = `app-select-${++nextId}`;
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly dropUp = signal(false);
  protected readonly current = computed(
    () => this.options().find((opt) => opt.value === this.value()) ?? null,
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');
  private typed = '';
  private typedAt = 0;

  protected toggle() {
    if (this.open()) this.close();
    else this.show();
  }

  protected choose(index: number) {
    const opt = this.options()[index];
    if (!opt || opt.disabled) return;
    this.value.set(opt.value);
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected onKey(event: KeyboardEvent) {
    const opts = this.options();
    const open = this.open();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          this.show();
          return;
        }
        this.move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      case 'Home':
      case 'End':
        if (!open) return;
        event.preventDefault();
        this.setActive(
          event.key === 'Home' ? this.firstEnabled(0, 1) : this.firstEnabled(opts.length - 1, -1),
        );
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open && this.active() >= 0) this.choose(this.active());
        else this.show();
        return;
      case 'Escape':
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      case 'Tab':
        if (open) this.close();
        return;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          this.typeAhead(event.key);
        }
    }
  }

  protected onBlur(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this.close();
  }

  protected onOutside(event: PointerEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private show() {
    if (this.disabled()) return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    this.dropUp.set(below < 220 && rect.top > below);
    const selected = this.options().findIndex((opt) => opt.value === this.value());
    this.open.set(true);
    this.setActive(selected >= 0 ? selected : this.firstEnabled(0, 1));
  }

  private close() {
    this.open.set(false);
    this.active.set(-1);
  }

  private move(step: 1 | -1) {
    const next = this.firstEnabled(this.active() + step, step);
    if (next >= 0) this.setActive(next);
  }

  private firstEnabled(from: number, step: 1 | -1) {
    const opts = this.options();
    for (let i = from; i >= 0 && i < opts.length; i += step) if (!opts[i].disabled) return i;
    return -1;
  }

  private setActive(index: number) {
    this.active.set(index);
    if (index < 0) return;
    afterNextRender(
      () => {
        const el = this.list()?.nativeElement.querySelector<HTMLElement>(
          `#${this.uid}-opt-${index}`,
        );
        el?.scrollIntoView({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  private typeAhead(key: string) {
    const now = performance.now();
    this.typed = now - this.typedAt > 600 ? key.toLowerCase() : this.typed + key.toLowerCase();
    this.typedAt = now;
    const match = this.options().findIndex(
      (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(this.typed),
    );
    if (match < 0) return;
    if (this.open()) this.setActive(match);
    else this.value.set(this.options()[match].value);
  }
}
