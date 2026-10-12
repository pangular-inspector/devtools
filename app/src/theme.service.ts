import { DestroyRef, Service, effect, inject, signal } from '@angular/core';
import { storeThemePreference, storedThemePreference, type ThemePreference } from './shell-prefs';

export type Theme = 'dark' | 'light';

@Service()
export class ThemeService {
  readonly current = signal<Theme>('dark');
  /** What the viewer picked in Settings. `system` follows the hub, the extension or the system. */
  readonly preference = signal<ThemePreference>(storedThemePreference());
  /** The theme the hub, the extension, a `data-theme` attribute or the system asks for. */
  private source: Theme = 'dark';
  /** Whether the source set `data-theme`, which the system preference never does. */
  private sourceAttr = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const colorRoot = getHubColorRoot();
    const attr = document.documentElement.dataset['theme'];
    let pinned = attr === 'light' || attr === 'dark';

    if (attr === 'light' || attr === 'dark') {
      this.fromSource(attr, true);
    } else if (colorRoot) {
      pinned = true;
      this.fromSource(hubTheme(colorRoot), true);
    } else {
      const query = prefersLight();
      if (query) {
        this.fromSource(query.matches ? 'light' : 'dark', false);
        const onChange = (e: MediaQueryListEvent) => {
          if (!pinned) this.fromSource(e.matches ? 'light' : 'dark', false);
        };
        query.addEventListener('change', onChange);
        destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
      } else {
        this.resolve();
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
      for (const { win, origin } of themeTargets()) {
        try {
          win.postMessage({ type: 'pangular:theme-change', theme }, origin);
        } catch {}
      }
    });

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const msg = e.data as { type?: unknown; theme?: unknown } | null;
      if (msg?.type !== 'pangular:theme-change') return;
      pinned = true;
      this.fromSource(msg.theme === 'dark' ? 'dark' : 'light', true);
    };
    window.addEventListener('message', onMessage);

    let observer: MutationObserver | undefined;
    if (colorRoot) {
      observer = new MutationObserver(() => this.fromSource(hubTheme(colorRoot), true));
      observer.observe(colorRoot, { attributes: true, attributeFilter: ['class'] });
    }

    destroyRef.onDestroy(() => {
      window.removeEventListener('message', onMessage);
      observer?.disconnect();
      channel?.close();
    });
  }

  /** Picks light, dark or the source's theme, and keeps the choice for the next visit. */
  setPreference(preference: ThemePreference) {
    this.preference.set(preference);
    storeThemePreference(preference);
    this.resolve();
  }

  private fromSource(theme: Theme, attr: boolean) {
    this.source = theme;
    this.sourceAttr = attr;
    this.resolve();
  }

  private resolve() {
    const preference = this.preference();
    const theme = preference === 'system' ? this.source : preference;
    this.current.set(theme);
    const root = document.documentElement;
    // The system preference reaches the styles through the media query, so
    // `data-theme` is only set when something picked a theme.
    if (preference !== 'system' || this.sourceAttr) root.dataset['theme'] = theme;
    else delete root.dataset['theme'];
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

/**
 * The windows above the panel with the origin each may be sent to, nearest
 * first. An ancestor whose origin is unknown gets nothing, so the theme never
 * goes to a page the panel cannot name.
 */
export function themeTargets(win: Window = window): { win: Window; origin: string }[] {
  const targets: { win: Window; origin: string }[] = [];
  let listed: DOMStringList | undefined;
  try {
    listed = win.location.ancestorOrigins;
  } catch {}
  let current = win;
  try {
    for (let depth = 0; current !== current.parent; depth++) {
      current = current.parent;
      const origin = ancestorOrigin(win, current, depth, listed);
      if (origin) targets.push({ win: current, origin });
    }
  } catch {}
  return targets;
}

function ancestorOrigin(
  win: Window,
  ancestor: Window,
  depth: number,
  listed: DOMStringList | undefined,
): string | undefined {
  const known = (origin: string | null | undefined) =>
    origin && origin !== 'null' ? origin : undefined;
  const fromList = known(listed?.item(depth));
  if (fromList) return fromList;
  try {
    // Readable only when the ancestor shares the panel's origin.
    const own = known(ancestor.location.origin);
    if (own) return own;
  } catch {}
  if (depth > 0) return undefined;
  try {
    return known(new URL(win.document.referrer).origin);
  } catch {
    return undefined;
  }
}
