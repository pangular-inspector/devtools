// @vitest-environment jsdom
/**
 * `redaction.entropy`. Every token here is generated when the test runs, from
 * a seeded generator, so the file holds no secret-looking literal and the
 * results never flake.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  ENTROPY_DEFAULTS,
  entropyRedaction,
  entropyRedactionOn,
  isHighEntropy,
  redactHighEntropy,
  resolveEntropy,
  shannonEntropy,
} from '../entropy-redact.ts';
import { REDACTED, redactMessage, SecretSet, setRedaction } from '../forms-privacy.ts';
import { serialize } from '../serialize.ts';
import { redactRecord, redactText, redactUrl } from '../router.ts';
import { redactAnalogReport, redactCall, redactHeaders, redactPreview } from '../redaction.ts';
import { redactBody, redactMessage as redactServerMessage } from '../analog-server-log.ts';
import { maskedArgs } from '../capacitor-redact.ts';
import { serialize as ngrxSerialize } from '../ngrx-shared.ts';
import { consoleText, valueText } from '../errors-collector.ts';
import { serializeFormValue } from '../forms.ts';
import type { AnalogRuntimeReport } from '../analog-runtime.ts';
import type { HttpCall } from '../http-rules.ts';

afterEach(() => setRedaction());

/** A deterministic pseudo-random string over `alphabet` (mulberry32). */
function randomToken(length: number, seed: number, alphabet: string): string {
  let state = seed >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out += alphabet[Math.floor(r * alphabet.length)];
  }
  return out;
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const BASE62 = `${LOWER.toUpperCase()}${LOWER}0123456789`;
const BASE64URL = `${BASE62}-_`;
const BASE64 = `${BASE62}+/`;
const HEX = '0123456789abcdef';

/** The first seeded draw of `length` that the default rules mask. */
function opaque(length: number, seed = 1, alphabet = BASE62): string {
  for (let next = seed; next < seed + 1000; next++) {
    const token = randomToken(length, next * 7919 + length, alphabet);
    if (isHighEntropy(token, ENTROPY_DEFAULTS)) return token;
  }
  throw new Error(`No opaque token of ${length} characters`);
}

const TOKEN = opaque(24);
const LONG_TOKEN = opaque(40, 2);

describe('isHighEntropy', () => {
  it('flags random mixed-case tokens with digits', () => {
    for (const length of [24, 32, 40, 64]) {
      let candidates = 0;
      let flagged = 0;
      for (let seed = 1; seed <= 500; seed++) {
        const token = randomToken(length, seed * 7919 + length, BASE64URL);
        // A draw without all three classes is not a candidate at all.
        if (!/[a-z]/.test(token) || !/[A-Z]/.test(token) || !/\d/.test(token)) continue;
        candidates++;
        if (isHighEntropy(token)) flagged++;
      }
      // A random token can look like words or repeat itself; at most 2% of them do.
      expect(flagged / candidates, `length ${length}`).toBeGreaterThanOrEqual(0.98);
    }
  });

  it('keeps hex, UUIDs and ULIDs readable', () => {
    const hex = (length: number, seed: number) => randomToken(length, seed, HEX);
    const uuid = [hex(8, 1), hex(4, 2), hex(4, 3), hex(4, 4), hex(12, 5)].join('-');
    for (const value of [
      uuid,
      hex(24, 6),
      hex(40, 7),
      hex(64, 8),
      hex(32, 9).toUpperCase(),
      randomToken(26, 10, '0123456789ABCDEFGHJKMNPQRSTVWXYZ'),
      randomToken(26, 11, '0123456789abcdefghjkmnpqrstvwxyz'),
    ]) {
      expect(isHighEntropy(value), value).toBe(false);
    }
  });

  it('keeps identifiers, words and numbers readable', () => {
    for (const value of [
      'getUserProfileById2024Xx',
      'handleUserProfileUpdate2',
      'ChangeDetectionStrategy1',
      'UserServiceImpl2Factory3',
      'MyAppComponent_Factory_2024',
      'handleUserProfileUpdateRequest2x',
      'ngOnInit2CheckedLifecycleHook',
      'ng-reflect-router-link-active',
      `css-${randomToken(20, 12, `${LOWER}0123456789`)}`,
      'a'.repeat(28),
      '1234567890'.repeat(3),
      LOWER.toUpperCase(),
      'Short1Aa',
    ]) {
      expect(isHighEntropy(value), value).toBe(false);
    }
  });

  it('measures Shannon entropy in bits per character', () => {
    expect(shannonEntropy('')).toBe(0);
    expect(shannonEntropy('aaaa')).toBe(0);
    expect(shannonEntropy('abcd')).toBe(2);
  });
});

