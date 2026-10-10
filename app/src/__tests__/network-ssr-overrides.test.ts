import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

const calls: { name: string; args: unknown[] }[] = [];
vi.mock('../rpc', () => ({
  rpcCall: async (_rpc: unknown, name: string, ...args: unknown[]) => {
    calls.push({ name, args });
    return args[0];
  },
}));

const { NetworkInspector } = await import('../pages/network-inspector');

let fixture: ComponentFixture<InstanceType<typeof NetworkInspector>>;

describe('NetworkInspector SSR overrides', () => {
  afterEach(() => {
    calls.length = 0;
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('adds a TransferState edit only with a key and valid JSON', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    await fixture.whenStable();
    inspector.setOverrideDraft('kind', 'state-edit');
    inspector.setOverrideDraft('pattern', '/examples/ssr');
    expect(inspector.overrideReady()).toBe(false);
    inspector.setOverrideDraft('key', 'abc');
    inspector.setOverrideDraft('value', '{bad');
    expect(inspector.overrideValueError()).toBe('The value must be valid JSON.');
    expect(inspector.overrideReady()).toBe(false);
    inspector.setOverrideDraft('value', '{"b":2}');
    await inspector.addOverride(new Event('submit'));
    expect(calls[0].name).toBe('set-ssr-overrides');
    expect(calls[0].args[0]).toEqual([
      expect.objectContaining({
        kind: 'state-edit',
        pattern: '/examples/ssr',
        key: 'abc',
        value: '{"b":2}',
      }),
    ]);
    expect(inspector.overrides()).toHaveLength(1);
  });

  it('marks an overridden request and lists what was applied', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    inspector.requests.set([
      {
        id: 'r1',
        method: 'GET',
        url: '/examples/ssr',
        status: 200,
        at: 1,
        durationMs: 1,
        renderMs: 1,
        bytes: 1,
        renderMode: 'client',
        fetches: 0,
        fetchMs: 0,
        headers: {},
        overrides: [
          { id: 'o1', kind: 'client-render', applied: true, note: 'served index.csr.html' },
        ],
      },
    ]);
    inspector.selectedRequestId.set('r1');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('tbody .tag.mock')!.textContent).toBe('overridden');
    const detail = host.querySelector('#ssr-detail')!.textContent!;
    expect(detail).toContain('Overrides from the panel');
    expect(detail).toContain('Client render');
    expect(detail).toContain('served index.csr.html');
  });
});
