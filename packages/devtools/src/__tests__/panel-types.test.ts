import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(import.meta.dirname, '..');
const app = join(src, '..', '..', '..', 'app');
const ENTRY = '@pangular-inspector/devtools/internal/types';

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) filesUnder(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** The contract between the package's report types and the panel that reads them. */
describe('panel types entry', () => {
  const entry = readFileSync(join(src, 'panel-types.ts'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('holds type-only re-exports of names types.ts declares', () => {
    const statements = entry
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    const types = readFileSync(join(src, 'types.ts'), 'utf-8');
    for (const statement of statements) {
      const match = /^export type \{([^}]*)\} from '\.\/types\.ts'$/.exec(statement);
      expect(match, statement).not.toBeNull();
      for (const name of match![1]!
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)) {
        expect(types, name).toMatch(new RegExp(`export (?:interface|type) ${name}\\b`));
      }
    }
  });

  it('is a workspace-only entry that is never published', () => {
    const manifest = JSON.parse(readFileSync(join(src, '..', 'package.json'), 'utf-8')) as {
      exports: Record<string, string>;
      publishConfig: { exports: Record<string, unknown> };
    };
    expect(manifest.exports['./internal/types']).toBe('./src/panel-types.ts');
    expect(manifest.publishConfig.exports['./internal/types']).toBeUndefined();
  });

  it('is only imported with import type, so no package code reaches the panel bundle', () => {
    const users = filesUnder(join(app, 'src')).filter((file) =>
      readFileSync(file, 'utf-8').includes(ENTRY),
    );
    expect(users.length).toBeGreaterThan(0);
    for (const file of users) {
      const text = readFileSync(file, 'utf-8');
      const imports = [...text.matchAll(/import\s+(type\s+)?\{[^}]*\}\s*from\s*'([^']+)'/g)].filter(
        (m) => m[2] === ENTRY,
      );
      expect(imports.length, file).toBeGreaterThan(0);
      for (const found of imports) expect(found[1], file).toBeTruthy();
    }
  });
});
