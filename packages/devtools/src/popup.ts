export { registerNgrxSignals } from './ngrx-register.ts';
import { POPUP_ROOT_ID, SETUP_URL, insideDevtoolsPanel } from './panel-frame.ts';
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
const PANEL_BASES = ['/__pangular/', '/__devframes/pangular/', '/__devframe/', '/'];

/** The devtools URL the overlay connected to, which beats the default paths. */
let frameBase: string | undefined;
/** A `src` given to `createDevtoolsPopup`, which beats everything else. */
let explicitSrc: string | undefined;
/** What the panel loads: a hub or panel URL, or `null` when no server answered. */
let target: Promise<string | null> | undefined;
let retarget: (() => void) | undefined;

async function servesJson(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok && (response.headers.get('content-type') ?? '').includes('json');
  } catch {
    return false;
  }
}

function panelUrl(base: string): string {
  let pageId = '';
  try {
    pageId = sessionStorage.getItem('pangular-page-id') ?? '';
  } catch {
    // Storage can be blocked; the panel then shows the latest page.
  }
  return `${base}?baseURL=${encodeURIComponent(base)}&pageId=${encodeURIComponent(pageId)}`;
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
  for (const base of PANEL_BASES) {
    for (const file of ['__devframe/__connection.json', '__connection.json']) {
      if (await servesJson(`${origin}${base}${file}`)) return panelUrl(`${origin}${base}`);
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
export function createDevtoolsPopup(options: { src?: string } = {}) {
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
  // The Angular shield, from the wordmark on angular.dev.
  fab.innerHTML =
    `<svg width="22" height="22" viewBox="0 0 223 236" fill="currentColor" aria-hidden="true">` +
    `<path d="m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056` +
    `-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358` +
    `-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z"/></svg>`;

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
  title.textContent = 'Remember, we need to find a new name. Help us pls';

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
    btn.addEventListener('click', () => {
      state.docked = mode;
      applyDock();
      dockGroup.querySelectorAll('.dock-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      saveState(state);
    });
    dockGroup.appendChild(btn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.classList.add('close-btn');
  closeBtn.innerHTML = '✕';
  closeBtn.title = 'Close';
  closeBtn.setAttribute('aria-label', 'Close Pangular Inspector');
  closeBtn.addEventListener('click', togglePanel);

  toolbar.title = 'Drag to move. Double click to reset the position.';
  toolbar.append(title, dockGroup, closeBtn);

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
  missing.append(missingTitle, missingHint, setupLink);

  panel.append(toolbar, iframe, missing, missingStatus);

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
      background: var(--pangular-accent, #f5a524);
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
    .fab.open { background: var(--_fab-open); }
    .fab.dragging {
      transition: none;
      cursor: grabbing;
      transform: scale(1.06);
    }
    /* The shadow root cannot inherit the page's focus styles. */
    .dock-btn:focus-visible, .close-btn:focus-visible {
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
      height: 40vh !important;
      border-radius: 10px 10px 0 0;
      resize: vertical;
    }
    .panel.dock-right {
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      left: auto !important;
      width: 40vw !important;
      height: 100% !important;
      border-radius: 10px 0 0 10px;
      resize: horizontal;
    }
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
    .dock-btn, .close-btn {
      border: none;
      background: transparent;
      color: var(--_text-dim);
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      line-height: 1;
    }
    .dock-btn:hover, .close-btn:hover { background: var(--_hover-bg); color: var(--_hover-fg); }
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
  }

  function togglePanel() {
    isOpen = !isOpen;
    fab.classList.toggle('open', isOpen);
    fab.setAttribute('aria-expanded', String(isOpen));
    panel.classList.toggle('open', isOpen);
    applyDock();
    // Closing hides the panel, so focus would fall to the body. Only take it
    // back when it was inside the popup: the host page may own it.
    if (!isOpen && popupRoot?.contains(document.activeElement)) fab.focus();
    if (isOpen && !loaded) load();
  }

  let loaded = false;
  let loads = 0;
  function load() {
    loaded = true;
    const run = ++loads;
    void resolveTarget().then((src) => {
      if (run !== loads) return;
      iframe.hidden = src === null;
      missing.hidden = src !== null;
      missingStatus.textContent = src === null ? 'No devtools server found' : '';
      if (src === null) loaded = false;
      else if (iframe.src !== src) iframe.src = src;
    });
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
  fab.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    togglePanel();
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
  const onThemeMessage = (e: MessageEvent) => {
    if (e.source === window) return;
    const msg = e.data as { type?: unknown; theme?: unknown } | null;
    if (msg?.type !== 'pangular:theme-change') return;
    applyPopupTheme(msg.theme);
  };
  window.addEventListener('message', onThemeMessage);

  applyLauncher();
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
