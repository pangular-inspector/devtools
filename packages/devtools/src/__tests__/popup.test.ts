// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The module auto-creates on import and keeps a single instance, so each test
 * needs it loaded afresh. */
const json = () => new Response('{}', { headers: { 'content-type': 'application/json' } });
const notFound = () => new Response('', { status: 404 });
const spaFallback = () =>
  new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });

async function loadPopup(hub: boolean | ((url: string) => Response) = false) {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  vi.resetModules();
  const respond = typeof hub === 'function' ? hub : hub ? json : notFound;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => respond(url)),
  );
  const popup = await import('../popup.ts');
  await popup.showDevtools();
  return popup;
}

function frame() {
  return document
    .getElementById('pangular-popup-root')!
    .shadowRoot!.querySelector('iframe') as HTMLIFrameElement;
}

async function openedSrc() {
  parts().fab.click();
  await vi.waitFor(() => expect(frame().src).not.toBe(''));
  return frame().src;
}

function parts() {
  const host = document.getElementById('pangular-popup-root')!;
  const shadow = host.shadowRoot!;
  return {
    fab: shadow.querySelector('.fab') as HTMLButtonElement,
    panel: shadow.querySelector('.panel') as HTMLElement,
    toolbar: shadow.querySelector('.toolbar') as HTMLElement,
    dock: (mode: string) =>
      shadow.querySelector(`.dock-btn[aria-label="Dock ${mode}"]`) as HTMLButtonElement,
  };
}

/** jsdom has no PointerEvent, so a mouse event carries the pointer fields. */
function pointer(type: string, x: number, y: number, pointerType = 'touch') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  });
  return event;
}

function stored() {
  return JSON.parse(localStorage.getItem('pangular-popup') ?? '{}');
}

/** Hooks the frame to a document the test controls, as a same origin frame is. */
async function frameDocument() {
  await openedSrc();
  const inner = document.createElement('iframe');
  document.body.appendChild(inner);
  const doc = inner.contentDocument!;
  Object.defineProperty(frame(), 'contentDocument', { get: () => doc });
  frame().dispatchEvent(new Event('load'));
  return doc;
}

