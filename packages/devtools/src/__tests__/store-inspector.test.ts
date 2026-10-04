// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

let testBedReady = false;

async function mount() {
  await import('@angular/compiler');
  const { TestBed } = await import('@angular/core/testing');
  const { BrowserTestingModule, platformBrowserTesting } =
    await import('@angular/platform-browser/testing');
  const { ViewChild } = await import('@angular/core');
  const { StoreInspector } = await import('../../../../app/src/pages/store-inspector.ts');
  (StoreInspector as unknown as { propDecorators: unknown }).propDecorators = Object.fromEntries(
    ['stateTree', 'latestButton', 'cancelButton', 'restoreButton'].map((name) => [
      name,
      [{ type: ViewChild, args: [name, { isSignal: true }] }],
    ]),
  );
  if (!testBedReady) {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    testBedReady = true;
  }
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(StoreInspector);
  document.body.append(fixture.nativeElement);
  const inspector = fixture.componentInstance;
  inspector.sourceLoaded.set(true);
  inspector.pages.set([
    {
      pageId: 'p1',
      url: '/',
      title: 'App',
      reportedAt: 0,
      stores: [],
      classic: { state: { count: 2 }, devtools: true, scope: 'root' },
      log: [1, 2].map((seq) => ({
        seq,
        source: 'store' as const,
        storeId: 'store',
        type: `[Counter] Add ${seq}`,
        action: { type: 'add' },
        origin: seq === 1 ? ('dispatch' as const) : ('effect' as const),
        timestamp: 0,
        diff: [],
        restorable: true,
      })),
    },
  ]);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
  const click = async (text: string) => {
    button(text).click();
    await fixture.whenStable();
  };
  const logItem = (seq: number) =>
    [...el.querySelectorAll<HTMLButtonElement>('.log-item')].find((b) =>
      b.textContent?.includes(`#${seq}`),
    )!;
  return { fixture, inspector, el, button, click, logItem };
}

describe('Store inspector', () => {
  it('moves focus into the restore confirmation and back when it closes', async () => {
    const { fixture, el, button, click, logItem } = await mount();
    logItem(2).click();
    await fixture.whenStable();
    await click('Restore this state');
    const group = el.querySelector('.confirm[role="group"]')!;
    expect(group.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(button('Cancel'));
    await click('Cancel');
    expect(el.querySelector('.confirm')).toBeNull();
    expect(document.activeElement).toBe(button('Restore this state'));

    await click('Restore this state');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(el.querySelector('.confirm')).toBeNull();
    expect(document.activeElement).toBe(button('Restore this state'));
    fixture.destroy();
  });

  it('clears the result message when another entry, store or page is picked', async () => {
    const { fixture, inspector, el, logItem } = await mount();
    const status = () => el.querySelector('.message[role="status"]')!.textContent!.trim();
    inspector.message.set('Jumped to the state after action #1.');
    await fixture.whenStable();
    expect(status()).toMatch(/Jumped/);
    logItem(1).click();
    await fixture.whenStable();
    expect(status()).toBe('');
    inspector.message.set('Restored.');
    inspector.selectStore('store');
    expect(inspector.message()).toBe('');
    inspector.message.set('Restored.');
    inspector.selectPage('p1');
    expect(inspector.message()).toBe('');
    fixture.destroy();
  });

  it('shows where each action came from', async () => {
    const { fixture, el, logItem } = await mount();
    expect(logItem(1).querySelector('.tag')?.textContent?.trim()).toBe('dispatch');
    expect(logItem(2).querySelector('.tag')?.textContent?.trim()).toBe('effect');
    logItem(2).click();
    await fixture.whenStable();
    const terms = [...el.querySelectorAll('.entry dt')].map((dt) => [
      dt.textContent?.trim(),
      dt.nextElementSibling?.textContent?.trim(),
    ]);
    expect(terms).toContainEqual(['Origin', 'NgRx effect (Store.next)']);
    fixture.destroy();
  });
});
