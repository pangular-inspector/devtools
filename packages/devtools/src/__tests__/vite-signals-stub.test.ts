import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pangularVite from '../vite.ts';
import {
  SIGNAL_PRIMITIVES,
  angularCoreMajor,
  signalPrimitivesAlias,
} from '../vite-signals-stub.ts';

/** An app folder whose node_modules holds `@angular/core` at `version`, or nothing. */
function app(version?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'pangular-signals-'));
  writeFileSync(join(root, 'package.json'), '{"name":"app","private":true}');
  if (version) {
    const core = join(root, 'node_modules', '@angular', 'core');
    mkdirSync(core, { recursive: true });
    writeFileSync(join(core, 'package.json'), JSON.stringify({ name: '@angular/core', version }));
  }
  return root;
}

describe('the signal primitives stub for Angular before 17', () => {
  it('reads the installed @angular/core major', () => {
    expect(angularCoreMajor(app('15.2.10'))).toBe(15);
    expect(angularCoreMajor(app('17.3.12'))).toBe(17);
    expect(angularCoreMajor(app())).toBeUndefined();
  });

  it('points the primitives entry at the stub only before 17.0', () => {
    const [alias] = signalPrimitivesAlias(app('16.2.12'));
    expect(alias?.find).toBe(SIGNAL_PRIMITIVES);
    expect(String(alias?.replacement)).toMatch(/signals-stub\.(ts|mjs)$/);
    expect(signalPrimitivesAlias(app('12.2.17'))).toHaveLength(1);
    expect(signalPrimitivesAlias(app('17.0.0'))).toEqual([]);
    expect(signalPrimitivesAlias(app('22.1.7'))).toEqual([]);
    expect(signalPrimitivesAlias(app())).toEqual([]);
  });

  it('adds the alias through the Vite plugin config hook', () => {
    const plugin = pangularVite();
    const config = plugin.config as (user: { root?: string }) => unknown;
    expect(config({ root: app('15.2.10') })).toMatchObject({
      resolve: { alias: [{ find: SIGNAL_PRIMITIVES }] },
    });
    expect(config({ root: app('20.0.7') })).toBeUndefined();
  });
});
