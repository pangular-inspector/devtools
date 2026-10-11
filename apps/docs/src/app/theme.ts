import {DOCUMENT} from '@angular/common';
import {inject, Injectable, signal} from '@angular/core';

type Mode = 'light' | 'dark';
const STORAGE_KEY = 'ngmd-theme';

@Injectable({providedIn: 'root'})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = typeof window !== 'undefined';

  readonly mode = signal<Mode>(this.read());

  toggle() {
    const next: Mode = this.mode() === 'dark' ? 'light' : 'dark';
    this.mode.set(next);
    this.apply(next);
  }

  initFromStorage() {
    this.apply(this.mode());
  }

  private read(): Mode {
    if (!this.isBrowser) return 'dark';
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  private apply(mode: Mode) {
    if (!this.isBrowser) return;
    this.document.documentElement.classList.toggle('dark', mode === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }
}
