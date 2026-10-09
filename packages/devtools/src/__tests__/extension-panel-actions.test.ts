import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  join(import.meta.dirname, '../../../../extension/panel-actions.js'),
  'utf8',
);

interface Actions {
  createPanelActions: (deps: {
    evalInPage: (expression: string) => Promise<unknown>;
    getResources: () => Promise<{ url: string; type?: string }[]>;
    openResource: (url: string, line: number) => Promise<boolean>;
  }) => (message: unknown) => Promise<Record<string, unknown> | null>;
  findSourceResource: (urls: string[], file: string) => string | null;
}

function load(): Actions {
  const context = { URL };
  runInNewContext(source, context);
  return context as unknown as Actions;
}

function setup({
  urls = [] as string[],
  resources = urls.map((url) => ({ url })) as { url: string; type?: string }[],
  opens = true,
  page = (_expression: string): unknown => null,
} = {}) {
  const { createPanelActions } = load();
  const evalInPage = vi.fn(async (expression: string) => page(expression));
  const openResource = vi.fn(async () => opens);
  const handle = createPanelActions({
    evalInPage,
    getResources: async () => resources,
    openResource,
  });
  return { handle, evalInPage, openResource };
}

const request = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  requestId: 'r1',
  pageId: 'page-1',
  id: 'cab12-3',
  ...extra,
});

describe('extension panel actions', () => {
  it('matches a project path to the source-mapped resource with the shortest path', () => {
    const { findSourceResource } = load();
    const urls = [
      'http://localhost:4200/main.js',
      'http://localhost:4200/vendor/src/app/card.ts',
      'http://localhost:4200/src/app/card.ts?t=1',
      'webpack:///src/app/other.ts',
    ];
    expect(findSourceResource(urls, 'src/app/card.ts')).toBe(
      'http://localhost:4200/src/app/card.ts?t=1',
    );
    expect(findSourceResource(urls, './src\\app\\other.ts')).toBe('webpack:///src/app/other.ts');
    expect(findSourceResource(urls, 'app/missing.ts')).toBeNull();
    expect(findSourceResource(urls, 'card.ts')).toBe('http://localhost:4200/src/app/card.ts?t=1');
    expect(findSourceResource(urls, '')).toBeNull();
  });

  it('opens the resolved file at the 0-based line Chrome expects', async () => {
    const { handle, openResource, evalInPage } = setup({
      urls: ['http://localhost:4200/src/app/card.ts'],
    });
    const reply = await handle(
      request('pangular:open-source', { file: 'src/app/card.ts', line: 12 }),
    );
    expect(openResource).toHaveBeenCalledWith('http://localhost:4200/src/app/card.ts', 11);
    expect(evalInPage).not.toHaveBeenCalled();
    expect(reply).toEqual({
      type: 'pangular:panel-action-result',
      requestId: 'r1',
      ok: true,
      opened: 'file',
    });
  });

  it('skips component style sheets that share the source path', async () => {
    const { handle, openResource, evalInPage } = setup({
      resources: [
        {
          url: 'http://localhost:4200/angular:styles/component:css;abc/src/app/card.ts',
          type: 'sm-stylesheet',
        },
      ],
      page: (expression) => expression.includes('__pangularClassOf'),
    });
    const reply = await handle(
      request('pangular:open-source', { file: 'src/app/card.ts', line: 12 }),
    );
    expect(openResource).not.toHaveBeenCalled();
    expect(evalInPage).toHaveBeenCalledOnce();
    expect(reply).toMatchObject({ ok: true, opened: 'class' });
  });

  it('falls back to inspecting the class when the file is not in Sources', async () => {
    const { handle, openResource, evalInPage } = setup({
      page: (expression) => expression.includes('__pangularClassOf'),
    });
    const reply = await handle(
      request('pangular:open-source', { file: 'src/app/card.ts', line: 12 }),
    );
    expect(openResource).not.toHaveBeenCalled();
    expect(evalInPage.mock.calls[0][0]).toContain(
      'window.__pangularClassOf?.("page-1", "cab12-3")',
    );
    expect(reply).toMatchObject({ ok: true, opened: 'class' });
  });

  it('falls back to the class when Chrome refuses to open the file', async () => {
    const { handle } = setup({
      urls: ['http://localhost:4200/src/app/card.ts'],
      opens: false,
      page: () => true,
    });
    const reply = await handle(
      request('pangular:open-source', { file: 'src/app/card.ts', line: 12 }),
    );
    expect(reply).toMatchObject({ ok: true, opened: 'class' });
  });

  it('reports not-found when the page has no such instance', async () => {
    const { handle } = setup({ page: () => false });
    expect(await handle(request('pangular:open-source'))).toMatchObject({
      ok: false,
      error: 'not-found',
    });
    expect(await handle(request('pangular:reveal-element'))).toMatchObject({
      ok: false,
      error: 'not-found',
    });
  });

  it('reveals the host element through the page helper', async () => {
    const { handle, evalInPage } = setup({ page: () => true });
    expect(await handle(request('pangular:reveal-element'))).toMatchObject({ ok: true });
    expect(evalInPage.mock.calls[0][0]).toContain('window.__pangularHostOf?.("page-1", "cab12-3")');
  });

  it('ignores other messages and rejects ids that could break out of the expression', async () => {
    const { handle, evalInPage } = setup({ page: () => true });
    expect(await handle(null)).toBeNull();
    expect(await handle({ type: 'pangular:theme-change' })).toBeNull();
    expect(await handle(request('pangular:reveal-element', { requestId: 7 }))).toBeNull();
    expect(await handle(request('pangular:reveal-element', { id: '"); alert(1); ("' }))).toEqual({
      type: 'pangular:panel-action-result',
      requestId: 'r1',
      ok: false,
      error: 'bad-request',
    });
    expect(await handle(request('pangular:reveal-element', { pageId: null }))).toMatchObject({
      error: 'bad-request',
    });
    expect(evalInPage).not.toHaveBeenCalled();
  });
});
