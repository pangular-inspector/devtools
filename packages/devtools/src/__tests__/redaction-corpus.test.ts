// @vitest-environment jsdom
/**
 * The leak corpus: fake secrets in many shapes (fixtures/redaction-corpus.json)
 * run through the redaction path of every collector and of the server, to
 * prove none of them comes out readable. A new redaction path belongs in one
 * of the tables below; a new secret shape belongs in the fixture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import corpus from './fixtures/redaction-corpus.json' with { type: 'json' };
import {
  REDACTED,
  isRedactedKey,
  redactMessage,
  SecretSet,
  setRedaction,
} from '../forms-privacy.ts';
import { redactRecord, redactText, redactUrl } from '../router.ts';
import { serialize } from '../serialize.ts';
import {
  redactAnalogReport,
  redactCall,
  redactHeaders,
  redactJsonText,
  redactPreview,
} from '../redaction.ts';
import { redactBody, redactMessage as redactServerMessage } from '../analog-server-log.ts';
import { maskedArgs } from '../capacitor-redact.ts';
import { serialize as ngrxSerialize } from '../ngrx-shared.ts';
import { consoleText, valueText } from '../errors-collector.ts';
import { serializeFormValue } from '../forms.ts';
import type { AnalogRuntimeReport } from '../analog-runtime.ts';
import type { HttpCall } from '../http-rules.ts';

afterEach(() => setRedaction());

type Path = (input: string) => unknown;
type ObjectPath = (input: Record<string, unknown>) => unknown;

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

/** Paths that take free text: messages, errors, previews, values. */
const PAIR_TEXT_PATHS: Record<string, Path> = {
  'serialize (component inputs, signals, pipes, providers)': (t) => serialize(t),
  'NgRx serialize': (t) => ngrxSerialize(t),
  'router redactText (titles, guards, warnings)': (t) => redactText(t),
  'router redactRecord (params and data)': (t) => redactRecord({ note: t }),
  'errors valueText': (t) => valueText(t),
  'errors consoleText': (t) => consoleText(['failed:', t]),
  'errors valueText of an Error': (t) => valueText(new Error(t)),
  'HTTP call error': (t) => call({ error: t }),
  'HTTP response preview (text)': (t) => redactPreview(t),
  'HTTP header value': (t) => redactHeaders({ 'x-debug': t }),
  'Analog hydration error': (t) => report({ hydrationErrors: [t] }),
  'Capacitor plugin argument': (t) => maskedArgs('App', { message: t }, {}),
};

/** Paths that hide value shapes in text, but not `key=value` pairs. */
const SHAPE_ONLY_TEXT_PATHS: Record<string, Path> = {
  // Object keys are masked by shape: a key is a name, not a sentence.
  'serialize, as an object key': (t) => serialize({ [t]: 1 }),
  'NgRx serialize, as an object key': (t) => ngrxSerialize({ [t]: 1 }),
  'forms redactMessage (field errors)': (t) => redactMessage(t),
  'forms SecretSet (event log)': (t) => new SecretSet().redact(t),
  'Analog server log message': (t) => redactServerMessage(t),
  'Analog server log body': (t) => redactBody(t),
};

/** Paths that take an object and hide its values by key. */
const OBJECT_PATHS: Record<string, ObjectPath> = {
  serialize: (o) => serialize(o),
  'NgRx serialize': (o) => ngrxSerialize(o),
  'router redactRecord': (o) => redactRecord(o),
  'forms serializeFormValue': (o) => serializeFormValue(o),
  'HTTP response preview (JSON)': (o) => redactPreview(JSON.stringify(o)),
  'HTTP response preview (cut JSON)': (o) => redactPreview(JSON.stringify(o).slice(0, -2)),
  'HTTP call preview': (o) => call({ preview: JSON.stringify(o) }),
  'JSON text redaction': (o) => redactJsonText(JSON.stringify(o), isRedactedKey),
  'Capacitor plugin argument': (o) => maskedArgs('Preferences', o, {}),
  'Analog load() preview': (o) =>
    report({ load: { preview: JSON.stringify(o), bytes: 10, keys: [] } }),
  'Analog server log body': (o) => redactBody(JSON.stringify(o)),
  'errors valueText': (o) => valueText(o),
  'errors consoleText': (o) => consoleText(['state', o]),
  'HTTP headers': (o) =>
    redactHeaders(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]))),
};

