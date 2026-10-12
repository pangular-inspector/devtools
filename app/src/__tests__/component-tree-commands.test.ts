import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

const roots = [{ id: 'app', name: 'App', tag: 'app-root', children: [] }];

function client(options: { live?: boolean; recording?: boolean } = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const page = {
    pageId: 'a',
    title: 'a',
    url: '/',
    roots: options.live === false ? [] : roots,
    count: 1,
    detail: null,
    reportedAt: 1,
  };
  const state: Record<string, unknown> = {
    'component-tree': { pages: { a: page } },
    'change-detection': {
      pages: {
        a: {
          pageId: 'a',
          supported: true,
          recording: options.recording === true,
          startedAt: null,
          cycles: [],
          dropped: 0,
          components: [],
          hosts: {},
        },
      },
    },
  };
  const rpc = {
    call: (name: string, ...args: unknown[]) => {
      calls.push({ name, args });
      // A pick waits for a click in the app; the test only checks it started.
      return name === 'request-component-pick' ? new Promise(() => {}) : Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => state[name] ?? null, on: () => () => {} }),
  };
  const fake = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { fake, calls };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function setup(options: { live?: boolean; recording?: boolean } = {}) {
  const { fake, calls } = client(options);
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput('rpc', fake);
  const handled = vi.fn();
  fixture.componentInstance.commandHandled.subscribe(handled);
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  return { fixture, calls, handled };
}

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

describe('Components tab palette commands', () => {
  it('starts picking a component on the page', async () => {
    const { fixture, calls, handled } = await setup();
    fixture.componentRef.setInput('command', { kind: 'pick' });
    await settle(fixture);
    expect(calls.some((call) => call.name === 'request-component-pick')).toBe(true);
    expect(fixture.componentInstance.picking()).toBe(true);
    expect(handled).toHaveBeenCalledTimes(1);
  });

  it('starts, stops and clears the change detection recording', async () => {
    const records = async (kind: 'cd-start' | 'cd-stop' | 'cd-clear', recording: boolean) => {
      const { fixture, calls } = await setup({ recording });
      fixture.componentRef.setInput('command', { kind });
      await settle(fixture);
      const sent = calls
        .filter((call) => call.name === 'request-change-detection-record')
        .map((call) => call.args[0]);
      fixture.destroy();
      TestBed.resetTestingModule();
      return sent;
    };
    expect(await records('cd-start', false)).toEqual([{ pageId: 'a', on: true }]);
    expect(await records('cd-start', true)).toEqual([]);
    expect(await records('cd-stop', true)).toEqual([{ pageId: 'a', on: false }]);
    expect(await records('cd-clear', false)).toEqual([{ pageId: 'a', clear: true }]);
  });

  it('drops a command when no live page is connected', async () => {
    const { fixture, calls, handled } = await setup({ live: false });
    fixture.componentRef.setInput('command', { kind: 'pick' });
    await settle(fixture);
    expect(calls.some((call) => call.name === 'request-component-pick')).toBe(false);
    expect(handled).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('The page reported no component instances');
  });
});
