import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalogInspector } from '../pages/analog-inspector';
import { AnalogPlayground, fillPattern, patternParams } from '../pages/analog-playground';

const project = { analog: true, routes: [], api: [], middleware: [], content: [] };

function client() {
  const sent: Record<string, unknown>[] = [];
  const rpc = {
    call: (name: string, arg?: Record<string, unknown>) => {
      if (name === 'analog-project') return Promise.resolve(project);
      if (name === 'analog-render') return Promise.resolve({ rows: [], plan: null });
      if (name === 'analog-call-api') {
        sent.push(arg ?? {});
        return Promise.resolve({
          status: 201,
          ms: 3,
          headersMs: 2,
          size: 2,
          headers: { 'x-id': '1' },
          body: '{}',
        });
      }
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => ({}), on: () => () => {} }),
  };
  const rpcClient = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { rpcClient, sent };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render() {
  const { rpcClient, sent } = client();
  const fixture = TestBed.createComponent(AnalogPlayground);
  fixture.componentRef.setInput('rpc', rpcClient);
  await settle(fixture);
  return { playground: fixture.componentInstance, sent, fixture };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Analog request playground confirmation', () => {
  it('asks again after a confirmed POST is sent', async () => {
    const { playground, sent } = await render();
    playground.method.set('POST');
    playground.template.set('/api/v1/products');
    playground.confirmSend.set(true);
    expect(playground.canSend()).toBe(true);

    await playground.send();
    expect(sent).toEqual([
      expect.objectContaining({ method: 'POST', path: '/api/v1/products', confirm: true }),
    ]);
    expect(playground.confirmSend()).toBe(false);
    expect(playground.needsConfirm()).toBe(true);

    await playground.send();
    expect(sent).toHaveLength(1);
  });

  it('asks again when the method or the URL changes', async () => {
    const { playground } = await render();
    playground.method.set('POST');
    playground.template.set('/api/v1/products/:id');
    playground.confirmSend.set(true);

    playground.setParam('id', '7');
    expect(playground.needsConfirm()).toBe(true);

    playground.confirmSend.set(true);
    playground.method.set('DELETE');
    expect(playground.needsConfirm()).toBe(true);
  });

  it('asks again when Try loads another route', async () => {
    const { playground, fixture } = await render();
    playground.method.set('PUT');
    playground.template.set('/api/v1/products/1');
    playground.confirmSend.set(true);

    fixture.componentRef.setInput('target', {
      route: { method: 'PUT', path: '/api/v1/orders/:id', file: 'orders.put.ts' },
      nonce: 1,
    });
    await settle(fixture);
    expect(playground.template()).toBe('/api/v1/orders/:id');
    expect(playground.needsConfirm()).toBe(true);
  });
});

describe('Analog request playground', () => {
  it('fills params, adds query, headers and cookies, and keeps history per route', async () => {
    const { playground, sent } = await render();
    playground.template.set('/api/v1/products/:id');
    expect(playground.params()).toEqual(['id']);
    playground.setParam('id', 'a b');
    playground.addPair('query');
    const q = playground.query()[0];
    playground.editPair('query', q.id, 'key', 'sort');
    playground.editPair('query', q.id, 'value', 'price');
    playground.addPair('headers');
    playground.editPair('headers', playground.headers()[0].id, 'key', 'accept-language');
    playground.editPair('headers', playground.headers()[0].id, 'value', 'de');
    playground.addPair('cookies');
    playground.editPair('cookies', playground.cookies()[0].id, 'key', 'theme');
    playground.editPair('cookies', playground.cookies()[0].id, 'value', 'dark');
    expect(playground.url()).toBe('/api/v1/products/a%20b?sort=price');

    await playground.send();
    expect(sent[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/products/a%20b?sort=price',
      headers: { 'accept-language': 'de' },
      cookies: { theme: 'dark' },
    });
    expect(playground.history()).toHaveLength(1);
    expect(playground.history()[0]).toMatchObject({ status: 201, ms: 3 });

    playground.template.set('/api/v1/other');
    expect(playground.history()).toEqual([]);
    playground.restore(playground.historyByRoute()['/api/v1/products/:id'][0]);
    expect(playground.url()).toBe('/api/v1/products/a%20b?sort=price');
  });

  it('copies the request as curl and as fetch', async () => {
    const { playground, fixture } = await render();
    fixture.componentRef.setInput('origin', 'http://localhost:5173');
    playground.method.set('POST');
    playground.template.set("/api/v1/it's");
    playground.body.set('{"a":1}');
    expect(playground.command('curl')).toBe(
      "curl -X POST 'http://localhost:5173/api/v1/it'\\''s' \\\n  -H 'content-type: application/json' \\\n  --data '{\"a\":1}'",
    );
    expect(playground.command('fetch')).toContain(
      'await fetch("http://localhost:5173/api/v1/it\'s"',
    );
  });

  it('reads params from patterns, catch-alls included', () => {
    expect(patternParams('/a/:id/b/:slug')).toEqual(['id', 'slug']);
    expect(patternParams('/docs/**')).toEqual(['**']);
    expect(fillPattern('/docs/**', { '**': 'a b/c' })).toBe('/docs/a%20b/c');
    expect(fillPattern('/a/:id', {})).toBe('/a/:id');
  });

  it('hands a Try route from the inspector to the playground', async () => {
    const { rpcClient } = client();
    const fixture = TestBed.createComponent(AnalogInspector);
    fixture.componentRef.setInput('rpc', rpcClient);
    await settle(fixture);
    fixture.componentInstance.tryApi({ method: 'ANY', path: '/api/v1/hello', file: 'h.ts' });
    expect(fixture.componentInstance.tryTarget()).toMatchObject({ nonce: 1 });
  });
});
