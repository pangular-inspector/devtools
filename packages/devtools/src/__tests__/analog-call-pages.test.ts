import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analogMiddleware,
  bindRenderCalls,
  clearCalls,
  dropCalls,
  recentCalls,
} from '../analog-server-log.ts';
import { beginRender, clearRenders, setPagesAtPath } from '../analog-call-pages.ts';
import { currentAnalogRender, runInSsrRequest } from '../ssr-context.ts';

class FakeRes extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }
  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  write() {
    return true;
  }
  end(chunk?: unknown) {
    void chunk;
    this.emit('finish');
    return this;
  }
}

function run(
  url: string,
  headers: Record<string, string> = {},
  options: { method?: string; body?: string; inside?: () => void } = {},
) {
  const req = { url, originalUrl: url, method: options.method ?? 'GET', headers } as never;
  const res = new FakeRes();
  analogMiddleware('api')(req, res as never, () => options.inside?.());
  res.end(options.body);
  return { res, call: recentCalls().at(-1)! };
}

const html = { accept: 'text/html', 'user-agent': 'Mozilla/5.0' };
const browser = { 'user-agent': 'Mozilla/5.0' };

afterEach(() => {
  clearCalls();
  clearRenders();
  setPagesAtPath(undefined);
});

describe('Analog server calls and their tab', () => {
  it('tags a call with the page id the app sends in x-pangular-page', () => {
    const { call } = run('/api/_analog/pages/products/1', {
      ...browser,
      'x-pangular-page': 'pg1',
    });
    expect(call.pageId).toBe('pg1');
  });

  it('ignores a page header that is not a page id', () => {
    const { call } = run('/api/_analog/pages/products/1', {
      ...browser,
      'x-pangular-page': '<script>alert(1)</script>',
    });
    expect(call.pageId).toBeUndefined();
  });

  it('gives a page render an id in Server-Timing and ties it, and its own requests, to the page that reports it', () => {
    let renderSeen: string | undefined;
    const { res, call: page } = run('/products/1', html, {
      inside: () => {
        // What the app's interceptor reads during the render.
        renderSeen = currentAnalogRender();
      },
    });
    expect(page.renderId).toMatch(/^[a-z0-9]+$/);
    expect(res.headers['server-timing']).toBe(`pangular-analog;desc="${page.renderId}"`);
    expect(renderSeen).toBe(page.renderId);

    const { call: load } = run('/api/_analog/pages/products/1', {
      'user-agent': 'node',
      'x-pangular-render': page.renderId!,
    });
    expect(load).toMatchObject({ from: 'ssr', renderId: page.renderId });
    expect(load.pageId).toBeUndefined();

    expect(bindRenderCalls(page.renderId, 'pg1')).toBe(true);
    expect(recentCalls().map((c) => c.pageId)).toEqual(['pg1', 'pg1']);

    // Later calls of that render are tagged as they come in.
    const { call: later } = run('/api/_analog/fn/abc', {
      'user-agent': 'node',
      'x-pangular-render': page.renderId!,
    });
    expect(later.pageId).toBe('pg1');
  });

  it('keeps a render on the first page that reports it', () => {
    const { call } = run('/products/1', html);
    bindRenderCalls(call.renderId, 'pg1');
    expect(bindRenderCalls(call.renderId, 'pg2')).toBe(false);
    expect(recentCalls()[0].pageId).toBe('pg1');
  });

  it('ignores a render id the dev server never gave out', () => {
    const { call } = run('/api/_analog/pages/products/1', {
      'user-agent': 'node',
      'x-pangular-render': 'forged1',
    });
    expect(call.renderId).toBeUndefined();
    expect(bindRenderCalls('forged1', 'pg1')).toBe(false);
  });

  it('keeps the render id when an SSR tracer runs inside the render', () => {
    let seen: string | undefined;
    run('/products/1', html, {
      inside: () => runInSsrRequest(undefined, () => (seen = currentAnalogRender())),
    });
    expect(seen).toBe(recentCalls()[0].renderId);
  });

  it('tags a call by its Referer only when exactly one live page shows that path', () => {
    const pages: Record<string, string[]> = { '/products/1': ['pg1'], '/': ['pg1', 'pg2'] };
    setPagesAtPath((path) => pages[path] ?? []);
    const action = (referer: string) =>
      run('/api/_analog/pages/products/1', { ...browser, referer }, { method: 'POST' }).call;
    expect(action('http://localhost:5173/products/1?tab=2').pageId).toBe('pg1');
    expect(action('http://localhost:5173/').pageId).toBeUndefined();
    expect(action('http://localhost:5173/nowhere').pageId).toBeUndefined();
    // A document request's Referer is the page it came from, often another tab.
    expect(
      run('/products/2', { ...html, referer: 'http://localhost:5173/products/1' }).call.pageId,
    ).toBeUndefined();
  });

  it('drops the calls of a page that left, and keeps the untagged ones', () => {
    run('/api/_analog/pages/a', { ...browser, 'x-pangular-page': 'pg1' });
    run('/api/_analog/pages/b', browser);
    dropCalls((call) => call.pageId === 'pg1');
    expect(recentCalls().map((c) => c.route)).toEqual(['/b']);
  });

  it('forgets render ids past the cap, so they tag nothing', () => {
    const first = beginRender();
    for (let i = 0; i < 201; i++) beginRender();
    expect(bindRenderCalls(first, 'pg1')).toBe(false);
  });
});
