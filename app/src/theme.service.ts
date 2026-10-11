import { DestroyRef, Service, effect, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Service()
export class ThemeService {
  readonly current = signal<Theme>('dark');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const colorRoot = getHubColorRoot();
    const attr = document.documentElement.dataset['theme'];
    let pinned = attr === 'light' || attr === 'dark';

    if (attr === 'light' || attr === 'dark') {
      this.current.set(attr);
    } else if (colorRoot) {
      pinned = true;
      this.apply(hubTheme(colorRoot));
    } else {
      const query = prefersLight();
      if (query) {
        this.current.set(query.matches ? 'light' : 'dark');
        const onChange = (e: MediaQueryListEvent) => {
          if (!pinned) this.current.set(e.matches ? 'light' : 'dark');
        };
        query.addEventListener('change', onChange);
        destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
      }
    }

    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel('pangular:theme');
    } catch {}
    effect(() => {
      const theme = this.current();
      try {
        channel?.postMessage(theme);
      } catch {}
      try {
        let w: Window = window;
        while (w !== w.parent) {
          w = w.parent;
          w.postMessage({ type: 'pangular:theme-change', theme }, '*');
        }
      } catch {}
    });

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const msg = e.data as { type?: unknown; theme?: unknown } | null;
      if (msg?.type !== 'pangular:theme-change') return;
      pinned = true;
      this.apply(msg.theme === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('message', onMessage);

    let observer: MutationObserver | undefined;
    if (colorRoot) {
      observer = new MutationObserver(() => this.apply(hubTheme(colorRoot)));
      observer.observe(colorRoot, { attributes: true, attributeFilter: ['class'] });
    }

    destroyRef.onDestroy(() => {
      window.removeEventListener('message', onMessage);
      observer?.disconnect();
      channel?.close();
    });
  }

  private apply(theme: Theme) {
    this.current.set(theme);
    document.documentElement.dataset['theme'] = theme;
  }
}

function prefersLight(): MediaQueryList | null {
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)') ?? null;
  } catch {
    return null;
  }
}

function hubTheme(colorRoot: Element): Theme {
  return colorRoot.classList.contains('dark') ? 'dark' : 'light';
}

function getHubColorRoot(): Element | null {
  try {
    return window.frameElement?.closest('.devframes-color-root') ?? null;
  } catch {
    return null;
  }
}
