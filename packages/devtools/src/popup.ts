export { registerNgrxSignals } from './ngrx-register.ts';
import { DEVTOOLS_BASES, POPUP_ROOT_ID, SETUP_URL, insideDevtoolsPanel } from './panel-frame.ts';
import { DEFAULT_POPUP_HOTKEY, matchesHotkey, normalizeHotkey } from './config.ts';
// In-page floating devtools popup. Renders an iframe pointing at the devtools SPA.

let popupRoot: HTMLElement | null = null;
/** Kept so a later call returns the same handle rather than nothing. */
let handle: { toggle: () => void; destroy: () => void } | undefined;
let isOpen = false;

const STORAGE_KEY = 'pangular-popup';

interface PopupState {
  x: number;
  y: number;
  width: number;
  height: number;
  docked: 'float' | 'bottom' | 'right';
  /** Where the launcher was left, so it can sit anywhere, not just a corner. */
  launcher?: { x: number; y: number };
  theme?: 'light' | 'dark';
  /** Passive mode: the launcher stays hidden until the shortcut opens the panel. */
  passive?: boolean;
  /** The size in px the splitter left each docked side at; the default is 40% of the window. */
  dockSize?: Partial<Record<DockSide, number>>;
}

type DockSide = 'bottom' | 'right';

/** The smallest a docked panel gets, in px, so its toolbar and some content stay usable. */
const DOCK_MIN: Record<DockSide, number> = { bottom: 120, right: 280 };
/** Room a docked panel always leaves for the app, in px. */
const DOCK_GAP = 48;
/** How far an arrow key moves the splitter, and with Shift held. */
const DOCK_STEP = 16;
const DOCK_STEP_LARGE = 64;

function windowSpan(side: DockSide): number {
  return side === 'bottom' ? window.innerHeight : window.innerWidth;
}

/** The sizes a docked side can take in the current window. */
function dockLimits(side: DockSide): { min: number; max: number } {
  const max = Math.max(0, windowSpan(side) - DOCK_GAP);
  return { min: Math.min(DOCK_MIN[side], max), max };
}

/** A docked size kept inside the window, the default when there is none. */
function clampDockSize(side: DockSide, size: number | undefined): number {
  const { min, max } = dockLimits(side);
  const wanted = size ?? windowSpan(side) * 0.4;
  return Math.round(Math.min(max, Math.max(min, wanted)));
}

function dockSizes(value: unknown): PopupState['dockSize'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const sizes: Partial<Record<DockSide, number>> = {};
  for (const side of ['bottom', 'right'] as const) {
    const size = (value as Record<string, unknown>)[side];
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) sizes[side] = size;
  }
  return Object.keys(sizes).length ? sizes : undefined;
}

const DEFAULT_STATE: PopupState = { x: 16, y: 16, width: 720, height: 480, docked: 'float' };

function loadState(): PopupState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored: unknown = raw ? JSON.parse(raw) : null;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...DEFAULT_STATE };

    // Anything in storage may be stale or hand edited, so each field is only
    // taken when it is the shape this version expects.
    const saved = stored as Partial<PopupState>;
    const point = saved.launcher;
    return {
      ...DEFAULT_STATE,
      ...(Number.isFinite(saved.x) ? { x: saved.x as number } : {}),
      ...(Number.isFinite(saved.y) ? { y: saved.y as number } : {}),
      ...(Number.isFinite(saved.width) ? { width: saved.width as number } : {}),
      ...(Number.isFinite(saved.height) ? { height: saved.height as number } : {}),
      ...(saved.docked === 'float' || saved.docked === 'bottom' || saved.docked === 'right'
        ? { docked: saved.docked }
        : {}),
      ...(point && Number.isFinite(point.x) && Number.isFinite(point.y)
        ? { launcher: { x: point.x, y: point.y } }
        : {}),
      ...(saved.theme === 'light' || saved.theme === 'dark' ? { theme: saved.theme } : {}),
      ...(saved.passive === true ? { passive: true } : {}),
      ...(dockSizes(saved.dockSize) ? { dockSize: dockSizes(saved.dockSize) } : {}),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state: PopupState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const HUB_BASE = '/__devframes/';

/** The devtools URL the overlay connected to, which beats the default paths. */
let frameBase: string | undefined;
/** A `src` given to `createDevtoolsPopup`, which beats everything else. */
let explicitSrc: string | undefined;
/** What the panel loads: a hub or panel URL, or `null` when no server answered. */
let target: Promise<string | null> | undefined;
let retarget: (() => void) | undefined;

/** The shortcut that toggles the panel, or `false` when it is off. */
let hotkey: string | false = DEFAULT_POPUP_HOTKEY;
/** Applies a new shortcut to a popup that is already on the page. */
let rehotkey: (() => void) | undefined;

/**
 * Sets the keyboard shortcut that opens and closes the panel, as
 * `popup.hotkey` takes it. An invalid one keeps the default; `false` turns
 * it off, which also shows a launcher that passive mode hid. The overlay
 * calls it with the server's config.
 */
export function setPopupHotkey(value: string | false) {
  hotkey = value === false ? false : (normalizeHotkey(value) ?? DEFAULT_POPUP_HOTKEY);
  rehotkey?.();
}

function isMac(): boolean {
  try {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform ?? nav.platform ?? '');
  } catch {
    return false;
  }
}

async function servesJson(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok && (response.headers.get('content-type') ?? '').includes('json');
  } catch {
    return false;
  }
}

/** The id this page claimed, or `''` when the overlay has not claimed one yet. */
function currentPageId(): string {
  try {
    return sessionStorage.getItem('pangular-page-id') ?? '';
  } catch {
    // Storage can be blocked; the panel then shows the latest page.
    return '';
  }
}

function panelUrl(base: string): string {
  const pageId = currentPageId();
  return `${base}?baseURL=${encodeURIComponent(base)}&pageId=${encodeURIComponent(pageId)}`;
}

