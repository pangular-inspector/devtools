import { Component, computed, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'pangular-demo-theme';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

@Component({
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      [attr.aria-label]="'Theme: ' + label() + '. Activate to switch.'"
      (click)="next()"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (theme()) {
          @case ('light') {
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            />
          }
          @case ('dark') {
            <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
          }
          @default {
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
          }
        }
      </svg>
      <span class="label">{{ label() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 92px;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      transition:
        border-color 0.15s var(--ease),
        background-color 0.15s var(--ease),
        color 0.15s var(--ease);
    }
    button:hover {
      border-color: var(--line-strong);
      background: var(--subtle);
      color: var(--ink);
    }
    svg {
      flex: none;
    }
    @media (max-width: 520px) {
      button {
        min-width: 34px;
        padding: 0;
      }
      .label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    }
  `,
})
export class ThemeToggle {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly theme = signal<Theme>(this.restore());

  readonly label = computed(() => LABEL[this.theme()]);

  constructor() {
    effect(() => {
      const theme = this.theme();
      if (!this.isBrowser) return;
      const root = document.documentElement;
      if (theme === 'system') delete root.dataset['theme'];
      else root.dataset['theme'] = theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // storage can be unavailable or full; the theme still applies
      }
    });
  }

  next() {
    this.theme.update((current) => NEXT[current]);
  }

  private restore(): Theme {
    if (!this.isBrowser) return 'system';
    try {
      // Reading storage throws outright when a browser blocks it, and this
      // runs while the root component is being constructed.
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
