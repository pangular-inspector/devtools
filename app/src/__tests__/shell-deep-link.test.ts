import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePanelLink } from '@pangular-inspector/devtools/internal/config';

const server = vi.hoisted(() => ({
  /** Events the panel registered, by name, to call as the server would broadcast. */
  handlers: new Map<string, (message: unknown) => void>(),
}));

function fakeClient(): DevframeRpcClient {
  const rpc = {
    call: () => new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => undefined, on: () => () => {} }),
    register: (definition: { name: string; handler: (message: unknown) => void }) =>
      server.handlers.set(definition.name, definition.handler),
  };
  return {
    status: 'connected',
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
    close: () => {},
  } as unknown as DevframeRpcClient;
}

vi.mock('devframe/client', () => ({
  connectDevframe: () => Promise.resolve(fakeClient()),
}));

const { App } = await import('../app');

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function boot(hash = '') {
  history.replaceState(null, '', `/${hash}`);
  const fixture = TestBed.createComponent(App);
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  return { fixture, app: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  server.handlers.clear();
});

afterEach(() => {
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
  TestBed.resetTestingModule();
});

describe('deep links', () => {
  it('opens the tab and selects the component a link names', async () => {
    const { fixture, app } = await boot('#tab=components&id=12&page=p1');
    expect(app.tab()).toBe('components');
    expect(app.componentFocus()).toEqual({ id: '12', pageId: 'p1' });
    fixture.destroy();
  });

  it('selects the injector of a component, and a form', async () => {
    const booted = await boot('#tab=injectors&id=c4');
    expect(booted.app.injectorFocus()).toEqual({ componentId: 'c4', pageId: undefined });
    booted.fixture.destroy();
    TestBed.resetTestingModule();
    // The Forms tab takes the focus at once and clears it, so the hand-over is watched.
    history.replaceState(null, '', '/#tab=forms&id=f1');
    const fixture = TestBed.createComponent(App);
    const handed = vi.spyOn(fixture.componentInstance.formFocus, 'set');
    await settle(fixture);
    expect(fixture.componentInstance.tab()).toBe('forms');
    expect(handed).toHaveBeenCalledWith({ id: 'f1' });
    fixture.destroy();
  });

  it('opens a tab without an item, and ignores an unknown tab', async () => {
    let booted = await boot('#tab=signals&id=3');
    expect(booted.app.tab()).toBe('signals');
    booted.fixture.destroy();
    TestBed.resetTestingModule();
    booted = await boot('#tab=nope&id=3');
    expect(booted.app.tab()).toBe('dashboard');
    booted.fixture.destroy();
  });

  it('follows a link the server sends to open panels', async () => {
    const { fixture, app } = await boot();
    server.handlers.get('open-in-panel')!({ tab: 'components', id: '7', page: 'p2' });
    await settle(fixture);
    expect(app.tab()).toBe('components');
    expect(app.componentFocus()).toEqual({ id: '7', pageId: 'p2' });
    expect(parsePanelLink(location.hash)).toEqual({ tab: 'components', id: '7', page: 'p2' });
    fixture.destroy();
  });

  it('runs commands from the hub palette', async () => {
    const { fixture, app } = await boot();
    server.handlers.get('panel-command')!({ command: 'tab:routes' });
    await settle(fixture);
    expect(app.tab()).toBe('routes');
    server.handlers.get('panel-command')!({ command: 'pick-component' });
    await settle(fixture);
    expect(app.tab()).toBe('components');
    fixture.destroy();
  });
});

describe('shell palette and settings', () => {
  it('opens the palette with Ctrl+K and runs a tab command', async () => {
    const { fixture, app, root } = await boot();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    await settle(fixture);
    const input = root.querySelector<HTMLInputElement>('app-command-palette input')!;
    expect(document.activeElement).toBe(input);
    input.value = 'go to forms';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    expect(app.tab()).toBe('forms');
    fixture.destroy();
  });

  it('opens Settings from the header and goes back to the tab before', async () => {
    const { fixture, app, root } = await boot('#tab=signals');
    const settings = root.querySelector<HTMLButtonElement>('button[aria-label="Settings"]')!;
    settings.click();
    await settle(fixture);
    expect(app.tab()).toBe('settings');
    expect(settings.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('app-settings h2')?.textContent).toBe('Theme');
    settings.click();
    await settle(fixture);
    expect(app.tab()).toBe('signals');
    fixture.destroy();
  });

  it('orders and hides tab bar buttons as saved in Settings', async () => {
    localStorage.setItem(
      'pangular-pref:tabs',
      JSON.stringify({ order: [], hidden: ['pipes'], pinned: ['forms'] }),
    );
    const { fixture, root } = await boot();
    const labels = [...root.querySelectorAll('nav button')].map((b) => b.textContent?.trim());
    expect(labels[0]).toBe('Forms');
    expect(labels).not.toContain('Pipes');
    fixture.destroy();
  });
});
