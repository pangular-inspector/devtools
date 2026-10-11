import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { FormsTimeline } from '../pages/forms-timeline';
import type { FormEvent } from '../pages/forms-types';

function event(seq: number, path: string, type: string, origin = 'user'): FormEvent {
  return { formId: 'signup@p1', path, type, origin, seq, timestamp: 1_700_000_000_000 + seq };
}

const EVENTS: FormEvent[] = [
  event(1, 'email', 'value'),
  event(2, 'email', 'status', 'code'),
  event(3, 'address.city', 'value'),
  event(4, 'address.zip', 'touched'),
  event(5, 'name', 'value', 'agent'),
  event(6, '', 'submit'),
];

async function setup(events: FormEvent[]) {
  const fixture = TestBed.createComponent(FormsTimeline);
  fixture.componentRef.setInput('events', events);
  document.body.append(fixture.nativeElement);
  await fixture.whenStable();
  return fixture;
}

function root(fixture: ComponentFixture<FormsTimeline>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function paths(fixture: ComponentFixture<FormsTimeline>): string[] {
  return Array.from(root(fixture).querySelectorAll('.events .path')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function total(fixture: ComponentFixture<FormsTimeline>): string {
  return root(fixture).querySelector('.total')?.textContent?.trim() ?? '';
}

async function typePath(fixture: ComponentFixture<FormsTimeline>, value: string) {
  const input = root(fixture).querySelector<HTMLInputElement>('input[type="search"]')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  return input;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FormsTimeline filters', () => {
  it('labels the path filter and the event type select', async () => {
    const fixture = await setup(EVENTS);
    const input = root(fixture).querySelector('input[type="search"]')!;
    expect(input.getAttribute('aria-label')).toBe('Filter by field path');
    const select = root(fixture).querySelector('button[role="combobox"]')!;
    expect(select.getAttribute('aria-label')).toBe('Event type');
    expect(total(fixture)).toBe('6 events');
  });

  it('offers All plus only the types present, in the agent tool order', async () => {
    const fixture = await setup(EVENTS);
    expect(fixture.componentInstance.typeOptions().map((o) => o.value)).toEqual([
      'all',
      'value',
      'status',
      'touched',
      'submit',
    ]);
  });

  it('matches a path substring, ignoring case, and clears it on Escape', async () => {
    const fixture = await setup(EVENTS);
    const input = await typePath(fixture, 'ADDRESS');
    expect(paths(fixture)).toEqual(['address.zip', 'address.city']);
    expect(total(fixture)).toBe('2 of 6 events');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.pathFilter()).toBe('');
    expect(paths(fixture)).toHaveLength(6);
  });

  it('combines path, type and origin', async () => {
    const fixture = await setup(EVENTS);
    await typePath(fixture, 'e');
    fixture.componentInstance.typeFilter.set('value');
    await fixture.whenStable();
    expect(paths(fixture)).toEqual(['name', 'address.city', 'email']);

    fixture.componentInstance.filter.set('agent');
    await fixture.whenStable();
    expect(paths(fixture)).toEqual(['name']);
    expect(total(fixture)).toBe('1 of 6 events');
  });

  it('says when the list is cut to the latest 100', async () => {
    const many = Array.from({ length: 240 }, (_, i) =>
      event(i + 1, i % 2 ? 'email' : 'name', 'value'),
    );
    const fixture = await setup(many);
    expect(root(fixture).querySelectorAll('.events li')).toHaveLength(100);
    expect(total(fixture)).toBe('Showing the latest 100 of 240 events');

    await typePath(fixture, 'email');
    expect(total(fixture)).toBe('Showing the latest 100 of 120 matching events');

    fixture.componentInstance.filter.set('code');
    await fixture.whenStable();
    expect(root(fixture).querySelector('.events')).toBeNull();
  });

  it('announces the count when a filter changes, not on every new event', async () => {
    const fixture = await setup(EVENTS);
    const status = () => root(fixture).querySelector('[role="status"]')?.textContent?.trim();
    expect(root(fixture).querySelector('.total')?.hasAttribute('aria-live')).toBe(false);
    await typePath(fixture, 'name');
    const filtered = status();
    expect(filtered).toBe(total(fixture));
    fixture.componentRef.setInput('events', [...EVENTS, event(7, 'name', 'value')]);
    await fixture.whenStable();
    expect(total(fixture)).not.toBe(filtered);
    expect(status()).toBe(filtered);
  });

  it('shows Clear filters when the filters hide everything and resets all three', async () => {
    const fixture = await setup(EVENTS);
    await typePath(fixture, 'nothing');
    fixture.componentInstance.typeFilter.set('status');
    fixture.componentInstance.filter.set('code');
    await fixture.whenStable();
    expect(root(fixture).textContent).toContain('No events match these filters');

    const clear = Array.from(root(fixture).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Clear filters',
    )!;
    clear.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.pathFilter()).toBe('');
    expect(fixture.componentInstance.typeFilter()).toBe('all');
    expect(fixture.componentInstance.filter()).toBe('all');
    expect(paths(fixture)).toHaveLength(6);
    expect(document.activeElement).toBe(root(fixture).querySelector('input[type="search"]'));
  });

  it('keeps the no-events state when nothing was recorded', async () => {
    const fixture = await setup([]);
    expect(root(fixture).textContent).toContain('No changes yet');
    expect(root(fixture).textContent).not.toContain('Clear filters');
  });
});