// One document and one localStorage, so these share state by nature.
describe.sequential('devtools popup', () => {
  beforeEach(() => localStorage.clear());

  it('opens the whole hub from the launcher when a hub is mounted', async () => {
    await loadPopup(true);
    expect(await openedSrc()).toBe(`${location.origin}/__devframes/`);
    expect(document.head.querySelector('script[src="/__devframes/embedded.js"]')).toBeNull();
  });

  it('closes on Escape pressed inside a dock frame nested in the hub', async () => {
    await loadPopup(true);
    const { panel } = parts();
    await openedSrc();
    const frame = document
      .getElementById('pangular-popup-root')!
      .shadowRoot!.querySelector('iframe') as HTMLIFrameElement;
    const viewerFrame = document.createElement('iframe');
    document.body.appendChild(viewerFrame);
    const viewer = viewerFrame.contentDocument!;
    Object.defineProperty(frame, 'contentDocument', { get: () => viewer });
    frame.dispatchEvent(new Event('load'));
    const dock = viewer.createElement('iframe');
    viewer.body.appendChild(dock);
    await new Promise((resolve) => setTimeout(resolve));
    dock.contentDocument!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(panel.classList.contains('open')).toBe(false);
  });

  it('mounts even when the stored state is unusable', async () => {
    for (const stored of ['null', '123', '"float"', '[]', '{not json', '{"launcher":{}}']) {
      localStorage.setItem('pangular-popup', stored);
      await loadPopup();
      const { fab } = parts();
      expect(fab, `stored: ${stored}`).toBeTruthy();
      expect(fab.style.inset).not.toContain('NaN');
    }
  });

  it('opens and closes on click, which is what a keyboard sends', async () => {
    await loadPopup();
    const { fab, panel } = parts();
    fab.click();
    expect(panel.classList.contains('open')).toBe(true);
    expect(fab.getAttribute('aria-expanded')).toBe('true');
    fab.click();
    expect(panel.classList.contains('open')).toBe(false);
  });

  it('moves focus into the panel when a keyboard opens it', async () => {
    await loadPopup(true);
    const { fab } = parts();
    fab.focus();
    // A click from the keyboard has no pointer, so its detail is 0.
    fab.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await vi.waitFor(() => expect(frame().src).not.toBe(''));
    frame().dispatchEvent(new Event('load'));

    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    expect(shadow.activeElement).toBe(frame());
  });

  it('waits for a new lookup before moving focus after one found nothing', async () => {
    let up = false;
    await loadPopup(() => (up ? json() : spaFallback()));
    const { fab } = parts();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    const missing = shadow.querySelector<HTMLElement>('.missing')!;
    fab.click();
    await vi.waitFor(() => expect(missing.hidden).toBe(false));
    fab.click();

    up = true;
    fab.focus();
    fab.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await vi.waitFor(() => expect(missing.hidden).toBe(true));
    frame().dispatchEvent(new Event('load'));
    expect(shadow.activeElement).toBe(frame());
  });

  it('focuses the frame when its main element cannot take focus', async () => {
    await loadPopup(true);
    const doc = await frameDocument();
    const main = doc.createElement('main');
    doc.body.appendChild(main);
    const { fab } = parts();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    const reopen = () => {
      fab.click();
      fab.focus();
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    };

    reopen();
    expect(shadow.activeElement).toBe(frame());

    main.tabIndex = -1;
    reopen();
    expect(doc.activeElement).toBe(main);
  });

  it('leaves focus alone when a pointer opens the panel', async () => {
    await loadPopup(true);
    const { fab } = parts();
    fab.focus();
    fab.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await vi.waitFor(() => expect(frame().src).not.toBe(''));
    frame().dispatchEvent(new Event('load'));

    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    expect(shadow.activeElement).toBe(fab);
  });

  it('moves the launcher with the arrow keys and remembers where it went', async () => {
    await loadPopup();
    const { fab } = parts();
    fab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('pangular-popup')!);
    expect(Number.isFinite(saved.launcher.x)).toBe(true);
    expect(Number.isFinite(saved.launcher.y)).toBe(true);
  });

  it('keeps the launcher on screen', async () => {
    localStorage.setItem(
      'pangular-popup',
      JSON.stringify({ launcher: { x: 99999, y: 99999 }, docked: 'float' }),
    );
    await loadPopup();
    const { fab } = parts();
    const [top, , , left] = fab.style.inset.split(' ');
    expect(parseInt(left, 10)).toBeLessThan(window.innerWidth);
    expect(parseInt(top, 10)).toBeLessThan(window.innerHeight);
  });

  it('labels the panel and its controls', async () => {
    await loadPopup();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    expect(shadow.querySelector('.panel')!.getAttribute('aria-label')).toBeTruthy();
    expect(shadow.querySelector('.frame')!.getAttribute('title')).toBeTruthy();
    expect(shadow.querySelector('.dock-btn')!.getAttribute('aria-label')).toBeTruthy();
    expect(shadow.querySelector('.close-btn')!.getAttribute('aria-label')).toBeTruthy();
  });

  it('shows the product name in the toolbar', async () => {
    await loadPopup();
    expect(parts().toolbar.querySelector('.title')!.textContent).toBe('Pangular Inspector');
  });

  it('opens the hub on the custom base the overlay connected to', async () => {
    const popup = await loadPopup((url) =>
      url === `${location.origin}/__tools/__connection.json` ? json() : notFound(),
    );
    popup.useDevtoolsBase('/__tools/pangular/');
    expect(await openedSrc()).toBe(`${location.origin}/__tools/`);
  });

  it('opens the panel alone on a custom base without a hub', async () => {
    const popup = await loadPopup();
    popup.useDevtoolsBase('/__my-devtools/');
    const src = new URL(await openedSrc());
    expect(src.pathname).toBe('/__my-devtools/');
    expect(src.searchParams.get('baseURL')).toBe(`${location.origin}/__my-devtools/`);
  });

  it('follows a base that arrives after the panel opened', async () => {
    const popup = await loadPopup((url) => (url.includes('/__tools/') ? json() : notFound()));
    parts().fab.click();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    await vi.waitFor(() =>
      expect(shadow.querySelector<HTMLElement>('.missing')!.hidden).toBe(false),
    );
    popup.useDevtoolsBase('/__tools/pangular/');
    await vi.waitFor(() => expect(frame().src).toBe(`${location.origin}/__tools/`));
    expect(shadow.querySelector<HTMLElement>('.missing')!.hidden).toBe(true);
  });

  it('still finds the hub when createDevtoolsPopup runs first', async () => {
    document.body.innerHTML = '';
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return json();
      }),
    );
    const popup = await import('../popup.ts');
    const handle = popup.createDevtoolsPopup();
    await popup.showDevtools();
    expect(popup.createDevtoolsPopup()).toBe(handle);
    expect(await openedSrc()).toBe(`${location.origin}/__devframes/`);
  });

  it('applies a src passed to a later createDevtoolsPopup call', async () => {
    const popup = await loadPopup(true);
    popup.createDevtoolsPopup({ src: '/__custom-hub/' });
    expect(await openedSrc()).toBe(`${location.origin}/__custom-hub/`);
  });

  it('says no server was found instead of loading the app in the panel', async () => {
    await loadPopup(spaFallback);
    parts().fab.click();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    const missing = shadow.querySelector<HTMLElement>('.missing')!;
    await vi.waitFor(() => expect(missing.hidden).toBe(false));
    expect(missing.textContent).toContain('No devtools server found');
    expect(missing.querySelector('a')!.getAttribute('href')).toMatch(/^https:/);
    expect(missing.querySelector('h2')!.id).toBe(missing.getAttribute('aria-labelledby'));
    expect(missing.querySelector('a')!.textContent).toContain('opens in a new tab');
    expect(shadow.querySelector('.sr-only[role="status"]')!.textContent).toBe(
      'No devtools server found',
    );
    expect(frame().hidden).toBe(true);
    expect(frame().getAttribute('src')).toBeNull();
  });

  it('looks for the server again from Try again, without a reload', async () => {
    let up = false;
    await loadPopup(() => (up ? json() : spaFallback()));
    parts().fab.click();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    const missing = shadow.querySelector<HTMLElement>('.missing')!;
    await vi.waitFor(() => expect(missing.hidden).toBe(false));

    const retry = shadow.querySelector<HTMLButtonElement>('.missing button')!;
    expect(retry.textContent).toBe('Try again');
    const looked = vi.mocked(fetch).mock.calls.length;
    retry.focus();
    retry.click();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(looked * 2));
    expect(missing.hidden).toBe(false);
    expect(shadow.activeElement).toBe(retry);

    up = true;
    retry.click();
    await vi.waitFor(() => expect(missing.hidden).toBe(true));
    expect(frame().src).toBe(`${location.origin}/__devframes/`);
  });

  it('keeps the floating panel inside a narrow window', async () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    window.innerWidth = 360;
    window.innerHeight = 640;
    localStorage.setItem(
      'pangular-popup',
      JSON.stringify({ x: 600, y: 500, width: 720, height: 480, docked: 'float' }),
    );
    try {
      await loadPopup(true);
      parts().fab.click();
      const panel = parts().panel;
      expect(parseInt(panel.style.left, 10)).toBe(16);
      expect(parseInt(panel.style.top, 10)).toBe(160);
    } finally {
      window.innerWidth = width;
      window.innerHeight = height;
    }
  });

  it('brings a panel stored off screen back inside the window, and keeps it there on resize', async () => {
    const width = window.innerWidth;
    localStorage.setItem(
      'pangular-popup',
      JSON.stringify({ x: 3000, y: 3000, width: 720, height: 480, docked: 'float' }),
    );
    try {
      await loadPopup(true);
      parts().fab.click();
      const { panel } = parts();
      expect(parseInt(panel.style.left, 10)).toBe(window.innerWidth - 720);
      expect(parseInt(panel.style.top, 10)).toBe(window.innerHeight - 480);

      window.innerWidth = 360;
      window.dispatchEvent(new Event('resize'));
      expect(parseInt(panel.style.left, 10)).toBe(16);
      expect(stored().width ?? 720).toBe(720);
    } finally {
      window.innerWidth = width;
    }
  });

  it('drags the floating panel by touch and remembers where it went', async () => {
    await loadPopup(true);
    parts().fab.click();
    const { panel, toolbar } = parts();
    const css = toolbar.getRootNode() as ShadowRoot;
    expect(css.querySelector('style')!.textContent).toMatch(/\.toolbar \{[^}]*touch-action: none/);
    toolbar.dispatchEvent(pointer('pointerdown', 40, 40));
    toolbar.dispatchEvent(pointer('pointermove', 140, 90));
    toolbar.dispatchEvent(pointer('pointerup', 140, 90));
    expect(panel.style.left).toBe('100px');
    expect(panel.style.top).toBe('50px');
    expect(stored()).toMatchObject({ x: 100, y: 50 });
  });

  it('does not start a drag from the dock or close buttons', async () => {
    await loadPopup(true);
    parts().fab.click();
    const { panel, dock } = parts();
    const before = panel.style.left;
    dock('right').dispatchEvent(pointer('pointerdown', 40, 40, 'mouse'));
    parts().toolbar.dispatchEvent(pointer('pointermove', 240, 240, 'mouse'));
    expect(panel.style.left).toBe(before);
  });

  it('puts the panel back in its default place on a double click of the toolbar', async () => {
    localStorage.setItem(
      'pangular-popup',
      JSON.stringify({ x: 200, y: 150, width: 300, height: 200, docked: 'float' }),
    );
    await loadPopup(true);
    parts().fab.click();
    const { panel, toolbar } = parts();
    expect(panel.style.left).toBe('200px');
    toolbar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(panel.style.left).toBe('16px');
    expect(panel.style.top).toBe('16px');
    expect(stored()).toMatchObject({ x: 16, y: 16 });
  });

  it('switches docking and returns to the floating place', async () => {
    localStorage.setItem(
      'pangular-popup',
      JSON.stringify({ x: 50, y: 60, width: 300, height: 200, docked: 'float' }),
    );
    await loadPopup(true);
    parts().fab.click();
    const { panel, dock } = parts();
    dock('bottom').click();
    expect(panel.classList.contains('dock-bottom')).toBe(true);
    expect(panel.style.left).toBe('');
    expect(dock('bottom').getAttribute('aria-pressed')).toBe('true');
    dock('float').click();
    expect(panel.classList.contains('dock-float')).toBe(true);
    expect(panel.style.left).toBe('50px');
    expect(stored().docked).toBe('float');
  });

  it('draws no resize grip on a docked panel, which the splitter resizes', async () => {
    await loadPopup(true);
    const sheet = document
      .getElementById('pangular-popup-root')!
      .shadowRoot!.querySelector('style')!.textContent!;
    for (const mode of ['bottom', 'right']) {
      const rule = new RegExp(`\\.panel\\.dock-${mode}\\s*\\{([^}]*)\\}`).exec(sheet)![1];
      expect(rule).toContain('!important');
      expect(rule).toMatch(/resize\s*:\s*none/);
    }
  });

  it('lets Escape clear a search box in the frame without closing the panel', async () => {
    await loadPopup(true);
    const doc = await frameDocument();
    const { panel } = parts();
    const search = doc.createElement('input');
    search.type = 'search';
    search.value = 'card';
    search.addEventListener('keydown', () => (search.value = ''));
    doc.body.appendChild(search);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(search.value).toBe('');
    expect(panel.classList.contains('open')).toBe(true);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.classList.contains('open')).toBe(false);
  });

  describe('top layer', () => {
    let shown: Element[] = [];
    beforeEach(() => {
      shown = [];
      HTMLElement.prototype.showPopover = function (this: HTMLElement) {
        shown.push(this);
      };
      HTMLElement.prototype.hidePopover = function () {};
    });
    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
    });

    it('shows the launcher and panel as popovers, and again above a popover that opens', async () => {
      await loadPopup(true);
      const { fab, panel } = parts();
      expect(fab.getAttribute('popover')).toBe('manual');
      expect(panel.getAttribute('popover')).toBe('manual');
      expect(shown).toEqual([fab, panel]);

      const menu = document.createElement('div');
      document.body.appendChild(menu);
      shown = [];
      menu.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }));
      expect(shown).toEqual([fab, panel]);

      shown = [];
      menu.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
      expect(shown).toEqual([]);
    });

    it('stays below a modal dialog, which makes it inert anyway', async () => {
      await loadPopup(true);
      const dialog = document.createElement('dialog');
      dialog.matches = ((selector: string): boolean =>
        selector === ':modal') as typeof dialog.matches;
      document.body.appendChild(dialog);
      shown = [];
      dialog.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }));
      expect(shown).toEqual([]);
    });
  });

  describe('theme sync', () => {
    const root = () => document.getElementById('pangular-popup-root')!;
    /** jsdom gives a frame in a shadow root no window, so the panel gets a stand-in. */
    const panelWindow = { postMessage: () => {} } as unknown as Window;
    Object.defineProperty(panelWindow, 'parent', { value: window });
    const open = async () => {
      await openedSrc();
      Object.defineProperty(frame(), 'contentWindow', { get: () => panelWindow });
    };
    const send = (
      data: unknown,
      source: MessageEventSource | null = panelWindow,
      origin = location.origin,
    ) => window.dispatchEvent(new MessageEvent('message', { data, source, origin }));

    it('follows the theme the panel posts and restores it on the next open', async () => {
      await loadPopup(true);
      await open();
      send({ type: 'pangular:theme-change', theme: 'light' });

      expect(root().dataset['theme']).toBe('light');
      expect(stored().theme).toBe('light');

      await loadPopup(true);
      expect(root().dataset['theme']).toBe('light');
    });

    it('pins dark when the panel switches back, so a light system does not win', async () => {
      await loadPopup(true);
      await open();
      send({ type: 'pangular:theme-change', theme: 'light' });
      send({ type: 'pangular:theme-change', theme: 'dark' });

      expect(root().dataset['theme']).toBe('dark');
      expect(stored().theme).toBe('dark');
    });

    it('ignores its own window and other message types', async () => {
      await loadPopup(true);
      send({ type: 'pangular:theme-change', theme: 'light' }, window);
      send({ type: 'other', theme: 'light' });

      expect(root().dataset['theme']).toBeUndefined();
    });

    it('follows a frame inside the panel, such as a hub dock', async () => {
      await loadPopup(true);
      await open();
      const dock = {} as Window;
      Object.defineProperty(dock, 'parent', { value: panelWindow });
      send({ type: 'pangular:theme-change', theme: 'light' }, dock);

      expect(root().dataset['theme']).toBe('light');
    });

    it('ignores other frames on the page and messages from another origin', async () => {
      await loadPopup(true);
      await open();
      const stray = document.createElement('iframe');
      document.body.appendChild(stray);
      send({ type: 'pangular:theme-change', theme: 'light' }, stray.contentWindow);
      send({ type: 'pangular:theme-change', theme: 'light' }, undefined, 'https://evil.test');

      expect(root().dataset['theme']).toBeUndefined();
      expect(stored().theme).toBeUndefined();
    });
  });
  describe('shortcut and passive mode', () => {
    const press = (target: EventTarget = document.body, init: KeyboardEventInit = {}) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'p',
          code: 'KeyP',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      );
    const panelWindow = { postMessage: () => {} } as unknown as Window;
    Object.defineProperty(panelWindow, 'parent', { value: window });
    const send = (data: unknown) =>
      window.dispatchEvent(
        new MessageEvent('message', { data, source: panelWindow, origin: location.origin }),
      );

    it('opens and closes the panel with Alt+Shift+P, and gives focus back', async () => {
      await loadPopup();
      const { panel } = parts();
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      press(input);
      expect(panel.classList.contains('open')).toBe(true);
      press(input, { altKey: false });
      expect(panel.classList.contains('open')).toBe(true);
      press();
      expect(panel.classList.contains('open')).toBe(false);
    });

    it('follows a shortcut from the config, and none when it is off', async () => {
      const popup = await loadPopup();
      const { panel } = parts();
      popup.setPopupHotkey('Mod+Shift+K');
      press();
      expect(panel.classList.contains('open')).toBe(false);
      press(document.body, { key: 'k', code: 'KeyK', altKey: false, ctrlKey: true });
      expect(panel.classList.contains('open')).toBe(true);
      popup.setPopupHotkey(false);
      press(document.body, { key: 'k', code: 'KeyK', altKey: false, ctrlKey: true });
      expect(panel.classList.contains('open')).toBe(true);
      popup.setPopupHotkey('Alt+Shift+P');
    });

    it('hides the launcher in passive mode until the shortcut opens the panel', async () => {
      localStorage.setItem('pangular-popup', JSON.stringify({ passive: true }));
      const popup = await loadPopup();
      const { fab } = parts();
      expect(fab.classList.contains('passive')).toBe(true);
      press();
      expect(fab.classList.contains('passive')).toBe(false);
      press();
      expect(fab.classList.contains('passive')).toBe(true);
      // Without a shortcut nothing could open it, so the launcher shows.
      popup.setPopupHotkey(false);
      expect(fab.classList.contains('passive')).toBe(false);
      popup.setPopupHotkey('Alt+Shift+P');
    });

    it('takes passive mode and the dock mode from the panel', async () => {
      await loadPopup(true);
      await openedSrc();
      Object.defineProperty(frame(), 'contentWindow', { get: () => panelWindow });
      const { fab, panel, dock } = parts();
      send({ type: 'pangular:popup-dock', mode: 'right' });
      expect(panel.classList.contains('dock-right')).toBe(true);
      expect(dock('right').getAttribute('aria-pressed')).toBe('true');
      expect(dock('float').getAttribute('aria-pressed')).toBe('false');
      send({ type: 'pangular:popup-passive', passive: true });
      expect(stored().passive).toBe(true);
      // The panel is open, so the launcher stays until it closes.
      expect(fab.classList.contains('passive')).toBe(false);
      fab.click();
      expect(fab.classList.contains('passive')).toBe(true);
      send({ type: 'pangular:popup-passive', passive: false });
      expect(fab.classList.contains('passive')).toBe(false);
      expect(stored().passive).toBeUndefined();
    });

    it('closes when the panel heard the shortcut', async () => {
      await loadPopup(true);
      await openedSrc();
      Object.defineProperty(frame(), 'contentWindow', { get: () => panelWindow });
      const { panel } = parts();
      expect(panel.classList.contains('open')).toBe(true);
      send({ type: 'pangular:popup-close' });
      expect(panel.classList.contains('open')).toBe(false);
      // Only the panel's own frame may ask.
      parts().fab.click();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'pangular:popup-close' },
          source: window,
          origin: location.origin,
        }),
      );
      expect(panel.classList.contains('open')).toBe(true);
    });
  });
  describe('splitter', () => {
    const splitter = () =>
      document
        .getElementById('pangular-popup-root')!
        .shadowRoot!.querySelector('.splitter') as HTMLElement;
    const key = (k: string, init: KeyboardEventInit = {}) =>
      splitter().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));
    const docked = async (mode: 'bottom' | 'right') => {
      await loadPopup(true);
      parts().fab.click();
      parts().dock(mode).click();
    };

    it('is a focusable separator on the docked edge only', async () => {
      await loadPopup(true);
      parts().fab.click();
      expect(splitter().hidden).toBe(true);
      parts().dock('bottom').click();
      const el = splitter();
      expect(el.hidden).toBe(false);
      expect(el.getAttribute('role')).toBe('separator');
      expect(el.tabIndex).toBe(0);
      expect(el.getAttribute('aria-label')).toBe('Resize the panel');
      expect(el.getAttribute('aria-orientation')).toBe('horizontal');
      expect(el.getAttribute('aria-controls')).toBe(parts().panel.id);
      // jsdom's window is 1024 by 768: 40% of its height, inside 120 and 768 - 48.
      expect(el.getAttribute('aria-valuenow')).toBe(String(Math.round(768 * 0.4)));
      expect(el.getAttribute('aria-valuemin')).toBe('120');
      expect(el.getAttribute('aria-valuemax')).toBe('720');
      expect(el.getAttribute('aria-valuetext')).toBe('307 pixels high');
      parts().dock('right').click();
      expect(el.getAttribute('aria-orientation')).toBe('vertical');
      expect(el.getAttribute('aria-valuemin')).toBe('280');
      expect(el.getAttribute('aria-valuemax')).toBe('976');
    });

    it('resizes a bottom dock with Up, Down, Home and End, and remembers the size', async () => {
      await docked('bottom');
      key('ArrowUp');
      expect(splitter().getAttribute('aria-valuenow')).toBe('323');
      expect(parts().panel.style.getPropertyValue('--_dock-size')).toBe('323px');
      key('ArrowDown', { shiftKey: true });
      expect(splitter().getAttribute('aria-valuenow')).toBe('259');
      // The other axis does nothing on a horizontal splitter.
      key('ArrowLeft');
      expect(splitter().getAttribute('aria-valuenow')).toBe('259');
      key('Home');
      expect(splitter().getAttribute('aria-valuenow')).toBe('120');
      key('ArrowDown');
      expect(splitter().getAttribute('aria-valuenow')).toBe('120');
      key('End');
      expect(splitter().getAttribute('aria-valuenow')).toBe('720');
      expect(stored().dockSize).toEqual({ bottom: 720 });

      await loadPopup(true);
      parts().fab.click();
      expect(splitter().getAttribute('aria-valuenow')).toBe('720');
    });

    it('keeps a size for each side, and Left grows a right dock', async () => {
      await docked('right');
      key('ArrowLeft');
      expect(splitter().getAttribute('aria-valuenow')).toBe(String(Math.round(1024 * 0.4) + 16));
      parts().dock('bottom').click();
      key('ArrowUp');
      expect(stored().dockSize).toEqual({ right: 426, bottom: 323 });
    });

    it('resizes by dragging and goes back to the default on a double click', async () => {
      await docked('right');
      const { panel } = parts();
      splitter().dispatchEvent(pointer('pointerdown', 600, 300, 'mouse'));
      expect(panel.classList.contains('resizing')).toBe(true);
      splitter().dispatchEvent(pointer('pointermove', 500, 300, 'mouse'));
      expect(splitter().getAttribute('aria-valuenow')).toBe('524');
      // Dragging past the window edge stops at the largest size.
      splitter().dispatchEvent(pointer('pointermove', -50, 300, 'mouse'));
      expect(splitter().getAttribute('aria-valuenow')).toBe('976');
      splitter().dispatchEvent(pointer('pointerup', -50, 300, 'mouse'));
      expect(panel.classList.contains('resizing')).toBe(false);
      expect(stored().dockSize).toEqual({ right: 976 });
      splitter().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(stored().dockSize).toBeUndefined();
      expect(splitter().getAttribute('aria-valuenow')).toBe('410');
    });

    it('keeps a saved size inside a smaller window', async () => {
      localStorage.setItem(
        'pangular-popup',
        JSON.stringify({ docked: 'bottom', dockSize: { bottom: 5000, right: 'x' } }),
      );
      await loadPopup(true);
      parts().fab.click();
      expect(splitter().getAttribute('aria-valuenow')).toBe('720');
      // A size that is not a number is dropped, so that side opens at the default.
      parts().dock('right').click();
      expect(splitter().getAttribute('aria-valuenow')).toBe('410');
    });
  });

  describe('pop-out window', () => {
    const notice = () =>
      document.getElementById('pangular-popup-root')!.shadowRoot!.querySelector('.notice')!;
    const popoutButton = () =>
      document
        .getElementById('pangular-popup-root')!
        .shadowRoot!.querySelector('.popout-btn') as HTMLButtonElement;
    const fakeWindow = () => {
      const win = { closed: false, close: vi.fn(), focus: vi.fn(), name: '' };
      win.close.mockImplementation(() => {
        win.closed = true;
      });
      Object.defineProperty(win, 'parent', { get: () => win });
      return win;
    };

    afterEach(() => {
      vi.restoreAllMocks();
      sessionStorage.clear();
    });

    it('opens the full panel in its own window on this page id, and closes it here', async () => {
      sessionStorage.setItem('pangular-page-id', 'k3x9');
      const win = fakeWindow();
      const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
      await loadPopup(true);
      await openedSrc();
      const { fab, panel } = parts();
      expect(popoutButton().getAttribute('aria-label')).toBe(
        'Open Pangular Inspector in its own window',
      );
      popoutButton().click();
      await vi.waitFor(() => expect(open).toHaveBeenCalled());
      const [url, name, features] = open.mock.calls[0];
      const base = `${location.origin}/__devframes/pangular/`;
      expect(url).toBe(`${base}?baseURL=${encodeURIComponent(base)}&pageId=k3x9`);
      expect(name).toBe('pangular-inspector-k3x9');
      expect(features).toMatch(/^popup,width=\d+,height=\d+$/);
      expect(panel.classList.contains('open')).toBe(false);
      expect(fab.getAttribute('aria-label')).toBe('Bring Pangular Inspector back into the page');

      // The launcher is the way back: it closes the window and opens the panel here.
      fab.click();
      expect(win.close).toHaveBeenCalled();
      expect(panel.classList.contains('open')).toBe(true);
      expect(fab.getAttribute('aria-label')).toBe('Toggle Pangular Inspector');
    });

    it('reserves the window during the click when the panel has not loaded yet', async () => {
      sessionStorage.setItem('pangular-page-id', 'k3x9');
      const win = { ...fakeWindow(), location: { href: '' } };
      const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
      await loadPopup(true);
      popoutButton().click();
      // The blank window opens inside the click, before the address lookup.
      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0][0]).toBe('about:blank');
      expect(open.mock.calls[0][1]).toBe('pangular-inspector-k3x9');
      const base = `${location.origin}/__devframes/pangular/`;
      await vi.waitFor(() =>
        expect(win.location.href).toBe(`${base}?baseURL=${encodeURIComponent(base)}&pageId=k3x9`),
      );
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('closes the reserved window when there is no devtools server', async () => {
      const win = { ...fakeWindow(), location: { href: '' } };
      vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
      await loadPopup(false);
      popoutButton().click();
      await vi.waitFor(() => expect(notice().textContent).toContain('No devtools server found'));
      expect(win.close).toHaveBeenCalled();
    });

    it('says so and stays in the page when the browser blocks the window', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);
      await loadPopup(true);
      await openedSrc();
      popoutButton().click();
      await vi.waitFor(() => expect(notice().textContent).toContain('blocked the new window'));
      expect(notice().getAttribute('role')).toBe('status');
      expect(parts().panel.classList.contains('open')).toBe(true);
    });

    it('takes the panel back when the window asks, and only that window', async () => {
      const win = fakeWindow();
      vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
      await loadPopup(true);
      await openedSrc();
      popoutButton().click();
      const { panel } = parts();
      await vi.waitFor(() => expect(panel.classList.contains('open')).toBe(false));
      const send = (source: unknown, origin = location.origin) =>
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'pangular:popup-return' },
            source: source as Window,
            origin,
          }),
        );
      send(window);
      send(win, 'https://evil.test');
      expect(panel.classList.contains('open')).toBe(false);
      send(win);
      expect(panel.classList.contains('open')).toBe(true);
      expect(win.close).toHaveBeenCalled();
    });

    it('notices the window was closed by hand', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      try {
        const win = fakeWindow();
        vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
        await loadPopup(true);
        await openedSrc();
        popoutButton().click();
        const { fab } = parts();
        await vi.waitFor(() =>
          expect(fab.getAttribute('aria-label')).toBe(
            'Bring Pangular Inspector back into the page',
          ),
        );
        win.closed = true;
        vi.advanceTimersByTime(1000);
        expect(fab.getAttribute('aria-label')).toBe('Toggle Pangular Inspector');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
