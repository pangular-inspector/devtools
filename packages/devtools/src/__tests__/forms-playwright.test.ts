import { describe, expect, it } from 'vitest';
import type { CollectedForm, FormEvent, FormFieldNode } from '../forms.ts';
import { fieldSelector, playwrightTestText } from '../rpc/forms-playwright.ts';
import type { FormsState } from '../rpc/forms-tools.ts';

function node(path: string, extra: Partial<FormFieldNode> = {}): FormFieldNode {
  return {
    key: path.split('.').pop() ?? '',
    path,
    type: 'control',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: true,
    errors: [],
    ...extra,
  };
}

const reactive: CollectedForm = {
  id: 'Checkout.form@p1',
  kind: 'reactive',
  owner: 'Checkout',
  label: 'Checkout.form',
  root: {
    ...node(''),
    type: 'group',
    status: 'VALID',
    children: [
      node('email', { value: 'a@b.co' }),
      node('password', { value: '[redacted]', redacted: 'input-type' }),
      node('terms', { value: true, accessor: 'CheckboxControlValueAccessor' }),
      {
        ...node('address'),
        type: 'group',
        children: [node('address.city', { value: 'Paris' })],
      },
      {
        ...node('items'),
        type: 'array',
        children: [node('items.0', { value: 'x' })],
      },
    ],
  },
};

function event(
  path: string,
  detail: string,
  seq: number,
  extra: Partial<FormEvent> = {},
): FormEvent {
  return {
    formId: reactive.id,
    path,
    type: 'value',
    detail,
    timestamp: seq,
    seq,
    origin: 'user',
    ...extra,
  };
}

function state(events: FormEvent[], forms = [reactive]): FormsState {
  return { forms, events, reportedAt: 0 };
}

function code(text: string): string {
  return text.match(/```ts\n([\s\S]*)```$/)?.[1] ?? '';
}

describe('Playwright test export', () => {
  it('builds selectors from the bindings and gives up on array indexes', () => {
    const [email, , , address, items] = reactive.root.children!;
    expect(fieldSelector(reactive, email)).toBe('[formcontrolname="email"]');
    expect(fieldSelector(reactive, address.children![0])).toBe(
      '[formgroupname="address"] [formcontrolname="city"]',
    );
    expect(fieldSelector(reactive, items.children![0])).toBeNull();
    const template = { ...reactive, kind: 'template' as const };
    expect(fieldSelector(template, address.children![0])).toBe(
      '[ngmodelgroup="address"] [name="city"]',
    );
    const signalForm = { ...reactive, kind: 'signal' as const };
    expect(fieldSelector(signalForm, node('email', { name: 'f.email' }))).toBe('[name="f.email"]');
    expect(fieldSelector(signalForm, email)).toBeNull();
  });

  it('replays typing as the last value per field, secrets from the environment, then submits and checks', () => {
    const text = playwrightTestText(
      state([
        event('email', '"a"', 1),
        event('email', '"a@b.co"', 2),
        event('password', '"[redacted]"', 3),
        event('terms', 'true', 4),
        event('address.city', '"Paris"', 5),
        event('items.0', '"x"', 6),
        event('email', '"from code"', 7, { origin: 'code' }),
        { formId: reactive.id, path: '', type: 'submit', timestamp: 8, seq: 8, origin: 'user' },
      ]),
      { form: reactive.id, url: 'http://localhost:4200/checkout' },
    );
    const test = code(text);
    expect(test).toContain("import { test, expect } from '@playwright/test';");
    expect(test).toContain('await page.goto("http://localhost:4200/checkout");');
    expect(test).toContain('await page.locator("[formcontrolname=\\"email\\"]").fill("a@b.co");');
    expect(test).not.toContain('fill("a")');
    expect(test).not.toContain('from code');
    expect(test).toContain('process.env["FORM_PASSWORD"]');
    expect(test).not.toContain('[redacted]');
    expect(test).toContain('.setChecked(true);');
    expect(test).toContain('[formgroupname=\\"address\\"] [formcontrolname=\\"city\\"]');
    expect(test).toContain('// TODO: set items.0 to "x"');
    expect(test).toContain('button[type="submit"], input[type="submit"]');
    expect(test).toContain('toHaveValue("a@b.co")');
    expect(test).toContain('toBeChecked()');
    expect(test).toContain('toHaveClass(/ng-valid/)');
  });

  it('says when no change from a person, an agent or the panel is recorded', () => {
    expect(
      playwrightTestText(state([event('email', '"x"', 1, { origin: 'code' })]), {
        form: reactive.id,
      }),
    ).toContain('No changes');
  });
});
