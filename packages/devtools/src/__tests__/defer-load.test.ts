// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  angularDeferInternals,
  loadDeferBlock,
  registerDeferLoad,
  type DeferInternals,
} from '../defer-load.ts';
import { setRedaction } from '../forms-privacy.ts';
import type { DeferBlockInfo } from '../types.ts';

const info = (overrides: Partial<DeferBlockInfo> = {}): DeferBlockInfo => ({
  id: 'd1',
  state: 'placeholder',
  hydration: 'not-configured',
  triggers: ['on viewport'],
  hasErrorBlock: false,
  rootIds: [],
  since: 0,
  ...overrides,
});

/**
 * A root view with one block in it, and a second block inside the views the
 * first one rendered, shaped the way `ɵgetDeferBlocks` lists them.
 */
function app(options: { failed?: boolean; errorBlock?: boolean } = {}) {
  const root = document.createElement('app-root');
  const outerAnchor = document.createComment('container');
  const innerAnchor = document.createComment('container');
  const innerView: unknown[] = ['inner view'];
  const outer = {
    lContainer: [outerAnchor, 0, 0, 0, 0, 0, 0, outerAnchor, 0, 0, innerView],
    lView: ['root view'],
    tNode: { index: 20 },
    tDetails: { loadingState: 2, errorTmplIndex: null },
  };
  const inner = {
    lContainer: [innerAnchor, 0, 0, 0, 0, 0, 0, innerAnchor, 0, 0],
    lView: innerView,
    tNode: { index: 30 },
    tDetails: { loadingState: 0, errorTmplIndex: options.errorBlock ? 5 : null },
  };
  const rootView = ['root view'];
  const rendered: { state: number; tNode: unknown; skip?: boolean }[] = [];
  const internals: DeferInternals = {
    getDeferBlocks: (lView, out) => {
      if (lView === rootView) out.push(outer);
      if (lView === innerView) out.push(inner);
    },
    triggerResourceLoading: async (tDetails) => {
      (tDetails as { loadingState: number }).loadingState = options.failed ? 3 : 2;
    },
    renderDeferBlockState: (state, tNode, _container, skip) =>
      void rendered.push({ state, tNode, skip }),
  };
  const component = {};
  const ng = {
    getInjector: (el: Element) => (el === root ? { _lView: rootView, _tNode: {} } : null),
    getComponent: (el: Element) => (el === root ? component : null),
    applyChanges: vi.fn(),
  };
  return { root, outerAnchor, innerAnchor, inner, internals, ng, rendered, component };
}

