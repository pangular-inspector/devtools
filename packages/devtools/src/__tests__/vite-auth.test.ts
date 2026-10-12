import { describe, expect, it, vi } from 'vitest';

const hubOptions = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('../hub.ts', () => ({
  PANGULAR_HUB_BASE: '/__devframes/',
  startPangularHub: (options: Record<string, unknown>) => {
    hubOptions.push(options);
    return { nodeMiddleware: vi.fn(), close: vi.fn() };
  },
}));

const { allowsRemoteOrigins, default: pangularVite, hubAuthFor } = await import('../vite.ts');

function hubAuth(
  options: Parameters<typeof pangularVite>[0],
  allowedHosts?: readonly string[] | true,
) {
  hubOptions.length = 0;
  const plugin = pangularVite({ apiPrefix: 'api', ...options });
  const server = {
    config: { root: process.cwd(), server: { allowedHosts } },
    middlewares: { use: vi.fn() },
    httpServer: null,
  };
  (plugin.configureServer as (server: unknown) => void)(server);
  return hubOptions[0]?.auth;
}

describe('allowsRemoteOrigins', () => {
  it('is false when only loopback hosts and origins are trusted', () => {
    expect(allowsRemoteOrigins()).toBe(false);
    expect(allowsRemoteOrigins({ allowedHosts: [] })).toBe(false);
    expect(
      allowsRemoteOrigins({
        allowedHosts: ['localhost', '.localhost', '127.0.0.1', '::1', '[::1]'],
        allowedOrigins: [
          'http://localhost:4200',
          'https://127.0.0.1:5173',
          'http://[::1]:3000',
          'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        ],
      }),
    ).toBe(false);
  });

  it('is true when a tunnel host or any other remote origin is trusted', () => {
    expect(allowsRemoteOrigins({ allowedHosts: true })).toBe(true);
    expect(allowsRemoteOrigins({ allowedHosts: ['localhost', 'myapp.test'] })).toBe(true);
    expect(allowsRemoteOrigins({ allowedHosts: ['.ngrok-free.app'] })).toBe(true);
    expect(allowsRemoteOrigins({ allowedHosts: ['127.attacker.example'] })).toBe(true);
    expect(allowsRemoteOrigins({ allowedOrigins: ['https://tunnel.example:8443'] })).toBe(true);
    expect(allowsRemoteOrigins({ allowedOrigins: ['not a url'] })).toBe(true);
    expect(allowsRemoteOrigins({ allowedOrigins: ['ws://localhost:5173'] })).toBe(true);
  });
});

describe('hubAuthFor', () => {
  it('is on unless auth is false', () => {
    expect(hubAuthFor()).toBe(true);
    expect(hubAuthFor(true)).toBe(true);
    expect(hubAuthFor(false)).toBe(false);
  });
});

describe('pangularVite hub auth', () => {
  it('asks for the one-time code by default, a purely local dev server included', () => {
    expect(hubAuth({})).toBe(true);
    expect(hubAuth({ allowedOrigins: ['http://localhost:4200'] }, ['localhost'])).toBe(true);
  });

  it('keeps the one-time code when a tunnel host or origin is allowed', () => {
    expect(hubAuth({}, ['abc.trycloudflare.com'])).toBe(true);
    expect(hubAuth({}, true)).toBe(true);
    expect(hubAuth({ allowedOrigins: ['https://tunnel.example'] })).toBe(true);
  });

  it('lets the user turn the one-time code off or on explicitly', () => {
    expect(hubAuth({ auth: false, allowedOrigins: ['https://tunnel.example'] })).toBe(false);
    expect(hubAuth({ auth: false }, true)).toBe(false);
    expect(hubAuth({ auth: true })).toBe(true);
  });

  it('passes the devtools config to the hub next to auth', () => {
    hubAuth({ auth: true, inspectors: { http: false }, limits: { refreshMs: 1000 } });
    expect(hubOptions[0]).toMatchObject({
      auth: true,
      inspectors: { http: false },
      limits: { refreshMs: 1000 },
    });
  });
});

describe('pangularVite allowedOrigins', () => {
  function plugin(allowedOrigins: string[]) {
    hubOptions.length = 0;
    const warn = vi.fn();
    const use = vi.fn();
    const server = {
      config: { root: process.cwd(), server: {}, logger: { warn } },
      middlewares: { use },
      httpServer: null,
    };
    (pangularVite({ apiPrefix: 'api', allowedOrigins }).configureServer as (s: unknown) => void)(
      server,
    );
    const gate = use.mock.calls[0][0] as (req: unknown, res: unknown, next: () => void) => void;
    const status = (origin: string | undefined, host?: string) => {
      const res = { statusCode: 200, end: vi.fn() };
      const next = vi.fn();
      const headers = { ...(origin === undefined ? {} : { origin }), ...(host ? { host } : {}) };
      gate(
        { url: '/__devframes/__sse', headers, socket: { remoteAddress: '127.0.0.1' } },
        res,
        next,
      );
      return next.mock.calls.length ? 'next' : res.statusCode;
    };
    return { auth: hubOptions[0]?.auth, warn, status };
  }

  it('matches entries with a trailing slash, a path or an uppercase host', () => {
    for (const entry of [
      'https://abc.trycloudflare.com/',
      'https://abc.trycloudflare.com/app',
      'https://ABC.trycloudflare.com',
    ]) {
      const { auth, warn, status } = plugin([entry]);
      expect(auth).toBe(true);
      expect(status('https://abc.trycloudflare.com')).toBe('next');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"https://abc.trycloudflare.com"'));
    }
  });

  it('refuses a loopback request sent to a foreign Host, with or without an Origin', () => {
    const { warn, status } = plugin([]);
    expect(status(undefined, 'evil.test')).toBe(403);
    expect(status('http://localhost:5173', 'evil.test:5173')).toBe(403);
    expect(status(undefined, 'localhost:5173')).toBe('next');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('host evil.test'));
  });

  it('drops an entry that is not an origin and says so', () => {
    const { warn } = plugin(['abc.trycloudflare.com']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ignoring allowedOrigins entry'));
  });

  it('keeps an exact origin quiet and warns once per refused origin', () => {
    const { warn, status } = plugin(['https://tunnel.example']);
    expect(warn).not.toHaveBeenCalled();
    expect(status('https://evil.example')).toBe(403);
    expect(status('https://evil.example')).toBe(403);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('https://evil.example'));
  });
  it('accepts the Pangular Inspector extension with no allowedOrigins', () => {
    const { status } = plugin([]);
    expect(status('chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk')).toBe('next');
  });

  it('refuses a Chrome extension that is not listed', () => {
    const { status } = plugin([]);
    expect(status('chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba')).toBe(403);
    expect(status('chrome-extension://abcdefghijklmnopabcdefghijklmnop')).toBe(403);
  });

  it('accepts an unpacked extension ID listed in allowedOrigins', () => {
    const selfBuilt = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
    const { warn, status } = plugin([selfBuilt]);
    expect(warn).not.toHaveBeenCalled();
    expect(status(selfBuilt)).toBe('next');
    expect(status('chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk')).toBe('next');
    expect(status('chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba')).toBe(403);
  });

  it('reads an extension entry with a trailing slash or uppercase ID as its origin', () => {
    const { warn, status } = plugin(['chrome-extension://ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP/']);
    expect(status('chrome-extension://abcdefghijklmnopabcdefghijklmnop')).toBe('next');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"chrome-extension://abcdefghijklmnopabcdefghijklmnop"'),
    );
  });
});