describe('the options', () => {
  it('turns on with true or an object, and fills in what an object leaves out', () => {
    expect(resolveEntropy(undefined)).toBeUndefined();
    expect(resolveEntropy(false)).toBeUndefined();
    expect(resolveEntropy('yes')).toBeUndefined();
    expect(resolveEntropy([])).toBeUndefined();
    expect(resolveEntropy(true)).toEqual({ minLength: 24, threshold: 4.5 });
    expect(resolveEntropy({})).toEqual({ minLength: 24, threshold: 4.5 });
    expect(resolveEntropy({ minLength: 32 })).toEqual({ minLength: 32, threshold: 4.5 });
    expect(resolveEntropy({ minLength: 8, threshold: 9 })).toEqual(ENTROPY_DEFAULTS);
    expect(resolveEntropy({ minLength: 30.5, threshold: Number.NaN })).toEqual(ENTROPY_DEFAULTS);
  });

  it('masks only runs of at least minLength', () => {
    setRedaction({ entropy: { minLength: 32 } });
    expect(entropyRedaction()).toEqual({ minLength: 32, threshold: 4.5 });
    expect(redactMessage(`short ${TOKEN}`)).toBe(`short ${TOKEN}`);
    expect(redactMessage(`long ${LONG_TOKEN}`)).toBe(`long ${REDACTED}`);
  });

  it('asks long runs for fewer bits with a lower threshold', () => {
    // 48 characters over a 10-letter alphabet: about 3.3 bits, under the default 4.5.
    let narrow = '';
    for (let seed = 1; !narrow; seed++) {
      const draw = randomToken(48, seed, 'gHjKmN5678');
      if (/[a-z]/.test(draw) && /[A-Z]/.test(draw) && /\d/.test(draw)) narrow = draw;
    }
    expect(shannonEntropy(narrow)).toBeLessThan(4.5);
    expect(shannonEntropy(narrow)).toBeGreaterThan(3);
    expect(redactHighEntropy(narrow, REDACTED, ENTROPY_DEFAULTS)).toBe(narrow);
    expect(redactHighEntropy(narrow, REDACTED, { minLength: 24, threshold: 3 })).toBe(REDACTED);
  });
});

describe('redactHighEntropy', () => {
  it('does nothing while the option is off', () => {
    expect(entropyRedactionOn()).toBe(false);
    expect(redactHighEntropy(`token ${TOKEN}`, REDACTED)).toBe(`token ${TOKEN}`);
    expect(redactHighEntropy(`token ${TOKEN}`, REDACTED, true)).toBe(`token ${REDACTED}`);
  });

  it('judges base64 with slashes whole, and paths segment by segment', () => {
    const body = opaque(42, 3);
    const slashed = `${body.slice(0, 14)}/${body.slice(14, 28)}/${body.slice(28)}`;
    expect(redactHighEntropy(`key ${slashed}`, REDACTED, true)).toBe(`key ${REDACTED}`);
    const padded = `${opaque(27, 6, BASE64URL)}=`;
    expect(redactHighEntropy(`v=${padded};`, REDACTED, true)).toBe(`v=${REDACTED}=;`);
    expect(redactHighEntropy(`/api/v2/Users/${TOKEN}/edit`, REDACTED, true)).toBe(
      `/api/v2/Users/${REDACTED}/edit`,
    );
    expect(redactHighEntropy('/src/app/components/user-profile/index.ts', REDACTED, true)).toBe(
      '/src/app/components/user-profile/index.ts',
    );
  });

  it('keeps ordinary text, URLs and ids', () => {
    const sha = randomToken(40, 13, HEX);
    const text = `Loaded 24 users from https://api.example.com/v1/users?page=2 in 120ms, commit ${sha}`;
    expect(redactHighEntropy(text, REDACTED, true)).toBe(text);
  });
});

const call = (fields: Partial<HttpCall>) =>
  redactCall({ id: 1, method: 'GET', url: '/api', ...fields } as HttpCall);

const report = (fields: Partial<AnalogRuntimeReport>) =>
  redactAnalogReport({
    pageId: 'p1',
    url: '/',
    analog: true,
    chain: [],
    hydrated: 0,
    transferState: false,
    hydrationErrors: [],
    configPaths: [],
    ...fields,
  });

const show = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? '');

/**
 * Every redaction path, each fed the token in a harmless spot: a sentence, a
 * field named `note`, a `cursor` query value. No name or shape rule hides it
 * there, so only `redaction.entropy` can.
 */
