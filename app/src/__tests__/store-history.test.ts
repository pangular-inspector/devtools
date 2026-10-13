import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderValue } from '../pages/di-provider-value';
import { EntryTabs, type EntryDetailAnswer } from '../pages/store-entry-tabs';
import { StoreSession } from '../pages/store-session';
import type { NgrxLogEntry } from '../pages/store-types';

type Call = (name: string, arg: Record<string, unknown>) => Promise<unknown>;

function fakeClient(call: Call): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => null, on: () => () => {} }),
  };
  return {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function el(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<unknown>, name: string | RegExp): HTMLButtonElement {
  const found = Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('button')).find((b) => {
    const text = (b.getAttribute('aria-label') ?? b.textContent ?? '').replace(/\s+/g, ' ').trim();
    return typeof name === 'string' ? text === name : name.test(text);
  });
  if (!found) throw new Error(`No button ${name}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
});

@Component({
  imports: [EntryTabs],
  template: `
    <app-entry-tabs idPrefix="t" [seq]="seq()" [diffTruncated]="truncated()" [loader]="loader">
      <div tab-action><p class="action-text">Action rows</p></div>
      <div tab-diff><p class="diff-text">Log diff</p></div>
    </app-entry-tabs>
  `,
})
class TabsHost {
  readonly seq = signal(2);
  readonly truncated = signal<number | undefined>(undefined);
  loader = vi.fn(async (seq: number): Promise<EntryDetailAnswer> => ({
    ok: true,
    detail: {
      seq,
      storeId: 'store',
      before: { count: 1 },
      after: { count: 2 },
      diff: [{ path: 'count', op: 'change', before: 1, after: 2 }],
    },
  }));
}

describe('Entry tabs', () => {
  async function mount() {
    const fixture = TestBed.createComponent(TabsHost);
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    return fixture;
  }
  const tab = (fixture: ComponentFixture<unknown>, name: string) =>
    el(fixture).querySelector<HTMLButtonElement>(`#t-tab-${name}`)!;
  const panel = (fixture: ComponentFixture<unknown>, name: string) =>
    el(fixture).querySelector<HTMLElement>(`#t-panel-${name}`)!;

  it('opens on Diff and moves between tabs with the arrow keys', async () => {
    const fixture = await mount();
    expect(el(fixture).querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe(
      'Entry #2 details',
    );
    expect(tab(fixture, 'diff').getAttribute('aria-selected')).toBe('true');
    expect(panel(fixture, 'diff').hidden).toBe(false);
    expect(panel(fixture, 'action').hidden).toBe(true);
    expect(tab(fixture, 'diff').tabIndex).toBe(0);
    expect(tab(fixture, 'action').tabIndex).toBe(-1);

    tab(fixture, 'diff').focus();
    tab(fixture, 'diff').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    await settle(fixture);
    expect(tab(fixture, 'action').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(fixture, 'action'));
    expect(panel(fixture, 'action').textContent).toContain('Action rows');
    expect(fixture.componentInstance.loader).not.toHaveBeenCalled();

    tab(fixture, 'action').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    await settle(fixture);
    expect(tab(fixture, 'state').getAttribute('aria-selected')).toBe('true');
    expect(fixture.componentInstance.loader).toHaveBeenCalledWith(2);
  });

  it('reads the state when State opens, and shows the state before on request', async () => {
    const fixture = await mount();
    tab(fixture, 'state').click();
    await settle(fixture);
    const pre = () => panel(fixture, 'state').querySelector('pre')!.textContent!;
    expect(pre()).toContain('count: 2');
    button(fixture, 'Before #2').click();
    await settle(fixture);
    expect(pre()).toContain('count: 1');
    expect(button(fixture, 'Before #2').getAttribute('aria-pressed')).toBe('true');
  });

  it('says why the state could not be read and retries', async () => {
    const fixture = await mount();
    fixture.componentInstance.loader.mockResolvedValueOnce({
      error: 'The page no longer holds the state of this entry.',
    });
    tab(fixture, 'state').click();
    await settle(fixture);
    expect(panel(fixture, 'state').querySelector('[role="alert"]')?.textContent).toContain(
      'no longer holds',
    );
    button(fixture, 'Retry').click();
    await settle(fixture);
    expect(panel(fixture, 'state').querySelector('pre')?.textContent).toContain('count: 2');
  });

  it('offers the full diff when the log entry was cut, and starts over for another entry', async () => {
    const fixture = await mount();
    fixture.componentInstance.truncated.set(3);
    await settle(fixture);
    button(fixture, 'Show all changes').click();
    await settle(fixture);
    expect(panel(fixture, 'diff').textContent).toContain('All changes (1)');
    fixture.componentInstance.seq.set(5);
    await settle(fixture);
    expect(tab(fixture, 'diff').getAttribute('aria-selected')).toBe('true');
    expect(panel(fixture, 'diff').textContent).not.toContain('All changes');
  });
});

function entry(seq: number, type: string): NgrxLogEntry {
  return {
    seq,
    source: 'store',
    storeId: 'store',
    type,
    action: { type },
    timestamp: seq,
    diff: [],
    restorable: false,
  };
}

describe('Store session tools', () => {
  async function mount(call: Call) {
    const fixture = TestBed.createComponent(StoreSession);
    document.body.append(fixture.nativeElement);
    fixture.componentRef.setInput('rpc', fakeClient(call));
    fixture.componentRef.setInput('pageId', 'p1');
    fixture.componentRef.setInput('storeId', 'store');
    fixture.componentRef.setInput('entries', [entry(1, 'a'), entry(2, 'b'), entry(3, 'c')]);
    await settle(fixture);
    return fixture;
  }

  it('generates a test from the chosen range and shows it with its notes', async () => {
    const call = vi.fn(async () => ({
      ok: true,
      test: {
        framework: 'Vitest',
        file: 'cart.reducer.session.spec.ts',
        code: "describe('cart', () => {});\n",
        notes: ['Point the import at it.'],
      },
    }));
    const fixture = await mount(call);
    fixture.componentInstance.from.set('3');
    fixture.componentInstance.to.set('2');
    button(fixture, 'Generate test').click();
    await settle(fixture);
    expect(call).toHaveBeenCalledWith('request-ngrx-history', {
      pageId: 'p1',
      request: { type: 'test', storeId: 'store', from: 2, to: 3 },
    });
    const region = el(fixture).querySelector('[aria-labelledby="ngrx-test-heading"]')!;
    expect(region.querySelector('h5')?.textContent).toContain('Generated test (Vitest)');
    expect(region.querySelector('pre')?.textContent).toContain("describe('cart'");
    expect(region.textContent).toContain('Point the import at it.');
  });

  it('exports the session as a file', async () => {
    const call = vi.fn(async () => ({
      ok: true,
      message: 'Exported 3 entries.',
      session: { entries: [] },
    }));
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fixture = await mount(call);
    button(fixture, 'Export session').click();
    await settle(fixture);
    expect(call).toHaveBeenCalledWith('request-ngrx-history', {
      pageId: 'p1',
      request: { type: 'export', storeId: 'store', from: 1, to: 3 },
    });
    expect(click).toHaveBeenCalled();
    expect(el(fixture).querySelector('.session-message')?.textContent).toContain(
      'Exported 3 entries.',
    );
    click.mockRestore();
  });

  it('imports a session file and reads its entries', async () => {
    const call = vi.fn(async (name: string, arg: Record<string, unknown>) => {
      if (name === 'import-ngrx-session') {
        expect(arg['session']).toBe('{"format":"pangular-ngrx-session"}');
        return {
          ok: true,
          id: 'session-1',
          store: { id: 'store', kind: 'store' },
          exportedAt: 1,
          entries: [entry(7, '[Cart] Add')],
        };
      }
      return {
        ok: true,
        detail: { seq: 7, storeId: 'store', before: {}, after: { n: 1 }, diff: [] },
      };
    });
    const fixture = await mount(call);
    const input = el(fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['{"format":"pangular-ngrx-session"}'], 'session.json', {
      type: 'application/json',
    });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle(fixture);
    const region = el(fixture).querySelector('[aria-labelledby="ngrx-imported-heading"]')!;
    expect(region.textContent).toContain('#7');
    expect(call).toHaveBeenCalledWith('request-ngrx-history', {
      session: 'session-1',
      request: { type: 'entry', seq: 7 },
    });
    expect(region.textContent).toContain('All changes (0)');
  });

  it('says why an import was refused', async () => {
    const fixture = await mount(async () => ({
      error: 'Only version 1 sessions can be imported.',
    }));
    const input = el(fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['{}'], 's.json')],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(el(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'Not imported: Only version 1',
    );
  });
});

describe('Provider value', () => {
  async function mount(call: Call) {
    const fixture = TestBed.createComponent(ProviderValue);
    document.body.append(fixture.nativeElement);
    fixture.componentRef.setInput('rpc', fakeClient(call));
    fixture.componentRef.setInput('pageId', 'p1');
    fixture.componentRef.setInput('injectorId', 'inj-1');
    fixture.componentRef.setInput('token', 'CartService');
    fixture.componentRef.setInput('index', 2);
    await settle(fixture);
    return fixture;
  }

  it('reads the members when opened, and nested levels on demand', async () => {
    const call = vi.fn(async (_name: string, arg: Record<string, unknown>) => {
      const request = arg['request'] as { path: string[] };
      if (!request.path.length) {
        return {
          ok: true,
          type: 'CartService',
          members: [
            { name: 'count', kind: 'signal', value: 2 },
            { name: 'items', value: [{ $collapsed: 'Object', size: 1 }] },
          ],
        };
      }
      return { ok: true, value: { id: 7 } };
    });
    const fixture = await mount(call);
    expect(call).not.toHaveBeenCalled();
    const toggle = button(fixture, 'Show the value of CartService');
    toggle.click();
    await settle(fixture);
    expect(call).toHaveBeenCalledWith('request-provider-value', {
      pageId: 'p1',
      request: { injectorId: 'inj-1', token: 'CartService', index: 2, path: [] },
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const region = el(fixture).querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Value of CartService');
    expect(region.textContent).toContain('count');
    expect(region.textContent).toContain('signal');

    button(fixture, /^items: Array \(1 item\)$/).click();
    await settle(fixture);
    button(fixture, /^0: Object \(1 key\)$/).click();
    await settle(fixture);
    expect(call).toHaveBeenLastCalledWith('request-provider-value', {
      pageId: 'p1',
      request: expect.objectContaining({ path: ['items', '0'], injectorId: 'inj-1' }),
    });
    expect(region.textContent).toContain('id:');
  });

  it('says when the provider was not created yet', async () => {
    const fixture = await mount(async () => ({
      error:
        'CartService has not been created yet, and reading it would create it. Read it once the app uses it.',
    }));
    button(fixture, 'Show the value of CartService').click();
    await settle(fixture);
    expect(el(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'has not been created yet',
    );
  });
});
