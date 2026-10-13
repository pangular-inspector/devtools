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
} from '@angular/core';
import {
  moveTab,
  orderedTabIds,
  setTabHidden,
  setTabPinned,
  DEFAULT_TAB_LAYOUT,
  type TabLayout,
  type ThemePreference,
} from '../shell-prefs';
import type { DevframeRpcClient } from 'devframe/client';
import { BrowserToolsSetting } from './browser-tools-setting';
import { TabIcon } from './tab-icon';

export interface SettingsTab {
  id: string;
  label: string;
}

const THEMES: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Follows the hub, or your system without it' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
];

/**
 * Per-viewer settings (theme, tab bar layout and the popup's passive mode),
 * and the dev server's browser agent tools switch.
 */
@Component({
  selector: 'app-settings',
  imports: [BrowserToolsSetting, TabIcon],
  template: `
    <p class="intro">
      Settings for this panel in this browser. They are saved in the browser's local storage, so
      every panel on this address uses them. Browser agents is the exception: the dev server keeps
      it for every page and panel.
    </p>

    <section class="card" aria-labelledby="settings-theme">
      <h2 id="settings-theme">Theme</h2>
      <div class="themes" role="radiogroup" aria-labelledby="settings-theme">
        @for (option of themes; track option.value) {
          <label class="theme" [class.checked]="theme() === option.value">
            <input
              type="radio"
              name="settings-theme"
              [value]="option.value"
              [checked]="theme() === option.value"
              (change)="theme.set(option.value)"
            />
            <span class="theme-label">{{ option.label }}</span>
            <span class="hint">{{ option.hint }}</span>
          </label>
        }
      </div>
    </section>

    <section class="card" aria-labelledby="settings-tabs">
      <div class="card-head">
        <h2 id="settings-tabs">Tabs</h2>
        <button type="button" class="action" [disabled]="isDefaultLayout()" (click)="resetTabs()">
          Reset tabs
        </button>
      </div>
      <p class="hint" id="settings-tabs-hint">
        Pinned tabs come first in the tab bar. Hidden tabs stay reachable from the command palette
        and from links. Use the arrow buttons, or <kbd>Alt</kbd> with <kbd>↑</kbd> and
        <kbd>↓</kbd> on a row, to change the order.
      </p>
      <ol class="tab-list" aria-labelledby="settings-tabs" aria-describedby="settings-tabs-hint">
        @for (tab of orderedTabs(); track tab.id; let first = $first, last = $last) {
          <li
            class="tab-row"
            [class.hidden-tab]="isHidden(tab.id)"
            [attr.data-tab]="tab.id"
            (keydown)="onRowKey($event, tab.id)"
          >
            <app-tab-icon [name]="tab.id" />
            <span class="tab-label">
              {{ tab.label }}
              @if (isPinned(tab.id)) {
                <span class="tag">Pinned</span>
              }
            </span>
            <button
              type="button"
              class="action small"
              [attr.aria-pressed]="isPinned(tab.id)"
              [attr.aria-label]="'Pin ' + tab.label"
              (click)="togglePinned(tab.id)"
            >
              Pin
            </button>
            <label class="check">
              <input
                type="checkbox"
                [checked]="!isHidden(tab.id)"
                [attr.aria-label]="tab.label + ' shown in the tab bar'"
                (change)="setShown(tab.id, $any($event.target).checked)"
              />
              <span>Shown</span>
            </label>
            <span class="moves">
              <button
                type="button"
                class="icon"
                data-move="up"
                [disabled]="!canMove(tab.id, -1)"
                [attr.aria-label]="'Move ' + tab.label + ' up'"
                (click)="move(tab.id, -1)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
              </button>
              <button
                type="button"
                class="icon"
                data-move="down"
                [disabled]="!canMove(tab.id, 1)"
                [attr.aria-label]="'Move ' + tab.label + ' down'"
                (click)="move(tab.id, 1)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </span>
          </li>
        }
      </ol>
    </section>

    <section class="card" aria-labelledby="settings-popup">
      <h2 id="settings-popup">Popup on the page</h2>
      <label class="check wide">
        <input
          type="checkbox"
          [checked]="passive()"
          [disabled]="hotkey() === false"
          aria-describedby="settings-passive-hint"
          (change)="passive.set($any($event.target).checked)"
        />
        <span>Passive mode: hide the floating button until the shortcut is pressed</span>
      </label>
      <p class="hint" id="settings-passive-hint">
        @if (hotkey(); as shortcut) {
          Press <kbd>{{ shortcut }}</kbd> on your app's page to open or close the panel. The button
          shows while the panel is open. The popup on the page saves this setting.
        } @else {
          The popup shortcut is turned off in the devtools config (<code>popup.hotkey</code>), so
          the button always shows.
        }
      </p>
    </section>

    <section class="card" aria-labelledby="settings-browser-agents">
      <app-browser-tools-setting [rpc]="rpc()" />
    </section>

    <section class="card" aria-labelledby="settings-keys">
      <h2 id="settings-keys">Keyboard shortcuts</h2>
      <table class="keys">
        <caption class="sr-only">
          Keyboard shortcuts
        </caption>
        <thead>
          <tr>
            <th scope="col">Shortcut</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <kbd>{{ paletteShortcut() }}</kbd>
            </td>
            <td>Open the command palette in the panel</td>
          </tr>
          <tr>
            <td>
              @if (hotkey(); as shortcut) {
                <kbd>{{ shortcut }}</kbd>
              } @else {
                Off
              }
            </td>
            <td>Open or close the popup on your app's page</td>
          </tr>
        </tbody>
      </table>
    </section>
    <p class="sr-only" role="status">{{ announcement() }}</p>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      max-width: 760px;
    }
    .intro {
      max-width: 720px;
      margin: 0 0 16px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .card {
      margin: 0 0 16px;
      padding: 16px;
      @include m.panel(1);
    }
    .card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h2 {
      margin: 0 0 10px;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 650;
    }
    .card-head h2 {
      margin: 0;
    }
    .hint {
      margin: 8px 0 12px;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    .themes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }
    .theme {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 8px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--bg);
      cursor: pointer;
      .hint {
        grid-column: 2;
        margin: 0;
      }
      &.checked {
        border-color: var(--accent-line);
        background: var(--accent-soft);
      }
      &:has(input:focus-visible) {
        @include m.focus-ring(2px);
      }
    }
    .theme input {
      margin: 0;
      accent-color: var(--accent);
    }
    .theme-label {
      color: var(--text-strong);
      font-weight: 600;
    }
    .tab-list {
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .tab-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      min-height: 44px;
      padding: 4px 8px 4px 12px;
      color: var(--text);
      & + & {
        border-top: 1px solid var(--border);
      }
      app-tab-icon {
        color: var(--text-3);
      }
    }
    .tab-row.hidden-tab .tab-label {
      color: var(--text-2);
    }
    .tab-label {
      display: inline-flex;
      flex: 1 1 120px;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .tag {
      padding: 1px 8px;
      border: 1px solid;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
    }
    .action {
      display: inline-flex;
      align-items: center;
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      &.small {
        height: 28px;
        padding: 0 10px;
        font-size: 12px;
      }
      &[aria-pressed='true'] {
        border-color: var(--accent-line);
        background: var(--accent-soft);
        color: var(--text-strong);
      }
      &:hover:not(:disabled) {
        background: var(--surface-3);
      }
      &:disabled {
        color: var(--text-3);
        cursor: default;
      }
      &:focus-visible {
        @include m.focus-ring;
      }
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-2);
      font-size: 12px;
      cursor: pointer;
      input {
        margin: 0;
        accent-color: var(--accent);
      }
      input:focus-visible {
        @include m.focus-ring;
      }
      &.wide {
        color: var(--text);
        font-size: 13px;
      }
    }
    .moves {
      display: inline-flex;
      gap: 4px;
      margin-left: auto;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      cursor: pointer;
      svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
      }
      &:hover:not(:disabled) {
        background: var(--surface-3);
      }
      &:disabled {
        color: var(--text-3);
        opacity: 0.6;
        cursor: default;
      }
      &:focus-visible {
        @include m.focus-ring;
      }
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
    code {
      font-family: var(--font-mono);
    }
    .keys {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      th {
        padding: 6px 8px;
        text-align: left;
        @include m.label;
      }
      td {
        padding: 8px;
        border-top: 1px solid var(--border);
        color: var(--text);
      }
    }
  `,
})
export class Settings {
  /** Every tab the panel can show here, in the default order. */
  readonly tabs = input<readonly SettingsTab[]>([]);
  readonly layout = model<TabLayout>(DEFAULT_TAB_LAYOUT);
  readonly theme = model<ThemePreference>('system');
  readonly passive = model(false);
  /** The popup shortcut as the platform writes it, or `false` when it is off. */
  readonly hotkey = input<string | false>(false);
  readonly paletteShortcut = input('Ctrl+K');
  /** The devtools server connection, for the settings it keeps (browser agent tools). */
  readonly rpc = input<DevframeRpcClient | null>(null);

