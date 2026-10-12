import { describe, expect, it } from 'vitest';
import { isEmptyTreeQuery, matchesTreeQuery, parseTreeQuery } from '../config.ts';

const button = {
  name: 'MatTooltip',
  tag: 'button',
  kind: 'directive' as const,
  directives: ['MatTooltip', 'RouterLink'],
  attributes: ['matTooltip', 'routerLink'],
};
const row = { name: 'TripRow', tag: 'app-row', directives: ['FormControlDirective'] };
const input = { name: 'NgModel', tag: 'input', directives: ['NgModel'], attributes: ['ngModel'] };

describe('parseTreeQuery', () => {
  it('splits <tag> and [dir] tokens from the plain text', () => {
    expect(parseTreeQuery('<button> [matTooltip] Save  ')).toEqual({
      tags: [{ value: 'button', exact: true }],
      directives: [{ value: 'mattooltip', exact: true }],
      text: 'save',
    });
    expect(parseTreeQuery('trip row')).toEqual({ tags: [], directives: [], text: 'trip row' });
  });

  it('reads a token still being typed at the end as a prefix', () => {
    expect(parseTreeQuery('<app-r')).toMatchObject({ tags: [{ value: 'app-r', exact: false }] });
    expect(parseTreeQuery('<button> [mat')).toMatchObject({
      tags: [{ value: 'button', exact: true }],
      directives: [{ value: 'mat', exact: false }],
      text: '',
    });
    expect(isEmptyTreeQuery(parseTreeQuery('<'))).toBe(true);
    expect(isEmptyTreeQuery(parseTreeQuery('  '))).toBe(true);
  });
});

describe('matchesTreeQuery', () => {
  const match = (query: string, node: Parameters<typeof matchesTreeQuery>[0]) =>
    matchesTreeQuery(node, parseTreeQuery(query));

  it('matches a tag exactly and a directive by attribute or class name', () => {
    expect(match('<button>', button)).toBe(true);
    expect(match('<but>', button)).toBe(false);
    expect(match('<button> [matTooltip]', button)).toBe(true);
    expect(match('[routerLink] <button>', button)).toBe(true);
    expect(match('[ngModel]', input)).toBe(true);
    expect(match('[ngModel]', button)).toBe(false);
    // A class name with the Directive suffix matches without it.
    expect(match('[formControl]', row)).toBe(true);
    expect(match('<app-row>', row)).toBe(true);
  });

  it('needs every part to match, plain text included', () => {
    expect(match('<button> [matTooltip] tooltip', button)).toBe(true);
    expect(match('<button> [matTooltip] cart', button)).toBe(false);
    expect(match('<a> [matTooltip]', button)).toBe(false);
    expect(match('trip', row)).toBe(true);
    expect(match('formcontrol', row)).toBe(true);
  });

  it('matches a partial token as a prefix or part of a name', () => {
    expect(match('<but', button)).toBe(true);
    expect(match('[toolt', button)).toBe(true);
    expect(match('<app-', input)).toBe(false);
  });
});
