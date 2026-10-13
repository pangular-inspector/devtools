// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureElement,
  registerComponentScreenshot,
  snapshotElement,
  styleText,
  type Snapshot,
} from '../component-screenshot.ts';
import { elementId } from '../element-id.ts';

/** jsdom has no computed style for pseudo-elements. */
const JSDOM = { pseudoElements: false } as const;

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLXZhbHVl';
const PNG = 'iVBORw0KGgo=';

/** jsdom lays nothing out, so every element gets the same box. */
function giveSize(width = 320, height = 180) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect,
  );
}

const fakeRaster = vi.fn(async (_snapshot: Snapshot, _scale: number) => ({
  mimeType: 'image/png' as const,
  data: PNG,
}));

beforeEach(() => {
  document.body.innerHTML = '';
  fakeRaster.mockClear();
});
afterEach(() => vi.restoreAllMocks());

function loginCard() {
  document.body.innerHTML = `
    <app-root ng-version="22.1.0">
      <login-card>
        <h2>Sign in</h2>
        <p>Token: ${JWT}</p>
        <input id="email" name="email" value="ada@example.com" />
        <input id="pw" type="password" />
        <input id="api" formcontrolname="apiKey" />
        <textarea name="notes">public note</textarea>
        <div data-private><span>Card 4111 1111 1111 1111</span></div>
        <div data-pangular="mask"><b>loyalty-tier</b></div>
        <script>window.leak = 1</script>
        <iframe src="https://example.com"></iframe>
      </login-card>
    </app-root>`;
  (document.getElementById('pw') as HTMLInputElement).value = 'hunter22';
  (document.getElementById('api') as HTMLInputElement).value = 'sk-live-abc';
  return document.querySelector('login-card')!;
}

