import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { RovingList } from '../ui/roving-list';

@Component({
  imports: [RovingList],
  template: `
    <ul appRovingList="button.row">
      @for (item of items(); track item) {
        <li>
          <button type="button" class="row" [attr.aria-pressed]="item === selected()">
            {{ item }}
          </button>
        </li>
      }
    </ul>
  `,
})
class Host {
  readonly items = signal(['a', 'b', 'c', 'd']);
  readonly selected = signal<string | null>(null);
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function mount() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  return fixture;
}

const rows = (fixture: ComponentFixture<Host>) => [
  ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.row'),
];
const tabStops = (fixture: ComponentFixture<Host>) =>
  rows(fixture)
    .filter((row) => row.tabIndex === 0)
    .map((row) => row.textContent?.trim());
const press = (key: string) =>
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RovingList', () => {
  it('keeps one row in the Tab order, the selected one when there is one', async () => {
    const fixture = mount();
    fixture.componentInstance.selected.set('c');
    await settle(fixture);
    expect(tabStops(fixture)).toEqual(['c']);
  });

  it('moves focus with the arrow keys, Home and End, and stops at the ends', async () => {
    const fixture = mount();
    await settle(fixture);
    expect(tabStops(fixture)).toEqual(['a']);

    rows(fixture)[0].focus();
    press('ArrowUp');
    expect(document.activeElement).toBe(rows(fixture)[0]);
    press('ArrowDown');
    expect(document.activeElement).toBe(rows(fixture)[1]);
    expect(tabStops(fixture)).toEqual(['b']);
    press('End');
    expect(document.activeElement).toBe(rows(fixture)[3]);
    press('ArrowDown');
    expect(document.activeElement).toBe(rows(fixture)[3]);
    press('Home');
    expect(document.activeElement).toBe(rows(fixture)[0]);
  });

  it('takes rows that arrive later out of the Tab order, and finds a new stop when its row goes', async () => {
    const fixture = mount();
    await settle(fixture);
    rows(fixture)[1].focus();

    fixture.componentInstance.items.set(['a', 'b', 'c', 'd', 'e']);
    await settle(fixture);
    expect(tabStops(fixture)).toEqual(['b']);

    fixture.componentInstance.items.set(['c', 'd']);
    await settle(fixture);
    expect(tabStops(fixture)).toEqual(['c']);
  });
  it('moves focus to the new stop when the focused row is removed', async () => {
    const fixture = mount();
    await settle(fixture);
    rows(fixture)[1].focus();

    fixture.componentInstance.items.set(['c', 'd']);
    await settle(fixture);
    expect(document.activeElement).toBe(rows(fixture)[0]);
    press('ArrowDown');
    expect(document.activeElement?.textContent?.trim()).toBe('d');
  });

  it('leaves focus alone when it had already left the list', async () => {
    const fixture = mount();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    await settle(fixture);

    rows(fixture)[1].focus();
    outside.focus();
    fixture.componentInstance.items.set(['c', 'd']);
    await settle(fixture);
    expect(document.activeElement).toBe(outside);

    rows(fixture)[0].focus();
    rows(fixture)[0].blur();
    await settle(fixture);
    fixture.componentInstance.items.set(['d']);
    await settle(fixture);
    expect(document.activeElement).toBe(document.body);
  });
});
