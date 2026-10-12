import { createDevServer } from 'devframe/adapters/dev';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pangularMcp, pangularMcpInstructions } from '../agent-mcp.ts';
import {
  PANGULAR_INSPECTORS,
  SHARED_STATE_INSPECTOR,
  SHARED_STATE_KEYS,
  resolvePangularConfig,
  sharedStateExposed,
} from '../config.ts';
import { createPangular } from '../devframe.ts';
import { initPangularHub, type PangularHubOptions } from '../hub.ts';
import { makeProject } from './analog-fixture.ts';

const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of closers.splice(0)) await close();
  delete (globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__;
});

type Send = (request: Request) => Promise<Response>;

/** A JSON-RPC client for one stateless MCP endpoint. */
function mcpClient(url: string, send: Send) {
  let id = 0;
  return async <T>(
    method: string,
    params: object = {},
  ): Promise<{ result?: T; error?: unknown }> => {
    const response = await send(
      new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost:4000',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      }),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    const json = text.startsWith('{') ? text : /^data: (.*)$/m.exec(text)?.[1];
    return JSON.parse(json ?? '{}');
  };
}

const INITIALIZE = {
  protocolVersion: '2025-03-26',
  capabilities: {},
  clientInfo: { name: 'test', version: '0' },
};

async function bootHub(options: PangularHubOptions) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const hub = initPangularHub({
    cwd: makeProject({ 'package.json': '{}' }),
    ws: false,
    auth: false,
    allowedOrigins: false,
    ...options,
  });
  closers.push(() => hub.close());
  await hub.ready;
  const ctx = await hub.context;
  return { ctx, call: mcpClient('http://localhost/__devframes/__mcp', (r) => hub.handler(r)) };
}

type StateKeys = { content: { text: string }[]; isError?: boolean };

async function stateKeys(call: ReturnType<typeof mcpClient>): Promise<string[]> {
  const listed = await call<StateKeys>('tools/call', {
    name: 'devframe_state_read',
    arguments: {},
  });
  return (JSON.parse(listed.result!.content[0]!.text) as { keys: string[] }).keys;
}

describe('sharedStateExposed', () => {
  it('follows agent.tools for each inspector key', () => {
    const config = resolvePangularConfig({ agent: { tools: { forms: false } } });
    expect(sharedStateExposed('pangular:forms', config)).toBe(false);
    expect(sharedStateExposed('pangular:router', config)).toBe(true);
    expect(sharedStateExposed('pangular:page-visibility', config)).toBe(true);
  });

  it('hides the keys of an inspector that is off', () => {
    const config = resolvePangularConfig({ inspectors: { http: false } });
    expect(sharedStateExposed('pangular:http', config)).toBe(false);
    expect(sharedStateExposed('pangular:http-payloads', config)).toBe(false);
  });

  it('hides an unknown pangular key and leaves other namespaces alone', () => {
    const config = resolvePangularConfig();
    expect(sharedStateExposed('pangular:not-listed', config)).toBe(false);
    expect(sharedStateExposed('devframes:hub:messages', config)).toBe(true);
  });

  it('maps every key to a known inspector', () => {
    for (const inspector of Object.values(SHARED_STATE_INSPECTOR)) {
      expect(PANGULAR_INSPECTORS).toContain(inspector);
    }
  });
});

describe('pangularMcp', () => {
  const config = resolvePangularConfig({ agent: { tools: { forms: false } } });

  it('keeps the route off when the setting is false', () => {
    expect(pangularMcp(false, config)).toBe(false);
  });

  it('adds the instructions and the filter to the auto default and to an object', () => {
    for (const setting of [undefined, 'auto', true] as const) {
      const mcp = pangularMcp(setting, config);
      expect(mcp).toMatchObject({ instructions: pangularMcpInstructions(config) });
    }
    const own = pangularMcp({ authorization: 'secret', path: '__agents' }, config);
    expect(own).toMatchObject({ authorization: 'secret', path: '__agents' });
    const filter = (own as { exposeSharedState: (key: string) => boolean }).exposeSharedState;
    expect(filter('pangular:forms')).toBe(false);
    expect(filter('pangular:router')).toBe(true);
  });

  it("keeps the caller's instructions and narrows the caller's filter", () => {
    const mcp = pangularMcp(
      { instructions: 'Own text.', exposeSharedState: (key) => !key.endsWith(':router') },
      config,
    ) as { instructions: string; exposeSharedState: (key: string) => boolean };
    expect(mcp.instructions).toBe('Own text.');
    expect(mcp.exposeSharedState('pangular:router')).toBe(false);
    expect(mcp.exposeSharedState('pangular:forms')).toBe(false);
    expect(mcp.exposeSharedState('pangular:http')).toBe(true);
    expect(pangularMcp({ exposeSharedState: false }, config)).toMatchObject({
      exposeSharedState: false,
    });
  });

  it('says the server is read-only under agent.readOnly', () => {
    const readOnly = pangularMcpInstructions(resolvePangularConfig({ agent: { readOnly: true } }));
    expect(readOnly).toContain('read-only');
    expect(readOnly).not.toContain('destructive tools');
    expect(pangularMcpInstructions(resolvePangularConfig())).toContain('destructive tools');
  });
});

describe('Pangular Inspector hub MCP instructions and shared state', () => {
  it('sends the instructions in the initialize result', async () => {
    const { call } = await bootHub({});
    const init = await call<{ instructions?: string }>('initialize', INITIALIZE);
    expect(init.result?.instructions).toBe(pangularMcpInstructions(resolvePangularConfig()));
    expect(init.result?.instructions).toContain('pangular_list-pages');
  });

  it('lists every pangular key it registers in the shared-state tables', async () => {
    const { ctx } = await bootHub({});
    const known = [...SHARED_STATE_KEYS, ...Object.keys(SHARED_STATE_INSPECTOR)];
    const keys = ctx.rpc.sharedState.keys().filter((key) => key.startsWith('pangular:'));
    expect(keys.length).toBeGreaterThan(5);
    for (const key of keys) expect(known).toContain(key.replace(/^pangular:/, ''));
  });

  it('hides the forms state from agents with agent.tools.forms off', async () => {
    const { ctx, call } = await bootHub({ agent: { tools: { forms: false } } });
    // The panel still gets the key.
    expect(ctx.rpc.sharedState.keys()).toContain('pangular:forms');

    const keys = await stateKeys(call);
    expect(keys).not.toContain('pangular:forms');
    expect(keys).toContain('pangular:router');

    const forms = await call<StateKeys>('tools/call', {
      name: 'devframe_state_read',
      arguments: { key: 'pangular:forms' },
    });
    expect(forms.error ?? forms.result?.isError).toBeTruthy();
    const router = await call<StateKeys>('tools/call', {
      name: 'devframe_state_read',
      arguments: { key: 'pangular:router' },
    });
    expect(router.result?.isError).toBeFalsy();
    expect(JSON.parse(router.result!.content[0]!.text)).toMatchObject({ key: 'pangular:router' });

    const uris = (
      await call<{ resources: { uri: string }[] }>('resources/list')
    ).result!.resources.map((resource) => resource.uri);
    expect(uris).not.toContain(`devframe://state/${encodeURIComponent('pangular:forms')}`);
    expect(uris).toContain(`devframe://state/${encodeURIComponent('pangular:router')}`);

    const formsResource = await call('resources/read', {
      uri: `devframe://state/${encodeURIComponent('pangular:forms')}`,
    });
    expect(formsResource.error).toBeDefined();
    const routerResource = await call<{ contents: unknown[] }>('resources/read', {
      uri: `devframe://state/${encodeURIComponent('pangular:router')}`,
    });
    expect(routerResource.result?.contents).toHaveLength(1);
  });

  it('keeps the forms state readable by default', async () => {
    const { call } = await bootHub({});
    expect(await stateKeys(call)).toContain('pangular:forms');
  });

  it('applies to an explicit mcp setting too', async () => {
    const { call } = await bootHub({
      mcp: { authorization: false },
      agent: { tools: { forms: false } },
    });
    const init = await call<{ instructions?: string }>('initialize', INITIALIZE);
    expect(init.result?.instructions).toContain('pangular_list-pages');
    expect(await stateKeys(call)).not.toContain('pangular:forms');
  });
});

describe('pangular dev MCP route', () => {
  it('sends the instructions and filters shared state', async () => {
    const config = resolvePangularConfig({ agent: { tools: { forms: false } } });
    const server = await createDevServer(createPangular(config), {
      host: '127.0.0.1',
      port: 0,
      auth: false,
      mcp: pangularMcp(true, config),
    });
    closers.push(() => server.close());
    const call = mcpClient(`${server.origin}/__mcp`, (request) => fetch(request));
    const init = await call<{ instructions?: string }>('initialize', INITIALIZE);
    expect(init.result?.instructions).toBe(pangularMcpInstructions(config));
    const keys = await stateKeys(call);
    expect(keys).not.toContain('pangular:forms');
    expect(keys).toContain('pangular:router');
  });
});
