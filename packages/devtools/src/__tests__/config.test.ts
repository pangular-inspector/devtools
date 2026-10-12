import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION_TOOLS,
  ACTION_TOOL_FREE_MODES,
  AGENT_INSPECTOR,
  AGENT_SAFETY,
  PANGULAR_INSPECTORS,
  RPC_INSPECTOR,
  SHARED_RPC,
  agentAllowed,
  agentSafety,
  pangularConfigProblems,
  pickPangularConfig,
  resolvePangularConfig,
  summarizePangularConfig,
  type PangularConfig,
} from '../config.ts';
import { createPangular } from '../devframe.ts';
import { initPangularHub } from '../hub.ts';
import { makeProject } from './analog-fixture.ts';
import { isSecretKey, setRedaction } from '../forms-privacy.ts';

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  const definitions = (ctx.rpc as unknown as { definitions: Map<string, unknown> }).definitions;
  const rpc = [...definitions.keys()]
    .filter((name) => name.startsWith('pangular:'))
    .map((name) => name.slice('pangular:'.length));
  const manifest = ctx.agent.list();
  const strip = (id: string) => id.replace(/^pangular:/, '');
  return {
    ctx,
    rpc,
    tools: manifest.tools.map((tool) => strip(tool.id)),
    actionTools: manifest.tools.filter((t) => t.safety !== 'read').map((t) => strip(t.id)),
    safety: Object.fromEntries(manifest.tools.map((t) => [strip(t.id), t.safety])),
    describe: (name: string) => manifest.tools.find((t) => strip(t.id) === name),
    resources: manifest.resources.map((resource) => strip(resource.id)),
    invoke: (name: string, payload: unknown) =>
      ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never)),
  };
}

describe('resolvePangularConfig', () => {
  it('turns everything on by default', () => {
    const config = resolvePangularConfig();
    expect(Object.values(config.inspectors).every(Boolean)).toBe(true);
    expect(Object.keys(config.inspectors)).toEqual([...PANGULAR_INSPECTORS]);
    expect(Object.values(config.agent.tools).every(Boolean)).toBe(true);
    expect(config.agent.readOnly).toBe(false);
    expect(config.actions).toEqual({
      forms: true,
      router: true,
      ngrx: true,
      http: true,
      analog: true,
    });
  });

  it('carries a disabled inspector into its agent tools and panel actions', () => {
    const config = resolvePangularConfig({
      inspectors: { forms: false, ngrx: false },
      agent: { tools: { pipes: false } },
    });
    expect(config.inspectors.forms).toBe(false);
    expect(config.inspectors.pipes).toBe(true);
    expect(config.agent.tools).toMatchObject({ forms: false, ngrx: false, pipes: false });
    expect(config.agent.tools.router).toBe(true);
    expect(config.actions).toEqual({
      forms: false,
      router: true,
      ngrx: false,
      http: true,
      analog: true,
    });
  });

  it('reads actions as a switch or per action', () => {
    expect(resolvePangularConfig({ actions: false }).actions).toEqual({
      forms: false,
      router: false,
      ngrx: false,
      http: false,
      analog: false,
    });
    expect(resolvePangularConfig({ actions: { router: false } }).actions).toEqual({
      forms: true,
      router: false,
      ngrx: true,
      http: true,
      analog: true,
    });
  });

  it('ignores values that are not booleans and keys it does not know', () => {
    const config = resolvePangularConfig({
      inspectors: { forms: 'no', router: 0, unknown: false },
      agent: 'read-only',
      actions: ['forms'],
    });
    expect(config).toEqual(resolvePangularConfig());
    expect(resolvePangularConfig(null)).toEqual(resolvePangularConfig());
  });

  it('returns its own output unchanged', () => {
    const config = resolvePangularConfig({
      inspectors: { signals: false },
      agent: { readOnly: true, tools: { router: false } },
      actions: { ngrx: false },
    });
    expect(resolvePangularConfig(JSON.parse(JSON.stringify(config)))).toEqual(config);
  });

  it('splits the config out of hub and plugin options', () => {
    const { config, rest } = pickPangularConfig({
      base: '/x/',
      auth: false,
      allowedOrigins: ['https://app.example'],
      mcp: { authorization: 'token' },
      inspectors: { http: false },
      agent: { readOnly: true },
    });
    expect(rest).toEqual({
      base: '/x/',
      auth: false,
      allowedOrigins: ['https://app.example'],
      mcp: { authorization: 'token' },
    });
    expect(config).toEqual({
      inspectors: { http: false },
      agent: { readOnly: true },
      actions: undefined,
      redaction: undefined,
      limits: undefined,
    });
  });

  it('fills in and clamps the limits', () => {
    expect(resolvePangularConfig().limits).toEqual({
      refreshMs: 3000,
      navigations: 50,
      formTimeline: 200,
      httpCalls: 200,
      changeLog: 200,
      cdCycles: 200,
      capacitorCalls: 200,
    });
    expect(
      resolvePangularConfig({
        limits: {
          refreshMs: 100,
          navigations: 10_000,
          formTimeline: 99.6,
          httpCalls: Number.NaN,
          changeLog: '500',
          cdCycles: 5,
          capacitorCalls: 5000,
        },
      }).limits,
    ).toEqual({
      refreshMs: 500,
      navigations: 500,
      formTimeline: 100,
      httpCalls: 200,
      changeLog: 200,
      cdCycles: 10,
      capacitorCalls: 2000,
    });
    expect(resolvePangularConfig({ limits: { refreshMs: 60_000 } }).limits.refreshMs).toBe(8000);
  });

  it('keeps redaction names as trimmed, unique strings', () => {
    expect(resolvePangularConfig().redaction).toEqual({ secretNames: [], unmask: [] });
    const config = resolvePangularConfig({
      redaction: { secretNames: [' passport ', 'passport', '', 7, 'x'.repeat(101)], unmask: 'pin' },
    });
    expect(config.redaction).toEqual({ secretNames: ['passport'], unmask: [] });
  });
});

