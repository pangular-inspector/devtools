import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../rpc', () => ({
  rpcCall: async (_rpc: unknown, _name: string, ...args: unknown[]) => args[0],
}));

const { NetworkInspector } = await import('../pages/network-inspector');

type Inspector = InstanceType<typeof NetworkInspector>;
type Rule = ReturnType<Inspector['rules']>[number];
type Call = ReturnType<Inspector['serverCalls']>[number];

let fixture: ComponentFixture<Inspector>;

const host = () => fixture.nativeElement as HTMLElement;
const status = () => host().querySelector('.toolbar [role="status"]')!.textContent!.trim();

function rule(id: string, pattern: string): Rule {
  return { id, pattern, enabled: true, target: 'client', status: 503 };
}

function call(id: string, preview?: string): Call {
  return {
    id,
    url: `http://localhost/api/${id}`,
    method: 'GET',
    status: 200,
    durationMs: 1,
    side: 'server',
    cacheHit: false,
    faulted: false,
    at: 1000,
    preview,
  };
}

async function mount() {
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  await fixture.whenStable();
  return fixture.componentInstance;
}

async function settle() {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

async function clickRemove(selector: string, index: number) {
  const buttons = host().querySelectorAll<HTMLButtonElement>(selector);
  buttons[index].focus();
  buttons[index].click();
  await settle();
}

describe('NetworkInspector accessibility', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('moves focus to the next, then the previous Remove button, then the heading', async () => {
    const inspector = await mount();
    inspector.rules.set([rule('a', '/a'), rule('b', '/b'), rule('c', '/c')]);
    await fixture.whenStable();
    const label = () => document.activeElement?.getAttribute('aria-label');

    await clickRemove('[data-remove-rule]', 0);
    expect(label()).toBe('Remove rule for /b');
    expect(status()).toBe('Rule removed.');

    await clickRemove('[data-remove-rule]', 1);
    expect(label()).toBe('Remove rule for /b');
    expect(status()).toBe('Rule removed.');

    await clickRemove('[data-remove-rule]', 0);
    expect(document.activeElement?.id).toBe('rule-list-heading');
    expect(inspector.rules()).toEqual([]);
  });

  it('says a repeated removal again', async () => {
    const inspector = await mount();
    inspector.rules.set([rule('a', '/a'), rule('b', '/b')]);
    await fixture.whenStable();
    await clickRemove('[data-remove-rule]', 0);
    expect(status()).toBe('Rule removed.');

    const node = host().querySelector('.toolbar [role="status"]')!;
    const seen: (string | null)[] = [];
    const observer = new MutationObserver((records) =>
      seen.push(...records.map((r) => r.oldValue)),
    );
    observer.observe(node, { characterData: true, characterDataOldValue: true, subtree: true });
    await clickRemove('[data-remove-rule]', 0);
    observer.disconnect();
    // Emptied, then filled again, so the live region has a change to read.
    expect(seen).toEqual(['Rule removed.', '']);
    expect(status()).toBe('Rule removed.');
  });

  it('keeps a newer message over a pending repeat', async () => {
    const inspector = await mount();
    inspector.message.set('Rule removed.');
    await fixture.whenStable();
    inspector['announce']('Rule removed.');
    inspector.message.set('Could not save the rules.');
    await settle();
    expect(status()).toBe('Could not save the rules.');
  });

  it('moves focus the same way when an override is removed', async () => {
    const inspector = await mount();
    inspector.overrides.set([
      { id: 'o1', kind: 'client-render', pattern: '/one', enabled: true },
      { id: 'o2', kind: 'client-render', pattern: '/two', enabled: true },
    ]);
    await fixture.whenStable();

    await clickRemove('[data-remove-override]', 1);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Remove Client render for /one',
    );
    expect(status()).toBe('Override removed.');

    await clickRemove('[data-remove-override]', 0);
    expect(document.activeElement?.id).toBe('override-list-heading');
  });

  it('points the form controls at their help text', async () => {
    const inspector = await mount();
    const trigger = (label: string) =>
      host().querySelector(`button[role="combobox"][aria-labelledby="${label}"]`)!;

    expect(trigger('rule-status-label').hasAttribute('aria-describedby')).toBe(false);
    inspector.setDraft('pattern', '/api');
    inspector.setDraft('status', '200');
    await fixture.whenStable();
    expect(host().querySelector('#rule-ssr-note')).not.toBeNull();
    expect(trigger('rule-status-label').getAttribute('aria-describedby')).toBe('rule-ssr-note');
    expect(trigger('rule-target-label').getAttribute('aria-describedby')).toBe('rule-ssr-note');

    const help = () => host().querySelector('#override-kind-help')?.textContent ?? '';
    expect(help()).toContain('Throws while the server renders');
    expect(trigger('override-kind-label').getAttribute('aria-describedby')).toBe(
      'override-kind-help',
    );
    const message = host().querySelector('input[placeholder="Simulated render error"]')!;
    expect(message.getAttribute('aria-describedby')).toBe('override-kind-help');

    inspector.setOverrideDraft('kind', 'client-render');
    await fixture.whenStable();
    expect(help()).toContain('index.csr.html');

    inspector.setOverrideDraft('kind', 'state-edit');
    await fixture.whenStable();
    expect(trigger('override-kind-label').hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows the filter count only once there are calls', async () => {
    const inspector = await mount();
    const total = () => host().querySelector<HTMLElement>('.filters .total')!;
    expect(host().querySelector('.filters')!.classList).toContain('no-calls');

    inspector.serverCalls.set([call('a')]);
    await fixture.whenStable();
    expect(host().querySelector('.filters')!.classList).not.toContain('no-calls');
    expect(total().textContent!.trim()).toBe('1 of 1');
  });

  it('names the scrollable response preview', async () => {
    const inspector = await mount();
    inspector.serverCalls.set([call('a', '{"ok":true}')]);
    inspector.selectedCallId.set('a');
    await fixture.whenStable();
    const pre = host().querySelector('pre.preview-body')!;
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('role')).toBe('region');
    expect(pre.getAttribute('aria-label')).toBe('Response body');
  });
});
