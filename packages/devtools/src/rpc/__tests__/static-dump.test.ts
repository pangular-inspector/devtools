import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { collectStaticRpcDump, createClientFromDump, dumpFunctions } from 'devframe/rpc/dump';
import { describe, expect, it } from 'vitest';
import pangular from '../../devframe.ts';
import { fixtureDir } from './fixture-dir.ts';

describe('static report dump', () => {
  it('bakes in every source scan', async () => {
    const cwd = fixtureDir('pangular-dump-');
    writeFileSync(join(cwd, 'package.json'), '{}');
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd, mode: 'build', host: host as never });
    await pangular.setup(ctx as never);
    const { manifest } = await collectStaticRpcDump(ctx.rpc.definitions.values(), ctx);
    expect(Object.keys(manifest)).toEqual(
      expect.arrayContaining(
        [
          'build-meta',
          'get-components',
          'get-routes',
          'get-signals',
          'get-providers',
          'get-pipes',
          'get-ngrx-store',
          'pipe-lint',
        ].map((name) => `pangular:${name}`),
      ),
    );
  });

  it('answers the Pipes lint from the report', async () => {
    const cwd = fixtureDir('pangular-dump-lint-');
    writeFileSync(join(cwd, 'package.json'), '{}');
    mkdirSync(join(cwd, 'src'));
    writeFileSync(
      join(cwd, 'src', 'debug.component.ts'),
      `@Component({ selector: 'app-debug', template: '{{ user | json }}' })\nexport class Debug {}\n`,
    );
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd, mode: 'build', host: host as never });
    await pangular.setup(ctx as never);
    const pipes = ['pangular:get-pipes', 'pangular:pipe-lint'].map((name) =>
      ctx.rpc.definitions.get(name)!,
    );
    const store = await dumpFunctions(pipes, ctx);
    const client = createClientFromDump(store) as Record<string, () => Promise<unknown>>;
    const findings = (await client['pangular:pipe-lint']()) as { rule: string }[];
    expect(findings.map((finding) => finding.rule)).toEqual(['json-pipe-in-template']);
  });
});
