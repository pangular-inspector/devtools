import { describe, expect, it } from 'vitest';
import { explainSection, toErrorExplain } from '../rpc/error-explain-tools.ts';
import {
  explainErrorText,
  mergeErrorsReport,
  toErrorsReport,
  type ErrorsState,
} from '../rpc/errors-tools.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

function stateWith(group: Record<string, unknown>): ErrorsState {
  const state: ErrorsState = { pages: {} };
  const report = toErrorsReport({
    pageId: 'p1',
    full: true,
    url: '/',
    title: 'Trips',
    handler: 'wrapped',
    errors: [{ id: 'e1', message: 'x', count: 1, firstAt: 1, lastAt: 1, sources: [], ...group }],
    console: [],
    dropped: { errors: 0, console: 0 },
  })!;
  mergeErrorsReport(state, report, 10);
  return state;
}

describe('toErrorExplain', () => {
  it('builds the hydration diff on the server and ignores one the page sent', () => {
    const explain = toErrorExplain({
      kind: 'hydration-mismatch',
      expected: '<p>\n  <div>…</div>',
      actual: '<p>\n  <span>…</span>',
      diff: [{ op: 'same', text: 'forged' }],
      external: true,
    });
    expect(explain).toEqual({
      kind: 'hydration-mismatch',
      expected: '<p>\n  <div>…</div>',
      actual: '<p>\n  <span>…</span>',
      external: true,
      diff: [
        { op: 'same', text: '<p>' },
        { op: 'expected', text: '  <div>…</div>' },
        { op: 'actual', text: '  <span>…</span>' },
      ],
    });
  });

  it('masks values again and keeps masked values hidden', () => {
    const explain = toErrorExplain({
      kind: 'expression-changed',
      previous: `Bearer ${JWT}`,
      current: 'ok',
      writes: [{ signal: 'token', at: 1, stack: [`f (${JWT})`] }, { signal: 3 }],
    });
    expect(JSON.stringify(explain)).not.toContain(JWT);
    expect(explain).toMatchObject({ writes: [{ signal: 'token', at: 1 }] });
    expect(
      toErrorExplain({ kind: 'expression-changed', masked: true, previous: 'a', current: 'b' }),
    ).toMatchObject({ previous: '[redacted]', current: '[redacted]', masked: true });
  });

  it('drops an unknown kind and a missing provider without a token', () => {
    expect(toErrorExplain({ kind: 'other' })).toBeUndefined();
    expect(toErrorExplain({ kind: 'missing-provider' })).toBeUndefined();
    expect(toErrorExplain('x')).toBeUndefined();
  });
});

describe('explain-error with an explainer', () => {
  it('shows the NG0100 binding, values, fields and the signal write with its stack', () => {
    const text = explainErrorText(
      stateWith({
        code: 'NG0100',
        owner: { id: 'c4', name: 'TripList' },
        explain: {
          kind: 'expression-changed',
          binding: 'title',
          template: 'TripList_Template',
          previous: 'Trips',
          current: 'Trips (3)',
          members: ['title'],
          writes: [{ signal: 'heading', at: 1, stack: ['TripList.ngAfterViewInit (a.ts:1:1)'] }],
          writesKnown: true,
        },
      }),
      { id: 'e1' },
      10,
    );
    expect(text).toContain('**What changed** (NG0100 explainer)');
    expect(text).toContain('- Component: `TripList` (instance `c4`).');
    expect(text).toContain('the `title` property, in the template function `TripList_Template`');
    expect(text).toContain('Previous value: `Trips`. Current value: `Trips (3)`.');
    expect(text).toContain(
      'Signal `heading` was written with this value just before the check, from `TripList.ngAfterViewInit (a.ts:1:1)`.',
    );
  });

  it('says how to find the writer when no signal write matched or none is heard', () => {
    const base = { kind: 'expression-changed', previous: 'a', current: 'b' };
    expect(
      explainErrorText(stateWith({ explain: { ...base, writesKnown: true } }), { id: 'e1' }),
    ).toContain('No named signal was written with this value');
    expect(explainErrorText(stateWith({ explain: base }), { id: 'e1' })).toContain(
      'the page does not report signal writes',
    );
  });

  it('shows the hydration diff as a fenced block', () => {
    const text = explainErrorText(
      stateWith({
        code: 'NG0500',
        explain: {
          kind: 'hydration-mismatch',
          summary: 'During hydration Angular expected <div> but found <span>.',
          expected: '<p>\n  <div>…</div>',
          actual: '<p>\n  <span>…</span>',
        },
      }),
      { id: 'e1' },
    );
    expect(text).toContain('**Server vs client DOM**');
    expect(text).toContain('```text\n  <p>\n-   <div>…</div>\n+   <span>…</span>\n```');
  });

  it('points a missing provider at explain-injection with the owner and token', () => {
    const section = explainSection(
      { kind: 'missing-provider', token: 'TripApi', path: ['TripList', 'TripApi'] },
      { id: 'c4', name: 'TripList' },
    );
    expect(section).toContain('`TripList` -> `TripApi`');
    expect(section).toContain(
      'pangular:explain-injection with `selector` `c4` and `token` `TripApi`',
    );
  });
});
