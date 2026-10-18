import { describe, expect, it } from 'vitest';
import { REDACTED, type CollectedForm, type FormFieldNode } from '../forms.ts';
import {
  FORM_TOOL_MAX_CHARS,
  MAX_FORM_LINES,
  capFieldTree,
  capLines,
  type CappedFieldNode,
} from '../rpc/forms-cap.ts';
import { exportFormText, formPayloadText, lintFormsText } from '../rpc/forms-explain.ts';
import { explainFormsText, inspectFormsText, type FormsState } from '../rpc/forms-tools.ts';

function control(path: string, overrides: Partial<FormFieldNode> = {}): FormFieldNode {
  return {
    key: path.split('.').pop()!,
    path,
    type: 'control',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: true,
    value: 'x',
    errors: [],
    ...overrides,
  };
}

function group(
  path: string,
  children: FormFieldNode[],
  type: FormFieldNode['type'] = 'group',
): FormFieldNode {
  return {
    ...control(path),
    key: path.split('.').pop() ?? '',
    type,
    value: undefined,
    bound: false,
    status: children.some((c) => c.status === 'INVALID') ? 'INVALID' : 'VALID',
    children,
  };
}

/** A form with `name` and an `items` array of `rows` groups, each with five controls. */
function bigForm(rows: number, invalid = false): CollectedForm {
  const items = Array.from({ length: rows }, (_, i) =>
    group(
      `items.${i}`,
      ['a', 'b', 'c', 'd', 'e'].map((k) =>
        control(`items.${i}.${k}`, {
          value: `row ${i} ${k}`,
          ...(invalid
            ? {
                status: 'INVALID' as const,
                errors: [{ kind: 'required', message: 'is required' }],
              }
            : {}),
        }),
      ),
    ),
  );
  return {
    id: 'Orders.form@p1',
    kind: 'reactive',
    owner: 'Orders',
    label: 'Orders.form',
    root: group('', [control('name'), group('items', items, 'array')]),
  };
}

function stateOf(...forms: CollectedForm[]): FormsState {
  return { forms, events: [], reportedAt: 1 };
}

const json = (text: string) => JSON.parse(text.split('\n\n')[1]);

function countKept(node: CappedFieldNode): number {
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countKept(c), 0);
}

describe('capFieldTree', () => {
  it('keeps fields breadth first and counts what it left out on each group', () => {
    const root = bigForm(10).root;
    const capped = capFieldTree(root, 20);
    expect(capped.total).toBe(1 + 2 + 10 + 50);
    expect(capped.shown).toBe(20);
    expect(countKept(capped.root)).toBe(20);
    const items = capped.root.children![1];
    expect(items.children).toHaveLength(10);
    // root, name, items and ten rows are 13; the next 7 controls are rows 0 and 1.
    expect(items.children![0].notShown).toBeUndefined();
    expect(items.children![1].children!.map((c) => c.key)).toEqual(['a', 'b']);
    expect(items.children![1].notShown).toBe(3);
    expect(items.children![9].notShown).toBe(5);
    expect(capped.cut[0]).toBe('items.1.c');
  });

  it('leaves small trees and short values unchanged', () => {
    const root = bigForm(2).root;
    const capped = capFieldTree(root);
    expect(capped.shown).toBe(capped.total);
    expect(capped.cut).toEqual([]);
    expect(capped.clipped).toBe(0);
    expect(capped.root).toEqual(root);
  });

  it('cuts long values and keeps redacted ones', () => {
    const root = group('', [
      control('notes', { value: 'n'.repeat(1000) }),
      control('password', { value: REDACTED, redacted: 'key' }),
      control('tags', {
        value: Array.from({ length: 20 }, (_, i) => `tag-${i}-${'t'.repeat(30)}`),
      }),
    ]);
    const capped = capFieldTree(root, 200, 100);
    const [notes, password, tags] = capped.root.children!;
    expect(notes.value).toBe(`"${'n'.repeat(99)}…`);
    expect(password.value).toBe(REDACTED);
    expect(typeof tags.value).toBe('string');
    expect((tags.value as string).endsWith('…')).toBe(true);
    expect(capped.clipped).toBe(2);
  });
});

describe('capLines', () => {
  it('keeps the first lines and says how many more were left out and how to narrow', () => {
    const lines = Array.from({ length: 105 }, (_, i) => `- ${i}`);
    const out = capLines(lines, 'pass `form` to narrow it down');
    expect(out).toHaveLength(MAX_FORM_LINES + 1);
    expect(out.at(-1)).toBe('- … and 5 more not shown; pass `form` to narrow it down.');
    expect(capLines(lines.slice(0, 3), 'x')).toEqual(lines.slice(0, 3));
  });
});

