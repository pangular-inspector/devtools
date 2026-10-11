import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findFormSource, formSourceIn } from '../rpc/forms-source.ts';

describe('form source scan gaps', () => {
  it('ignores parentheses inside string literals when finding the end of a schema', () => {
    const page = `const S = schema<F>((p) => {
  validate(p.name, () => ({ kind: 'x', message: 'Use a name (first and last' }));
  required(p.email);
});

export class Page {
  f = form(this.model, S);
}

function other() {
  required(p.email);
}
`;
    const found = formSourceIn(page, 'a.ts', 'Page', 'f', 'email');
    expect(found?.rules.map((r) => r.line)).toEqual([3]);

    const closing = page.replace('(first and last', 'a ) b');
    const early = formSourceIn(closing, 'a.ts', 'Page', 'f', 'email');
    expect(early?.rules.map((r) => r.line)).toEqual([3]);
  });

  it('takes a same-named schema from the file the owner imports it from', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'pangular-schema-'));
    for (const dir of ['a', 'b']) {
      mkdirSync(join(cwd, 'src', dir), { recursive: true });
      writeFileSync(
        join(cwd, 'src', dir, 'schema.ts'),
        `export const addressSchema = schema<A>((p) => {\n  required(p.city);\n});\n`,
      );
    }
    writeFileSync(
      join(cwd, 'src', 'page.ts'),
      `import { addressSchema } from './b/schema';\nexport class Page {\n  f = form(this.model, addressSchema);\n}\n`,
    );
    const found = findFormSource(cwd, 'Page', 'f', 'city');
    expect(found?.schemas?.map((s) => s.file.replaceAll('\\', '/'))).toEqual(['src/b/schema.ts']);
  });

  it('matches the local binding of an aliased import', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'pangular-schema-'));
    for (const dir of ['a', 'b']) {
      mkdirSync(join(cwd, 'src', dir), { recursive: true });
      writeFileSync(
        join(cwd, 'src', dir, 'schema.ts'),
        `export const addressSchema = schema<A>((p) => {\n  required(p.city);\n});\n`,
      );
    }
    writeFileSync(
      join(cwd, 'src', 'page.ts'),
      `import { addressSchema as shippingSchema } from './a/schema';\nimport { addressSchema } from './b/schema';\nexport class Page {\n  f = form(this.model, addressSchema);\n}\n`,
    );
    const found = findFormSource(cwd, 'Page', 'f', 'city');
    expect(found?.schemas?.map((s) => s.file.replaceAll('\\', '/'))).toEqual(['src/b/schema.ts']);
  });

  it('does not use an unrelated declaration when the import cannot be resolved', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'pangular-schema-'));
    mkdirSync(join(cwd, 'src', 'a'), { recursive: true });
    writeFileSync(
      join(cwd, 'src', 'a', 'schema.ts'),
      `export const addressSchema = schema<A>((p) => {\n  required(p.city);\n});\n`,
    );
    writeFileSync(
      join(cwd, 'src', 'page.ts'),
      `import { addressSchema } from '@app/schema';\nexport class Page {\n  f = form(this.model, addressSchema);\n}\n`,
    );
    expect(findFormSource(cwd, 'Page', 'f', 'city')?.schemas).toBeUndefined();
  });

  it('does not guess between same-named schemas it cannot tell apart', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'pangular-schema-'));
    for (const dir of ['a', 'b']) {
      mkdirSync(join(cwd, 'src', dir), { recursive: true });
      writeFileSync(
        join(cwd, 'src', dir, 'schema.ts'),
        `export const addressSchema = schema<A>((p) => {\n  required(p.city);\n});\n`,
      );
    }
    writeFileSync(
      join(cwd, 'src', 'page.ts'),
      `import { addressSchema } from '@app/schema';\nexport class Page {\n  f = form(this.model, addressSchema);\n}\n`,
    );
    expect(findFormSource(cwd, 'Page', 'f', 'city')?.schemas).toBeUndefined();
  });
});
