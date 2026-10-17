import { describe, expect, it } from 'vitest';
import { formActionProblem } from '../forms-actions.ts';
import { resolvePangularConfig } from '../config.ts';
import { noMatch } from '../rpc/forms-tools.ts';
import { openInPanel } from '../rpc/open-in-panel.ts';
import { isRefusal, refusal, refusalOf, ToolRefusal } from '../rpc/refusal.ts';
import { checkToolArgs, guardHandler } from '../rpc/tool-input.ts';
import { unknownPageText } from '../rpc/pages.ts';
import { unknownRouterActionText } from '../router-actions.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    page: { type: 'string', description: 'Page id.' },
    selector: { type: 'string', description: 'Host tag or class name.' },
    limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Rows to list.' },
    ratio: { type: 'number' },
    on: { type: 'boolean' },
    record: { type: 'string', enum: ['start', 'stop', 'clear'] },
    sections: { type: 'array', items: { type: 'string', enum: ['page', 'http'] } },
    params: { type: 'object', additionalProperties: { type: 'string' } },
    values: { type: 'object' },
    value: { description: 'Any value.' },
  },
  required: ['selector'],
};

const error = (args: unknown, schema: unknown = SCHEMA) => {
  const checked = checkToolArgs(schema, args);
  return 'error' in checked ? checked.error : undefined;
};

