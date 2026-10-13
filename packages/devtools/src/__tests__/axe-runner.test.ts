// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OVERLAY_HOST_IDS,
  attachAxe,
  axeOwnerNg,
  nodeSnippet,
  type AxeLike,
} from '../axe-runner.ts';
import type { BlockOwnerDebugNg } from '../block-owner.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

class _TripCard {}

function page() {
  document.body.innerHTML = `
    <app-trip-card>
      <img id="hero" src="/img/rome.jpg?token=${JWT}" class="hero">
      <input name="email" value="ada@example.com" aria-label="Bearer ${JWT}">
      <button>Secret text inside</button>
    </app-trip-card>
    <div id="pangular-popup-root"></div>`;
  const host = document.querySelector('app-trip-card')!;
  const card = new _TripCard();
  const ng: BlockOwnerDebugNg = {
    getComponent: (el: Element) => (el === host ? card : null),
    getOwningComponent: (node: Node) => (host.contains(node) && node !== host ? card : null),
    getHostElement: (instance: object) => (instance === card ? host : null),
  };
  return { host, ng };
}

function fakeAxe(nodes: () => Element[]) {
  const run = vi.fn<AxeLike['run']>(async () => ({
    violations: [
      {
        id: 'image-alt',
        impact: 'critical',
        help: 'Images must have alternative text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
        tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
        nodes: nodes().map((element) => ({
          element,
          target: [`#${element.id || 'x'}[data-token="${JWT}"]`],
          impact: 'critical',
          failureSummary: `Fix any of the following:\n  Element has no alt attribute, token=${JWT}`,
        })),
      },
    ],
  }));
  return { run, version: '4.13.0' } satisfies AxeLike;
}

