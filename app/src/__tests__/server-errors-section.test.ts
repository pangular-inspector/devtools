import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ServerErrorsSection,
  serverErrorPlace,
  serverErrorsOf,
  type ServerErrorGroup,
} from '../pages/server-errors-section';

const group = (extra: Partial<ServerErrorGroup> = {}): ServerErrorGroup => ({
  id: 's1',
  kind: 'ssr',
  message: 'NG0201: No provider found for `TripsApi`',
  count: 2,
  firstAt: 1_000,
  lastAt: 2_000,
  url: '/trips',
  stack: 'Error: NG0201\n    at render',
  ...extra,
});

function fakeClient(value: unknown) {
  let listener: ((value: unknown) => void) | undefined;
  const call = vi.fn(() => Promise.resolve());
  const scoped = {
    rpc: {
      call,
      sharedState: (name: string) =>
        Promise.resolve({
          value: () => (name === 'server-errors' ? value : null),
          on: (_event: string, fn: (value: unknown) => void) => {
            listener = fn;
            return () => {};
          },
        }),
    },
  };
  const client = { scope: () => scoped } as unknown as DevframeRpcClient;
  return { client, call, push: (next: unknown) => listener?.(next) };
}

let fixture: ComponentFixture<ServerErrorsSection>;

async function render(value: unknown) {
  const fake = fakeClient(value);
  fixture = TestBed.createComponent(ServerErrorsSection);
  fixture.componentRef.setInput('rpc', fake.client);
  document.body.append(fixture.nativeElement);
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, ...fake };
}

describe('server errors section', () => {
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows nothing while the server has no errors', async () => {
    const { host } = await render({ errors: [], dropped: 0 });
    expect(host.querySelector('section')).toBeNull();
  });

  it('lists SSR and Vite errors with where they happened, and clears them', async () => {
    const { host, call, push } = await render({
      errors: [
        group(),
        group({
          id: 's2',
          kind: 'vite',
          message: 'Transform failed',
          count: 1,
          url: undefined,
          file: '/src/app.ts',
          line: 3,
          column: 7,
          plugin: 'vite:esbuild',
          frame: '3 | let = 1',
        }),
      ],
      dropped: 0,
    });
    const items = [...host.querySelectorAll('li.item')];
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('SSR');
    expect(items[0]!.textContent).toContain('2×');
    expect(items[0]!.textContent).toContain('Render of /trips');
    expect(items[1]!.textContent).toContain('/src/app.ts:3:7');
    expect(items[1]!.querySelector('details summary')!.textContent).toBe('Code frame');
    const clear = [...host.querySelectorAll('button')].find((b) =>
      b.textContent!.includes('Clear server errors'),
    )!;
    clear.click();
    await fixture.whenStable();
    expect(call).toHaveBeenCalledWith('clear-server-errors');
    push({ errors: [], dropped: 0 });
    await fixture.whenStable();
    expect(host.querySelector('section')).toBeNull();
  });

  it('drops malformed groups and words the place of each kind', () => {
    expect(
      serverErrorsOf({ errors: [group(), { id: 3 }, null, { ...group(), kind: 'x' }] }),
    ).toHaveLength(1);
    expect(serverErrorsOf(null)).toEqual([]);
    expect(serverErrorPlace(group({ url: undefined }))).toBe('Server render');
    expect(serverErrorPlace(group({ kind: 'vite', file: undefined, plugin: 'vite:css' }))).toBe(
      'vite:css',
    );
  });
});