describe('summarizePangularConfig', () => {
  it('is empty for the defaults', () => {
    expect(summarizePangularConfig(resolvePangularConfig())).toEqual([]);
    expect(summarizePangularConfig(resolvePangularConfig({ limits: { refreshMs: 3000 } }))).toEqual(
      [],
    );
  });

  it('lists only what differs from the defaults', () => {
    const config = resolvePangularConfig({
      inspectors: { ngrx: false, pipes: false },
      agent: { readOnly: true, tools: { router: false, pipes: false } },
      actions: { forms: false, http: false, ngrx: false },
      redaction: { secretNames: ['passport'], unmask: ['pin'] },
      limits: { refreshMs: 1000, httpCalls: 50 },
    });
    expect(summarizePangularConfig(config)).toEqual([
      { label: 'Inspectors off', value: 'NgRx, Pipes' },
      { label: 'Agent', value: 'Read-only' },
      { label: 'Hidden from the agent', value: 'Router' },
      { label: 'Blocked actions', value: 'Form writes, HTTP mocking' },
      { label: 'Extra secret names', value: 'passport' },
      { label: 'Unmasked names', value: 'pin' },
      { label: 'Limits', value: 'poll every 1000 ms, 50 HTTP calls' },
    ]);
  });
});

describe('agent tool and RPC registration', () => {
  it('assigns every tool, resource and RPC function to an inspector or keeps it shared', async () => {
    const { rpc, tools, resources } = await boot();
    const unassigned = rpc.filter((name) => !RPC_INSPECTOR[name] && !SHARED_RPC.includes(name));
    expect(unassigned).toEqual([]);
    for (const id of [...tools, ...resources].filter((id) => !SHARED_RPC.includes(id))) {
      expect(agentAllowed({ id }, resolvePangularConfig({ agent: { tools: offAll() } }))).toBe(
        false,
      );
    }
    expect(Object.keys(AGENT_INSPECTOR).every((id) => [...tools, ...resources].includes(id))).toBe(
      true,
    );
  });

  it('keeps open-in-editor with every inspector off, as an RPC only, inside the project root', async () => {
    const { rpc, tools, invoke } = await boot({ inspectors: offAll() });
    expect(rpc).toContain('open-in-editor');
    expect(tools).not.toContain('open-in-editor');
    expect(await invoke('open-in-editor', { file: '../../../../etc/passwd' })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/outside the project root/),
    });
    expect(await invoke('open-in-editor', { file: 'package.json/nope' })).toMatchObject({
      ok: false,
    });
  });

  it('registers everything by default', async () => {
    const { tools, actionTools } = await boot();
    expect(actionTools.sort()).toEqual(
      [
        'analog-call-api',
        'change-detection',
        'clear-recordings',
        'dispatch-ngrx-action',
        'fill-form',
        'form-action',
        'navigate',
        'record-pipes',
        'remove-http-rule',
        'set-http-rule',
      ].sort(),
    );
    expect(tools).toContain('inspect-forms');
  });

  it('registers each tool with its tier from AGENT_SAFETY', async () => {
    const { safety } = await boot();
    expect(
      Object.fromEntries(Object.entries(safety).filter(([, tier]) => tier !== 'read')),
    ).toEqual(AGENT_SAFETY);
    expect(safety['highlight']).toBe('read');
    expect(safety['clear-recordings']).toBe('destructive');
    expect(safety['analog-call-api']).toBe('destructive');
    expect(safety['navigate']).toBe('action');
    expect(safety['record-pipes']).toBe('action');
    expect(safety['change-detection']).toBe('action');
  });

  it('keeps only read tools in read-only mode', async () => {
    const { tools, actionTools, safety, resources } = await boot({ agent: { readOnly: true } });
    expect(actionTools).toEqual([]);
    expect(Object.values(safety).every((tier) => tier === 'read')).toBe(true);
    for (const dropped of [
      'navigate',
      'record-pipes',
      'clear-recordings',
      'analog-call-api',
      'form-action',
    ]) {
      expect(tools).not.toContain(dropped);
    }
    expect(tools).toEqual(
      expect.arrayContaining(['inspect-forms', 'list-routes', 'analog-lint', 'highlight']),
    );
    expect(resources).toEqual(expect.arrayContaining(['component-tree', 'router', 'forms']));
  });

  it('keeps change-detection as a read tool without record in read-only mode', async () => {
    const full = await boot();
    const fullSchema = full.describe('change-detection')?.inputSchema as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(fullSchema.properties)).toContain('record');

    const readOnly = await boot({ agent: { readOnly: true } });
    const tool = readOnly.describe('change-detection');
    expect(tool?.safety).toBe('read');
    const schema = tool?.inputSchema as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties)).not.toContain('record');
    const answer = (await readOnly.ctx.agent.invoke('pangular:change-detection', {
      record: 'start',
    })) as { markdown: string };
    expect(answer.markdown).toContain('agent.readOnly');
  });

  it('keeps navigate for its free modes when actions.router is off', async () => {
    expect(ACTION_TOOLS.router).toContain('navigate');
    expect(ACTION_TOOL_FREE_MODES['navigate']).toEqual(['instrument', 'resolve-lazy']);
    const blocked = resolvePangularConfig({ actions: { router: false } });
    expect(agentAllowed({ id: 'pangular:navigate' }, blocked)).toBe(true);
    expect(
      agentAllowed({ id: 'pangular:navigate' }, resolvePangularConfig({ actions: false })),
    ).toBe(true);
    expect(
      agentAllowed(
        { id: 'pangular:navigate' },
        resolvePangularConfig({ agent: { readOnly: true } }),
      ),
    ).toBe(false);
  });

  it('gives resources and unlisted tools the read tier', () => {
    const readOnly = resolvePangularConfig({ agent: { readOnly: true } });
    expect(agentSafety('pangular:forms', readOnly)).toBe('read');
    expect(agentSafety('pangular:highlight', readOnly)).toBe('read');
    expect(agentSafety('pangular:change-detection', readOnly)).toBe('read');
    expect(agentSafety('pangular:change-detection', resolvePangularConfig())).toBe('action');
    expect(agentSafety('pangular:clear-recordings', resolvePangularConfig())).toBe('destructive');
    expect(agentAllowed({ id: 'pangular:forms' }, readOnly)).toBe(true);
    expect(agentAllowed({ id: 'pangular:clear-recordings' }, readOnly)).toBe(false);
  });

  it('drops the agent tools of a blocked action and keeps the rest', async () => {
    const forms = await boot({ actions: { forms: false } });
    expect(forms.actionTools.sort()).toEqual(
      [
        'analog-call-api',
        'change-detection',
        'clear-recordings',
        'dispatch-ngrx-action',
        'navigate',
        'record-pipes',
        'remove-http-rule',
        'set-http-rule',
      ].sort(),
    );
    expect(forms.tools).toEqual(expect.arrayContaining(['inspect-forms', 'form-history']));
    const router = await boot({ actions: { router: false } });
    expect(router.actionTools).toContain('navigate');
    expect(router.actionTools).toEqual(expect.arrayContaining(['form-action', 'fill-form']));
    expect(router.tools).toContain('list-routes');
    const analog = await boot({ actions: { analog: false } });
    expect(analog.actionTools).not.toContain('analog-call-api');
    expect(analog.tools).toContain('analog-lint');
    const ngrx = await boot({ actions: { ngrx: false } });
    expect(ngrx.actionTools).not.toContain('dispatch-ngrx-action');
    expect(ngrx.tools).toContain('get-ngrx-store');
    const http = await boot({ actions: { http: false } });
    expect(http.actionTools).not.toContain('set-http-rule');
    expect(http.actionTools).not.toContain('remove-http-rule');
    expect(http.tools).toContain('list-http-rules');
  });

  it('leaves out the RPC functions, tools and resources of a disabled inspector', async () => {
    const { rpc, tools, resources } = await boot({ inspectors: { forms: false, analog: false } });
    expect(rpc.filter((name) => RPC_INSPECTOR[name] === 'forms')).toEqual([]);
    expect(rpc.some((name) => name.includes('analog'))).toBe(false);
    expect(tools.some((id) => AGENT_INSPECTOR[id] === 'forms' || id.startsWith('analog-'))).toBe(
      false,
    );
    expect(resources).not.toContain('forms');
    expect(rpc).toContain('push-router');
    expect(tools).toContain('list-routes');
  });

  it('keeps record-pipes with its inspector, not behind a write action', async () => {
    const pipeTools = ['explain-pipe', 'record-pipes'];
    expect((await boot()).tools).toEqual(expect.arrayContaining(pipeTools));
    // Recording patches the page, so it is an action tool: read-only mode
    // drops it, but blocking actions leaves it, as no action covers pipes.
    const blocked = await boot({ actions: false });
    expect(blocked.tools).toEqual(expect.arrayContaining(pipeTools));
    expect(blocked.safety['record-pipes']).toBe('action');
    const readOnly = await boot({ agent: { readOnly: true } });
    expect(readOnly.tools).toContain('explain-pipe');
    expect(readOnly.tools).not.toContain('record-pipes');
    const hidden = await boot({ agent: { tools: { pipes: false } } });
    expect(hidden.tools.filter((id) => pipeTools.includes(id))).toEqual([]);
    expect(hidden.rpc).toContain('request-instrument-pipes');
    const off = await boot({ inspectors: { pipes: false } });
    expect(off.tools.filter((id) => pipeTools.includes(id))).toEqual([]);
    expect(off.rpc).not.toContain('request-instrument-pipes');
  });

  it('hides one inspector from the agent while its panel keeps working', async () => {
    const { rpc, tools, resources } = await boot({ agent: { tools: { router: false } } });
    expect(tools.some((id) => AGENT_INSPECTOR[id] === 'router')).toBe(false);
    expect(tools).not.toContain('get-routes');
    expect(rpc).toContain('get-routes');
    expect(resources).not.toContain('router');
    expect(rpc).toContain('push-router');
  });
});

