import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { expect, it } from 'vitest';
import { createPangular } from '../devframe.ts';

const WORDS = [
  'Forty-eight',
  'Forty-nine',
  'Fifty',
  'Fifty-one',
  'Fifty-two',
  'Fifty-three',
  'Fifty-four',
  'Fifty-five',
  'Fifty-six',
  'Fifty-seven',
  'Fifty-eight',
  'Fifty-nine',
  'Sixty',
  'Sixty-one',
  'Sixty-two',
  'Sixty-three',
  'Sixty-four',
  'Sixty-five',
  'Sixty-six',
  'Sixty-seven',
  'Sixty-eight',
  'Sixty-nine',
  'Seventy',
  'Seventy-one',
  'Seventy-two',
  'Seventy-three',
  'Seventy-four',
  'Seventy-five',
  'Seventy-six',
  'Seventy-seven',
  'Seventy-eight',
  'Seventy-nine',
  'Eighty',
  'Eighty-one',
  'Eighty-two',
  'Eighty-three',
  'Eighty-four',
  'Eighty-five',
  'Eighty-six',
  'Eighty-seven',
  'Eighty-eight',
  'Eighty-nine',
  'Ninety',
  'Ninety-one',
  'Ninety-two',
  'Ninety-three',
  'Ninety-four',
  'Ninety-five',
  'Ninety-six',
  'Ninety-seven',
  'Ninety-eight',
  'Ninety-nine',
];

it('states on the tools page how many tools the server registers', async () => {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  // Every tool, with the library ones the demo project does not use.
  await createPangular({
    inspectors: { analog: true, capacitor: true, tanstackQuery: true },
  }).setup(ctx as never);
  const registered = ctx.agent
    .list()
    .tools.filter((tool) => tool.id.startsWith('pangular:')).length;
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
