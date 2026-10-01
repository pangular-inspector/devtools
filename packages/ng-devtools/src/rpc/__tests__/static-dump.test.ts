import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { collectStaticRpcDump } from 'devframe/rpc/dump';
import { describe, expect, it } from 'vitest';
import ngDevtools from '../../devframe.ts';
import { fixtureDir } from './fixture-dir.ts';

describe('static report dump', () => {
  it('bakes in every source scan', async () => {
    const cwd = fixtureDir('ng-devtools-dump-');
    writeFileSync(join(cwd, 'package.json'), '{}');
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd, mode: 'build', host: host as never });
    await ngDevtools.setup(ctx as never);
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
        ].map((name) => `ng-devtools:${name}`),
      ),
    );
  });
});
