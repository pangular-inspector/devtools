import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { expect, it } from 'vitest';
import { createPangular } from '../devframe.ts';

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** A count from 1 to 999 in words, as the tools page writes it: `Ninety-nine`, `One hundred and four`. */
function inWords(n: number): string {
  const below100 = (m: number): string =>
    m < 10
      ? ONES[m]
      : m < 20
        ? TEENS[m - 10]
        : TENS[Math.floor(m / 10)] + (m % 10 ? `-${ONES[m % 10]}` : '');
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const text = hundreds
    ? `${ONES[hundreds]} hundred${rest ? ` and ${below100(rest)}` : ''}`
    : below100(rest);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
  const stated = /^\s*([A-Z][a-z]+(?:[- ][a-z]+)*) tools, grouped by inspector/m.exec(page)?.[1];
  expect(stated).toBe(inWords(registered));
});
