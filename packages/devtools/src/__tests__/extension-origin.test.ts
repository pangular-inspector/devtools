import { createHash, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PANGULAR_EXTENSION_IDS,
  extensionOrigin,
  isAllowedExtensionOrigin,
} from '../extension-origin.ts';

const PINNED = 'dcogniffeelebaolkkfbopmjcblhblfk';
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
  it('trusts the extension ID pinned by the manifest key by default', () => {
    expect(PANGULAR_EXTENSION_IDS).toEqual([PINNED]);
    expect(isAllowedExtensionOrigin(`chrome-extension://${PINNED}`)).toBe(true);
    expect(isAllowedExtensionOrigin(`chrome-extension://${OURS}`)).toBe(false);
    expect(isAllowedExtensionOrigin(`chrome-extension://${OTHER}`)).toBe(false);
  });

  it('keeps the pinned extension trusted next to a user list', () => {
    const allowed = [`chrome-extension://${OURS}`];
    expect(isAllowedExtensionOrigin(`chrome-extension://${PINNED}`, allowed)).toBe(true);
    expect(isAllowedExtensionOrigin(`chrome-extension://${OURS}`, allowed)).toBe(true);
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

describe('extension manifest key', () => {
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../../extension/manifest.json'), 'utf8'),
  ) as { key?: string };

  it('is an RSA SubjectPublicKeyInfo that gives the pinned extension ID', () => {
    const der = Buffer.from(manifest.key ?? '', 'base64');
    expect(createPublicKey({ key: der, format: 'der', type: 'spki' }).asymmetricKeyType).toBe(
      'rsa',
    );
    const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)]
      .map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
      .join('');
    expect(id).toBe(PINNED);
  });
});
