// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ANALOG_META_DESCRIPTION,
  LOAD_DATA_EVENT,
  LOAD_DATA_RESULT,
  attachAnalog,
  loadDataOf,
} from '../analog-runtime.ts';
import { redactLoadValue, registerAnalog } from '../rpc/analog-register.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const META = Symbol.for(ANALOG_META_DESCRIPTION);
const DATA = {
  product: { id: 7, name: 'Lamp', tags: Array.from({ length: 50 }, (_, i) => `t${i}`) },
  password: 'hunter2',
  note: 'x'.repeat(3000),
};

function fakeNg() {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const leaf = {
    routeConfig: {
      path: '',
      component: class {},
      [META]: { endpoint: '/pages/x', endpointKey: '/src/app/pages/x.page.ts' },
    },
    data: { load: DATA },
    firstChild: null,
  };
  const router = {
    url: '/x',
    config: [],
    routerState: { snapshot: { root: { routeConfig: null, data: {}, firstChild: leaf } } },
  };
  return { getInjector: () => ({}), ɵgetRouterInstance: () => router };
}

describe('loadDataOf', () => {
  it('serializes the whole load() value with secret keys masked', () => {
    const answer = loadDataOf(fakeNg());
    expect(answer.found).toBe(true);
    const value = answer.value as typeof DATA;
    expect(value.product.tags).toHaveLength(50);
    expect(value.note).toHaveLength(3000);
    expect(value.password).toBe('[redacted]');
    expect(answer.bytes).toBeGreaterThan(3000);
    expect(loadDataOf({}).found).toBe(false);
  });

  it('answers a request for its own page only', async () => {
    const handlers = new Map<string, (message: unknown) => void>();
    const calls: [string, unknown][] = [];
    const rpc = {
      call: async (name: string, arg: unknown) => void calls.push([name, arg]),
      register: (definition: { name: string; handler: (message: unknown) => void }) =>
        handlers.set(definition.name, definition.handler),
    };
    const stop = attachAnalog({ rpc }, 'p1', fakeNg, 60_000);
    handlers.get(LOAD_DATA_EVENT)!({ requestId: 'r1', pageId: 'p2' });
    handlers.get(LOAD_DATA_EVENT)!({ requestId: 'r2', pageId: 'p1' });
    stop();
    const answers = calls.filter(([name]) => name === LOAD_DATA_RESULT);
    expect(answers).toHaveLength(1);
    expect(answers[0][1]).toMatchObject({ requestId: 'r2', pageId: 'p1', found: true });
  });
});

describe('analog-load-data', () => {
  it('asks the page through a broadcast and returns its masked answer', async () => {
    const rpcs = new Map<string, (arg: unknown) => unknown>();
    let state: Record<string, unknown> = {};
    const broadcasts: { method: string; args: unknown[] }[] = [];
    const my = {
      rpc: {
        register: (d: Record<string, unknown>) =>
          rpcs.set(d['name'] as string, d['handler'] as never),
        sharedState: async (_name: string, options: Record<string, unknown>) => {
          state = structuredClone(options['initialValue']) as Record<string, unknown>;
          return {
            value: () => state,
            mutate: (fn: (draft: Record<string, unknown>) => void) => fn(state),
          };
        },
        broadcast: (message: { method: string; args: unknown[] }) => {
          broadcasts.push(message);
          const { requestId, pageId } = message.args[0] as { requestId: string; pageId: string };
          queueMicrotask(() =>
            rpcs.get(LOAD_DATA_RESULT)!({
              requestId,
              pageId,
              found: true,
              value: { token: 'Bearer abcdefghijklmnopqrstuvwxyz123456', ok: 1 },
            }),
          );
        },
      },
    };
    await registerAnalog(my, { cwd: makeProject(BASE_FILES), agent: { registerTool: () => {} } });
    try {
      expect(await rpcs.get('analog-load-data')!(undefined)).toMatchObject({ found: false });
      rpcs.get('push-analog')!({
        pageId: 'p1',
        url: '/x',
        analog: true,
        chain: [],
        hydrated: 0,
        transferState: false,
        hydrationErrors: [],
        configPaths: [],
      });
      const answer = (await rpcs.get('analog-load-data')!('p1')) as { value: { token: string } };
      expect(broadcasts[0]).toMatchObject({ method: LOAD_DATA_EVENT });
      expect(answer.value.token).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    } finally {
      const { stopAnalog } = await import('../rpc/analog-register.ts');
      stopAnalog();
    }
  });

  it('caps a large value', () => {
    expect(String(redactLoadValue({ a: 'x'.repeat(300_000) })).length).toBeLessThan(200_010);
  });
});
