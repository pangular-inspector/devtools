import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';
import { PropValue, parseDraft, type EditableProp } from '../pages/component-prop-value';

type Call = (name: string, arg: Record<string, unknown>) => Promise<unknown>;

function fakeClient(
  call: Call,
  state: Record<string, unknown> = {},
  configs: Record<string, unknown> = {},
): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => state[name] ?? null, on: () => () => {} }),
  };
  return { connectionMeta: { configs }, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function el(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function buttons(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement[] {
  return Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('button')).filter(
    (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name,
  );
}

function key(target: Element, name: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(prop: EditableProp, call: Call, writes = true) {
  const fixture = TestBed.createComponent(PropValue);
  fixture.componentRef.setInput('prop', prop);
  fixture.componentRef.setInput('componentId', 'c1');
  fixture.componentRef.setInput('pageId', 'p1');
  fixture.componentRef.setInput('rpc', fakeClient(call));
  fixture.componentRef.setInput('writes', writes);
  document.body.append(fixture.nativeElement);
  return fixture;
}

describe('parseDraft', () => {
  it('reads JSON and explains text without quotes', () => {
    expect(parseDraft(' 42 ')).toEqual({ value: 42 });
    expect(parseDraft('"Paris"')).toEqual({ value: 'Paris' });
    expect(parseDraft('Paris')).toEqual({ error: expect.stringMatching(/double quotes/) });
    expect(parseDraft('')).toEqual({ error: expect.stringMatching(/Type a JSON value/) });
  });
});

describe('PropValue', () => {
  it('edits a writable signal: Edit focuses a labelled field, Enter sends set-signal', async () => {
    const call = vi.fn<Call>(async () => ({ ok: true, value: 5 }));
    const fixture = mount({ name: 'count', prop: 'count', value: 1, edit: 'signal' }, call);
    await settle(fixture);
    buttons(fixture, 'Edit count')[0].click();
    await settle(fixture);
    const input = el(fixture).querySelector('input')!;
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('1');
    const label = el(fixture).querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent).toContain('New value of count, as JSON');
    expect(input.getAttribute('aria-describedby')).toContain('-hint');
    type(input, '5');
    key(input, 'Enter');
    await settle(fixture);
    expect(call).toHaveBeenCalledWith('request-component-edit', {
      pageId: 'p1',
      request: { id: 'c1', path: 'count', value: 5, kind: 'signal' },
    });
    expect(el(fixture).querySelector('input')).toBeNull();
    expect(el(fixture).querySelector('[role="status"]')?.textContent).toBe('Set count.');
    expect(document.activeElement).toBe(buttons(fixture, 'Edit count')[0]);
  });

  it('Escape cancels without writing and returns focus to Edit', async () => {
    const call = vi.fn<Call>(async () => ({ ok: true }));
    const fixture = mount({ name: 'price', prop: 'price', value: 120, edit: 'property' }, call);
    await settle(fixture);
    buttons(fixture, 'Edit price')[0].click();
    await settle(fixture);
    key(el(fixture).querySelector('input')!, 'Escape');
    await settle(fixture);
    expect(call).not.toHaveBeenCalled();
    expect(el(fixture).querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(buttons(fixture, 'Edit price')[0]);
  });

  it('shows the refusal from the page and bad JSON as an alert tied to the field', async () => {
    const call = vi.fn<Call>(async () => ({
      error: '`price` is redacted, so it cannot be written.',
    }));
    const fixture = mount({ name: 'price', prop: 'price', value: 1, edit: 'property' }, call);
    await settle(fixture);
    buttons(fixture, 'Edit price')[0].click();
    await settle(fixture);
    const input = el(fixture).querySelector('input')!;
    type(input, 'oops');
    key(input, 'Enter');
    await settle(fixture);
    expect(call).not.toHaveBeenCalled();
    const alert = el(fixture).querySelector('[role="alert"]')!;
    expect(alert.textContent).toMatch(/Not valid JSON/);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    type(input, '2');
    buttons(fixture, 'Apply')[0].click();
    await settle(fixture);
    expect(el(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'is redacted, so it cannot be written',
    );
    expect(el(fixture).querySelector('input')).not.toBeNull();
  });

  it('says why a read-only value cannot be edited, and offers no Edit', async () => {
    const fixture = mount(
      {
        name: 'title',
        prop: 'title',
        value: 'Paris',
        locked: 'Signal input. Its parent binding sets it, so it has no set().',
      },
      vi.fn<Call>(),
    );
    await settle(fixture);
    expect(buttons(fixture, 'Edit title')).toHaveLength(0);
    expect(el(fixture).textContent).toContain('Signal input. Its parent binding sets it');
  });

  it('stays read-only when writes are off', async () => {
    const fixture = mount(
      { name: 'count', prop: 'count', value: 1, edit: 'signal' },
      vi.fn<Call>(),
      false,
    );
    await settle(fixture);
    expect(buttons(fixture, 'Edit count')).toHaveLength(0);
  });
});

describe('ComponentTree editing', () => {
  const page = {
    pageId: 'p1',
    roots: [{ id: 'c1', name: 'Card', tag: 'app-card', children: [] }],
    count: 1,
    reportedAt: 1,
    detail: {
      id: 'c1',
      name: 'Card',
      tag: 'app-card',
      path: 'app-card',
      inputs: [{ name: 'title', prop: 'title', value: 'Paris', locked: 'Signal input.' }],
      outputs: [],
      properties: [{ name: 'count', prop: 'count', value: 1, kind: 'signal', edit: 'signal' }],
      listeners: [],
      directives: [],
      dependencies: [],
    },
  };

  async function open(configs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(async () => [], { 'component-tree': { pages: { p1: page } } }, configs),
    );
    await settle(fixture);
    // The page reports the detail of the instance it has selected, so the panel follows it.
    expect(fixture.componentInstance.selectedId()).toBe('c1');
    return fixture;
  }

  it('offers Edit for writable values of the selected component', async () => {
    const fixture = await open();
    expect(buttons(fixture, 'Edit count')).toHaveLength(1);
    expect(buttons(fixture, 'Edit title')).toHaveLength(0);
    expect(el(fixture).textContent).toContain('Signal input.');
  });

  it('offers no Edit when actions.components is off', async () => {
    const fixture = await open({ pangular: { actions: { components: false } } });
    expect(buttons(fixture, 'Edit count')).toHaveLength(0);
    expect(el(fixture).textContent).not.toContain('Signal input.');
  });
});
