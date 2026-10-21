import { afterEach, describe, expect, it } from 'vitest';
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
