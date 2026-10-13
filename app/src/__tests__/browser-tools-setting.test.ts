// @vitest-environment jsdom
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserToolsSetting, browserToolsState } from '../pages/browser-tools-setting';

let fixture: ComponentFixture<BrowserToolsSetting> | undefined;

afterEach(() => {
  fixture?.destroy();
  fixture = undefined;
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

async function settle() {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture!.whenStable();
  }
}

interface FakeServer {
  value: unknown;
  set?: (arg: unknown) => unknown;
  backend?: string;
  sharedStateFails?: boolean;
}

function render(server: FakeServer | null) {
  const listeners: ((value: unknown) => void)[] = [];
  const call = vi.fn(async (name: string, arg: unknown) => {
    if (name !== 'set-browser-tools') throw new Error(`unexpected ${name}`);
    return server?.set ? server.set(arg) : { ...(arg as object), config: false };
  });
  const client = server && {
    connectionMeta: { backend: server.backend ?? 'websocket' },
    scope: () => ({
      rpc: {
        call,
        sharedState: async (key: string) => {
          if (server.sharedStateFails) throw new Error('down');
          expect(key).toBe('browser-tools');
          return {
            value: () => server.value,
            on: (_: string, listener: (value: unknown) => void) => {
              listeners.push(listener);
              return () => {};
            },
          };
        },
      },
    }),
  };
  fixture = TestBed.createComponent(BrowserToolsSetting);
  fixture.componentRef.setInput('rpc', client as unknown as DevframeRpcClient | null);
  document.body.appendChild(fixture.nativeElement);
  const root = fixture.nativeElement as HTMLElement;
  const toggle = () => root.querySelector<HTMLInputElement>('input[role="switch"]')!;
  const text = () => root.textContent?.replace(/\s+/g, ' ') ?? '';
  const push = (value: unknown) => {
    for (const listener of listeners) listener(value);
  };
  return { root, toggle, text, call, push };
}

describe('browser agent tools setting', () => {
  it('reads only a boolean switch from the shared state', () => {
    expect(browserToolsState({ enabled: true, config: false })).toEqual({
      enabled: true,
      config: false,
    });
    expect(browserToolsState({ enabled: false })).toEqual({ enabled: false, config: false });
    for (const value of [undefined, null, {}, { enabled: 'yes' }, 'on']) {
      expect(browserToolsState(value)).toBeNull();
    }
  });

  it('is a labelled switch, off by default, that says how long it lasts', async () => {
    const { toggle, text } = render({ value: { enabled: false, config: false } });
    await settle();
    const input = toggle();
    expect(input.type).toBe('checkbox');
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(false);
    expect(input.closest('label')?.textContent).toContain('Browser agent tools');
    const described = input.getAttribute('aria-describedby')!.split(' ');
    for (const id of described) expect(document.getElementById(id)).not.toBeNull();
    expect(text()).toMatch(/until the server restarts/);
    expect(text()).toMatch(/off in this project/);
    expect(text()).toMatch(/no reload/);
  });

  it('turns the tools on through the server and follows other panels', async () => {
    const { toggle, call, push, root } = render({ value: { enabled: false, config: false } });
    await settle();
    toggle().click();
    await settle();
    expect(call).toHaveBeenCalledWith('set-browser-tools', { enabled: true });
    expect(toggle().checked).toBe(true);
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/on\. Connected pages/);

    // Another panel turned them off.
    push({ enabled: false, config: false });
    await settle();
    expect(toggle().checked).toBe(false);
  });

  it('shows the error with Retry when the server refuses, and retries the change', async () => {
    let fail = true;
    const { toggle, call, root } = render({
      value: { enabled: false, config: true },
      set: (arg) => {
        if (fail) throw new Error('gone');
        return { ...(arg as object), config: true };
      },
    });
    await settle();
    toggle().click();
    await settle();
    const alert = root.querySelector('[role="alert"]')!;
    expect(alert.textContent).toMatch(/Couldn't turn the browser agent tools on/);
    expect(toggle().checked).toBe(false);
    fail = false;
    alert.querySelector('button')!.click();
    await settle();
    expect(call).toHaveBeenLastCalledWith('set-browser-tools', { enabled: true });
    expect(toggle().checked).toBe(true);
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('is disabled while connecting, on a saved report and on a server without the switch', async () => {
    let view = render(null);
    await settle();
    expect(view.toggle().disabled).toBe(true);
    expect(view.text()).toMatch(/Waiting for the devtools server/);
    fixture!.destroy();

    view = render({ value: { enabled: false, config: false }, backend: 'static' });
    await settle();
    expect(view.toggle().disabled).toBe(true);
    expect(view.text()).toMatch(/saved report/);
    fixture!.destroy();

    view = render({ value: undefined });
    await settle();
    expect(view.toggle().disabled).toBe(true);
    expect(view.text()).toMatch(/browserTools: true/);
  });

  it('shows a Retry when the setting cannot be read', async () => {
    const { toggle, root } = render({ value: undefined, sharedStateFails: true });
    await settle();
    expect(toggle().disabled).toBe(true);
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/Couldn't read/);
    expect(root.querySelector('[role="alert"] button')?.textContent).toMatch(/Retry/);
  });
});