describe('redaction', () => {
  afterEach(() => setRedaction());

  it('applies the configured secret names on the server', async () => {
    await boot({ redaction: { secretNames: ['voucher'] } });
    expect(isSecretKey('voucherCode')).toBe(true);
    await boot();
    expect(isSecretKey('voucherCode')).toBe(false);
  });
});

describe('panel actions', () => {
  it('refuses blocked writes on the server and lets reads through', async () => {
    const { invoke } = await boot({ actions: false });
    expect(await invoke('request-form-action', { action: 'submit', formId: 'F.form@p1' })).toEqual({
      ok: false,
      error: expect.stringContaining('actions.forms'),
    });
    expect(await invoke('request-router-action', { request: { action: 'navigate' } })).toEqual({
      error: expect.stringContaining('actions.router'),
    });
    expect(await invoke('request-ngrx-action', { request: { type: 'restore', seq: 1 } })).toEqual({
      error: expect.stringContaining('actions.ngrx'),
    });
    expect(await invoke('request-form-action', { action: 'fill', formId: 'F.form@p1' })).toEqual({
      ok: false,
      error: expect.stringContaining('actions.forms'),
    });
    expect(await invoke('request-form-action', null)).toEqual({
      ok: false,
      error: 'Bad request.',
    });
    await expect(invoke('set-http-rules', [])).rejects.toThrow('actions.http');
    await expect(invoke('clear-http-calls', undefined)).rejects.toThrow('actions.http');
    await expect(invoke('clear-router-navigations', 'p1')).rejects.toThrow('actions.router');
    expect(await invoke('analog-call-api', { path: '/api/x' })).toEqual({
      error: expect.stringContaining('actions.analog'),
    });
    expect(await invoke('get-http-rules', undefined)).toEqual([]);
  });

  it('refuses a form action without formId unless it acts on the page', async () => {
    const { ctx, invoke } = await boot();
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: never) => {
      const { requestId } = (options as { args: [{ requestId: string }] }).args[0];
      await invoke('form-action-result', { requestId, pageId: 'p1', result: { ok: true } });
    }) as never);
    expect(await invoke('request-form-action', { action: 'focus' })).toEqual({
      ok: false,
      error: 'focus needs a formId.',
    });
    expect(broadcast).not.toHaveBeenCalled();
    expect(await invoke('request-form-action', { action: 'cancel-pick' })).toEqual({ ok: true });
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('refuses a panel probe with router actions off and lets record and resolve lazy through', async () => {
    const { ctx, invoke } = await boot({ actions: { router: false } });
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: never) => {
      const { requestId } = (options as { args: [{ requestId: string }] }).args[0];
      await invoke('router-action-result', { requestId, pageId: 'p1', result: { ok: true } });
    }) as never);
    expect(
      await invoke('request-router-action', { request: { action: 'probe', url: '/' } }),
    ).toEqual({
      error:
        'Navigating and clearing navigations is turned off in the devtools config (actions.router).',
    });
    expect(
      await invoke('request-router-action', { request: { action: 'instrument', on: true } }),
    ).toEqual({ ok: true });
    expect(
      await invoke('request-router-action', { request: { action: 'resolve-lazy', id: '2' } }),
    ).toEqual({ ok: true });
    expect(broadcast).toHaveBeenCalledTimes(2);
  });

  it('lets HTTP and Analog writes through when only other actions are blocked', async () => {
    const { invoke } = await boot({ actions: { forms: false } });
    expect(await invoke('set-http-rules', [])).toEqual([]);
    expect(await invoke('analog-call-api', { path: 'nope' })).not.toEqual({
      error: expect.stringContaining('actions.analog'),
    });
  });
});