function rpc() {
  const calls: { name: string; message: any }[] = [];
  const handlers = new Map<string, (message: unknown) => unknown>();
  return {
    calls,
    emit: (name: string, message: unknown) => handlers.get(name)?.(message),
    my: {
      rpc: {
        call: async (name: string, message: unknown) => {
          calls.push({ name, message });
        },
        register: (definition: { name: string; handler: (message: never) => unknown }) =>
          void handlers.set(definition.name, definition.handler as (message: unknown) => unknown),
      },
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('attachAxe', () => {
  it('names element owners only with the Components inspector on', async () => {
    const { ng } = page();
    const axe = fakeAxe(() => [document.getElementById('hero')!]);
    const owners = async (componentsOn: boolean) => {
      const channel = rpc();
      attachAxe(
        channel.my,
        'tab1',
        axeOwnerNg(componentsOn, () => ng),
        {
          loadAxe: async () => ({ default: axe }),
        },
      );
      channel.emit('axe-run', { requestId: 'a1', pageId: 'tab1' });
      await vi.waitFor(() => expect(channel.calls).toHaveLength(1));
      return channel.calls[0]!.message.result.report.violations[0].nodes[0];
    };
    expect((await owners(true)).owner).toMatchObject({ name: 'TripCard' });
    const hidden = await owners(false);
    expect(hidden.owner).toBeUndefined();
    // The element id is the overlay's own WeakMap id, kept for the panel.
    expect(hidden.elementId).toEqual(expect.any(String));
  });

  it('loads axe-core only when its own page asks for a pass', async () => {
    const { ng } = page();
    const axe = fakeAxe(() => [document.getElementById('hero')!]);
    const loadAxe = vi.fn(async () => ({ default: axe }));
    const channel = rpc();
    attachAxe(channel.my, 'tab1', () => ng, { loadAxe });
    expect(loadAxe).not.toHaveBeenCalled();

    channel.emit('axe-run', { requestId: 'a1', pageId: 'other' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadAxe).not.toHaveBeenCalled();

    channel.emit('axe-run', { requestId: 'a2', pageId: 'tab1' });
    await vi.waitFor(() => expect(channel.calls).toHaveLength(1));
    expect(loadAxe).toHaveBeenCalledTimes(1);
    expect(channel.calls[0]).toMatchObject({
      name: 'axe-result',
      message: { requestId: 'a2', pageId: 'tab1', result: { ok: true } },
    });
  });

  it('leaves the overlay elements out and checks only violations, without frames', async () => {
    const { ng } = page();
    const axe = fakeAxe(() => []);
    const runner = attachAxe(rpc().my, 'tab1', () => ng, { loadAxe: async () => axe });
    await runner.run();
    const [context, options] = axe.run.mock.calls[0]!;
    expect(context).toEqual({ include: [document], exclude: [['#pangular-popup-root']] });
    expect(options).toMatchObject({
      resultTypes: ['violations'],
      iframes: false,
      elementRef: true,
    });
    expect(OVERLAY_HOST_IDS).toContain('pangular-highlight');
  });

  it('masks selectors and summaries, keeps no text content and names the owning component', async () => {
    const { ng, host } = page();
    const img = document.getElementById('hero')!;
    const input = document.querySelector('input')!;
    const axe = fakeAxe(() => [img, input]);
    const runner = attachAxe(rpc().my, 'tab1', () => ng, { loadAxe: async () => axe });
    const result = await runner.run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = JSON.stringify(result.report);
    expect(text).not.toContain(JWT);
    expect(text).not.toContain('ada@example.com');
    expect(text).not.toContain('Secret text inside');
    const [violation] = result.report.violations;
    expect(violation).toMatchObject({
      id: 'image-alt',
      impact: 'critical',
      count: 2,
      tags: ['wcag2a', 'wcag111'],
    });
    expect(violation!.nodes[0]!.html).toMatch(/^<img id="hero" class="hero" src="\/img\/rome\.jpg/);
    expect(violation!.nodes[1]!.html).not.toContain('value=');
    expect(violation!.nodes[0]!.owner?.name).toBe('TripCard');
    expect(violation!.nodes[0]!.summary).toContain('Element has no alt attribute');
    expect(host.outerHTML).not.toContain('data-');
  });

  it('keeps element ids stable between passes and writes nothing to the DOM', async () => {
    const { ng } = page();
    const before = document.body.innerHTML;
    const axe = fakeAxe(() => [document.getElementById('hero')!]);
    const runner = attachAxe(rpc().my, 'tab1', () => ng, { loadAxe: async () => axe });
    const first = await runner.run();
    const second = await runner.run();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.report.violations[0]!.nodes[0]!.elementId).toBeTruthy();
    expect(second.report.violations[0]!.nodes[0]!.elementId).toBe(
      first.report.violations[0]!.nodes[0]!.elementId,
    );
    expect(document.body.innerHTML).toBe(before);
  });

  it('runs one pass at a time', async () => {
    const { ng } = page();
    const axe = fakeAxe(() => []);
    const runner = attachAxe(rpc().my, 'tab1', () => ng, { loadAxe: async () => axe });
    const [a, b] = await Promise.all([runner.run(), runner.run()]);
    expect(a).toBe(b);
    expect(axe.run).toHaveBeenCalledTimes(1);
  });

  it('says why when axe-core cannot load or fails', async () => {
    const failing = attachAxe(rpc().my, 'tab1', () => undefined, {
      loadAxe: async () => {
        throw new Error(`chunk failed ${JWT}`);
      },
    });
    const loaded = await failing.run();
    expect(loaded).toMatchObject({
      ok: false,
      error: expect.stringContaining('could not be loaded'),
    });
    expect(JSON.stringify(loaded)).not.toContain(JWT);

    const broken = attachAxe(rpc().my, 'tab1', () => undefined, {
      loadAxe: async () => ({
        run: async () => Promise.reject(new Error('Axe is already running')),
      }),
    });
    expect(await broken.run()).toMatchObject({
      ok: false,
      error: expect.stringContaining('failed'),
    });
  });

  it('stops answering after stop()', async () => {
    const loadAxe = vi.fn(async () => fakeAxe(() => []));
    const channel = rpc();
    attachAxe(channel.my, 'tab1', () => undefined, { loadAxe }).stop();
    channel.emit('axe-run', { requestId: 'a1', pageId: 'tab1' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadAxe).not.toHaveBeenCalled();
  });
});

describe('nodeSnippet', () => {
  it('keeps the opening tag with listed attributes and masks secrets in them', () => {
    const el = document.createElement('a');
    el.setAttribute('href', `https://user:hunter2@example.com/x?access_token=${JWT}`);
    el.setAttribute('data-user', 'Ada');
    el.setAttribute('aria-hidden', '');
    el.textContent = 'Account of Ada';
    const snippet = nodeSnippet(el);
    expect(snippet.startsWith('<a href="')).toBe(true);
    expect(snippet).toContain('aria-hidden>');
    expect(snippet).not.toContain('hunter2');
    expect(snippet).not.toContain(JWT);
    expect(snippet).not.toContain('Ada');
  });

  it('replaces free-text attribute values, which can hold personal data', () => {
    const el = document.createElement('img');
    el.setAttribute('alt', 'Photo of Ada Lovelace');
    el.setAttribute('title', 'Ada');
    el.setAttribute('aria-label', 'Ada Lovelace');
    el.setAttribute('name', 'ada-avatar');
    el.setAttribute('role', 'img');
    const snippet = nodeSnippet(el);
    expect(snippet).not.toContain('Ada');
    expect(snippet).not.toContain('ada-avatar');
    expect(snippet).toContain('alt="[redacted]"');
    expect(snippet).toContain('aria-label="[redacted]"');
    expect(snippet).toContain('role="img"');
  });
});