describe('checkToolArgs', () => {
  it('passes arguments that fit the schema, unknown keys included', () => {
    const args = {
      selector: 'app-root',
      limit: 5,
      ratio: 0.5,
      on: false,
      record: 'stop',
      sections: ['page'],
      params: { id: '7' },
      values: { 'a.b': 1 },
      value: null,
      extra: 1,
    };
    expect(checkToolArgs(SCHEMA, args)).toEqual({ args });
  });

  it('asks for a missing required argument with what it takes', () => {
    expect(error({})).toBe('Pass `selector`: Host tag or class name.');
    expect(error({ selector: null })).toBe('Pass `selector`: Host tag or class name.');
    expect(
      error({}, { properties: { tab: { type: 'string', enum: ['a', 'b'] } }, required: ['tab'] }),
    ).toBe('Pass `tab`: one of `a`, `b`.');
  });

  it('names a wrong-typed argument, what it takes and what it got', () => {
    expect(error({ selector: 12345 })).toBe(
      '`selector` must be a string, not the number (12345). Host tag or class name.',
    );
    expect(error({ selector: 'x', limit: 'ten' })).toBe(
      '`limit` must be a whole number, not a string ("ten"). Rows to list.',
    );
    expect(error({ selector: 'x', limit: 2.5 })).toMatch(/^`limit` must be a whole number/);
    expect(error({ selector: 'x', ratio: '1' })).toMatch(/^`ratio` must be a number/);
    expect(error({ selector: 'x', on: 'yes' })).toMatch(/^`on` must be true or false/);
    expect(error({ selector: 'x', values: 'a=1' })).toMatch(/^`values` must be an object/);
    expect(error({ selector: 'x', values: [1] })).toMatch(
      /^`values` must be an object, not an array/,
    );
    expect(error({ selector: 'x', sections: 'page' })).toMatch(/^`sections` must be an array/);
  });

  it('rejects a value outside an enum or a range', () => {
    expect(error({ selector: 'x', record: 'bogus' })).toBe(
      '`record` must be one of `start`, `stop`, `clear`, not a string ("bogus").',
    );
    expect(error({ selector: 'x', limit: 0 })).toMatch(/^`limit` must be at least 1, not 0\./);
    expect(error({ selector: 'x', limit: 1_000_000 })).toMatch(/^`limit` must be at most 50/);
    expect(error({ selector: 'x', sections: ['page', 'bogus'] })).toMatch(
      /^`sections\[1\]` must be one of `page`, `http`/,
    );
    expect(error({ selector: 'x', params: { id: 7 } })).toMatch(/^`params\.id` must be a string/);
    expect(error({ on: false }, { properties: { on: { type: 'boolean', enum: [true] } } })).toMatch(
      /^`on` only takes `true`, not a boolean \(false\)\./,
    );
  });

  it('never lets a non-string page fall back to another tab, aliases included', () => {
    expect(error({ selector: 'x', page: 12345 })).toBe(
      '`page` must be a string, not the number (12345). Pass a page id from pangular:list-pages, or leave it out for the most recent page.',
    );
    // `pageId` is an alias the schema does not list.
    expect(error({ selector: 'x', pageId: { id: 'p1' } })).toMatch(
      /^`pageId` must be a string, not an object/,
    );
    expect(error({ selector: 'x', pageId: false })).toMatch(/^`pageId` must be a string/);
  });

  it('treats null and an empty page as left out', () => {
    expect(checkToolArgs(SCHEMA, { selector: 'x', limit: null, page: '' })).toEqual({
      args: { selector: 'x' },
    });
    // A property that takes any value keeps its null.
    expect(checkToolArgs(SCHEMA, { selector: 'x', value: null })).toEqual({
      args: { selector: 'x', value: null },
    });
  });

  it('accepts null for a required argument that takes any value or allows null', () => {
    const setSignal = {
      type: 'object',
      properties: {
        component: { type: 'string' },
        signal: { type: 'string' },
        value: { description: 'The new value, as JSON.' },
        note: { type: ['string', 'null'] },
      },
      required: ['component', 'signal', 'value', 'note'],
    };
    const args = { component: 'c1', signal: 'count', value: null, note: null };
    expect(checkToolArgs(setSignal, args)).toEqual({ args });
    expect(error({ component: null, signal: 's', value: 1, note: 'x' }, setSignal)).toBe(
      'Pass `component`.',
    );
    expect(error({ component: 'c1', signal: 's', note: 'x' }, setSignal)).toBe(
      'Pass `value`: The new value, as JSON.',
    );
  });

  it('accepts null for a nested required key that takes any value', () => {
    const nested = {
      type: 'object',
      properties: {
        edit: {
          type: 'object',
          properties: { path: { type: 'string' }, value: {} },
          required: ['path', 'value'],
        },
      },
    };
    expect(error({ edit: { path: 'a', value: null } }, nested)).toBeUndefined();
    expect(error({ edit: { path: null, value: 1 } }, nested)).toBe('`edit.path` is required.');
  });

  it('refuses arguments that are not an object, and lists at most five problems', () => {
    expect(error([1, 2])).toMatch(/^The arguments must be an object of named values, not an array/);
    expect(error('x')).toMatch(/^The arguments must be an object/);
    expect(checkToolArgs(SCHEMA, undefined)).toEqual({ error: expect.stringContaining('Pass') });
    const many = error({
      selector: 1,
      limit: 'a',
      ratio: 'b',
      on: 'c',
      record: 'd',
      sections: 'e',
      values: 'f',
    })!;
    expect(many.split('\n')).toHaveLength(6);
    expect(many).toMatch(/…and 2 more\.$/);
  });

  it('accepts anything for a tool without a schema, but still wants an object', () => {
    expect(checkToolArgs(undefined, { a: 1 })).toEqual({ args: { a: 1 } });
    expect(checkToolArgs(undefined, undefined)).toEqual({ args: {} });
  });

  it('honours additionalProperties: false', () => {
    expect(error({ x: 1 }, { type: 'object', properties: {}, additionalProperties: false })).toBe(
      'There is no `x` argument.',
    );
  });

  it('checks unlisted top-level keys against a schema-valued additionalProperties', () => {
    const schema = {
      type: 'object',
      properties: { page: { type: 'string' } },
      additionalProperties: { type: 'string' },
    };
    expect(checkToolArgs(schema, { page: 'p1', id: '7' })).toEqual({
      args: { page: 'p1', id: '7' },
    });
    expect(error({ id: 7 }, schema)).toMatch(/`id`.*string/);
    // A null the schema refuses counts as left out, as for a listed argument.
    expect(checkToolArgs(schema, { id: null })).toEqual({ args: {} });
    const nullable = { ...schema, additionalProperties: { type: ['string', 'null'] } };
    expect(checkToolArgs(nullable, { id: null })).toEqual({ args: { id: null } });
  });
});

