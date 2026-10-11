import { Server } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

const hubOptions = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('../hub.ts', () => ({
  PANGULAR_HUB_BASE: '/__devframes/',
  initPangularHub: (options: Record<string, unknown>) => {
    hubOptions.push(options);
    return {
      nodeMiddleware: vi.fn(),
      close: vi.fn(),
      handleUpgrade: vi.fn(),
      context: new Promise(() => {}),
    };
  },
}));

const {
  default: pangularVite,
  hubRequestGate,
  hubUpgradeListener,
  lanAllowed,
} = await import('../vite.ts');

const PHONE = '192.168.1.30';
const LAN_ORIGIN = 'http://192.168.1.20:5173';

function gate(policy: Parameters<typeof hubRequestGate>[1]) {
  const middleware = hubRequestGate('/__devframes/', policy);
  return (remoteAddress: string, headers: Record<string, string> = {}) => {
    const res = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    middleware(
      {
        url: '/__devframes/pangular/__connection.json',
        headers,
        socket: { remoteAddress },
      } as never,
      res as never,
      next,
    );
    return next.mock.calls.length ? 'next' : res.statusCode;
  };
}

/** The request gate the plugin installs, for the given options. */
function pluginGate(options: Parameters<typeof pangularVite>[0]) {
  hubOptions.length = 0;
  const warn = vi.fn();
  const use = vi.fn();
  const plugin = pangularVite({ apiPrefix: 'api', inspectors: { analog: false }, ...options });
  (plugin.configureServer as (server: unknown) => void)({
    config: { root: process.cwd(), server: {}, logger: { warn } },
    middlewares: { use },
    httpServer: null,
  });
  const middleware = use.mock.calls[0][0];
  const call = (remoteAddress: string, headers: Record<string, string> = {}) => {
    const res = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    middleware({ url: '/__devframes/', headers, socket: { remoteAddress } }, res, next);
    return next.mock.calls.length ? 'next' : res.statusCode;
  };
  return { call, warn, auth: hubOptions[0]?.auth };
}

describe('hub request gate on the network', () => {
  it('still refuses every other machine by default, even with its origin listed', () => {
    const check = gate({ allowedOrigins: [LAN_ORIGIN] });
    expect(check(PHONE, { origin: LAN_ORIGIN })).toBe(403);
    expect(check('127.0.0.1', { origin: LAN_ORIGIN })).toBe('next');
  });

  it('tells another machine how to allow it in the 403 body', () => {
    const middleware = hubRequestGate('/__devframes/', {});
    const refuse = (remoteAddress: string) => {
      const res = { statusCode: 200, end: vi.fn() };
      middleware(
        {
          url: '/__devframes/',
          headers: { origin: 'http://evil.example' },
          socket: { remoteAddress },
        } as never,
        res as never,
        vi.fn(),
      );
      return res.end.mock.calls[0][0] as string;
    };
    expect(refuse(PHONE)).toContain('set allowLan: true and list their origin in allowedOrigins');
    expect(refuse('127.0.0.1')).toBe('Pangular Inspector only answers requests from this machine.');
  });

  it('with lan on, answers another machine whose origin is listed', () => {
    const check = gate({ allowedOrigins: [LAN_ORIGIN], lan: true });
    expect(check(PHONE, { origin: LAN_ORIGIN })).toBe('next');
    expect(check(`::ffff:${PHONE}`, { origin: LAN_ORIGIN })).toBe('next');
  });

  it('with lan on, refuses another machine with a wrong or missing origin', () => {
    const check = gate({ allowedOrigins: [LAN_ORIGIN], lan: true });
    expect(check(PHONE, { origin: 'http://192.168.1.99:5173' })).toBe(403);
    expect(check(PHONE, { origin: 'http://evil.example' })).toBe(403);
    expect(check(PHONE)).toBe(403);
    expect(check(PHONE, { origin: 'null' })).toBe(403);
  });

  it('with lan on, takes the origin of a same-origin request from its Host', () => {
    const check = gate({ allowedOrigins: [LAN_ORIGIN], lan: true });
    expect(check(PHONE, { host: '192.168.1.20:5173' })).toBe('next');
    expect(check(PHONE, { host: 'evil.example' })).toBe(403);
  });

  it('with lan on, reads the Host like an origin: default port dropped, host lowercased', () => {
    const check = gate({
      allowedOrigins: ['http://192.168.1.20', 'http://phone.local:5173'],
      lan: true,
    });
    expect(check(PHONE, { host: '192.168.1.20:80' })).toBe('next');
    expect(check(PHONE, { host: '192.168.1.20' })).toBe('next');
    expect(check(PHONE, { host: 'Phone.LOCAL:5173' })).toBe('next');
    // It can't widen access: another host or port is still refused.
    expect(check(PHONE, { host: '192.168.1.20:8080' })).toBe(403);
    expect(check(PHONE, { host: '192.168.1.21:80' })).toBe(403);
    expect(check(PHONE, { host: '192.168.1.20@evil.example' })).toBe(403);
    expect(check(PHONE, { host: '192.168.1.20/x' })).toBe(403);
    expect(check(PHONE, { host: 'evil.example' })).toBe(403);
  });

  it('with lan on and no origins listed, refuses other machines', () => {
    expect(gate({ lan: true })(PHONE, { origin: LAN_ORIGIN })).toBe(403);
  });

  it('applies the same rule to WebSocket upgrades', () => {
    const upgrade = (policy: Parameters<typeof hubUpgradeListener>[1], origin: string) => {
      const server = new Server();
      const hub = vi.fn();
      server.on('upgrade', hubUpgradeListener('/__devframes/', policy, hub));
      const socket = { destroy: vi.fn() };
      server.emit(
        'upgrade',
        { url: '/__devframes/__ws', headers: { origin }, socket: { remoteAddress: PHONE } },
        socket,
        Buffer.alloc(0),
      );
      return hub.mock.calls.length ? 'upgraded' : 'destroyed';
    };
    expect(upgrade({ allowedOrigins: [LAN_ORIGIN] }, LAN_ORIGIN)).toBe('destroyed');
    expect(upgrade({ allowedOrigins: [LAN_ORIGIN], lan: true }, LAN_ORIGIN)).toBe('upgraded');
    expect(upgrade({ allowedOrigins: [LAN_ORIGIN], lan: true }, 'http://evil.example')).toBe(
      'destroyed',
    );
  });
});

