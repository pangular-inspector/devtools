import { describe, expect, it, vi } from 'vitest';
import type { WsOriginRegistry } from 'devframe/rpc/transports/ws-server';
import { PANGULAR_EXTENSION_ORIGINS } from '../extension-origin.ts';
import { hubAllowedOrigins } from '../hub.ts';

const extension = PANGULAR_EXTENSION_ORIGINS[0];

describe('hubAllowedOrigins', () => {
  it('adds the published extension to a custom registry', () => {
    const custom: WsOriginRegistry = {
      token: 'abc',
      registerFromUrl: vi.fn(() => 'https://app.example'),
      isAllowed: (origin) => origin === 'https://app.example',
    };
    const registry = hubAllowedOrigins(custom) as WsOriginRegistry;
    expect(registry.isAllowed(extension)).toBe(true);
    expect(registry.isAllowed('https://app.example')).toBe(true);
    expect(registry.isAllowed('https://evil.example')).toBe(false);
    expect(registry.isAllowed('chrome-extension://abcdefghijklmnopabcdefghijklmnop')).toBe(false);
    expect(registry.token).toBe('abc');
    expect(registry.registerFromUrl('https://app.example/?t=1')).toBe('https://app.example');
    expect(custom.registerFromUrl).toHaveBeenCalledWith('https://app.example/?t=1');
  });

  it('adds the published extension to a list', () => {
    expect(hubAllowedOrigins(['https://app.example'])).toEqual([
      'https://app.example',
      ...PANGULAR_EXTENSION_ORIGINS,
    ]);
  });

  it('warns once when the origin check is off', () => {
    const warn = vi.fn();
    expect(hubAllowedOrigins(false, warn)).toBe(false);
    expect(hubAllowedOrigins(false, warn)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('allowedOrigins is false');
  });
});