describe('loadDeferBlock', () => {
  it('loads a nested block found through the views its parent rendered', async () => {
    const { root, innerAnchor, inner, internals, ng, rendered, component } = app();
    const result = await loadDeferBlock(ng, internals, { host: innerAnchor, block: info() }, [
      root,
    ]);
    expect(result).toEqual({ ok: true, state: 'complete' });
    expect(rendered).toEqual([{ state: 2, tNode: inner.tNode, skip: true }]);
    expect(ng.applyChanges).toHaveBeenCalledWith(component);
  });

  it('says what change detection threw while it rendered the block', async () => {
    const { root, innerAnchor, internals, ng } = app();
    ng.applyChanges.mockImplementation(() => {
      throw new Error('NG0100: changed after checked');
    });
    const result = await loadDeferBlock(ng, internals, { host: innerAnchor, block: info() }, [
      root,
    ]);
    expect(result).toEqual({
      ok: true,
      state: 'complete',
      renderError: 'NG0100: changed after checked',
    });
  });

  it('masks tokens and secret values in the error it passes on', async () => {
    setRedaction({ secretNames: ['ssn'] });
    try {
      const { root, innerAnchor, internals, ng } = app();
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      ng.applyChanges.mockImplementation(() => {
        throw new Error(`Bearer abc.def.ghi failed for ${jwt} with ssn=123-45-6789`);
      });
      const result = await loadDeferBlock(ng, internals, { host: innerAnchor, block: info() }, [
        root,
      ]);
      expect(result.renderError).toContain('[redacted]');
      expect(result.renderError).not.toContain('abc.def.ghi');
      expect(result.renderError).not.toContain(jwt);
      expect(result.renderError).not.toContain('123-45-6789');
    } finally {
      setRedaction();
    }
  });

  it('shows the @error block when the dependencies fail', async () => {
    const { root, innerAnchor, internals, ng, rendered } = app({ failed: true, errorBlock: true });
    const result = await loadDeferBlock(ng, internals, { host: innerAnchor, block: info() }, [
      root,
    ]);
    expect(result).toEqual({ ok: true, state: 'error' });
    expect(rendered.map((r) => r.state)).toEqual([3]);
  });

  it('renders nothing when the dependencies fail and there is no @error block', async () => {
    const { root, innerAnchor, internals, ng, rendered } = app({ failed: true });
    const result = await loadDeferBlock(ng, internals, { host: innerAnchor, block: info() }, [
      root,
    ]);
    expect(result.error).toMatch(/no @error block/);
    expect(rendered).toEqual([]);
  });

  it('leaves loaded, dehydrated and unknown blocks alone', async () => {
    const { root, outerAnchor, internals, ng, rendered } = app();
    const run = (block: DeferBlockInfo | undefined) =>
      loadDeferBlock(ng, internals, block && { host: outerAnchor, block }, [root]);
    expect(await run(info({ state: 'complete' }))).toEqual({
      ok: true,
      state: 'complete',
      already: true,
    });
    expect((await run(info({ hydration: 'dehydrated' }))).error).toMatch(/incremental hydration/);
    expect((await run(info({ hydrateNever: true }))).error).toMatch(/incremental hydration/);
    expect((await run(undefined)).error).toMatch(/pangular:defer-blocks/);
    expect(rendered).toEqual([]);
  });

  it('says so when the build has no internals or no anchor', async () => {
    const { root, outerAnchor, internals, ng } = app();
    expect(
      (await loadDeferBlock(ng, null, { host: outerAnchor, block: info() }, [root])).error,
    ).toMatch(/ɵtriggerResourceLoading/);
    expect(
      (await loadDeferBlock(ng, internals, { host: {}, block: info() }, [root])).error,
    ).toMatch(/no anchor/);
    const stray = document.createComment('container');
    expect(
      (await loadDeferBlock(ng, internals, { host: stray, block: info() }, [root])).error,
    ).toMatch(/could not be found/);
  });

  it('reads the internals from a core module only when all three are there', () => {
    const fn = () => {};
    expect(
      angularDeferInternals({
        ɵgetDeferBlocks: fn,
        ɵtriggerResourceLoading: fn,
        ɵrenderDeferBlockState: fn,
      }),
    ).not.toBeNull();
    expect(angularDeferInternals({ ɵgetDeferBlocks: fn })).toBeNull();
  });
});

describe('registerDeferLoad', () => {
  function rpc() {
    const handlers = new Map<string, (message: unknown) => unknown>();
    const calls: { name: string; message: unknown }[] = [];
    return {
      handlers,
      calls,
      call: async (name: string, message: unknown) => void calls.push({ name, message }),
      register: (def: { name: string; handler: (message: never) => unknown }) =>
        handlers.set(def.name, def.handler as (message: unknown) => unknown),
    };
  }

  it('answers for its own page and refuses when actions are off', async () => {
    const on = rpc();
    const loaded = vi.fn();
    registerDeferLoad(on, 'p1', {
      allowed: true,
      load: async (id) => ({ ok: true, state: id === 'd1' ? 'complete' : 'error' }),
      loaded,
    });
    on.handlers.get('defer-load')!({ requestId: 'l1', pageId: 'p2', id: 'd1' });
    on.handlers.get('defer-load')!({ requestId: 'l2', pageId: 'p1', id: 'd1' });
    await vi.waitFor(() => expect(on.calls).toHaveLength(1));
    expect(on.calls[0]).toEqual({
      name: 'defer-load-result',
      message: { requestId: 'l2', pageId: 'p1', result: { ok: true, state: 'complete' } },
    });
    expect(loaded).toHaveBeenCalledOnce();

    const off = rpc();
    const load = vi.fn();
    registerDeferLoad(off, 'p1', { allowed: false, load });
    off.handlers.get('defer-load')!({ requestId: 'l3', pageId: 'p1', id: 'd1' });
    await vi.waitFor(() => expect(off.calls).toHaveLength(1));
    expect((off.calls[0].message as { result: { error?: string } }).result.error).toMatch(
      /actions/,
    );
    expect(load).not.toHaveBeenCalled();
  });
});
