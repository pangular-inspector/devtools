import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDevframe } from 'devframe/client';
import { getTempAuthCode } from 'devframe/node/auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initPangularHub } from '../hub.ts';
import { REDACTION_CONFIG_RPC } from '../overlay-redaction.ts';
import { makeProject } from './analog-fixture.ts';

const hubs: { close: () => Promise<void> }[] = [];

afterEach(async () => {
  for (const hub of hubs.splice(0)) await hub.close();
});

async function boot() {
  const hub = initPangularHub({
    cwd: makeProject({ 'package.json': '{}' }),
    ws: false,
    allowedOrigins: false,
    inspectors: { ngrx: false },
    redaction: { secretNames: ['passport'], unmask: ['pin'] },
  });
  hubs.push(hub);
  await hub.ready;
  return { hub, ctx: await hub.context };
}

describe('the redaction config and __connection.json', () => {
  it('leaves the redaction config out of the connection info served before pairing', async () => {
    const { hub } = await boot();
    const response = await hub.handler(
      new Request('http://localhost/__devframes/pangular/__connection.json'),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('passport');
    expect(text).not.toContain('secretNames');
    expect(text).not.toContain('unmask');
    const pangular = JSON.parse(text).configs.pangular;
    expect(pangular).not.toHaveProperty('redaction');
    // The rest of the config still reaches the page and the panel.
    expect(pangular.inspectors.ngrx).toBe(false);
  });

  it('sends the redaction config through a function only a trusted client can call', async () => {
    const { ctx } = await boot();
    const name = `pangular:${REDACTION_CONFIG_RPC}`;
    // devframe lets an untrusted client call `anonymous:` functions only.
    expect(name.startsWith('anonymous:')).toBe(false);
    const invoke = ctx.rpc.invokeLocal.bind(ctx.rpc) as unknown as (
      name: string,
    ) => Promise<unknown>;
    expect(await invoke(name)).toEqual({
      secretNames: ['passport'],
      unmask: ['pin'],
    });
  });
});

describe('the redaction config over the real transport, with the one-time code on', () => {
  const cleanups: (() => Promise<void> | void)[] = [];
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('refuses the redaction config to a client that has not entered the code', async () => {
    const home = mkdtempSync(join(tmpdir(), 'pangular-home-'));
    vi.stubEnv('HOME', home);
    const hub = initPangularHub({
      cwd: makeProject({ 'package.json': '{}' }),
      ws: false,
      mcp: false,
      redaction: { secretNames: ['passport'], unmask: [] },
    });
    const server: Server = createServer((req, res) =>
      hub.nodeMiddleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    cleanups.push(() => rmSync(home, { recursive: true, force: true }));
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    cleanups.push(() => hub.close());
    vi.stubGlobal('location', new URL(`http://127.0.0.1:${port}/`));
    await hub.context;
    const rpc = await connectDevframe({
      baseURL: `http://127.0.0.1:${port}/__devframes/pangular/`,
      simpleAuth: false,
      otpParam: false,
      webmcp: false,
    });
    cleanups.push(() => rpc.close?.());
    const call = () => rpc.scope('pangular').rpc.call(REDACTION_CONFIG_RPC as never);

    expect(rpc.isTrusted).toBe(false);
    const refused = await call().then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(String(refused)).toContain('Not authorized');
    expect(String(refused)).not.toContain('passport');

    // The same client gets it once trusted, so the refusal was about trust.
    expect(await rpc.requestTrustWithCode(getTempAuthCode())).toBeTruthy();
    expect(await call()).toEqual({ secretNames: ['passport'], unmask: [] });
  });
});
