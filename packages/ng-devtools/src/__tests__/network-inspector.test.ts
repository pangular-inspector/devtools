// @vitest-environment jsdom
import '@angular/compiler';
import { Component, EventEmitter } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../../../../app/src/pages/network-inspector.ts';
import { Select } from '../../../../app/src/ui/select.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

class StubSelect {
  valueChange = new EventEmitter<string | null>();
}
Component({
  selector: 'app-select',
  template: '',
  inputs: ['options', 'value', 'labelledBy', 'emptyText', 'placeholder'],
  outputs: ['valueChange'],
})(StubSelect);

type Call = NetworkInspector['serverCalls'] extends { (): infer T } ? T : never;

const call = (id: string, extra: Partial<Call[number]> = {}): Call[number] => ({
  id,
  url: `/api/${id}`,
  method: 'GET',
  status: 200,
  durationMs: 3,
  side: 'server',
  cacheHit: false,
  faulted: false,
  at: Number(id.replace(/\D/g, '')) || 1,
  ...extra,
});

let fixture: ComponentFixture<NetworkInspector>;

function mount(calls: Call = []) {
  TestBed.overrideComponent(NetworkInspector, {
    remove: { imports: [Select] },
    add: { imports: [StubSelect] },
  });
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  fixture.componentInstance.serverCalls.set(calls);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const typeInto = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input'));
  fixture.detectChanges();
};

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

describe('NetworkInspector response preview', () => {
  it('moves focus to the preview heading and back to the URL button on Escape and Close', async () => {
    const host = mount([call('s1'), call('s2')]);
    const button = host.querySelector<HTMLButtonElement>('button[data-call-id="s2"]')!;
    button.focus();
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const heading = host.querySelector<HTMLElement>('#preview-heading')!;
    expect(document.activeElement).toBe(heading);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    heading.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('#preview-heading')).toBeNull();
    expect(document.activeElement).toBe(button);

    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    [...host.querySelectorAll<HTMLButtonElement>('.preview button')]
      .find((b) => b.textContent?.trim() === 'Close')!
      .click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(button);
  });

  it('points the URL buttons at the preview only while it is open', async () => {
    const host = mount([call('s1'), call('s2')]);
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button[data-call-id]')];
    expect(host.querySelector('#call-preview')).toBeNull();
    expect(buttons.map((b) => b.hasAttribute('aria-controls'))).toEqual([false, false]);

    buttons[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelector('#call-preview')).not.toBeNull();
    expect(buttons.map((b) => b.getAttribute('aria-controls'))).toEqual([
      'call-preview',
      'call-preview',
    ]);
  });
});

describe('NetworkInspector timeline notes', () => {
  it('shows cancelled calls in a neutral tone and splits the rule notes', () => {
    const host = mount([
      call('s1', { status: 0, cancelled: true, error: 'cancelled' }),
      call('s2', { status: 0, error: 'Http failure response for /api/s2: 0 Unknown Error' }),
      call('s3', { delayMs: 300, ruleId: 'r1', rulePattern: '/api/*' }),
      call('s4', { status: 201, mocked: true, rulePattern: '/api/s4' }),
      call('s5', { status: 500, faulted: true, rulePattern: '/api/s5' }),
    ]);
    const row = (id: string) =>
      host.querySelector(`button[data-call-id="${id}"]`)!.closest('tr') as HTMLElement;
    const status = (id: string) => row(id).querySelector('td.status') as HTMLElement;
    const notes = (id: string) =>
      [...row(id).querySelectorAll('.notes .tag')].map((t) =>
        t.textContent!.replace(/\s+/g, ' ').trim(),
      );

    expect(status('s1').textContent!.trim()).toBe('cancelled');
    expect(status('s1').classList.contains('bad')).toBe(false);
    expect(status('s2').textContent!.trim()).toBe('ERR');
    expect(status('s2').classList.contains('bad')).toBe(true);
    expect(notes('s3')).toEqual(['delayed 300 ms', 'rule /api/*']);
    expect(notes('s4')).toEqual(['mocked', 'rule /api/s4']);
    expect(notes('s5')).toEqual(['faulted', 'rule /api/s5']);
  });
});

describe('NetworkInspector rule form', () => {
  const form = (host: HTMLElement) => ({
    pattern: host.querySelector<HTMLInputElement>('.rule-form input:not([type])')!,
    status: host.querySelector<HTMLInputElement>('.rule-form input[type="number"][max="599"]')!,
    delay: host.querySelector<HTMLInputElement>('.rule-form input[type="number"][max="10000"]')!,
    body: host.querySelector<HTMLTextAreaElement>('.rule-form textarea')!,
    submit: host.querySelector<HTMLButtonElement>('.rule-form button[type="submit"]')!,
    hint: () => host.querySelector('#rule-hint')!.textContent!.trim(),
  });

  it('starts empty and only enables Add rule for a rule that changes something', () => {
    const f = form(mount());
    expect(f.pattern.value).toBe('');
    expect(f.status.value).toBe('');
    expect(f.submit.disabled).toBe(true);

    typeInto(f.pattern, '/api/products');
    expect(f.submit.disabled).toBe(true);
    expect(f.hint()).toBe('Set a status, a delay or a mock body.');

    typeInto(f.delay, '3000');
    expect(f.submit.disabled).toBe(false);
    expect(fixture.componentInstance.draftRule()).toEqual({
      pattern: '/api/products',
      enabled: true,
      target: 'both',
      delayMs: 3000,
    });

    typeInto(f.status, '42');
    expect(f.submit.disabled).toBe(true);
    expect(f.hint()).toBe('Set a status from 100 to 599.');
  });

  it('gives a body-only rule status 200', () => {
    const f = form(mount());
    typeInto(f.pattern, '/api/products');
    typeInto(f.body, '{"items":[]}');
    expect(f.hint()).toBe('With no status, the mock body returns 200.');
    expect(fixture.componentInstance.draftRule()).toMatchObject({
      status: 200,
      body: '{"items":[]}',
    });
  });

  it('resets the form after Add rule and mentions a reload only for SSR rules', async () => {
    const host = mount();
    const f = form(host);
    const inspector = fixture.componentInstance;
    typeInto(f.pattern, '/api/products');
    typeInto(f.status, '500');
    inspector.setDraft('target', 'client');
    fixture.detectChanges();
    f.submit.focus();
    f.submit.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(inspector.rules()).toMatchObject([{ pattern: '/api/products', status: 500 }]);
    expect(inspector.message()).toBe('Rule added.');
    expect(f.pattern.value).toBe('');
    expect(f.submit.disabled).toBe(true);
    expect(document.activeElement).toBe(f.pattern);

    typeInto(f.pattern, '/api/cart');
    typeInto(f.status, '503');
    f.submit.click();
    await fixture.whenStable();
    expect(inspector.message()).toBe('Rule added. Reload the page to apply it to SSR.');
  });

  it('blocks a rule past the cap', () => {
    const host = mount();
    const inspector = fixture.componentInstance;
    inspector.rules.set(
      Array.from({ length: 50 }, (_, i) => ({
        id: `r${i}`,
        pattern: `/p${i}`,
        enabled: true,
        target: 'both' as const,
        status: 500,
      })),
    );
    const f = form(host);
    typeInto(f.pattern, '/api/products');
    typeInto(f.status, '500');
    expect(f.submit.disabled).toBe(true);
    expect(f.hint()).toBe('You can add up to 50 rules. Remove one to add another.');
  });
});
