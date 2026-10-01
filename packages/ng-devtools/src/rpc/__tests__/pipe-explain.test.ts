import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { describe, expect, it } from 'vitest';
import { explainPipeText } from '../pipe-explain.ts';
import type { PipesState } from '../pipes-tools.ts';

function fixture(): string {
  const dir = fixtureDir('ng-devtools-pipe-explain-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(
    join(dir, 'src', 'app.ts'),
    `
      @Pipe({ name: 'appPrice' })
      export class PricePipe implements PipeTransform {
        transform(value: number) { return value; }
      }
    `,
  );
  return dir;
}

function state(instrumented: string[]): PipesState {
  return { pipes: [], async: [], reportedAt: 0, instrumented };
}

describe('explainPipeText', () => {
  it('names the Record calls button when recording is off', () => {
    const text = explainPipeText('appPrice', fixture(), state([]));
    expect(text).toContain('`PricePipe`');
    expect(text).toContain('**Live:** unknown, recording is off.');
    expect(text).toContain('Click **Record calls** in the Pipes panel');
    const live = text.split('\n').find((line) => line.startsWith('**Live:**'));
    expect(live).not.toContain('Instrument');
    expect(live).not.toContain('—');
  });

  it('says the pipe was not seen when recording is on', () => {
    const text = explainPipeText('appPrice', fixture(), state(['page-1']));
    expect(text).toContain('**Live:** not seen on the currently connected page.');
    expect(text).not.toContain('Record calls');
  });
});
