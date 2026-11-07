import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { networkInterfaces } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLanAddress } from '../config.ts';
import { cliLanLines, lanDefine, lanUrl, pickLanAddress, viteBindHost } from '../lan-address.ts';
import { LAN_URL_DEFINE, lanDevtoolsURL } from '../lan-url.ts';
import { viteLanAddress } from '../vite-lan.ts';
import pangularVite from '../vite.ts';

type Interfaces = ReturnType<typeof networkInterfaces>;

function nic(address: string, internal = false) {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4' as const,
    mac: '00:00:00:00:00:00',
    internal,
    cidr: `${address}/24`,
  };
}

const INTERFACES: Interfaces = {
  lo: [nic('127.0.0.1', true)],
  docker0: [nic('100.64.0.2')],
  wlan0: [nic('192.168.1.20')],
};

const LAN_OK = {
  allowLan: true,
  allowedOrigins: ['capacitor://localhost'],
};

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[LAN_URL_DEFINE];
});

describe('resolveLanAddress', () => {
  it('is off by default and for false', () => {
    expect(resolveLanAddress(undefined)).toEqual({ on: false });
    expect(resolveLanAddress(false)).toEqual({ on: false });
  });

  it('takes true and a network IPv4 address', () => {
    expect(resolveLanAddress(true)).toEqual({ on: true });
    expect(resolveLanAddress('192.168.1.20')).toEqual({ on: true, address: '192.168.1.20' });
  });

  it('warns about a bigint or a cyclic value without throwing', () => {
    const warn = vi.fn();
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(resolveLanAddress(10n, warn)).toEqual({ on: false });
    expect(resolveLanAddress(cyclic, warn)).toEqual({ on: false });
    expect(warn.mock.calls.map(([m]) => m)).toEqual([
      expect.stringContaining('got a bigint'),
      expect.stringContaining('got a object'),
    ]);
  });

  it('refuses loopback, unspecified and malformed values with a warning', () => {
    for (const value of ['127.0.0.1', '0.0.0.0', 'localhost', '192.168.1', 1, {}]) {
      const warn = vi.fn();
      expect(resolveLanAddress(value, warn)).toEqual({ on: false });
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[pangular\] Ignoring lanAddress/));
    }
  });
});

describe('the LAN URL', () => {
  it('picks a private address over other non-internal ones', () => {
    expect(pickLanAddress(INTERFACES)).toBe('192.168.1.20');
    expect(pickLanAddress({ eth0: [nic('100.64.0.2')] })).toBe('100.64.0.2');
    expect(pickLanAddress({ lo: [nic('127.0.0.1', true)] })).toBeUndefined();
  });

  it("reads Vite's server.host as a bind host", () => {
    expect(viteBindHost(true)).toBe('0.0.0.0');
    expect(viteBindHost('')).toBe('0.0.0.0');
    expect(viteBindHost(undefined)).toBe('localhost');
    expect(viteBindHost(false)).toBe('localhost');
    expect(viteBindHost('192.168.1.20')).toBe('192.168.1.20');
  });

  it('builds the URL for a server on every interface', () => {
    const input = { host: '0.0.0.0', port: 5173, path: '/__devframes/pangular/' };
    expect(lanUrl({ ...input, lan: { on: true }, interfaces: INTERFACES })).toEqual({
      url: 'http://192.168.1.20:5173/__devframes/pangular/',
    });
    expect(
      lanUrl({ ...input, lan: { on: true, address: '10.0.0.5' }, interfaces: INTERFACES }),
    ).toEqual({ url: 'http://10.0.0.5:5173/__devframes/pangular/' });
    expect(lanUrl({ ...input, https: true, lan: { on: true }, interfaces: INTERFACES })).toEqual({
      url: 'https://192.168.1.20:5173/__devframes/pangular/',
    });
  });

  it('gives no URL for a server on loopback, so it never points a device at a closed port', () => {
    for (const host of ['localhost', '127.0.0.1', '::1']) {
      const result = lanUrl({ lan: { on: true }, host, port: 9999, path: '/' });
      expect(result).toEqual({ problem: expect.stringContaining('listens on') });
    }
  });

  it('uses the one address a server binds to, and refuses another', () => {
    const base = { host: '192.168.1.20', port: 9999, path: '/' };
    expect(lanUrl({ ...base, lan: { on: true } })).toEqual({ url: 'http://192.168.1.20:9999/' });
    expect(lanUrl({ ...base, lan: { on: true, address: '10.0.0.5' } })).toEqual({
      problem: expect.stringContaining('not on 10.0.0.5'),
    });
  });

  it('says when the machine has no network address', () => {
    expect(
      lanUrl({
        lan: { on: true },
        host: '0.0.0.0',
        port: 9999,
        path: '/',
        interfaces: { lo: [nic('127.0.0.1', true)] },
      }),
    ).toEqual({ problem: 'this machine has no network address.' });
  });

  it('writes the define as a JSON string, and the CLI lines as an ng build flag', () => {
    expect(lanDefine('http://192.168.1.20:9999/')).toEqual({
      __PANGULAR_LAN_URL__: '"http://192.168.1.20:9999/"',
    });
    expect(cliLanLines('http://192.168.1.20:9999/').join('\n')).toContain(
      `--define "__PANGULAR_LAN_URL__='http://192.168.1.20:9999/'"`,
    );
  });
});