describe('hub', () => {
  const hubs: { close: () => Promise<void> }[] = [];
  afterEach(async () => {
    for (const hub of hubs.splice(0)) await hub.close();
  });

  it('skips the docks of disabled inspectors and publishes the config to pages', async () => {
    const hub = initPangularHub({
      cwd: makeProject({ 'package.json': '{}' }),
      ws: false,
      auth: false,
      allowedOrigins: false,
      inspectors: { ngrx: false },
      agent: { readOnly: true },
    });
    hubs.push(hub);
    await hub.ready;
    const ctx = await hub.context;
    const docks = [...ctx.docks.views.keys()].filter((id) => id.startsWith('pangular:'));
    expect(docks).not.toContain('pangular:ngrx');
    expect(docks).toContain('pangular:analog');
    const meta = await (
      await hub.handler(new Request('http://localhost/__devframes/pangular/__connection.json'))
    ).json();
    expect(meta.configs['pangular']).toEqual(
      resolvePangularConfig({ inspectors: { ngrx: false }, agent: { readOnly: true } }),
    );
  });
});

function offAll() {
  return Object.fromEntries(PANGULAR_INSPECTORS.map((key) => [key, false]));
}

describe('pangularConfigProblems', () => {
  it('reports nothing for the defaults, a valid config and its own resolved output', () => {
    expect(pangularConfigProblems(undefined)).toEqual([]);
    expect(pangularConfigProblems({})).toEqual([]);
    const valid = {
      inspectors: { signals: false },
      agent: { readOnly: true, tools: { router: false } },
      actions: { ngrx: false },
      redaction: { secretNames: ['passport'], unmask: ['pin'] },
      limits: { refreshMs: 1000 },
    };
    expect(pangularConfigProblems(valid)).toEqual([]);
    expect(pangularConfigProblems(resolvePangularConfig(valid))).toEqual([]);
    const hubOptions = { base: '/x/', auth: false, inspectors: {} };
    expect(pangularConfigProblems(pickPangularConfig(hubOptions).config)).toEqual([]);
  });

  it('names unknown keys with a suggestion, wrong types and clamped limits', () => {
    const problems = pangularConfigProblems({
      actions: 'false',
      agent: { readonly: true },
      inspectors: { form: false, route: false, http: 'no' },
      redaction: { secretNames: 'passport' },
      limits: { refreshMs: 100, navigations: 'many' },
      inspector: {},
    });
    expect(problems).toEqual([
      'Unknown option `inspector` was ignored. Did you mean `inspectors`?',
      'Unknown option `inspectors.form` was ignored. Did you mean `forms`?',
      'Unknown option `inspectors.route` was ignored. Did you mean `router`?',
      '`inspectors.http` should be true or false, got the string "no". It was ignored, so it is on.',
      'Unknown option `agent.readonly` was ignored. Did you mean `readOnly`?',
      '`actions` should be true, false or an object, got the string "false". It was ignored, so every action is allowed.',
      '`redaction.secretNames` should be an array of names, got the string "passport". It was ignored.',
      '`limits.refreshMs` is 100, which is outside 500 to 8000 or not whole. It was set to 500.',
      '`limits.navigations` should be a number, got the string "many". It was ignored, so it is 50.',
    ]);
    expect(pangularConfigProblems({ agent: { readOnly: 'true' } })).toEqual([
      '`agent.readOnly` should be true or false, got the string "true". It was ignored, so it is off.',
    ]);
  });

  it('prints one warning from createPangular and none for a clean config', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createPangular({ inspectors: { signals: false } });
    expect(warn).not.toHaveBeenCalled();
    createPangular({ agent: { readonly: true } } as never);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^\[pangular\] The devtools config has a problem:/);
    warn.mockRestore();
  });
});