/** Paths that take a URL. */
const URL_PATHS: Record<string, Path> = {
  'router redactUrl': (u) => redactUrl(u),
  'HTTP call URL': (u) => call({ url: u }),
  'HTTP redirect target': (u) => call({ redirectedTo: u }),
  'Analog page URL': (u) => report({ url: u }),
  'Capacitor HTTP URL': (u) => maskedArgs('CapacitorHttp', { url: u, method: 'GET' }, {}),
  'Analog server log message': (u) => redactServerMessage(u),
};

function expectHidden(path: string, input: string, out: unknown, secret: string) {
  const text = show(out);
  expect(
    text,
    `${path} leaked ${JSON.stringify(secret)} from ${JSON.stringify(input)}`,
  ).not.toContain(secret);
  expect(text, `${path} hid ${JSON.stringify(input)} without a marker`).toMatch(
    /\[redacted\]|%5Bredacted%5D/,
  );
}

describe('the leak corpus', () => {
  it('has every kind of secret it promises', () => {
    expect(corpus.shapes.length).toBeGreaterThanOrEqual(20);
    expect(corpus.named.length).toBeGreaterThanOrEqual(10);
    for (const entry of corpus.shapes) expect(entry.value).toContain(entry.secret);
  });

  describe('value shapes hide themselves in any text', () => {
    const paths = { ...PAIR_TEXT_PATHS, ...SHAPE_ONLY_TEXT_PATHS };
    for (const [path, run] of Object.entries(paths)) {
      it(path, () => {
        for (const { value, secret } of corpus.shapes) {
          for (const input of [value, `request failed (${value}) retry later`]) {
            expectHidden(path, input, run(input), secret);
          }
        }
      });
    }
  });

  describe('values under secret names hide in key=value text', () => {
    for (const [path, run] of Object.entries(PAIR_TEXT_PATHS)) {
      it(path, () => {
        for (const { key, secret } of corpus.named) {
          for (const input of [
            `${key}=${secret}`,
            `retry with ${key}=${secret}&user=ada`,
            `{"${key}":"${secret}","user":"ada"}`,
            `${key}: "${secret}"`,
          ]) {
            expectHidden(path, input, run(input), secret);
          }
        }
      });
    }
  });

  describe('values under secret names hide in objects', () => {
    for (const [path, run] of Object.entries(OBJECT_PATHS)) {
      it(path, () => {
        for (const { key, secret } of corpus.named) {
          for (const input of [{ [key]: secret, user: 'ada' }, { form: { [key]: secret } }]) {
            if (path === 'HTTP headers' && 'form' in input) continue;
            expectHidden(path, JSON.stringify(input), run(input), secret);
          }
        }
      });
    }
  });

  describe('values under secret names hide in URLs', () => {
    for (const [path, run] of Object.entries(URL_PATHS)) {
      it(path, () => {
        for (const { key, secret } of corpus.named) {
          for (const input of [
            `https://app.example.com/cb?${key}=${secret}&page=2`,
            `/login#${key}=${encodeURIComponent(secret)}`,
          ]) {
            expectHidden(path, input, run(input), secret);
          }
        }
      });
    }
  });

  describe('value shapes hide in URLs', () => {
    const inUrl = corpus.shapes.filter((entry) => /^(https?:|eyJ)/.test(entry.value));
    for (const [path, run] of Object.entries(URL_PATHS)) {
      it(path, () => {
        for (const { value, secret } of inUrl) {
          const input = value.startsWith('eyJ') ? `/verify/${value}?page=2` : value;
          expectHidden(path, input, run(input), secret);
        }
      });
    }
  });

  it('keeps the marker every path writes the same', () => {
    expect(REDACTED).toBe('[redacted]');
    expect(redactJsonText('{"password":"x"}', isRedactedKey)).toBe(`{"password":"${REDACTED}"}`);
  });
});
