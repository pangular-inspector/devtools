import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const saved: unknown[][] = [];
vi.mock('../rpc', () => ({
  rpcCall: async (_rpc: unknown, name: string, list: unknown[]) => {
    if (name === 'set-http-rules') saved.push(list);
    return list;
  },
}));

const { NetworkInspector } = await import('../pages/network-inspector');

let fixture: ComponentFixture<InstanceType<typeof NetworkInspector>>;

const host = () => fixture.nativeElement as HTMLElement;
const presetButton = (id: string) =>
  host().querySelector<HTMLButtonElement>(`button[data-preset="${id}"]`)!;
const settle = async () => {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
};

describe('NetworkInspector rule presets', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    saved.length = 0;
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('lists the three presets with what each one does', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    const group = host().querySelector('[role="group"][aria-labelledby="rule-presets-label"]')!;
    const labels = [...group.querySelectorAll('button')].map((b) => b.textContent!.trim());
    expect(labels).toEqual(['Offline', 'Slow 3G', 'Flaky']);
    const flaky = presetButton('flaky');
    const description = host().querySelector(`#${flaky.getAttribute('aria-describedby')!.trim()}`);
    expect(description!.textContent).toContain('30% of browser requests with 503');
  });

  it('adds a preset as plain rules after the existing ones', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    const inspector = fixture.componentInstance;
    inspector.rules.set([
      { id: 'a', pattern: '/api/a', target: 'client', enabled: true, status: 500 },
    ]);
    await fixture.whenStable();
    presetButton('flaky').click();
    await settle();
    expect(saved).toHaveLength(1);
    expect(inspector.rules()).toEqual([
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ pattern: '*', target: 'client', status: 503, chance: 30 }),
    ]);
    const meta = [...host().querySelectorAll('.rules li')][1].textContent!;
    expect(meta).toContain('30% of requests');
    presetButton('offline').click();
    await settle();
    const offline = [...host().querySelectorAll('.rules li')][2].textContent!;
    expect(offline).toContain('network error');
  });

  it('takes a chance from 1 to 99 in the rule form', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    const inspector = fixture.componentInstance;
    await fixture.whenStable();
    inspector.setDraft('pattern', '/api/x');
    inspector.setDraft('status', '503');
    inspector.setDraft('chance', '150');
    await fixture.whenStable();
    expect(inspector.draftRule()).toBeNull();
    expect(host().querySelector('#rule-hint')!.textContent!.trim()).toBe(
      'Chance is a whole percent from 1 to 99.',
    );
    inspector.setDraft('chance', '25');
    expect(inspector.draftRule()).toMatchObject({ status: 503, chance: 25 });
    inspector.setDraft('status', '0');
    expect(inspector.draftRule()).toMatchObject({ status: 0 });
    expect(inspector.mocksOnServer({ target: 'both', status: 0 })).toBe(false);
  });
});
