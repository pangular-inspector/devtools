import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it } from 'vitest';
import {
  pangularConfigProblems,
  resolvePangularConfig,
  summarizePangularConfig,
  type PangularConfig,
} from '../config.ts';
import { createPangular } from '../devframe.ts';
import { entropyRedaction } from '../entropy-redact.ts';
import { setRedaction } from '../forms-privacy.ts';
import { serverRedaction } from '../overlay-redaction.ts';

afterEach(() => setRedaction());

describe('redaction.entropy', () => {
  it('is off by default and while it is false or not an option', () => {
    expect(resolvePangularConfig().redaction).not.toHaveProperty('entropy');
    for (const entropy of [false, 'yes', 1, null, ['minLength']]) {
      expect(resolvePangularConfig({ redaction: { entropy } }).redaction).not.toHaveProperty(
        'entropy',
      );
    }
  });

  it('resolves true and an object to both options', () => {
    expect(resolvePangularConfig({ redaction: { entropy: true } }).redaction).toEqual({
      secretNames: [],
      unmask: [],
      entropy: { minLength: 24, threshold: 4.5 },
    });
    expect(
      resolvePangularConfig({ redaction: { entropy: { minLength: 40, threshold: 4 } } }).redaction
        .entropy,
    ).toEqual({ minLength: 40, threshold: 4 });
    // A value out of range takes its default; the rest is kept.
    expect(
      resolvePangularConfig({ redaction: { entropy: { minLength: 4, threshold: 3.5 } } }).redaction
        .entropy,
    ).toEqual({ minLength: 24, threshold: 3.5 });
    const resolved = resolvePangularConfig({ redaction: { entropy: { minLength: 32 } } });
    expect(resolvePangularConfig(JSON.parse(JSON.stringify(resolved)))).toEqual(resolved);
  });

  it('reports a value it ignores or changes', () => {
    expect(pangularConfigProblems({ redaction: { entropy: true } })).toEqual([]);
    expect(
      pangularConfigProblems({ redaction: { entropy: { minLength: 32, threshold: 4 } } }),
    ).toEqual([]);
    expect(pangularConfigProblems({ redaction: { entropy: 'on' } })).toEqual([
      '`redaction.entropy` should be true, false or an object, got the string "on". It was ignored, so it is off.',
    ]);
    expect(
      pangularConfigProblems({
        redaction: { entropy: { minLength: 8, threshold: 7, length: 30 } },
      }),
    ).toEqual([
      'Unknown option `redaction.entropy.length` was ignored. Did you mean `minLength`?',
      '`redaction.entropy.minLength` should be a whole number from 16 to 512, got 8. It uses 24.',
      '`redaction.entropy.threshold` should be a number of bits from 2 to 6, got 7. It uses 4.5.',
    ]);
  });

  it('shows in the configuration summary when it is on, with options that differ', () => {
    const summary = (entropy: PangularConfig['redaction']) =>
      summarizePangularConfig(resolvePangularConfig({ redaction: entropy })).find(
        (item) => item.label === 'Entropy masking',
      )?.value;
    expect(summary({ entropy: true })).toBe('On');
    expect(summary({ entropy: { minLength: 32, threshold: 4 } })).toBe(
      'On, 32 characters or more, up to 4 bits per character',
    );
    expect(summary({})).toBeUndefined();
  });

  it('reaches the overlay through the redaction-config answer', async () => {
    const on = { call: async () => ({ secretNames: [], unmask: [], entropy: { minLength: 30 } }) };
    expect(await serverRedaction(on, undefined)).toEqual({
      secretNames: [],
      unmask: [],
      entropy: { minLength: 30, threshold: 4.5 },
    });
    const odd = { call: async () => ({ secretNames: [], unmask: [], entropy: 'yes' }) };
    expect(await serverRedaction(odd, undefined)).toEqual({ secretNames: [], unmask: [] });
  });

  it('applies on the devtools server and goes to trusted pages with the redaction config', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({ redaction: { entropy: { minLength: 28 } } }).setup(ctx as never);
    expect(entropyRedaction()).toEqual({ minLength: 28, threshold: 4.5 });
    const answer = await ctx.rpc.invokeLocal(
      'pangular:redaction-config' as never,
      ...([] as never),
    );
    expect(answer).toMatchObject({ entropy: { minLength: 28, threshold: 4.5 } });
  });
});