describe('lanDevtoolsURL', () => {
  it('is undefined when the build injected nothing', () => {
    expect(lanDevtoolsURL()).toBeUndefined();
  });

  it('reads the value Vite defines on globalThis in dev, and ignores anything but a URL', () => {
    (globalThis as Record<string, unknown>)[LAN_URL_DEFINE] = 'http://192.168.1.20:5173/x/';
    expect(lanDevtoolsURL()).toBe('http://192.168.1.20:5173/x/');
    (globalThis as Record<string, unknown>)[LAN_URL_DEFINE] = 'javascript:alert(1)';
    expect(lanDevtoolsURL()).toBeUndefined();
    (globalThis as Record<string, unknown>)[LAN_URL_DEFINE] = 42;
    expect(lanDevtoolsURL()).toBeUndefined();
  });
});

describe('viteLanAddress gates', () => {
  const user = { server: { host: true, port: 5173 } };

  function run(options: Parameters<typeof viteLanAddress>[0], config: object = user) {
    const lan = viteLanAddress(options, '/__devframes/', INTERFACES);
    const define = lan.define(config);
    const warn = vi.fn();
    lan.report({ warn });
    return { define, url: lan.url, warnings: warn.mock.calls.map(([m]) => String(m)), lan };
  }

  it('injects nothing and says nothing when off', () => {
    expect(run({ ...LAN_OK })).toEqual(
      expect.objectContaining({ define: undefined, warnings: [] }),
    );
  });

  it('injects the hub URL when allowLan is in effect and Vite listens on the network', () => {
    const { define, url, warnings } = run({ ...LAN_OK, lanAddress: true });
    expect(url).toBe('http://192.168.1.20:5173/__devframes/pangular/');
    expect(define).toEqual({ __PANGULAR_LAN_URL__: JSON.stringify(url) });
    expect(warnings).toEqual([]);
  });

  it('respects allowLan, the one-time code and allowedOrigins', () => {
    for (const options of [
      { lanAddress: true, allowedOrigins: ['capacitor://localhost'] },
      { lanAddress: true, allowLan: true },
      { lanAddress: true, allowLan: true, allowedOrigins: ['http://localhost:4200'] },
      { ...LAN_OK, lanAddress: true, auth: false },
    ]) {
      const { define, warnings } = run(options);
      expect(define).toBeUndefined();
      expect(warnings).toEqual([expect.stringMatching(/don't answer other machines/)]);
    }
  });

  it('keeps the one-time code on with pairing tokens', () => {
    const { define } = run({ ...LAN_OK, lanAddress: true, auth: { tokens: ['a'.repeat(32)] } });
    expect(define).toBeDefined();
  });

  it('needs server.host on the network', () => {
    const { define, warnings } = run({ ...LAN_OK, lanAddress: true }, { server: {} });
    expect(define).toBeUndefined();
    expect(warnings).toEqual([expect.stringContaining('listens on localhost only')]);
  });

  it('warns when Vite moved to another port than the injected one', () => {
    const { lan } = run({ ...LAN_OK, lanAddress: true });
    const warn = vi.fn();
    lan.checkPort({ address: '::', family: 'IPv6', port: 5173 }, { warn });
    expect(warn).not.toHaveBeenCalled();
    lan.checkPort({ address: '::', family: 'IPv6', port: 5174 }, { warn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('server.strictPort'));
  });

  it('applies to development builds only, never to production ones', () => {
    const on = viteLanAddress({ ...LAN_OK, lanAddress: true }, '/__devframes/');
    expect(on.appliesToBuild('development')).toBe(true);
    expect(on.appliesToBuild('production')).toBe(false);
    expect(viteLanAddress({ ...LAN_OK }, '/__devframes/').appliesToBuild('development')).toBe(
      false,
    );
  });
});

describe('pangularVite lanAddress', () => {
  type Apply = (config: object, env: { command: string; mode: string }) => boolean;
  type ConfigHook = (user: object, env: { command: string; mode: string }) => unknown;

  it('keeps the plugin to the dev server unless lanAddress is on', () => {
    expect(pangularVite({ ...LAN_OK }).apply).toBe('serve');
    const lan = pangularVite({ ...LAN_OK, lanAddress: true }).apply as Apply;
    expect(lan({}, { command: 'serve', mode: 'development' })).toBe(true);
    expect(lan({}, { command: 'build', mode: 'development' })).toBe(true);
    expect(lan({}, { command: 'build', mode: 'production' })).toBe(false);
  });

  it('adds the define in the config hook of the dev server', () => {
    const plugin = pangularVite({ ...LAN_OK, lanAddress: '192.168.1.20' });
    const config = (plugin.config as ConfigHook)(
      { server: { host: true, port: 4300 } },
      { command: 'serve', mode: 'development' },
    );
    expect(config).toEqual({
      define: { __PANGULAR_LAN_URL__: '"http://192.168.1.20:4300/__devframes/pangular/"' },
    });
  });

  it('injects the address into a development build, and only the define', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pangular-lan-build-'));
    writeFileSync(
      join(root, 'index.html'),
      '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>',
    );
    writeFileSync(
      join(root, 'main.js'),
      'console.log(typeof __PANGULAR_LAN_URL__ === "undefined" ? "none" : __PANGULAR_LAN_URL__);\n',
    );
    const run = async (mode: string) => {
      const outDir = join(root, `dist-${mode}`);
      await build({
        configFile: false,
        root,
        mode,
        logLevel: 'silent',
        server: { host: true, port: 5180 },
        build: { outDir, minify: false },
        plugins: [pangularVite({ ...LAN_OK, lanAddress: '192.168.1.20' })],
      });
      const assets = join(outDir, 'assets');
      const js = readdirSync(assets).find((file) => file.endsWith('.js'))!;
      return {
        js: readFileSync(join(assets, js), 'utf8'),
        html: readFileSync(join(outDir, 'index.html'), 'utf8'),
      };
    };
    const development = await run('development');
    expect(development.js).toContain('http://192.168.1.20:5180/__devframes/pangular/');
    expect(development.html).not.toContain('data-pangular-overlay');
    const production = await run('production');
    expect(production.js).not.toContain('192.168.1.20');
  }, 30_000);
});
