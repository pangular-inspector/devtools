import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AppState, type StateKind } from '../ui/app-state';

@Component({
  imports: [AppState],
  template: `
    <app-state
      [kind]="kind()"
      [retrying]="retrying()"
      (retry)="retries = retries + 1"
      (clear)="clears = clears + 1"
    >
      Can't read the data.
      <p detail>Check that the dev server is running.</p>
    </app-state>
  `,
})
class Host {
  readonly kind = signal<StateKind>('loading');
  readonly retrying = signal(false);
  retries = 0;
  clears = 0;
}

async function mount(kind: StateKind) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.kind.set(kind);
  document.body.append(fixture.nativeElement as HTMLElement);
  await fixture.whenStable();
  const state = (fixture.nativeElement as HTMLElement).querySelector('app-state')!;
  return { fixture, state };
}

const buttons = (state: Element) => [...state.querySelectorAll('button')];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('app-state', () => {
  it('is a status with a spinner while loading, and has no button', async () => {
    const { state } = await mount('loading');
    expect(state.getAttribute('role')).toBe('status');
    expect(state.getAttribute('data-kind')).toBe('loading');
    expect(state.querySelector('.spinner')?.getAttribute('aria-hidden')).toBe('true');
    expect(buttons(state)).toEqual([]);
  });

  it('is an alert with Retry on an error, and holds Retry while one runs', async () => {
    const { fixture, state } = await mount('error');
    expect(state.getAttribute('role')).toBe('alert');
    expect(state.querySelector('.message')!.textContent!.trim()).toBe("Can't read the data.");
    expect(state.querySelector('[detail]')!.textContent).toContain('dev server');
    const [retry] = buttons(state);
    expect(retry.textContent!.trim()).toBe('Retry');
    retry.click();
    expect(fixture.componentInstance.retries).toBe(1);

    fixture.componentInstance.retrying.set(true);
    await fixture.whenStable();
    expect(retry.textContent!.trim()).toBe('Retrying…');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    retry.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });

  it('is a status that explains how to get data when empty', async () => {
    const { state } = await mount('empty');
    expect(state.getAttribute('role')).toBe('status');
    expect(buttons(state)).toEqual([]);
  });

  it('offers Clear filters on no match, and is not a live region', async () => {
    const { fixture, state } = await mount('no-match');
    expect(state.hasAttribute('role')).toBe(false);
    const [clear] = buttons(state);
    expect(clear.textContent!.trim()).toBe('Clear filters');
    clear.click();
    expect(fixture.componentInstance.clears).toBe(1);
  });
});
