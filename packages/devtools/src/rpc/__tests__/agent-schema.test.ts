import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { describable } from '../agent-schema.ts';
import { getBuildMeta } from '../build-meta.ts';
import { getComponents } from '../get-components.ts';
import { getNgrxStore } from '../get-ngrx-store.ts';
import { getProviders } from '../get-providers.ts';
import { getRoutes } from '../get-routes.ts';
import { getSignals } from '../get-signals.ts';

const converterOf = (schema: unknown) =>
  (schema as { '~standard': { jsonSchema?: { output: (o: unknown) => { type?: string } } } })[
    '~standard'
  ].jsonSchema;

describe('describable', () => {
  it('adds a converter', () => {
    expect(converterOf(describable(v.array(v.object({ id: v.string() }))))).toBeDefined();
  });

  it('describes an object return accurately, for the MCP output schema', () => {
    const schema = describable(v.object({ ok: v.boolean() }));
    expect(converterOf(schema)!.output({ target: 'draft-2020-12' })).toMatchObject({
      type: 'object',
      properties: { ok: { type: 'boolean' } },
    });
  });

  it('is what devframe publishes as the output schema', async () => {
    // devframe converts with `input`, and drops a non-object result, so an
    // object return must survive and an array return must not be advertised.
    const { returnToJsonSchema } = (await import('devframe/internal')) as {
      returnToJsonSchema: (schema: unknown) => { type?: string } | undefined;
    };
    expect(returnToJsonSchema(describable(v.object({ ok: v.boolean() })))?.type).toBe('object');
    expect(returnToJsonSchema(describable(v.array(v.string())))?.type).toBe('array');
    // Since devframe 1.1.0 a schema it cannot convert is simply not
    // advertised, rather than described as a permissive object.
    expect(returnToJsonSchema(v.array(v.string()))).toBeUndefined();
  });

  it('converts for the draft devframe asks for', () => {
    const schema = describable(v.array(v.string()));
    const json = converterOf(schema)!.output({ target: 'draft-2020-12' }) as Record<string, string>;
    expect(json['$schema']).toContain('2020-12');
  });

  it('describes an array return as an array', () => {
    const schema = describable(v.array(v.object({ id: v.string() })));
    expect(converterOf(schema)!.output({ target: 'draft-2020-12' }).type).toBe('array');
  });

  it('keeps validating', () => {
    const schema = describable(v.array(v.string()));
    const validate = schema['~standard'].validate as (input: unknown) => { value?: unknown };
    expect(validate(['a'])).toMatchObject({ value: ['a'] });
  });

  // Without a converter devframe advertises a permissive object output schema,
  // and every `tools/call` on these fails because an array does not match it.
  it('describes an object return so it can be published as an output schema', () => {
    const converter = converterOf((getBuildMeta as { returns: unknown }).returns);
    expect(converter!.output({ target: 'draft-2020-12' }).type).toBe('object');
  });

  // devframe converts with `input`, so that is the path that has to work.
  it('converts through the input side devframe uses', () => {
    const schema = describable(v.array(v.string()));
    const converter = converterOf(schema) as unknown as {
      input: (o: unknown) => { type?: string };
    };
    expect(converter.input({ target: 'draft-2020-12' }).type).toBe('array');
  });

  it('fails at startup rather than silently falling back', () => {
    expect(() => describable(v.array(v.custom(() => true)))).toThrow();
  });

  it.each([
    ['get-routes', getRoutes],
    ['get-components', getComponents],
    ['get-signals', getSignals],
    ['get-providers', getProviders],
    ['get-ngrx-store', getNgrxStore],
  ])('%s describes its own return value', (_name, definition) => {
    const converter = converterOf((definition as { returns: unknown }).returns);
    expect(converter).toBeDefined();
    expect(converter!.output({ target: 'draft-2020-12' }).type).toBe('array');
  });
});
