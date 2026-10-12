import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorOpener, SourceLink } from '../ui/source-link';

@Component({
  imports: [SourceLink],
  template: `
    <p class="plain"><app-source-link file="src/app/app.ts" [line]="12" /></p>
    <p class="custom">
      <app-source-link file="/src/app/pages/index.page.ts"
        ><span class="dir">pages/</span>index.page.ts</app-source-link
      >
    </p>
  `,
})
class Host {}

function client(answer: unknown, backend = 'websocket') {
  const call = vi.fn(async () => answer);
  const fake = {
    connectionMeta: { backend, configs: {} },
    scope: () => ({ rpc: { call } }),
  } as unknown as DevframeRpcClient;
  return { fake, call };
}

async function render(rpc: DevframeRpcClient | null) {
  TestBed.inject(EditorOpener).use(signal(rpc));
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('SourceLink', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows plain text when no server is connected', async () => {
    const el = await render(null);
    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('[role="alert"], [role="status"]')).toBeNull();
    expect(el.querySelector('.plain')!.textContent!.trim()).toBe('src/app/app.ts:12');
    expect(el.querySelector('.custom')!.textContent!.trim()).toBe('pages/index.page.ts');
  });

  it('shows plain text in a static report', async () => {
    const el = await render(client({ ok: true }, 'static').fake);
    expect(el.querySelector('button')).toBeNull();
  });

  it('is a button named after the file that opens it at its line', async () => {
    const { fake, call } = client({ ok: true, file: '/w/src/app/app.ts' });
    const el = await render(fake);
    const button = el.querySelector<HTMLButtonElement>('.plain button')!;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Open src/app/app.ts:12 in your editor');
    expect(button.textContent!.trim()).toBe('src/app/app.ts:12');
    button.click();
    await vi.waitFor(() =>
      expect(call).toHaveBeenCalledWith('open-in-editor', { file: 'src/app/app.ts', line: 12 }),
    );
    expect(el.querySelector('[role="alert"], [role="status"]')).toBeNull();
  });

  it('keeps projected text, whose words are part of the accessible name', async () => {
    const { fake, call } = client({ ok: true });
    const el = await render(fake);
    const button = el.querySelector<HTMLButtonElement>('.custom button')!;
    expect(button.textContent!.trim()).toBe('pages/index.page.ts');
    expect(button.getAttribute('aria-label')).toContain('pages/index.page.ts');
    button.click();
    await vi.waitFor(() =>
      expect(call).toHaveBeenCalledWith('open-in-editor', {
        file: '/src/app/pages/index.page.ts',
      }),
    );
  });

  it('says why the server did not open it', async () => {
    const { fake } = client({ ok: false, error: 'src/app/app.ts is outside the project root.' });
    const el = await render(fake);
    el.querySelector<HTMLButtonElement>('.plain button')!.click();
    expect(TestBed.inject(EditorOpener).available()).toBe(true);
    await vi.waitFor(() => {
      TestBed.tick();
      expect(el.querySelector('.plain [role="alert"]')!.textContent).toBe(
        'Not opened: src/app/app.ts is outside the project root.',
      );
    });
  });

  it('reports a server without the RPC', async () => {
    const fake = {
      connectionMeta: { backend: 'websocket', configs: {} },
      scope: () => ({ rpc: { call: async () => Promise.reject(new Error('unknown')) } }),
    } as unknown as DevframeRpcClient;
    TestBed.inject(EditorOpener).use(signal(fake));
    expect(await TestBed.inject(EditorOpener).open('a.ts', 1)).toEqual({
      ok: false,
      error: 'The server did not open it.',
    });
  });
});