  protected readonly themes = THEMES;
  protected readonly announcement = signal('');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private readonly ids = computed(() => this.tabs().map((tab) => tab.id));
  readonly orderedTabs = computed(() => {
    const byId = new Map(this.tabs().map((tab) => [tab.id, tab]));
    return orderedTabIds(this.ids(), this.layout()).map((id) => byId.get(id)!);
  });
  protected readonly isDefaultLayout = computed(() => {
    const { order, hidden, pinned } = this.layout();
    const shown = orderedTabIds(this.ids(), this.layout());
    return (
      !hidden.length &&
      !pinned.length &&
      (!order.length || shown.every((id, index) => id === this.ids()[index]))
    );
  });

  isPinned(id: string) {
    return this.layout().pinned.includes(id);
  }

  isHidden(id: string) {
    return this.layout().hidden.includes(id) && !this.isPinned(id);
  }

  canMove(id: string, delta: -1 | 1) {
    return moveTab(this.ids(), this.layout(), id, delta) !== this.layout();
  }

  move(id: string, delta: -1 | 1) {
    const next = moveTab(this.ids(), this.layout(), id, delta);
    if (next === this.layout()) return;
    this.layout.set(next);
    const order = orderedTabIds(this.ids(), next);
    const label = this.label(id);
    this.say(`${label} moved to position ${order.indexOf(id) + 1} of ${order.length}.`);
    // Keep focus on the moved row, on the same button, or the other one at an end.
    afterNextRender(
      () => {
        const row = [...this.host.nativeElement.querySelectorAll<HTMLElement>('.tab-row')].find(
          (candidate) => candidate.dataset['tab'] === id,
        );
        const wanted = row?.querySelector<HTMLButtonElement>(
          `[data-move="${delta < 0 ? 'up' : 'down'}"]`,
        );
        const other = row?.querySelector<HTMLButtonElement>(
          `[data-move="${delta < 0 ? 'down' : 'up'}"]`,
        );
        (wanted && !wanted.disabled ? wanted : other)?.focus();
      },
      { injector: this.injector },
    );
  }

  onRowKey(event: KeyboardEvent, id: string) {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    this.move(id, event.key === 'ArrowUp' ? -1 : 1);
  }

  togglePinned(id: string) {
    const pinned = !this.isPinned(id);
    this.layout.set(setTabPinned(this.ids(), this.layout(), id, pinned));
    this.say(pinned ? `${this.label(id)} pinned.` : `${this.label(id)} unpinned.`);
  }

  setShown(id: string, shown: boolean) {
    this.layout.set(setTabHidden(this.layout(), id, !shown));
    this.say(shown ? `${this.label(id)} shown.` : `${this.label(id)} hidden.`);
  }

  resetTabs() {
    this.layout.set(DEFAULT_TAB_LAYOUT);
    this.say('Tabs reset to the default order.');
  }

  private label(id: string) {
    return this.tabs().find((tab) => tab.id === id)?.label ?? id;
  }

  private say(message: string) {
    this.announcement.update((current) => (current === message ? `${message} ` : message));
  }
}
