import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalogInspector } from '../pages/analog-inspector';

const project = { analog: true, routes: [], api: [], middleware: [], content: [] };

function client() {
  const sent: Record<string, unknown>[] = [];
  const rpc = {
    call: (name: string, arg?: Record<string, unknown>) => {
      if (name === 'analog-project') return Promise.resolve(project);
      if (name === 'analog-render') return Promise.resolve({ rows: [], plan: null });
      if (name === 'analog-call-api') {
        sent.push(arg ?? {});
        return Promise.resolve({ status: 201, ms: 3, body: '{}' });
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
  const fixture = TestBed.createComponent(AnalogInspector);
  fixture.componentRef.setInput('rpc', rpcClient);
  await settle(fixture);
  return { inspector: fixture.componentInstance, sent };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Analog request playground confirmation', () => {
  it('asks again after a confirmed POST is sent', async () => {
    const { inspector, sent } = await render();
    inspector.method.set('POST');
    inspector.apiPath.set('/api/v1/products');
    inspector.confirmSend.set(true);
    expect(inspector.canSend()).toBe(true);

    await inspector.send();
    expect(sent).toEqual([
      expect.objectContaining({ method: 'POST', path: '/api/v1/products', confirm: true }),
    ]);
    expect(inspector.confirmSend()).toBe(false);
    expect(inspector.needsConfirm()).toBe(true);

    await inspector.send();
    expect(sent).toHaveLength(1);
  });

  it('asks again when the method or the path changes', async () => {
    const { inspector } = await render();
    inspector.method.set('POST');
    inspector.apiPath.set('/api/v1/products');
    inspector.confirmSend.set(true);

    inspector.apiPath.set('/api/v1/orders');
    expect(inspector.needsConfirm()).toBe(true);

    inspector.confirmSend.set(true);
    inspector.method.set('DELETE');
    expect(inspector.needsConfirm()).toBe(true);
  });

  it('asks again when Try loads another route', async () => {
    const { inspector } = await render();
    inspector.method.set('PUT');
    inspector.apiPath.set('/api/v1/products/1');
    inspector.confirmSend.set(true);

    inspector.tryApi({ method: 'PUT', path: '/api/v1/orders/:id', file: 'orders.put.ts' });
    expect(inspector.needsConfirm()).toBe(true);
  });
});
