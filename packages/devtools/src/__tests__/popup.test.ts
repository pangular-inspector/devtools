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
    expect(shadow.querySelector('[role="status"]')!.textContent).toBe('No devtools server found');
    expect(frame().hidden).toBe(true);
    expect(frame().getAttribute('src')).toBeNull();
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

  it('draws no resize grip on a docked panel, whose size is fixed', async () => {
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
    const send = (data: unknown, source: MessageEventSource | null = frame().contentWindow) =>
      window.dispatchEvent(new MessageEvent('message', { data, source }));

    it('follows the theme the panel posts and restores it on the next open', async () => {
      await loadPopup(true);
      send({ type: 'pangular:theme-change', theme: 'light' });

      expect(root().dataset['theme']).toBe('light');
      expect(stored().theme).toBe('light');

      await loadPopup(true);
      expect(root().dataset['theme']).toBe('light');
    });

    it('pins dark when the panel switches back, so a light system does not win', async () => {
      await loadPopup(true);
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
  });
});
