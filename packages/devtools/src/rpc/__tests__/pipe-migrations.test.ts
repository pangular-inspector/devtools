import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it } from 'vitest';
import pangular from '../../devframe.ts';
import { answerText } from '../../__tests__/tool-answer.ts';
import { pipeMigrations, pipeMigrationsText } from '../pipe-migrations.ts';
import type { PipePageReport, PipesState } from '../pipes-tools.ts';
import { clearSourceFileIndex } from '../source-file-index.ts';
import { fixtureDir } from './fixture-dir.ts';

afterEach(clearSourceFileIndex);

function project() {
  const cwd = fixtureDir('pangular-pipe-migrations-');
  mkdirSync(join(cwd, 'src'));
  writeFileSync(
    join(cwd, 'src', 'user.component.ts'),
    `import { Component } from '@angular/core';
@Component({
  selector: 'app-user',
  template: \`
    <p>{{ user$ | async }}</p>
    <p>{{ loadOrders() | async }}</p>
    <p>{{ items | sortBy }}</p>
  \`,
})
export class UserComponent {}
`,
  );
  writeFileSync(
    join(cwd, 'src', 'sort-by.pipe.ts'),
    `import { Pipe } from '@angular/core';
@Pipe({ name: 'sortBy', pure: false })
export class SortByPipe {
  transform(items: string[]) { return [...items].sort(); }
}
`,
  );
  writeFileSync(
    join(cwd, 'src', 'locale.pipe.ts'),
    `import { Pipe, signal } from '@angular/core';
@Pipe({ name: 'localized' })
export class LocalizedPipe {
  locale = signal('en');
  transform(value: string) { return this.locale() + value; }
}
`,
  );
  return cwd;
}

describe('pipe migrations', () => {
  it('suggests toSignal for | async, computed for impure and signal-reading pipes', () => {
    const cwd = project();
    const kinds = pipeMigrations(cwd, undefined).map((m) => `${m.kind}:${m.pipe}`);
    expect(kinds).toEqual([
      'async-to-signal:async',
      'impure-to-computed:sortBy',
      'signal-pipe-to-computed:localized',
    ]);
    const text = pipeMigrationsText(cwd, undefined);
    expect(text).toContain('readonly user = toSignal(this.user$);');
    expect(text).toContain('`src/user.component.ts:5`: `<p>{{ user$ | async }}</p>`');
    expect(text).toContain('pipe a method call');
    expect(text).toContain('no file was changed');
  });

  it('narrows to one pipe and adds live churn and stale findings', () => {
    const cwd = project();
    const live: PipesState = {
      pipes: [
        {
          name: 'sortBy',
          className: 'SortByPipe',
          isPure: false,
          instanceCount: 1,
          components: [],
          churn: { streak: 22, detectedAt: 1 },
          stale: { detectedAt: 1 },
        },
      ],
      async: [],
      reportedAt: 1,
      instrumented: [],
    };
    const kinds = pipeMigrations(cwd, live, { name: 'sortBy' }).map((m) => m.kind);
    expect(kinds).toEqual(['impure-to-computed', 'churn', 'stale']);
  });

  it('says there is nothing to suggest for a project of pure pipes', () => {
    const cwd = fixtureDir('pangular-pipe-migrations-empty-');
    expect(pipeMigrationsText(cwd, undefined)).toContain('No pipe-to-signal migrations');
  });

  it('answers through the agent tool and serves pipe usages as a resource', async () => {
    const cwd = project();
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd, mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const report: PipePageReport = {
      pageId: 'tab-1',
      pipes: [
        {
          name: 'sortBy',
          className: 'SortByPipe',
          isPure: false,
          instanceCount: 1,
          components: [{ name: 'UserComponent', count: 1 }],
          churn: { streak: 20, detectedAt: 5 },
        },
      ],
      instrumented: true,
    };
    await ctx.rpc.invokeLocal('pangular:push-pipes' as never, ...([report] as never));
    const text = await answerText(
      ctx.agent.invoke('pangular:suggest-pipe-migrations', { name: 'sortBy' }),
    );
    expect(text).toContain('churning');
    expect(
      await answerText(ctx.agent.invoke('pangular:suggest-pipe-migrations', { page: 'nope' })),
    ).toContain('nope');

    const resource = await ctx.agent.read('pangular:pipe-usages');
    const json = JSON.parse(String((resource as { text?: string }).text));
    expect(json._untrusted).toBeTruthy();
    expect(json.source.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(['sortBy', 'localized', 'async']),
    );
    expect(json.pipes[0].churn.streak).toBe(20);
  });
});
