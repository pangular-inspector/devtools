import { resolvePangularConfig } from '@pangular-inspector/devtools/internal/config';
import { describe, expect, it } from 'vitest';
import { withRedaction } from '../devtools-config';

describe('withRedaction', () => {
  const config = resolvePangularConfig();

  it('adds the redaction lists the server answers, with entropy only when it is on', () => {
    expect(withRedaction(config, { secretNames: ['passport'], unmask: [] }).redaction).toEqual({
      secretNames: ['passport'],
      unmask: [],
    });
    expect(
      withRedaction(config, { secretNames: [], unmask: [], entropy: { minLength: 32 } }).redaction,
    ).toEqual({ secretNames: [], unmask: [], entropy: { minLength: 32, threshold: 4.5 } });
    expect(
      withRedaction(config, { secretNames: [], unmask: [], entropy: 'on' }).redaction,
    ).not.toHaveProperty('entropy');
  });

  it('keeps the config for a missing or malformed answer', () => {
    expect(withRedaction(config, null)).toBe(config);
    expect(withRedaction(config, { secretNames: 'passport', unmask: [] })).toBe(config);
  });
});
