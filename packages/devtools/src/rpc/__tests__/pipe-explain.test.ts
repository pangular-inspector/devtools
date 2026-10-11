import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { describe, expect, it } from 'vitest';
import { explainPipeText } from '../pipe-explain.ts';
import type { AsyncUsageInfo, PipeUsageInfo, PipesState } from '../pipes-tools.ts';

function fixture(): string {
  const dir = fixtureDir('pangular-pipe-explain-');
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

function state(
  instrumented: string[],
  pipes: PipeUsageInfo[] = [],
  async: AsyncUsageInfo[] = [],
): PipesState {
  return { pipes, async, reportedAt: 0, instrumented };
}

function usage(name: string, className: string): PipeUsageInfo {
  return {
    name,
    className,
    isPure: true,
    instanceCount: 1,
    components: [{ name: 'CartComponent', count: 1 }],
  };
}

function liveLine(text: string): string | undefined {
  return text.split('\n').find((line) => line.startsWith('**Live:**'));
}

describe('explainPipeText', () => {
  it('says no page is connected when no page reports pipes', () => {
    const text = explainPipeText('appPrice', fixture(), state([]), 0);
    expect(text).toContain('`PricePipe`');
    const live = liveLine(text);
    expect(live).toContain('no page is connected');
    expect(live).toContain('stdio server');
    expect(live).not.toContain('Record calls');
    expect(live).not.toContain('—');
  });

  it('says the pipe is not in use when a page is connected but does not use it', () => {
    const text = explainPipeText('appPrice', fixture(), state([]), 1);
    const live = liveLine(text);
    expect(live).toContain('not in use on the connected page');
    expect(live).not.toContain('Record calls');
    expect(live).not.toContain('recording is off');
  });

  it('says the pipe is not in use while recording is on, too', () => {
    const text = explainPipeText('appPrice', fixture(), state(['page-1']), 1);
    expect(liveLine(text)).toContain('not in use on the connected page');
    expect(text).not.toContain('Record calls');
  });

  it('names the Record calls button when the pipe is in use and recording is off', () => {
    const text = explainPipeText(
      'appPrice',
      fixture(),
      state([], [usage('appPrice', 'PricePipe')]),
      1,
    );
    const live = liveLine(text);
    expect(live).toContain('1 instance(s), used by CartComponent (1).');
    expect(live).toContain('No calls recorded, recording is off.');
    expect(live).toContain('Click **Record calls** in the Pipes panel');
    expect(live).not.toContain('Instrument');
    expect(live).not.toContain('—');
  });

  it('says no calls were recorded yet when the pipe is in use and recording is on', () => {
    const text = explainPipeText(
      'appPrice',
      fixture(),
      state(['page-1'], [usage('appPrice', 'PricePipe')]),
      1,
    );
    const live = liveLine(text);
    expect(live).toContain('No calls recorded yet.');
    expect(live).not.toContain('Record calls');
  });

  it('shows already-described values as they are, without escaping them again', () => {
    const live = state(
      ['page-1'],
      [
        {
          ...usage('appPrice', 'PricePipe'),
          call: { callCount: 2, lastArgs: ['{"b":2}'], lastResult: '{"a":1}' },
        },
      ],
    );
    const text = explainPipeText('appPrice', fixture(), live, 1);
    expect(text).toContain('Last input: `[{"b":2}]`');
    expect(text).toContain('Last output: `{"a":1}`');
    expect(text).not.toContain('\\"');
  });

  it('lists the components with duplicate async subscriptions', () => {
    const asyncUsage = (component: string, duplicate: boolean): AsyncUsageInfo => ({
      component,
      hasSource: true,
      duplicate,
    });
    const text = explainPipeText(
      'async',
      fixture(),
      state(
        [],
        [usage('async', 'AsyncPipe')],
        [
          asyncUsage('CartComponent', true),
          asyncUsage('CartComponent', true),
          asyncUsage('HeaderComponent', true),
          asyncUsage('FooterComponent', false),
        ],
      ),
      1,
    );
    const line = text.split('\n').find((l) => l.startsWith('**Duplicate subscriptions:**'));
    expect(line).toContain('**Duplicate subscriptions:** 3 `| async` usage(s)');
    expect(line).toContain('(CartComponent, HeaderComponent)');
    expect(line).not.toContain('FooterComponent');
    expect(text).not.toContain('**Resubscribing:**');
  });

  it('leaves out the duplicate line when no async usage is a duplicate', () => {
    const text = explainPipeText(
      'async',
      fixture(),
      state(
        [],
        [usage('async', 'AsyncPipe')],
        [{ component: 'CartComponent', hasSource: true, duplicate: false }],
      ),
      1,
    );
    expect(text).not.toContain('Duplicate subscriptions');
  });
});
