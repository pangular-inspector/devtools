import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Select, type SelectOption } from '../ui/select';

@Component({
  imports: [Select],
  template: `<app-select ariaLabel="Fruit" [options]="options()" [(value)]="value" />`,
})
class Host {
  readonly options = signal<SelectOption[]>([]);
  readonly value = signal<string | null>(null);
}

async function setup(options: SelectOption[], value: string | null = null) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.options.set(options);
  fixture.componentInstance.value.set(value);
  await fixture.whenStable();
  const trigger = fixture.nativeElement.querySelector('button[role="combobox"]') as HTMLElement;
  const press = async (key: string) => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await fixture.whenStable();
  };
  const active = () => {
    const id = trigger.getAttribute('aria-activedescendant');
    return id ? fixture.nativeElement.querySelector(`#${id}`)?.textContent?.trim() : null;
  };
  return { fixture, trigger, press, active };
}

const FRUIT: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

describe('Select', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('opens on ArrowDown with the first enabled option active', async () => {
    const { trigger, press, active } = await setup(FRUIT);
    await press('ArrowDown');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(active()).toBe('Apple');
  });

  it('skips disabled options when moving', async () => {
    const { press, active } = await setup(FRUIT);
    await press('ArrowDown');
    await press('ArrowDown');
    expect(active()).toBe('Cherry');
    await press('ArrowUp');
    expect(active()).toBe('Apple');
  });

  it('keeps the active option when only disabled options follow', async () => {
    const { press, active } = await setup([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ]);
    await press('ArrowDown');
    await press('ArrowDown');
    expect(active()).toBe('A');
  });

  it('keeps the active option when only disabled options come before', async () => {
    const { press, active } = await setup(
      [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B' },
      ],
      'b',
    );
    await press('ArrowDown');
    expect(active()).toBe('B');
    await press('ArrowUp');
    expect(active()).toBe('B');
  });

  it('stops at the ends of the list', async () => {
    const { press, active } = await setup(FRUIT, 'cherry');
    await press('ArrowDown');
    expect(active()).toBe('Cherry');
    await press('ArrowDown');
    expect(active()).toBe('Cherry');
  });

  it('jumps to the first and last enabled options with Home and End', async () => {
    const { press, active } = await setup([
      ...FRUIT,
      { value: 'date', label: 'Date', disabled: true },
    ]);
    await press('ArrowDown');
    await press('End');
    expect(active()).toBe('Cherry');
    await press('Home');
    expect(active()).toBe('Apple');
  });

  it('chooses the active option with Enter and closes', async () => {
    const { fixture, trigger, press } = await setup(FRUIT);
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Enter');
    expect(fixture.componentInstance.value()).toBe('cherry');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('closes on Escape without changing the value', async () => {
    const { fixture, trigger, press } = await setup(FRUIT, 'apple');
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Escape');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.value()).toBe('apple');
  });

  it('selects by typed prefix while closed, skipping disabled options', async () => {
    const skipped = await setup(FRUIT);
    await skipped.press('b');
    expect(skipped.fixture.componentInstance.value()).toBeNull();
    const chosen = await setup(FRUIT);
    await chosen.press('c');
    expect(chosen.fixture.componentInstance.value()).toBe('cherry');
  });

  it('keeps focus on the trigger when the list itself is pressed', async () => {
    const { fixture, press } = await setup(FRUIT);
    await press('ArrowDown');
    const list = fixture.nativeElement.querySelector('ul[role="listbox"]') as HTMLElement;
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    list.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });
});