describe('snapshotElement', () => {
  it('copies the host into an SVG with secret fields, marked elements and tokens masked', async () => {
    giveSize();
    const host = loginCard();
    const snapshot = await snapshotElement(host, { ...JSDOM, imageData: async () => null });
    if ('error' in snapshot) throw new Error(snapshot.error);
    expect(snapshot.width).toBe(320);
    expect(snapshot.height).toBe(180);
    expect(snapshot.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(snapshot.svg).toContain('<foreignObject');
    expect(snapshot.svg).toContain('Sign in');
    expect(snapshot.svg).toContain('ada@example.com');
    expect(snapshot.svg).toContain('public note');
    // Masked: the password, the field named apiKey, both marked blocks and the JWT.
    expect(snapshot.svg).not.toContain('hunter22');
    expect(snapshot.svg).not.toContain('sk-live-abc');
    expect(snapshot.svg).not.toContain('4111');
    expect(snapshot.svg).not.toContain('loyalty-tier');
    expect(snapshot.svg).not.toContain(JWT);
    expect(snapshot.masked).toBe(4);
    expect(snapshot.maskedText).toBe(1);
    // No script, and the iframe is a labelled box.
    expect(snapshot.svg).not.toContain('window.leak');
    expect(snapshot.svg).toContain('&lt;iframe&gt;');
    expect(snapshot.notes.join(' ')).toContain('<iframe> content is not part of this page');
  });

  it('never changes the app DOM and never runs a custom element constructor', async () => {
    giveSize();
    let constructed = 0;
    class TripBadge extends HTMLElement {
      constructor() {
        super();
        constructed++;
      }
    }
    customElements.define('trip-badge', TripBadge);
    const host = loginCard();
    host.appendChild(document.createElement('trip-badge')).textContent = 'Gold';
    expect(constructed).toBe(1);
    const before = document.documentElement.outerHTML;
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => changes.push(...records));
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const snapshot = await snapshotElement(host, { ...JSDOM, imageData: async () => null });
    await Promise.resolve();
    observer.disconnect();
    expect('svg' in snapshot && snapshot.svg).toContain('Gold');
    expect(constructed).toBe(1);
    expect(changes).toEqual([]);
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('keeps the field when the page marks it unmask', async () => {
    giveSize();
    document.body.innerHTML =
      '<app-x><div data-pangular="unmask"><input id="t" name="token" /></div></app-x>';
    (document.getElementById('t') as HTMLInputElement).value = 'shown-on-purpose';
    const snapshot = await snapshotElement(document.querySelector('app-x')!, JSDOM);
    expect('svg' in snapshot && snapshot.svg).toContain('shown-on-purpose');
  });

  it('masks a field when any of its control name, name or id is secret', async () => {
    giveSize();
    document.body.innerHTML = `<app-pay>
      <input id="card-cvc" name="q" />
      <input id="v" formcontrolname="value" name="password" />
      <input id="plain" name="q" />
    </app-pay>`;
    (document.getElementById('card-cvc') as HTMLInputElement).value = '123-cvc-secret';
    (document.getElementById('v') as HTMLInputElement).value = 'hunter22';
    (document.getElementById('plain') as HTMLInputElement).value = 'search text';
    const snapshot = await snapshotElement(document.querySelector('app-pay')!, JSDOM);
    if ('error' in snapshot) throw new Error(snapshot.error);
    expect(snapshot.svg).not.toContain('123-cvc-secret');
    expect(snapshot.svg).not.toContain('hunter22');
    expect(snapshot.svg).toContain('search text');
    expect(snapshot.masked).toBe(2);
  });

  it('draws a custom form control with a secret name as a placeholder, inner inputs included', async () => {
    giveSize();
    customElements.define(
      'pin-input',
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<span>shadow-9876</span>';
        }
      },
    );
    document.body.innerHTML = `<app-account>
      <app-secret-field formcontrolname="apiToken"><span>sk-live-shown</span><input id="inner" /></app-secret-field>
      <pin-input name="pin"></pin-input>
      <app-field ng-reflect-name="password"><input id="inner2" /></app-field>
      <app-field id="nickname"><span>Ada</span></app-field>
      <div data-pangular="unmask"><app-field name="token"><span>token-on-purpose</span></app-field></div>
    </app-account>`;
    (document.getElementById('inner') as HTMLInputElement).value = 'inner-secret';
    (document.getElementById('inner2') as HTMLInputElement).value = 'inner-secret-2';
    const snapshot = await snapshotElement(document.querySelector('app-account')!, JSDOM);
    if ('error' in snapshot) throw new Error(snapshot.error);
    for (const secret of ['sk-live-shown', 'inner-secret', 'shadow-9876', 'inner-secret-2']) {
      expect(snapshot.svg).not.toContain(secret);
    }
    expect(snapshot.svg).not.toContain('<app-secret-field');
    expect(snapshot.svg).toContain('Ada');
    expect(snapshot.svg).toContain('token-on-purpose');
    expect(snapshot.masked).toBe(3);
  });

  it('inlines readable images and greys out the rest', async () => {
    giveSize();
    document.body.innerHTML =
      '<app-gallery><img id="a" src="/a.png" alt="Lisbon" /><img id="b" src="https://cdn.example/b.png" /><canvas></canvas></app-gallery>';
    const snapshot = await snapshotElement(document.querySelector('app-gallery')!, {
      ...JSDOM,
      imageData: async (el) => (el.id === 'a' ? 'data:image/png;base64,QUJD' : null),
    });
    if ('error' in snapshot) throw new Error(snapshot.error);
    expect(snapshot.svg).toContain('src="data:image/png;base64,QUJD"');
    expect(snapshot.svg).not.toContain('cdn.example');
    expect(snapshot.notes.join(' ')).toMatch(
      /^2 image\(s\), canvas\(es\) or video\(s\) could not be read/,
    );
  });

  it('stops at the element cap and says so', async () => {
    giveSize();
    document.body.innerHTML = `<app-list>${'<li>row</li>'.repeat(20)}</app-list>`;
    const snapshot = await snapshotElement(document.querySelector('app-list')!, {
      ...JSDOM,
      maxNodes: 5,
    });
    if ('error' in snapshot) throw new Error(snapshot.error);
    expect(snapshot.svg.match(/<li /g)).toHaveLength(4);
    expect(snapshot.notes).toContain(
      'The component has more than 5 elements; the ones after that are left out.',
    );
  });

  it('answers an error for an element with no size', async () => {
    document.body.innerHTML = '<app-empty></app-empty>';
    expect(await snapshotElement(document.querySelector('app-empty')!, JSDOM)).toEqual({
      error: expect.stringContaining('has no size on the page'),
    });
  });
});

