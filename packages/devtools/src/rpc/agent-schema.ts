import { toStandardJsonSchema } from '@valibot/to-json-schema';

/** The schemas the valibot converter accepts. */
type Convertible = Parameters<typeof toStandardJsonSchema>[0];

/**
 * Attach a [Standard JSON Schema](https://standardschema.dev/) converter to a
 * valibot schema.
 *
 * Devframe stays validator neutral: it describes an RPC `returns` schema with
 * the validator's own converter, and valibot does not ship one by default.
 * Since devframe 1.1.0 a `returns` schema it cannot convert simply advertises
 * no MCP `outputSchema`, so this is not a workaround for array returns any
 * more; those are correct either way.
 *
 * What it still buys is accuracy for the tools that return an object: with the
 * converter attached they advertise their real shape rather than a permissive
 * one, so a client can tell what a call will hand back.
 */
export function describable<T extends Convertible>(schema: T): T {
  const described = { ...schema, ...toStandardJsonSchema(schema) } as T;

  // Conversion is lazy, and devframe swallows a converter that throws by
  // falling back to a permissive object schema: the very thing this avoids.
  // Converting once here turns that into an error at startup instead.
  (described as unknown as { '~standard': { jsonSchema: { input: (o: unknown) => unknown } } })[
    '~standard'
  ].jsonSchema.input({ target: 'draft-2020-12' });

  return described;
}