describe('inspect-forms size cap', () => {
  const state = stateOf(bigForm(80));

  it('returns valid JSON under the cap with a note on what was left out', () => {
    const text = inspectFormsText(state, { form: 'Orders' });
    expect(text.length).toBeLessThan(FORM_TOOL_MAX_CHARS);
    const [tree] = json(text);
    expect(tree.root.children[1].children.at(-1).notShown).toBe(5);
    // Bisection keeps as many fields as fit, not just a round fraction of the cap.
    const shown = Number(/showing (\d+) of/.exec(text)![1]);
    expect(countKept(tree.root)).toBe(shown);
    expect(shown).toBeGreaterThan(100);
    expect(text).toMatch(
      /_Orders\.form@p1: showing \d+ of 483 fields; \d+ more not shown\. Groups that lost fields carry `notShown`\. Pass `path` to start the tree at a group or field, e\.g\. `items\.\d+\.\w`/,
    );
    expect(text).not.toContain('truncated at');
  });

  it('shows every field of a group when the agent passes its path', () => {
    const text = inspectFormsText(state, { form: 'Orders', path: 'items.79' });
    const [tree] = json(text);
    expect(tree.root.path).toBe('items.79');
    expect(tree.root.children.map((c: FormFieldNode) => c.value)).toEqual(
      ['a', 'b', 'c', 'd', 'e'].map((k) => `row 79 ${k}`),
    );
    expect(text).not.toContain('not shown');
  });

  it('cuts long values and says how to see them', () => {
    const form = bigForm(1);
    form.root.children![0].value = 'v'.repeat(5000);
    const text = inspectFormsText(stateOf(form), { form: 'Orders' });
    const [tree] = json(text);
    expect(tree.root.children[0].value).toHaveLength(301);
    expect(text).toContain(
      "_1 value(s) longer than 300 characters are cut and end in …. A group's value is also split across its fields; use inspect-form-payload with `path` to read a longer value._",
    );
  });

  it('does not report a cut for a small form', () => {
    expect(inspectFormsText(stateOf(bigForm(3)), { form: 'Orders' })).not.toContain('not shown');
  });
});

describe('explain-invalid-forms size cap', () => {
  const state = stateOf(bigForm(40, true));

  it('lists at most 100 problems per form and names a path to narrow', () => {
    const text = explainFormsText(state, {});
    const lines = text.split('\n').filter((l) => l.startsWith('- '));
    expect(lines).toHaveLength(MAX_FORM_LINES + 1);
    expect(lines.at(-1)).toBe(
      '- … and 100 more not shown; pass `path` to explain one group, e.g. `items`.',
    );
  });

  it('explains only the fields under `path`', () => {
    const text = explainFormsText(state, { form: 'Orders', path: 'items.39' });
    const lines = text.split('\n').filter((l) => l.startsWith('- '));
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain('`items.39.a`');
    expect(text).not.toContain('not shown');
  });

  it('says when the path does not exist', () => {
    expect(explainFormsText(state, { form: 'Orders', path: 'nope' })).toContain(
      'No field at `nope`; top-level fields: name, items.',
    );
  });
});

describe('inspect-form-payload and export-form size cap', () => {
  it('cuts a long form value and narrows by path', () => {
    const form = bigForm(1);
    form.root.children![0].value = 'v'.repeat(20_000);
    const state = stateOf(form);
    const text = formPayloadText(state, { form: 'Orders' });
    expect(text.length).toBeLessThan(FORM_TOOL_MAX_CHARS);
    expect(text).toMatch(/… \(cut at 8000 of \d+ characters; pass `path` to show one group\)/);

    const narrowed = formPayloadText(state, { form: 'Orders', path: 'items.0' });
    expect(narrowed).toContain(
      'form.value at `items.0`: {"a":"row 0 a","b":"row 0 b","c":"row 0 c","d":"row 0 d","e":"row 0 e"}',
    );
    expect(formPayloadText(state, { form: 'Orders', path: 'nope' })).toContain(
      'No field at `nope` in Orders.form@p1',
    );
  });

  it('keeps a snapshot within the cap and says what was cut', () => {
    const text = exportFormText(stateOf(bigForm(80)), { form: 'Orders' });
    expect(text.length).toBeLessThan(FORM_TOOL_MAX_CHARS + 1_000);
    const snapshot = JSON.parse(/```json\n([\s\S]*)\n```/.exec(text)![1]);
    const shown = Number(/_Snapshot cut: showing (\d+) of 483 fields/.exec(text)![1]);
    expect(countKept(snapshot.root)).toBe(shown);
    expect(snapshot.root.children[1].children.at(-1).notShown).toBe(5);
    expect(text).toContain('read the rest with inspect-forms or inspect-form-payload and a `path`');
  });
});

