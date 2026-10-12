// @vitest-environment jsdom
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Settings } from '../pages/settings';
import {
  DEFAULT_TAB_LAYOUT,
  arrangeTabs,
  moveTab,
  setTabHidden,
  setTabPinned,
  storePassive,
  storeTabLayout,
  storeThemePreference,
  storedPassive,
  storedTabLayout,
  storedThemePreference,
  type TabLayout,
} from '../shell-prefs';
import { ThemeService } from '../theme.service';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'components', label: 'Components' },
  { id: 'signals', label: 'Signals' },
  { id: 'forms', label: 'Forms' },
];
const IDS = TABS.map((tab) => tab.id);

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.body.innerHTML = '';
  delete document.documentElement.dataset['theme'];
  TestBed.resetTestingModule();
});

describe('settings storage', () => {
  it('keeps the tab layout, theme and passive mode across reloads', () => {
    expect(storedTabLayout()).toEqual(DEFAULT_TAB_LAYOUT);
    const layout: TabLayout = { order: ['forms', 'dashboard'], hidden: ['signals'], pinned: [] };
    storeTabLayout(layout);
    expect(storedTabLayout()).toEqual(layout);
    storeTabLayout(DEFAULT_TAB_LAYOUT);
    expect(localStorage.getItem('pangular-pref:tabs')).toBeNull();

    expect(storedThemePreference()).toBe('system');
    storeThemePreference('light');
    expect(storedThemePreference()).toBe('light');
    storeThemePreference('system');
    expect(localStorage.getItem('pangular-pref:theme')).toBeNull();

    expect(storedPassive()).toBe(false);
    storePassive(true);
    expect(storedPassive()).toBe(true);
  });

  it('ignores a stored layout it cannot use', () => {
    for (const raw of ['{nope', '[]', 'null', '{"order":"x","hidden":[1,"forms"]}']) {
      localStorage.setItem('pangular-pref:tabs', raw);
      const layout = storedTabLayout();
      expect(Array.isArray(layout.order)).toBe(true);
      expect(layout.hidden.every((id) => typeof id === 'string')).toBe(true);
    }
  });
});

describe('tab layout', () => {
  it('orders pinned tabs first and leaves hidden ones out, except the open one', () => {
    const layout: TabLayout = { order: [], hidden: ['signals'], pinned: ['forms'] };
    expect(arrangeTabs(TABS, layout).map((tab) => tab.id)).toEqual([
      'forms',
      'dashboard',
      'components',
    ]);
    expect(arrangeTabs(TABS, layout, 'signals').map((tab) => tab.id)).toContain('signals');
  });

  it('moves a tab within its section and not past the ends', () => {
    let layout = moveTab(IDS, DEFAULT_TAB_LAYOUT, 'signals', -1);
    expect(arrangeTabs(TABS, layout).map((tab) => tab.id)).toEqual([
      'dashboard',
      'signals',
      'components',
      'forms',
    ]);
    expect(moveTab(IDS, layout, 'dashboard', -1)).toBe(layout);
    layout = setTabPinned(IDS, layout, 'forms', true);
    // The first unpinned tab can't move above a pinned one.
    expect(moveTab(IDS, layout, 'dashboard', -1)).toBe(layout);
  });

  it('unpins a tab it hides, and shows a tab it pins', () => {
    let layout = setTabPinned(IDS, DEFAULT_TAB_LAYOUT, 'forms', true);
    layout = setTabHidden(layout, 'forms', true);
    expect(layout.pinned).toEqual([]);
    expect(layout.hidden).toEqual(['forms']);
    layout = setTabPinned(IDS, layout, 'forms', true);
    expect(layout.hidden).toEqual([]);
  });
});

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render() {
  const fixture = TestBed.createComponent(Settings);
  fixture.componentRef.setInput('tabs', TABS);
  fixture.componentRef.setInput('hotkey', 'Alt+Shift+P');
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  const root = fixture.nativeElement as HTMLElement;
  const rows = () =>
    [...root.querySelectorAll<HTMLElement>('.tab-row')].map((row) => row.dataset['tab']);
  const button = (label: string) =>
    root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  return { fixture, root, rows, button };
}

describe('Settings page', () => {
  it('starts with h2 sections and lists the tabs in order', async () => {
    const { root, rows } = await render();
    expect([...root.querySelectorAll('h2')].map((h) => h.textContent?.trim())).toEqual([
      'Theme',
      'Tabs',
      'Popup on the page',
      'Keyboard shortcuts',
    ]);
    expect(root.querySelector('h1, h3')).toBeNull();
    expect(rows()).toEqual(IDS);
  });

  it('reorders with the buttons, keeps focus on the moved row and says where it went', async () => {
    const { fixture, root, rows, button } = await render();
    button('Move Signals up').focus();
    button('Move Signals up').click();
    await settle(fixture);
    expect(rows()).toEqual(['dashboard', 'signals', 'components', 'forms']);
    expect(fixture.componentInstance.layout().order).toEqual([
      'dashboard',
      'signals',
      'components',
      'forms',
    ]);
    expect(document.activeElement).toBe(button('Move Signals up'));
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'Signals moved to position 2 of 4.',
    );
    // At the top, focus moves to the other arrow instead of a disabled one.
    button('Move Signals up').click();
    await settle(fixture);
    expect(rows()[0]).toBe('signals');
    expect(button('Move Signals up').disabled).toBe(true);
    expect(document.activeElement).toBe(button('Move Signals down'));
  });

  it('reorders with Alt and the arrow keys on a row', async () => {
    const { fixture, rows, button } = await render();
    const pin = button('Pin Dashboard');
    pin.focus();
    pin.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    await settle(fixture);
    expect(rows()).toEqual(['components', 'dashboard', 'signals', 'forms']);
  });

  it('hides, pins and resets tabs', async () => {
    const { fixture, root, rows, button } = await render();
    const shown = root.querySelector<HTMLInputElement>(
      '[aria-label="Forms shown in the tab bar"]',
    )!;
    shown.click();
    await settle(fixture);
    expect(fixture.componentInstance.layout().hidden).toEqual(['forms']);

    button('Pin Signals').click();
    await settle(fixture);
    expect(rows()[0]).toBe('signals');
    expect(button('Pin Signals').getAttribute('aria-pressed')).toBe('true');

    const reset = [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Reset tabs',
    )!;
    reset.click();
    await settle(fixture);
    expect(fixture.componentInstance.layout()).toEqual(DEFAULT_TAB_LAYOUT);
    expect(rows()).toEqual(IDS);
  });

  it('turns passive mode off when the popup has no shortcut', async () => {
    const { fixture, root } = await render();
    const passive = () =>
      root.querySelector<HTMLInputElement>('input[aria-describedby="settings-passive-hint"]')!;
    expect(passive().disabled).toBe(false);
    fixture.componentRef.setInput('hotkey', false);
    await settle(fixture);
    expect(passive().disabled).toBe(true);
    expect(root.textContent).toContain('popup.hotkey');
  });
});

describe('theme preference', () => {
  it('pins light or dark over the system, saves it, and follows the system again', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    service.setPreference('light');
    expect(service.current()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(storedThemePreference()).toBe('light');
    service.setPreference('system');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    expect(storedThemePreference()).toBe('system');
  });

  it('starts from the saved preference', () => {
    storeThemePreference('light');
    const service = TestBed.inject(ThemeService);
    expect(service.current()).toBe('light');
  });
});