describe('lanAllowed', () => {
  it('is off unless asked for', () => {
    expect(lanAllowed(undefined, true, { allowedOrigins: [LAN_ORIGIN] })).toBe(false);
  });

  it('turns on only for true, and warns about any other value', () => {
    const warn = vi.fn();
    expect(lanAllowed('yes', true, { allowedOrigins: [LAN_ORIGIN] }, warn)).toBe(false);
    expect(lanAllowed(1, true, { allowedOrigins: [LAN_ORIGIN] }, warn)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(lanAllowed(false, true, { allowedOrigins: [LAN_ORIGIN] }, warn)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('refuses to turn on without the one-time code, and says so', () => {
    const warn = vi.fn();
    expect(lanAllowed(true, false, { allowedOrigins: [LAN_ORIGIN] }, warn)).toBe(false);
    expect(String(warn.mock.calls[0][0])).toContain('needs the one-time code');
  });

  it('needs a network origin in allowedOrigins', () => {
    const warn = vi.fn();
    expect(lanAllowed(true, true, { allowedOrigins: ['http://localhost:5173'] }, warn)).toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});

describe('pangularVite allowLan', () => {
  it('answers a phone on Wi-Fi with the one-time code on', () => {
    const { call, auth } = pluginGate({ allowLan: true, allowedOrigins: [LAN_ORIGIN] });
    expect(auth).toBe(true);
    expect(call(PHONE, { origin: LAN_ORIGIN })).toBe('next');
  });

  it('stays loopback-only with auth: false, and warns', () => {
    const { call, warn, auth } = pluginGate({
      allowLan: true,
      allowedOrigins: [LAN_ORIGIN],
      auth: false,
    });
    expect(auth).toBe(false);
    expect(call(PHONE, { origin: LAN_ORIGIN })).toBe(403);
    expect(warn.mock.calls.some(([m]) => String(m).includes('Ignoring allowLan'))).toBe(true);
  });

  it('keeps pairing tokens as the auth option and the gate open to the listed origin', () => {
    const tokens = { tokens: ['pairing-token-0123456789abcdef'] };
    const { call, auth } = pluginGate({
      allowLan: true,
      allowedOrigins: [LAN_ORIGIN],
      auth: tokens,
    });
    expect(auth).toEqual(tokens);
    expect(call(PHONE, { origin: LAN_ORIGIN })).toBe('next');
  });

  it('leaves the default unchanged: no other machine', () => {
    const { call } = pluginGate({ allowedOrigins: [LAN_ORIGIN] });
    expect(call(PHONE, { origin: LAN_ORIGIN })).toBe(403);
  });
});

describe('pangularVite and the iOS origin capacitor://localhost', () => {
  const IOS = 'capacitor://localhost';

  it('keeps capacitor://localhost in allowedOrigins instead of dropping it', async () => {
    const { normalizeAllowedOrigins } = await import('../allowed-origins.ts');
    const warn = vi.fn();
    expect(
      normalizeAllowedOrigins([IOS, 'Capacitor://LocalHost/', 'ionic://localhost'], warn),
    ).toEqual([IOS, 'ionic://localhost']);
    expect(warn.mock.calls.some(([m]) => String(m).includes('Ignoring'))).toBe(false);
  });

  it('answers a listed capacitor://localhost and turns the one-time code on', () => {
    const { call, auth, warn } = pluginGate({ allowedOrigins: [IOS] });
    expect(auth).toBe(true);
    expect(call('127.0.0.1', { origin: IOS })).toBe('next');
    expect(warn).not.toHaveBeenCalled();
  });

  it('answers a phone on Wi-Fi from capacitor://localhost with allowLan', () => {
    const { call } = pluginGate({ allowLan: true, allowedOrigins: [IOS] });
    expect(call(PHONE, { origin: IOS })).toBe('next');
  });

  it('still refuses capacitor://localhost when it is not listed, and Origin: null', () => {
    const { call } = pluginGate({ allowedOrigins: [LAN_ORIGIN] });
    expect(call('127.0.0.1', { origin: IOS })).toBe(403);
    expect(call('127.0.0.1', { origin: 'null' })).toBe(403);
    const listed = pluginGate({ allowLan: true, allowedOrigins: [IOS] });
    expect(listed.call('127.0.0.1', { origin: 'null' })).toBe(403);
    expect(listed.call(PHONE, { origin: 'null' })).toBe(403);
    expect(listed.call('127.0.0.1', { origin: 'capacitor://evil.example' })).toBe(403);
  });
});