describe('lint-forms size cap', () => {
  it('lists at most 100 findings', () => {
    const form = bigForm(1);
    form.root.children = Array.from({ length: 150 }, (_, i) =>
      control(`f${i}`, { dom: { labelled: false } }),
    );
    const text = lintFormsText(stateOf(form), {});
    expect(text).toMatch(/- … and \d+ more not shown; pass `form` to lint one form\.$/);
  });
});

describe('answers that must stay parseable', () => {
  /** One field whose own errors are far larger than the whole budget, even with each text cut. */
  function hugeField(): CollectedForm {
    const params = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`p${i}`, 'q'.repeat(1000)]),
    );
    // The form itself (the one field always shown) carries the cross-field errors.
    return {
      ...bigForm(0),
      root: {
        ...group('', [control('email')]),
        status: 'INVALID',
        errors: Array.from({ length: 50 }, (_, i) => ({
          kind: `rule${i}`,
          message: 'm'.repeat(100_000),
          params,
        })),
        metadata: Array.from({ length: 50 }, () => ({ note: 'n'.repeat(100_000) })),
      },
    };
  }

  it('cuts long error messages and metadata in a field tree', () => {
    const form = bigForm(0);
    form.root.children = [
      control('email', {
        status: 'INVALID',
        errors: [{ kind: 'email', message: 'm'.repeat(100_000) }],
        metadata: [{ note: 'n'.repeat(100_000) }],
      }),
    ];
    const text = inspectFormsText(stateOf(form), { form: 'Orders' });
    const [tree] = json(text);
    const email = tree.root.children[0];
    expect(email.errors[0].message).toHaveLength(301);
    expect(email.metadata[0].note).toHaveLength(301);
    expect(text).toContain(
      '_Long error messages, metadata and other text in 1 field(s) are cut at 300 characters; call explain-field with `path` for one field._',
    );
  });

  it('inspect-forms returns parseable JSON when one field does not fit', () => {
    const text = inspectFormsText(stateOf(hugeField()), { form: 'Orders' });
    expect(text.length).toBeLessThan(FORM_TOOL_MAX_CHARS);
    const [record] = json(text);
    expect(record).toMatchObject({ id: 'Orders.form@p1', root: null, notShown: 2 });
    expect(text).toContain('_Not even one field per form fits in 18000 characters');
    expect(text).not.toContain('truncated at');
  });

  it('inspect-forms clips a huge label instead of cutting the JSON', () => {
    const form = { ...bigForm(1), label: 'L'.repeat(50_000) };
    const text = inspectFormsText(stateOf(form), { form: 'Orders.form@p1' });
    expect(text.length).toBeLessThan(FORM_TOOL_MAX_CHARS);
    expect(json(text)[0].label).toHaveLength(201);
  });

  it('export-form returns a parseable snapshot when one field does not fit', () => {
    const text = exportFormText(stateOf(hugeField()), { form: 'Orders' });
    const snapshot = JSON.parse(/```json\n([\s\S]*)\n```/.exec(text)![1]);
    expect(snapshot.root).toEqual({ path: '', status: 'INVALID', notShown: 2 });
    expect(text).toContain('not even one field fits');
    expect(text.length).toBeLessThan(FORM_TOOL_MAX_CHARS + 1_000);
  });

  it('inspect-form-payload handles a path to a field without a value', () => {
    const form = bigForm(1);
    form.root.children![0].value = undefined;
    const text = formPayloadText(stateOf(form), { form: 'Orders', path: 'name' });
    expect(text).toContain('form.value at `name`: undefined');
    expect(text).not.toContain('Secret values');
  });

  it('export-form keeps a fixture header and body within the budget together', () => {
    const text = exportFormText(stateOf(bigForm(400, true)), { form: 'Orders', format: 'fixture' });
    const code = /```ts\n([\s\S]*)\n```/.exec(text)![1];
    expect(code.length).toBeLessThanOrEqual(FORM_TOOL_MAX_CHARS);
    expect(code).toContain('items.0.a required, ');
    expect(code).toContain('and 1980 more not shown (call explain-invalid-forms for all)');
  });
});
