import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface Pending {
  name: string;
  list: { id: string; enabled?: boolean }[];
  resolve: () => void;
}

/** Each save waits until the test answers it, like a slow devtools server. */
const pending: Pending[] = [];
const sent: string[] = [];
vi.mock('../rpc', () => ({
  rpcCall: (_rpc: unknown, name: string, list: Pending['list']) => {
    sent.push(name);
    return new Promise((resolve) => pending.push({ name, list, resolve: () => resolve(list) }));
  },
}));

const { NetworkInspector } = await import('../pages/network-inspector');

let fixture: ComponentFixture<InstanceType<typeof NetworkInspector>>;
type HttpRule = ReturnType<InstanceType<typeof NetworkInspector>['rules']>[number];

const rule = (id: string, pattern: string): HttpRule => ({
  id,
  pattern,
  method: '',
  target: 'client',
  enabled: true,
});

const override = (id: string, pattern: string) => ({
  id,
  kind: 'client-render' as const,
  pattern,
  enabled: true,
});

/** Lets queued saves start, then answers every save that is waiting, oldest first. */
async function answerAll() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    pending.shift()?.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve));
}

afterEach(() => {
  pending.length = 0;
  sent.length = 0;
  fixture?.destroy();
  TestBed.resetTestingModule();
});

describe('NetworkInspector rule and override saves', () => {
  it('keeps both changes when two rules change before the first save answers', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    inspector.rules.set([rule('a', '/api/a'), rule('b', '/api/b')]);
    await fixture.whenStable();

    inspector.toggleRule('a');
    void inspector.removeRule('b');
    await answerAll();

    expect(inspector.rules()).toEqual([{ ...rule('a', '/api/a'), enabled: false }]);
  });

  it('adds a rule once when Add is pressed twice during a save', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    await fixture.whenStable();
    inspector.setDraft('pattern', '/api/products');
    inspector.setDraft('status', '500');

    const first = inspector.addRule(new Event('submit'));
    const second = inspector.addRule(new Event('submit'));
    await answerAll();
    await Promise.all([first, second]);

    expect(sent).toEqual(['set-http-rules']);
    expect(inspector.rules().map((r) => r.pattern)).toEqual(['/api/products']);
  });

  it('keeps both changes when two overrides change before the first save answers', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    inspector.overrides.set([override('a', '/a'), override('b', '/b')]);
    await fixture.whenStable();

    inspector.toggleOverride('a');
    void inspector.removeOverride('b');
    await answerAll();

    expect(inspector.overrides()).toEqual([{ ...override('a', '/a'), enabled: false }]);
  });

  it('adds an override once when Add is pressed twice during a save', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    await fixture.whenStable();
    inspector.setOverrideDraft('kind', 'client-render');
    inspector.setOverrideDraft('pattern', '/examples/ssr');

    const first = inspector.addOverride(new Event('submit'));
    const second = inspector.addOverride(new Event('submit'));
    await answerAll();
    await Promise.all([first, second]);

    expect(sent).toEqual(['set-ssr-overrides']);
    expect(inspector.overrides().map((o) => o.pattern)).toEqual(['/examples/ssr']);
  });
});
