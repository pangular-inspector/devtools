import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { expect, it } from 'vitest';
import pangular from '../devframe.ts';

const WORDS = [
  'Forty-eight',
  'Forty-nine',
  'Fifty',
  'Fifty-one',
  'Fifty-two',
  'Fifty-three',
  'Fifty-four',
  'Fifty-five',
];

it('states on the tools page how many tools the server registers', async () => {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const registered = ctx.agent.list().tools.length;
  const page = readFileSync(
    join(__dirname, '../../../../apps/docs/src/content/agents/tools.md'),
    'utf-8',
  );
  const stated = /^\s*([A-Z][a-z]+(?:-[a-z]+)?) tools, grouped by inspector/m.exec(page)?.[1];
  expect(stated).toBeDefined();
  const index = WORDS.indexOf(stated!);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(index + 48).toBe(registered);
});