/**
 * What the pop-out window loads. A hub's full panel opens alone with this
 * page's id in its URL, so the window keeps following this tab. A panel URL
 * carries the id already, and a `src` given to the popup is used as it is.
 */
function popoutUrl(src: string): string {
  if (explicitSrc !== undefined) return src;
  const url = new URL(src, location.href);
  if (url.searchParams.has('pageId')) return url.href;
  return panelUrl(new URL('pangular/', url).href);
}

/** The pop-out window's name, one per page, so opening it again reuses the window. */
function popoutName(): string {
  return `pangular-inspector-${currentPageId() || 'panel'}`;
}

/** The hub that serves a devtools frame, when the frame sits at `<hub>pangular/`. */
function hubOf(base: string): string | undefined {
  const url = new URL(base, location.href);
  return url.pathname.endsWith('/pangular/') ? new URL('../', url).href : undefined;
}

async function findTarget(): Promise<string | null> {
  if (explicitSrc !== undefined) return new URL(explicitSrc, location.origin).href;
  if (frameBase) {
    const hub = hubOf(frameBase);
    if (hub && (await servesJson(`${hub}__connection.json`))) return hub;
    return panelUrl(frameBase);
  }
  const origin = location.origin;
  if (await servesJson(`${origin}${HUB_BASE}__connection.json`)) return `${origin}${HUB_BASE}`;
  // The same places the overlay looks, once each: `./` can be the site root.
  const bases = new Set(DEVTOOLS_BASES.map((base) => new URL(base, location.href).href));
  for (const base of bases) {
    for (const file of ['__devframe/__connection.json', '__connection.json']) {
      if (await servesJson(`${base}${file}`)) return panelUrl(base);
    }
  }
  return null;
}

function resolveTarget(): Promise<string | null> {
  const found = (target ??= findTarget());
  // Nothing answered yet; look again on the next open, the server may be up by then.
  void found.then((src) => {
    if (src === null && target === found) target = undefined;
  });
  return found;
}

function changeTarget() {
  target = undefined;
  retarget?.();
}

/**
 * Points the panel at the devtools the overlay connected to. `initOverlay`
 * calls it, so a custom `baseURL` also reaches the floating button.
 */
export function useDevtoolsBase(base: string) {
  const absolute = new URL(base, location.href).href;
  if (absolute === frameBase) return;
  frameBase = absolute;
  changeTarget();
}

let shown: Promise<void> | undefined;

/** Adds the floating button. The panel finds the devtools server when it first opens. */
export function showDevtools(): Promise<void> {
  shown ??= Promise.resolve().then(() => {
    createDevtoolsPopup();
  });
  return shown;
}

/** Removes the popup, waiting for one that is still being created. */
export async function hideDevtools(): Promise<void> {
  await shown?.catch(() => {});
  handle?.destroy();
  shown = undefined;
}

/**
 * Adds the floating button and returns its handle. `src` is the page the panel
 * loads; without it the panel looks for the hub, then for the devtools alone.
 * A later call returns the same handle and applies a new `src`.
 */