describe('styleText', () => {
  const style = (values: Record<string, string>) =>
    ({
      length: Object.keys(values).length,
      item: (i: number) => Object.keys(values)[i] ?? '',
      getPropertyValue: (name: string) => values[name] ?? '',
    }) as unknown as CSSStyleDeclaration;

  it('writes inherited properties only where they differ, and leaves out behavior and aliases', () => {
    const parent = style({ color: 'rgb(0, 0, 0)', 'font-size': '16px' });
    const own = style({
      color: 'rgb(0, 0, 0)',
      'font-size': '20px',
      display: 'flex',
      'transition-duration': '0.3s',
      cursor: 'pointer',
      'margin-inline-start': '4px',
      'margin-left': '4px',
      '-webkit-user-drag': 'none',
      '-webkit-line-clamp': '2',
      '--brand': 'red',
    });
    expect(styleText(own, parent)).toBe(
      'font-size:20px;display:flex;margin-left:4px;-webkit-line-clamp:2;',
    );
    expect(styleText(own, null)).toContain('color:rgb(0, 0, 0);');
  });
});

describe('captureElement', () => {
  it('scales a large component down to the longest side and notes it', async () => {
    giveSize(4000, 1000);
    document.body.innerHTML = '<app-page><p>Long page</p></app-page>';
    const result = await captureElement(document.querySelector('app-page')!, {
      ...JSDOM,
      rasterize: fakeRaster,
      scale: 2,
      maxSide: 2000,
    });
    expect(result).toMatchObject({
      ok: true,
      mimeType: 'image/png',
      data: PNG,
      width: 2000,
      height: 500,
      cssWidth: 4000,
      cssHeight: 1000,
    });
    expect(fakeRaster.mock.calls[0]![1]).toBe(0.5);
    expect(result.ok && result.notes.join(' ')).toContain('Scaled down to fit 2000 pixels');
  });

  it('turns a drawing failure into an answer, masked', async () => {
    giveSize();
    document.body.innerHTML = '<app-x>x</app-x>';
    const result = await captureElement(document.querySelector('app-x')!, {
      ...JSDOM,
      rasterize: async () => {
        throw new Error(`blocked Bearer ${JWT}`);
      },
    });
    expect(result).toEqual({ ok: false, error: 'blocked Bearer [redacted]' });
  });
});

describe('registerComponentScreenshot', () => {
  function rpc() {
    const handlers = new Map<string, (message: unknown) => unknown>();
    const calls: { name: string; arg: any }[] = [];
    return {
      handlers,
      calls,
      rpc: {
        register: (def: { name: string; handler: (message: never) => unknown }) =>
          void handlers.set(def.name, def.handler as (message: unknown) => unknown),
        call: async (name: string, arg?: unknown) => void calls.push({ name, arg }),
      },
    };
  }

  it('captures the host its stable id names, for its own page only', async () => {
    giveSize(100, 50);
    document.body.innerHTML =
      '<app-root ng-version="22.1.0"><trip-card>Paris</trip-card></app-root>';
    const host = document.querySelector('trip-card')!;
    const id = elementId(host);
    const { rpc: my, handlers, calls } = rpc();
    registerComponentScreenshot(my, 'p1', { ...JSDOM, rasterize: fakeRaster, scale: 1 });
    const handle = handlers.get('component-screenshot')!;
    handle({ requestId: 's1', pageId: 'p2', id });
    handle({ requestId: 's2', pageId: 'p1', id });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      name: 'component-screenshot-result',
      arg: {
        requestId: 's2',
        pageId: 'p1',
        result: expect.objectContaining({ ok: true, data: PNG, cssWidth: 100, cssHeight: 50 }),
      },
    });
    expect(fakeRaster.mock.calls[0]![0].svg).toContain('Paris');
    // The id stays the same, so a second capture finds the same host.
    expect(elementId(host)).toBe(id);
  });

  it('answers with the reason when the id or selector finds nothing', async () => {
    const { rpc: my, handlers, calls } = rpc();
    registerComponentScreenshot(my, 'p1', { ...JSDOM, rasterize: fakeRaster });
    handlers.get('component-screenshot')!({ requestId: 's1', pageId: 'p1', id: 'c-gone' });
    handlers.get('component-screenshot')!({ requestId: 's2', pageId: 'p1', selector: '][' });
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]!.arg.result).toEqual({
      ok: false,
      error: expect.stringContaining('no longer on the page'),
    });
    expect(calls[1]!.arg.result).toEqual({
      ok: false,
      error: 'No element on the page matches the selector.',
    });
    expect(fakeRaster).not.toHaveBeenCalled();
  });
});