const PATHS: Record<string, (token: string) => unknown> = {
  serialize: (t) => serialize({ note: `session ${t}` }),
  'serialize, as an object key': (t) => serialize({ [t]: 1 }),
  'NgRx serialize': (t) => ngrxSerialize({ note: `session ${t}` }),
  'router redactText': (t) => redactText(`opaque ${t}`),
  'router redactUrl': (t) => redactUrl(`/reset/${t}?page=2`),
  'router redactRecord': (t) => redactRecord({ note: t }),
  'forms redactMessage': (t) => redactMessage(`opaque ${t}`),
  'forms SecretSet': (t) => new SecretSet().redact(`opaque ${t}`),
  'forms serializeFormValue': (t) => serializeFormValue({ note: t }),
  'HTTP call URL': (t) => call({ url: `/api/items?cursor=${t}` }),
  'HTTP call error': (t) => call({ error: `failed for ${t}` }),
  'HTTP response preview (JSON)': (t) => redactPreview(JSON.stringify({ cursor: t, count: 2 })),
  'HTTP response preview (text)': (t) => redactPreview(`cursor ${t}`),
  'HTTP header value': (t) => redactHeaders({ 'x-request-cursor': t }),
  'Analog page URL': (t) => report({ url: `/products?cursor=${t}` }),
  'Analog load() preview': (t) =>
    report({ load: { preview: JSON.stringify({ note: t }), bytes: 10, keys: [] } }),
  'Analog hydration error': (t) => report({ hydrationErrors: [`mismatch near ${t}`] }),
  'Analog server log message': (t) => redactServerMessage(`GET /api/items?cursor=${t}`),
  'Analog server log body': (t) => redactBody(JSON.stringify({ note: t })),
  'Capacitor plugin argument': (t) => maskedArgs('App', { note: t }, {}),
  'errors valueText': (t) => valueText({ note: t }),
  'errors consoleText': (t) => consoleText(['failed:', t]),
};

describe('redaction.entropy through every redaction path', () => {
  for (const [path, run] of Object.entries(PATHS)) {
    it(path, () => {
      expect(show(run(TOKEN)), 'readable while the option is off').toContain(TOKEN);
      setRedaction({ entropy: true });
      const out = show(run(TOKEN));
      expect(out).not.toContain(TOKEN);
      expect(out).toMatch(/\[redacted\]|%5Bredacted%5D/);
      setRedaction({});
      expect(show(run(TOKEN)), 'readable again once it is off').toContain(TOKEN);
    });
  }

  it('keeps known shapes readable by their prefix', () => {
    setRedaction({ entropy: true });
    const key = ['sk', 'live', opaque(28, 7)].join('_');
    expect(redactMessage(`key ${key}`)).toBe(`key sk_live_${REDACTED}`);
  });

  it('keeps hex ids and UUIDs readable in serialized values', () => {
    setRedaction({ entropy: true });
    const id = randomToken(32, 14, HEX);
    expect(JSON.stringify(serialize({ id, note: `session ${TOKEN}` }))).toContain(id);
  });
});

describe('redaction.entropy on long inputs', () => {
  const BUDGET_MS = 4000;
  const SIZE = 200_000;
  const timed = (text: string) => {
    const started = performance.now();
    const out = redactHighEntropy(text, REDACTED, true);
    return { out, ms: performance.now() - started };
  };

  it.each([
    ['one random run', () => randomToken(SIZE, 15, BASE62)],
    ['one run that ends before = and a letter', () => `${'Ab1'.repeat(SIZE / 3)}=a`],
    ['one run of slashes and letters', () => 'a/'.repeat(SIZE / 2)],
    ['random base64 with slashes', () => randomToken(SIZE, 16, BASE64)],
    ['many short words', () => 'word '.repeat(SIZE / 5)],
    ['many candidate tokens', () => `${TOKEN} `.repeat(SIZE / 25)],
    ['padding only', () => '='.repeat(SIZE)],
    ['separators only', () => '-_+'.repeat(SIZE / 3)],
  ])('stays fast on %s', (_name, build) => {
    const { ms } = timed(build());
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('masks every token in a long text', () => {
    const text = `${TOKEN} `.repeat(SIZE / 25);
    const { out } = timed(text);
    expect(out).not.toContain(TOKEN);
    expect(out.split(REDACTED)).toHaveLength(SIZE / 25 + 1);
  });

  it('stays fast through serialize, which every value goes through', () => {
    setRedaction({ entropy: true });
    const value = {
      notes: Array.from({ length: 200 }, (_, i) => `entry ${i} ${opaque(32, i + 20)}`),
    };
    const started = performance.now();
    const out = JSON.stringify(serialize(value, { items: 200 }));
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
    expect(out).not.toContain(value.notes[0]!.split(' ')[2]);
  });
});