export function createDevtoolsPopup(options: { src?: string; hotkey?: string | false } = {}) {
  if (options.hotkey !== undefined) setPopupHotkey(options.hotkey);
  if (options.src !== undefined && options.src !== explicitSrc) {
    explicitSrc = options.src;
    changeTarget();
  }
  if (popupRoot) return handle;

  const state = loadState();

  popupRoot = document.createElement('div');
  popupRoot.id = POPUP_ROOT_ID;

  const shadow = popupRoot.attachShadow({ mode: 'open' });

  // FAB toggle button
  const fab = document.createElement('button');
  fab.setAttribute('aria-label', 'Toggle Pangular Inspector');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = 'Pangular Inspector';
  fab.innerHTML =
    `<svg width="28" height="28" viewBox="-20 -11 280 280" aria-hidden="true">` +
    `<defs><mask id="pi-fab-mask"><rect x="-60" y="-60" width="360" height="380" fill="#fff"/>` +
    `<g fill="none" stroke="#000" stroke-width="30"><path d="M88 66 V196"/>` +
    `<path d="M88 66 H143 L170 98 L143 130 H88 Z"/></g></mask>` +
    `<clipPath id="pi-fab-clip"><rect x="-40" y="129" width="320" height="200"/></clipPath></defs>` +
    `<g transform="rotate(-10 120 129)"><ellipse cx="120" cy="129" rx="128" ry="34" fill="none"` +
    ` stroke="currentColor" stroke-width="10"/></g>` +
    `<path mask="url(#pi-fab-mask)" fill="currentColor" d="M120 5 L238 46 L218 198 L120 253 L22 198 L2 46 Z"/>` +
    `<g transform="rotate(-10 120 129)"><g clip-path="url(#pi-fab-clip)" fill="none">` +
    `<ellipse class="ko" cx="120" cy="129" rx="128" ry="34" stroke-width="22"/>` +
    `<ellipse cx="120" cy="129" rx="128" ry="34" stroke="currentColor" stroke-width="10"/></g>` +
    `<g transform="translate(230.9 146.0) rotate(10) scale(1.5) translate(-4 -4)">` +
    `<line class="ko" x1="9" y1="9" x2="21" y2="21" stroke-width="14" stroke-linecap="round"/>` +
    `<circle class="ko-fill" r="16"/>` +
    `<line x1="9" y1="9" x2="21" y2="21" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>` +
    `<circle class="ko-fill" r="12" stroke="currentColor" stroke-width="5"/></g></g></svg>`;

  // Panel container
  const panel = document.createElement('div');
  panel.classList.add('panel');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Pangular Inspector');

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.classList.add('toolbar');

  const title = document.createElement('span');
  title.classList.add('title');
  title.textContent = 'Pangular Inspector';

  const dockGroup = document.createElement('div');
  dockGroup.classList.add('dock-group');
  for (const mode of ['float', 'bottom', 'right'] as const) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = mode === 'float' ? '⊡' : mode === 'bottom' ? '⬓' : '⬔';
    btn.title = `Dock ${mode}`;
    btn.setAttribute('aria-label', `Dock ${mode}`);
    btn.setAttribute('aria-pressed', String(state.docked === mode));
    btn.classList.add('dock-btn');
    if (state.docked === mode) btn.classList.add('active');
    btn.dataset['mode'] = mode;
    btn.addEventListener('click', () => setDock(mode));
    dockGroup.appendChild(btn);
  }

  function setDock(mode: PopupState['docked']) {
    state.docked = mode;
    applyDock();
    dockGroup.querySelectorAll<HTMLElement>('.dock-btn').forEach((b) => {
      const active = b.dataset['mode'] === mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    saveState(state);
  }

  const popoutBtn = document.createElement('button');
  popoutBtn.type = 'button';
  popoutBtn.classList.add('popout-btn');
  popoutBtn.textContent = '⧉';
  popoutBtn.title = 'Open in its own window';
  popoutBtn.setAttribute('aria-label', 'Open Pangular Inspector in its own window');
  popoutBtn.addEventListener('click', () => void popOut(true));

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.classList.add('close-btn');
  closeBtn.innerHTML = '✕';
  closeBtn.title = 'Close';
  closeBtn.setAttribute('aria-label', 'Close Pangular Inspector');
  closeBtn.addEventListener('click', togglePanel);

  toolbar.title = 'Drag to move. Double click to reset the position.';
  toolbar.append(title, dockGroup, popoutBtn, closeBtn);

  // Iframe
  const iframe = document.createElement('iframe');
  iframe.classList.add('frame');
  iframe.title = 'Pangular Inspector';

  const missingStatus = document.createElement('span');
  missingStatus.classList.add('sr-only');
  missingStatus.setAttribute('role', 'status');
  const missing = document.createElement('div');
  missing.classList.add('missing');
  missing.setAttribute('role', 'region');
  missing.setAttribute('aria-labelledby', 'pangular-missing-title');
  missing.hidden = true;
  const missingTitle = document.createElement('h2');
  missingTitle.id = 'pangular-missing-title';
  missingTitle.classList.add('missing-title');
  missingTitle.textContent = 'No devtools server found';
  const missingHint = document.createElement('p');
  missingHint.textContent =
    'Mount the Pangular Inspector hub or the Vite plugin in your dev server, before the SSR handler. ' +
    'If it is mounted on a custom path, pass that path to initOverlay({baseURL}).';
  const setupLink = document.createElement('a');
  setupLink.href = SETUP_URL;
  setupLink.target = '_blank';
  setupLink.rel = 'noopener noreferrer';
  setupLink.textContent = 'How to set up Pangular Inspector';
  const newTab = document.createElement('span');
  newTab.classList.add('sr-only');
  newTab.textContent = ' (opens in a new tab)';
  setupLink.append(newTab);
  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.classList.add('retry');
  retryBtn.textContent = 'Try again';
  // The server may have started since; look for it again without a reload.
  retryBtn.addEventListener('click', () => {
    pendingFocus = true;
    load();
  });
  const missingActions = document.createElement('p');
  missingActions.classList.add('missing-actions');
  missingActions.append(retryBtn, setupLink);
  missing.append(missingTitle, missingHint, missingActions);

  // The splitter sits on the docked edge. It is a focusable separator, so the
  // size can be set with the keyboard as well as by dragging.
  panel.id = 'pangular-panel';
  const splitter = document.createElement('div');
  splitter.classList.add('splitter');
  splitter.setAttribute('role', 'separator');
  splitter.setAttribute('aria-label', 'Resize the panel');
  splitter.setAttribute('aria-controls', panel.id);
  splitter.title = 'Drag or use the arrow keys to resize. Double click to reset the size.';
  splitter.tabIndex = 0;
  splitter.hidden = true;

  // Says why the panel stayed in the page when the browser blocked the window.
  const notice = document.createElement('p');
  notice.classList.add('notice');
  notice.setAttribute('role', 'status');

  panel.append(splitter, toolbar, notice, iframe, missing, missingStatus);

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      color-scheme: light dark;
      --_bg:       #0f0f11;
      --_surface:  #18181b;
      --_border:   #27272a;
      --_text:     #d4d4d8;
      --_text-str: #fafafa;
      --_text-dim: #8a8a94;
      --_hover-bg: #27272a;
      --_hover-fg: #e4e4e7;
      --_shadow:   0 8px 32px rgba(0,0,0,0.5);
      --_accent:   var(--pangular-title, #f5a524);
      --_fab-open: #3f3f46;
    }
    @media (prefers-color-scheme: light) {
      :host(:not([data-theme='dark'])) {
        --_bg:       #ffffff;
        --_surface:  #f4f4f6;
        --_border:   #e2e2e7;
        --_text:     #18181b;
        --_text-str: #0a0a0d;
        --_text-dim: #52525b;
        --_hover-bg: #e8e8ec;
        --_hover-fg: #18181b;
        --_shadow:   0 4px 24px rgba(0,0,0,0.1);
        --_accent:   var(--pangular-title, #92400e);
        --_fab-open: #e4e4e7;
      }
    }
    :host([data-theme='light']) {
      --_bg:       #ffffff;
      --_surface:  #f4f4f6;
      --_border:   #e2e2e7;
      --_text:     #18181b;
      --_text-str: #0a0a0d;
      --_text-dim: #52525b;
      --_hover-bg: #e8e8ec;
      --_hover-fg: #18181b;
      --_shadow:   0 4px 24px rgba(0,0,0,0.1);
      --_accent:   var(--pangular-title, #92400e);
      --_fab-open: #e4e4e7;
    }
    .fab {
      position: fixed;
      z-index: 2147483646;
      inset: auto 16px 16px auto;
      margin: 0;
      padding: 0;
      overflow: visible;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      --_fab-bg: var(--pangular-accent, #f5a524);
      background: var(--_fab-bg);
      color: var(--pangular-accent-ink, #1c1300);
      cursor: pointer;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
      transition: transform 0.15s, filter 0.15s;
    }
    .fab:hover { filter: brightness(1.1); transform: scale(1.08); }
    .fab.passive { display: none; }
    .fab.open { --_fab-bg: var(--_fab-open); }
    .fab .ko { stroke: var(--_fab-bg); }
    .fab .ko-fill { fill: var(--_fab-bg); }
    .fab.dragging {
      transition: none;
      cursor: grabbing;
      transform: scale(1.06);
    }
    /* The shadow root cannot inherit the page's focus styles. */
    .dock-btn:focus-visible, .close-btn:focus-visible, .popout-btn:focus-visible {
      outline: 2px solid var(--_text-str);
      outline-offset: 2px;
    }
    /* The launcher sits on the host page, whose background is unknown, so the
       ring is drawn in both directions to stay visible either way. */
    .fab:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
      box-shadow: 0 0 0 4px #111827;
    }
    .panel {
      position: fixed;
      z-index: 2147483647;
      inset: auto;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(8px) scale(0.98);
      transform-origin: bottom right;
      transition: opacity 160ms ease, transform 160ms ease, visibility 0s linear 160ms;
      background: var(--_bg);
      border: 1px solid var(--_border);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: var(--_shadow);
      resize: both;
    }
    .panel.open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: none;
      transition: opacity 160ms ease, transform 160ms ease, visibility 0s;
    }
    :host([data-picking]) .panel.open {
      opacity: 0.2;
      pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .panel, .panel.open, .fab { transition: none; }
    }
    .panel.dock-float {
      border-radius: 10px;
      max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px);
    }
    .panel.dock-bottom {
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      top: auto !important;
      width: 100% !important;
      height: var(--_dock-size, 40vh) !important;
      border-radius: 10px 10px 0 0;
      resize: none;
    }
    .panel.dock-right {
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      left: auto !important;
      width: var(--_dock-size, 40vw) !important;
      height: 100% !important;
      border-radius: 10px 0 0 10px;
      resize: none;
    }
    .splitter {
      position: absolute;
      z-index: 1;
      background: transparent;
      touch-action: none;
      transition: background 150ms ease;
    }
    .splitter[hidden] { display: none; }
    .dock-bottom .splitter { top: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; }
    .dock-right .splitter { top: 0; bottom: 0; left: 0; width: 6px; cursor: ew-resize; }
    .splitter:hover, .resizing .splitter { background: var(--_accent); }
    .splitter:focus-visible {
      background: var(--_accent);
      outline: 2px solid var(--_text-str);
      outline-offset: -2px;
    }
    /* The frame would take the pointer while it crosses it. */
    .resizing .frame { pointer-events: none; }
    @media (prefers-reduced-motion: reduce) {
      .splitter { transition: none; }
    }
    .notice {
      margin: 0;
      padding: 6px 12px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: var(--_text);
      background: var(--_surface);
      border-bottom: 1px solid var(--_border);
    }
    .notice:empty { display: none; }
    .toolbar {
      cursor: grab;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--_surface);
      border-bottom: 1px solid var(--_border);
      user-select: none;
      touch-action: none;
      min-height: 36px;
    }
    .toolbar:active { cursor: grabbing; }
    .title {
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: var(--_accent);
      flex: 1;
    }
    .dock-group {
      display: flex;
      gap: 2px;
    }
    .dock-btn, .close-btn, .popout-btn {
      border: none;
      background: transparent;
      color: var(--_text-dim);
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      line-height: 1;
    }
    .dock-btn:hover, .close-btn:hover, .popout-btn:hover { background: var(--_hover-bg); color: var(--_hover-fg); }
    .dock-btn.active { color: var(--_accent); }
    .close-btn { font-size: 13px; }
    .frame {
      flex: 1;
      border: none;
      width: 100%;
      height: 100%;
      background: var(--_bg);
    }
    .frame[hidden], .missing[hidden] { display: none; }
    .missing {
      flex: 1;
      overflow: auto;
      padding: 24px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: var(--_text);
    }
    .missing p, .missing h2 { margin: 0 0 12px; max-width: 60ch; }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }
    .missing .missing-title { font-size: 15px; font-weight: 600; color: var(--_text-str); }
    .missing a { color: var(--_accent); }
    .missing a:focus-visible { outline: 2px solid var(--_text-str); outline-offset: 2px; }
    .missing .missing-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
    .retry {
      font: inherit;
      padding: 4px 12px;
      border: 1px solid var(--_border);
      border-radius: 6px;
      background: var(--_surface);
      color: var(--_text-str);
      cursor: pointer;
    }
    .retry:hover { background: var(--_hover-bg); color: var(--_hover-fg); }
    .retry:focus-visible { outline: 2px solid var(--_text-str); outline-offset: 2px; }
  `;

  fab.classList.add('fab');
  // Dialogs, popovers and CDK overlays sit in the top layer, above any
  // z-index, so the launcher and panel join it and stay reachable.
  const topLayer = typeof fab.showPopover === 'function';
  if (topLayer) {
    fab.setAttribute('popover', 'manual');
    panel.setAttribute('popover', 'manual');
  }
  shadow.append(style, fab, panel);
  document.body.appendChild(popupRoot);

  /** Shows the launcher and panel again, which puts them on top of the top layer. */
  function raise() {
    if (!topLayer) return;
    for (const el of [fab, panel]) {
      try {
        el.hidePopover();
        el.showPopover();
      } catch {
        // detached; the z-index still applies
      }
    }
  }
  raise();

  // A modal dialog makes the rest of the page inert, so the launcher could be
  // seen but not used above it; only popovers and overlays raise it.
  const onTopLayerOpen = (event: Event) => {
    if ((event as Event & { newState?: string }).newState !== 'open') return;
    const target = event.target as Element | null;
    if (!target || target === popupRoot) return;
    try {
      if (target.matches(':modal')) return;
    } catch {
      // `:modal` is unknown here, so it cannot be a modal dialog either
    }
    raise();
  };
  if (topLayer) document.addEventListener('toggle', onTopLayerOpen, true);

  // Drag support for floating mode. Pointer events with capture, so touch and
  // pen can move it too, and the drag survives the pointer leaving the toolbar.
  let drag: { id: number; offsetX: number; offsetY: number } | null = null;

  toolbar.addEventListener('pointerdown', (e) => {
    if (state.docked !== 'float' || drag) return;
    if ((e.target as Element | null)?.closest?.('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = {
      id: e.pointerId,
      offsetX: e.clientX - panel.offsetLeft,
      offsetY: e.clientY - panel.offsetTop,
    };
    try {
      toolbar.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone; the move events still reach the toolbar
    }
    e.preventDefault();
  });

  toolbar.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // Clamped at both ends: dragging the toolbar off the right or bottom edge
    // would leave the panel with no reachable handle.
    const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
    state.x = Math.min(Math.max(0, e.clientX - drag.offsetX), maxX);
    state.y = Math.min(Math.max(0, e.clientY - drag.offsetY), maxY);
    panel.style.left = state.x + 'px';
    panel.style.top = state.y + 'px';
  });

  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    saveState(state);
  };
  toolbar.addEventListener('pointerup', endDrag);
  toolbar.addEventListener('pointercancel', endDrag);
  toolbar.addEventListener('lostpointercapture', endDrag);

  // Dragging is not the only way to move it: a double click on the toolbar
  // puts the floating panel back in its default place.
  toolbar.addEventListener('dblclick', (e) => {
    if (state.docked !== 'float' || (e.target as Element | null)?.closest?.('button')) return;
    state.x = DEFAULT_STATE.x;
    state.y = DEFAULT_STATE.y;
    applyDock();
    saveState(state);
  });

  // Scoped to the popup's own chrome: a listener on the window would take
  // Escape away from the host application.
  // A search box with text clears itself on Escape, which is that key's whole
  // job there. By the time the event bubbles up the text is already gone, so
  // the box is looked at on the way down.
  const clearsField = new WeakSet<Event>();
  const noteSearchField = (event: Event) => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    const field = event.composedPath()[0] as Partial<HTMLInputElement> | undefined;
    if (field?.nodeName === 'INPUT' && field.type === 'search' && field.value) {
      clearsField.add(event);
    }
  };

  const onEscape = (event: Event) => {
    if (event.defaultPrevented || clearsField.has(event)) return;
    if ((event as KeyboardEvent).key === 'Escape' && isOpen) togglePanel();
  };
  popupRoot.addEventListener('keydown', onEscape);

  /** What had focus when the shortcut opened the panel. */
  let returnFocus: HTMLElement | null = null;

  /** Hides the launcher in passive mode while the panel is closed, if a shortcut can open it. */
  function applyPassive() {
    fab.classList.toggle('passive', !!state.passive && hotkey !== false && !isOpen);
  }

  const onHotkey = (event: Event) => {
    const key = event as KeyboardEvent;
    if (hotkey === false || key.repeat || !matchesHotkey(key, hotkey, isMac())) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isOpen) {
      const active = document.activeElement;
      returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
      togglePanel();
      focusWhenReady();
    } else {
      togglePanel();
    }
  };
  // Capture, so the app's own key handlers do not see the shortcut.
  window.addEventListener('keydown', onHotkey, true);
  rehotkey = applyPassive;

  // A key pressed inside the frame is delivered to the frame's own document
  // and never reaches the host, so Escape would not close the panel while the
  // devtools have focus. The frame is same origin, so it can be listened to.
  const hookedFrames = new WeakSet<HTMLIFrameElement>();
  const hookedDocs = new WeakSet<Document>();
  const hookFrame = (frame: HTMLIFrameElement) => {
    if (hookedFrames.has(frame)) return;
    hookedFrames.add(frame);
    const attach = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc || hookedDocs.has(doc)) return;
        hookedDocs.add(doc);
        doc.addEventListener('keydown', noteSearchField, true);
        doc.addEventListener('keydown', onEscape);
        doc.addEventListener('keydown', onHotkey, true);
        doc.querySelectorAll('iframe').forEach(hookFrame);
        new MutationObserver((records) => {
          for (const record of records) {
            record.addedNodes.forEach((node) => {
              if (node.nodeType !== Node.ELEMENT_NODE) return;
              const el = node as Element;
              if (el.nodeName === 'IFRAME') hookFrame(el as HTMLIFrameElement);
              else el.querySelectorAll('iframe').forEach(hookFrame);
            });
          }
        }).observe(doc, { childList: true, subtree: true });
      } catch {
        // a cross origin frame cannot be reached, and Escape stays host only
      }
    };
    frame.addEventListener('load', attach);
    attach();
  };
  hookFrame(iframe);

  function applyDock() {
    panel.className = `panel${isOpen ? ' open' : ''} dock-${state.docked}`;
    if (state.docked === 'float') {
      const width = Math.min(state.width, window.innerWidth - 16);
      const height = Math.min(state.height, window.innerHeight - 16);
      panel.style.left = Math.max(0, Math.min(state.x, window.innerWidth - width)) + 'px';
      panel.style.top = Math.max(0, Math.min(state.y, window.innerHeight - height)) + 'px';
      panel.style.width = state.width + 'px';
      panel.style.height = state.height + 'px';
    } else {
      panel.style.left = '';
      panel.style.top = '';
      panel.style.width = '';
      panel.style.height = '';
    }
    applySplitter();
  }

  /** Sizes a docked panel from the saved size, and gives the splitter its range. */
  function applySplitter() {
    const side = state.docked;
    splitter.hidden = side === 'float';
    if (side === 'float') {
      panel.style.removeProperty('--_dock-size');
      return;
    }
    const { min, max } = dockLimits(side);
    const size = clampDockSize(side, state.dockSize?.[side]);
    panel.style.setProperty('--_dock-size', `${size}px`);
    splitter.setAttribute('aria-orientation', side === 'bottom' ? 'horizontal' : 'vertical');
    splitter.setAttribute('aria-valuemin', String(min));
    splitter.setAttribute('aria-valuemax', String(max));
    splitter.setAttribute('aria-valuenow', String(size));
    splitter.setAttribute(
      'aria-valuetext',
      `${size} pixels ${side === 'bottom' ? 'high' : 'wide'}`,
    );
  }

  /** Sets the size of the docked side, inside the window; `undefined` goes back to the default. */
  function setDockSize(size: number | undefined) {
    const side = state.docked;
    if (side === 'float') return;
    const sizes = { ...state.dockSize };
    if (size === undefined) delete sizes[side];
    else sizes[side] = clampDockSize(side, size);
    state.dockSize = Object.keys(sizes).length ? sizes : undefined;
    applySplitter();
  }

  // Dragging the splitter. Pointer capture keeps the drag going when the
  // pointer crosses the frame or leaves the window.
  let resize: { id: number } | null = null;
  splitter.addEventListener('pointerdown', (e) => {
    if (state.docked === 'float' || resize) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    resize = { id: e.pointerId };
    panel.classList.add('resizing');
    try {
      splitter.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone; the move events still reach the splitter
    }
    e.preventDefault();
  });
  splitter.addEventListener('pointermove', (e) => {
    if (!resize || e.pointerId !== resize.id) return;
    setDockSize(
      state.docked === 'bottom' ? window.innerHeight - e.clientY : window.innerWidth - e.clientX,
    );
  });
  const endResize = (e: PointerEvent) => {
    if (!resize || e.pointerId !== resize.id) return;
    resize = null;
    panel.classList.remove('resizing');
    saveState(state);
  };
  splitter.addEventListener('pointerup', endResize);
  splitter.addEventListener('pointercancel', endResize);
  splitter.addEventListener('lostpointercapture', endResize);

  // The arrow keys along the splitter's axis move it, Shift moves it further,
  // and Home and End go to the smallest and largest size.
  splitter.addEventListener('keydown', (e) => {
    const side = state.docked;
    if (side === 'float') return;
    const step = e.shiftKey ? DOCK_STEP_LARGE : DOCK_STEP;
    const size = clampDockSize(side, state.dockSize?.[side]);
    const { min, max } = dockLimits(side);
    const grow = side === 'bottom' ? 'ArrowUp' : 'ArrowLeft';
    const shrink = side === 'bottom' ? 'ArrowDown' : 'ArrowRight';
    const next: Record<string, number> = {
      [grow]: size + step,
      [shrink]: size - step,
      Home: min,
      End: max,
    };
    if (!Object.hasOwn(next, e.key)) return;
    e.preventDefault();
    setDockSize(next[e.key]);
    saveState(state);
  });

  splitter.addEventListener('dblclick', () => {
    setDockSize(undefined);
    saveState(state);
  });

  /** The window the panel was popped out into, while it is open. */
  let outside: Window | null = null;
  /** The origin of the panel in that window, which its messages must come from. */
  let outsideOrigin = '';
  let outsideWatch: ReturnType<typeof setInterval> | undefined;

  /** Labels the launcher for what a click does: open the panel, or bring it back. */
  function applyOutside() {
    const label = outside
      ? 'Bring Pangular Inspector back into the page'
      : 'Toggle Pangular Inspector';
    fab.setAttribute('aria-label', label);
    fab.title = outside ? label : 'Pangular Inspector';
    fab.classList.toggle('outside', !!outside);
  }

  /** Forgets the pop-out window, closing it unless it is already closed. */
  function forgetOutside(close: boolean) {
    clearInterval(outsideWatch);
    outsideWatch = undefined;
    const win = outside;
    outside = null;
    if (close && win && !win.closed) {
      try {
        win.close();
      } catch {
        // a window the page can no longer reach
      }
    }
    applyOutside();
  }

  /**
   * Opens the panel in its own browser window, still on this page's id, and
   * closes it here. The launcher, the shortcut or the panel's **Back into the
   * page** command bring it back.
   */
  async function popOut(fromToolbar = false) {
    notice.textContent = '';
    const known = iframe.src && !iframe.hidden ? iframe.src : undefined;
    const width = Math.min(1200, Math.max(480, Math.round(window.outerWidth * 0.6) || 960));
    const height = Math.min(900, Math.max(360, Math.round(window.outerHeight * 0.8) || 720));
    const features = `popup,width=${width},height=${height}`;
    const closeQuietly = (w: Window | null) => {
      try {
        if (w && !w.closed) w.close();
      } catch {
        // the window is already gone
      }
    };
    let win: Window | null = null;
    // A pop-up blocker only allows window.open inside the click, so a toolbar
    // click that still has to look up the panel's address opens a blank window
    // first and points it at the panel once the address is known.
    if (fromToolbar && !known) {
      try {
        win = window.open('about:blank', popoutName(), features);
      } catch {
        win = null;
      }
    }
    const src = known ?? (await resolveTarget());
    if (src === null) {
      closeQuietly(win);
      notice.textContent = 'No devtools server found, so there is nothing to open.';
      return;
    }
    const url = popoutUrl(src);
    try {
      if (win) win.location.href = url;
      else win = window.open(url, popoutName(), features);
    } catch {
      closeQuietly(win);
      win = null;
    }
    if (!win) {
      notice.textContent =
        'The browser blocked the new window. Allow pop-ups for this site and try again.';
      return;
    }
    forgetOutside(false);
    outside = win;
    outsideOrigin = new URL(url, location.href).origin;
    applyOutside();
    // Closing the window by hand brings back the launcher's usual job.
    outsideWatch = setInterval(() => {
      if (outside?.closed) forgetOutside(false);
    }, 1000);
    if (isOpen) togglePanel();
    try {
      win.focus();
    } catch {
      // the browser decides which window has focus
    }
  }

  function togglePanel() {
    // Opening the panel here while it is popped out brings it back from the window.
    if (!isOpen && outside) forgetOutside(true);
    isOpen = !isOpen;
    fab.classList.toggle('open', isOpen);
    fab.setAttribute('aria-expanded', String(isOpen));
    panel.classList.toggle('open', isOpen);
    applyDock();
    applyPassive();
    // Closing hides the panel, so focus would fall to the body. Only take it
    // back when it was inside the popup: the host page may own it. The
    // shortcut gives it back to what had it before the panel opened.
    if (!isOpen && popupRoot?.contains(document.activeElement)) {
      const back = returnFocus;
      if (back?.isConnected) back.focus();
      else if (!fab.classList.contains('passive')) fab.focus();
    }
    if (!isOpen) {
      pendingFocus = false;
      returnFocus = null;
    }
    if (isOpen && !loaded) load();
  }

  let loaded = false;
  let loads = 0;
  /** Whether the frame finished loading its current `src`. */
  let frameReady = false;
  /** Set when a keyboard opened the panel before its content was there to focus. */
  let pendingFocus = false;
  /** Whether a lookup is running, so what the panel shows may be about to change. */
  let lookingUp = false;
  function load() {
    loaded = true;
    lookingUp = true;
    const run = ++loads;
    void resolveTarget().then((src) => {
      if (run !== loads) return;
      lookingUp = false;
      iframe.hidden = src === null;
      missing.hidden = src !== null;
      missingStatus.textContent = src === null ? 'No devtools server found' : '';
      if (src === null) loaded = false;
      else if (iframe.src !== src) {
        frameReady = false;
        iframe.src = src;
      }
      if (pendingFocus && (src === null || frameReady)) focusPanel();
    });
  }
  iframe.addEventListener('load', () => {
    frameReady = true;
    if (pendingFocus) focusPanel();
  });

  function focusWhenReady() {
    if (loaded && !lookingUp && (frameReady || !missing.hidden)) focusPanel();
    else pendingFocus = true;
  }

  /** Moves focus into the open panel: its content, the frame, or the setup link. */
  function focusPanel() {
    pendingFocus = false;
    if (!isOpen) return;
    if (!missing.hidden) {
      // After Try again finds nothing, focus stays on the button.
      if (!missing.contains(shadow.activeElement)) setupLink.focus();
      return;
    }
    try {
      const main = iframe.contentDocument?.querySelector<HTMLElement>('main');
      if (main) {
        main.focus();
        // A `<main>` that can't take focus, as on a page passed as `src`, leaves it on the frame.
        if (main.ownerDocument.activeElement === main) return;
      }
    } catch {
      // a cross origin frame: focus the frame itself
    }
    iframe.focus();
  }
  retarget = () => {
    loaded = false;
    loads++;
    if (isOpen) load();
  };

  // Dragging the launcher, so it can be left anywhere rather than only in a
  // corner. A press that does not move is a click, which still opens the panel.
  const DRAG_THRESHOLD = 4;
  const MARGIN = 8;
  let fabPointer: { id: number; offsetX: number; offsetY: number; moved: boolean } | null = null;
  let launcherAt: { x: number; y: number } | null = null;
  let suppressClick = false;

  fab.addEventListener('pointerdown', (event) => {
    // A second finger must not take over a drag that is already running.
    if (fabPointer) return;
    fabPointer = {
      id: event.pointerId,
      // Layout offsets, not the rendered box, which carries the hover scale.
      offsetX: event.clientX - fab.offsetLeft,
      offsetY: event.clientY - fab.offsetTop,
      moved: false,
    };
    try {
      fab.setPointerCapture(event.pointerId);
    } catch {
      // the pointer is already gone; the drag simply never starts
    }
  });

  fab.addEventListener('pointermove', (event) => {
    if (!fabPointer || event.pointerId !== fabPointer.id) return;
    // A mouse that comes back with no button held lost its capture somewhere.
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      cancelFabDrag();
      return;
    }
    const x = event.clientX - fabPointer.offsetX;
    const y = event.clientY - fabPointer.offsetY;

    if (!fabPointer.moved) {
      if (Math.hypot(x - fab.offsetLeft, y - fab.offsetTop) < DRAG_THRESHOLD) return;
      fabPointer.moved = true;
      fab.classList.add('dragging');
    }
    placeLauncher(x, y);
  });

  function cancelFabDrag() {
    fabPointer = null;
    fab.classList.remove('dragging');
  }

  const endFabDrag = (event: PointerEvent) => {
    if (!fabPointer || event.pointerId !== fabPointer.id) return;
    const moved = fabPointer.moved;
    cancelFabDrag();
    if (!moved) return;

    // A mouse drag is followed by a click, which must not also toggle. Touch
    // sends no such click, so the flag is cleared on the next frame rather
    // than left armed to swallow a later, unrelated activation.
    suppressClick = true;
    requestAnimationFrame(() => {
      suppressClick = false;
    });

    if (launcherAt) state.launcher = launcherAt;
    saveState(state);
  };

  fab.addEventListener('pointerup', endFabDrag);
  // A cancelled drag keeps whatever position it reached, but is not saved.
  fab.addEventListener('pointercancel', cancelFabDrag);
  fab.addEventListener('lostpointercapture', cancelFabDrag);

  // Keyboard activation of a button fires `click` with no pointer events, so
  // the toggle stays on `click` rather than on `pointerup`.
  fab.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    togglePanel();
    // A keyboard click has no pointer position, and its user expects focus to
    // follow into the panel they opened.
    if (isOpen && event.detail === 0) focusWhenReady();
  });

  /** Positions the launcher, keeping it fully on screen. */
  function placeLauncher(x: number, y: number) {
    const size = fab.offsetWidth;
    const left = Math.round(Math.min(Math.max(x, MARGIN), window.innerWidth - size - MARGIN));
    const top = Math.round(Math.min(Math.max(y, MARGIN), window.innerHeight - size - MARGIN));
    fab.style.inset = `${top}px auto auto ${left}px`;
    launcherAt = { x: left, y: top };
    return launcherAt;
  }

  function applyLauncher() {
    if (!state.launcher) return;
    placeLauncher(state.launcher.x, state.launcher.y);
  }

  // Dragging is not the only way to move it: arrow keys nudge it, and a
  // double click returns it to the default corner.
  fab.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 32 : 8;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = by[event.key];
    if (!move) return;
    event.preventDefault();
    state.launcher = placeLauncher(fab.offsetLeft + move[0], fab.offsetTop + move[1]);
    saveState(state);
  });

  fab.addEventListener('dblclick', () => {
    // The two clicks that make up a double click have already toggled the
    // panel twice, leaving it as it was; only the position resets.
    delete state.launcher;
    fab.style.inset = '';
    saveState(state);
  });

  const applyPopupTheme = (theme: unknown) => {
    const t = theme === 'light' ? 'light' : 'dark';
    popupRoot!.dataset['theme'] = t;
    if (state.theme !== t) {
      state.theme = t;
      saveState(state);
    }
  };
  if (state.theme) popupRoot.dataset['theme'] = state.theme;
  /** The panel's frame, or a frame inside it such as a hub dock, at the panel's origin. */
  const fromPanel = (e: MessageEvent) => {
    const panelWindow = iframe.contentWindow;
    if (!panelWindow || !e.source || !iframe.src) return false;
    try {
      if (e.origin !== new URL(iframe.src).origin) return false;
      let w = e.source as Window;
      while (w !== panelWindow) {
        if (w === w.parent) return false;
        w = w.parent;
      }
      return true;
    } catch {
      return false;
    }
  };
  const onThemeMessage = (e: MessageEvent) => {
    if (!fromPanel(e)) return;
    const msg = e.data as {
      type?: unknown;
      theme?: unknown;
      mode?: unknown;
      passive?: unknown;
    } | null;
    if (msg?.type === 'pangular:theme-change') applyPopupTheme(msg.theme);
    else if (msg?.type === 'pangular:popup-popout') void popOut();
    else if (msg?.type === 'pangular:popup-dock-size' && state.docked !== 'float') {
      setDockSize(undefined);
      saveState(state);
    } else if (msg?.type === 'pangular:popup-dock') {
      if (msg.mode === 'float' || msg.mode === 'bottom' || msg.mode === 'right') setDock(msg.mode);
    } else if (msg?.type === 'pangular:popup-close') {
      // The panel heard the shortcut inside a frame the popup can't listen to.
      if (isOpen) togglePanel();
    } else if (msg?.type === 'pangular:popup-passive' && typeof msg.passive === 'boolean') {
      state.passive = msg.passive || undefined;
      saveState(state);
      applyPassive();
    }
  };
  window.addEventListener('message', onThemeMessage);

  /** The pop-out window a message came from, itself or through a frame inside it. */
  const fromOutside = (e: MessageEvent): Window | null => {
    if (!e.source) return null;
    let w = e.source as Window;
    try {
      for (let depth = 0; depth < 10; depth++) {
        if (outside && w === outside) return e.origin === outsideOrigin ? w : null;
        // After a reload of this page the window is no longer known by
        // reference, but it still has the name this page gave it. Its name
        // can only be read on this page's origin.
        if (!outside && w.name === popoutName()) return e.origin === location.origin ? w : null;
        if (w === w.parent) return null;
        w = w.parent;
      }
    } catch {
      // a window on another origin, whose name can't be read
    }
    return null;
  };
  const onOutsideMessage = (e: MessageEvent) => {
    const type = (e.data as { type?: unknown } | null)?.type;
    if (type !== 'pangular:popup-return') return;
    const win = fromOutside(e);
    if (!win) return;
    outside = win;
    forgetOutside(true);
    if (!isOpen) togglePanel();
  };
  window.addEventListener('message', onOutsideMessage);

  applyLauncher();
  applyPassive();
  // Keep it reachable when the window changes size.
  window.addEventListener('resize', applyLauncher);
  window.addEventListener('resize', applyDock);
  // Track resize for float mode. Not every environment that has a document
  // also has ResizeObserver, so the panel still works without it.
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => {
          if (state.docked === 'float' && isOpen) {
            if (panel.offsetWidth < window.innerWidth - 16) state.width = panel.offsetWidth;
            if (panel.offsetHeight < window.innerHeight - 16) state.height = panel.offsetHeight;
            saveState(state);
          }
        });
  resizeObserver?.observe(panel);

  applyDock();

  handle = {
    toggle: togglePanel,
    destroy: () => {
      window.removeEventListener('message', onThemeMessage);
      window.removeEventListener('message', onOutsideMessage);
      clearInterval(outsideWatch);
      window.removeEventListener('keydown', onHotkey, true);
      rehotkey = undefined;
      window.removeEventListener('resize', applyLauncher);
      window.removeEventListener('resize', applyDock);
      document.removeEventListener('toggle', onTopLayerOpen, true);
      resizeObserver?.disconnect();
      popupRoot?.remove();
      popupRoot = null;
      handle = undefined;
      retarget = undefined;
      shown = undefined;
      isOpen = false;
    },
  };
  return handle;
}

// Auto-create when loaded as script
if (typeof document !== 'undefined' && !insideDevtoolsPanel()) {
  void showDevtools();
}