describe('guardHandler', () => {
  it('runs the handler with checked arguments only', async () => {
    const seen: unknown[] = [];
    const handler = guardHandler(SCHEMA, (args: Record<string, unknown>) => {
      seen.push(args);
      return { markdown: 'ok' };
    });
    await expect(handler({ selector: 'a', limit: null })).resolves.toEqual({ markdown: 'ok' });
    expect(seen).toEqual([{ selector: 'a' }]);
    const refused = handler({ selector: 'a', page: 12345 });
    await expect(refused).rejects.toBeInstanceOf(ToolRefusal);
    await expect(refused).rejects.toMatchObject({ name: 'Invalid arguments' });
    expect(seen).toHaveLength(1);
  });

  it('sends a refusal the handler answers with as a thrown ToolRefusal', async () => {
    const text = refusal('Pass `selector`: a host tag.');
    const markdown = guardHandler(undefined, () => ({ markdown: text }));
    await expect(markdown({})).rejects.toMatchObject({ name: 'Refused', message: text });
    const plain = guardHandler(undefined, () => text);
    await expect(plain({})).rejects.toBeInstanceOf(ToolRefusal);
    const answer = guardHandler(undefined, () => ({ markdown: 'Pass `selector` is fine here.' }));
    await expect(answer({})).resolves.toEqual({ markdown: 'Pass `selector` is fine here.' });
  });

  it('keeps one "Refused:" in the text MCP sends', () => {
    const error = new ToolRefusal('Refused: confirm first.');
    expect(`${error.name}: ${error.message}`).toBe('Refused: confirm first.');
  });
});

describe('refusals', () => {
  it('marks the texts built with refusal() and finds them in an answer', () => {
    const text = refusal('No page `x` is reporting things.');
    expect(isRefusal(text)).toBe(true);
    expect(isRefusal('No page `x` is reporting things, really.')).toBe(false);
    expect(refusalOf({ markdown: text })).toBe(text);
    expect(refusalOf({ mcpContent: [{ type: 'text', text }] })).toBe(text);
    expect(refusalOf({ markdown: 'ok' })).toBeUndefined();
  });

  it('marks the unknown-page answer as a refusal', () => {
    expect(isRefusal(unknownPageText('gone', [{ pageId: 'p1' }], 'forms'))).toBe(true);
  });
});

describe('refusal messages', () => {
  it('names the form when no page reports forms, without an empty list', () => {
    const text = noMatch([], 'Checkout.form');
    expect(text).toBe('No form matches `Checkout.form`: the page reports no forms right now.');
    expect(text).not.toContain('Forms on the page: .');
    expect(isRefusal(text)).toBe(true);
  });

  it('says what is wrong with a form action request instead of "Unknown form action"', () => {
    expect(formActionProblem({ action: 'focus', formId: 'f', path: 12 })).toBe(
      '`path` must be a string.',
    );
    expect(formActionProblem({ action: 'fill', formId: 'f', values: 'a=1' })).toBe(
      '`values` must be an object of field paths to values.',
    );
    expect(formActionProblem({ action: 'drop' })).toMatch(
      /^Unknown form action "drop"\. Actions: set-value, /,
    );
    expect(formActionProblem({ action: 'focus', formId: 'f', path: 'a.b' })).toBeUndefined();
  });

  it('asks open-in-panel for a tab with the tabs there are', () => {
    const config = resolvePangularConfig();
    const text = openInPanel({} as never, { config, pages: [] }).markdown;
    expect(text).toMatch(/^Pass `tab`, the panel tab to open: one of `dashboard`, /);
    expect(text).not.toContain('no tab');
    expect(isRefusal(text)).toBe(true);
  });

  it('lists the router actions for a missing or unknown one', () => {
    const all = '`navigate`, `abort`, `replay`, `probe`, `instrument`, `resolve-lazy`';
    expect(unknownRouterActionText(undefined)).toBe(`Pass \`action\`: one of ${all}.`);
    expect(unknownRouterActionText('jump')).toBe(
      `Unknown action \`jump\`. Pass \`action\`: one of ${all}.`,
    );
  });
});
