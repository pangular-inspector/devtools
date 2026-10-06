import { describe, expect, it } from 'vitest';
import {
  PANGULAR_EXTENSION_IDS,
  extensionOrigin,
  isAllowedExtensionOrigin,
} from '../extension-origin.ts';

const OURS = 'abcdefghijklmnopabcdefghijklmnop';
const OTHER = 'ponmlkjihgfedcbaponmlkjihgfedcba';

describe('extensionOrigin', () => {
  it('reads a Chrome extension origin with a well-formed ID', () => {
    expect(extensionOrigin(`chrome-extension://${OURS}`)).toBe(`chrome-extension://${OURS}`);
    expect(extensionOrigin(`chrome-extension://${OURS.toUpperCase()}/`)).toBe(
      `chrome-extension://${OURS}`,
    );
    expect(extensionOrigin(`chrome-extension://${OURS}/ui/index.html`)).toBe(
      `chrome-extension://${OURS}`,
    );
  });

  it('rejects other schemes and malformed IDs', () => {
    for (const value of [
      'chrome-extension://',
      'chrome-extension://abcdefghijklmnop',
      'chrome-extension://localhost',
      `chrome-extension://${'z'.repeat(32)}`,
      `moz-extension://${OURS}`,
      `https://${OURS}`,
      'not a url',
    ]) {
      expect(extensionOrigin(value)).toBeUndefined();
    }
  });
});

describe('isAllowedExtensionOrigin', () => {
  it('trusts no extension until it has a published ID', () => {
    expect(PANGULAR_EXTENSION_IDS).toEqual([]);
    expect(isAllowedExtensionOrigin(`chrome-extension://${OURS}`)).toBe(false);
  });

  it('accepts the published extension and refuses any other extension', () => {
    expect(isAllowedExtensionOrigin(`chrome-extension://${OURS}`, [], [OURS])).toBe(true);
    expect(isAllowedExtensionOrigin(`chrome-extension://${OTHER}`, [], [OURS])).toBe(false);
  });

  it('accepts an unpacked build listed in allowedOrigins', () => {
    const allowed = [`chrome-extension://${OURS}`];
    expect(isAllowedExtensionOrigin(`chrome-extension://${OURS}`, allowed)).toBe(true);
    expect(isAllowedExtensionOrigin(`chrome-extension://${OTHER}`, allowed)).toBe(false);
  });

  it('only matches the exact origin a browser sends', () => {
    const allowed = [`chrome-extension://${OURS}`];
    for (const origin of [
      `chrome-extension://${OURS}/`,
      `chrome-extension://${OURS.toUpperCase()}`,
      `chrome-extension://${OURS}/ui/index.html`,
    ]) {
      expect(isAllowedExtensionOrigin(origin, allowed, [OURS])).toBe(false);
    }
  });
});
