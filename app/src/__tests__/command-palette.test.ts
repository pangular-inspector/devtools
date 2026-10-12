import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CommandPalette } from '../ui/command-palette';
import { filterCommands, fuzzyScore, type PaletteCommand } from '../palette-filter';

const COMMANDS: PaletteCommand[] = [
  { id: 'tab:dashboard', title: 'Go to Dashboard', group: 'Go to' },
  { id: 'tab:signals', title: 'Go to Signals', group: 'Go to' },
  { id: 'tab:network', title: 'Go to SSR & HTTP', group: 'Go to' },
  { id: 'pick-component', title: 'Pick component on page', group: 'Actions', keywords: 'select' },
  { id: 'theme:dark', title: 'Theme: dark', group: 'Theme' },
];

describe('palette filter', () => {
  it('matches letters in order and ranks word starts and runs higher', () => {
    expect(fuzzyScore('Go to Signals', 'gtsig')).toBeGreaterThan(0);
    expect(fuzzyScore('Go to Signals', 'xyz')).toBe(-1);
    expect(fuzzyScore('Go to Signals', 'sig')).toBeGreaterThan(fuzzyScore('Design', 'sig'));
  });

  it('keeps the order for an empty query and puts the best match first', () => {
    expect(filterCommands(COMMANDS, '  ')).toEqual(COMMANDS);
    expect(filterCommands(COMMANDS, 'sig').map((c) => c.id)[0]).toBe('tab:signals');
    expect(filterCommands(COMMANDS, 'http').map((c) => c.id)).toEqual(['tab:network']);
    expect(filterCommands(COMMANDS, 'dark').map((c) => c.id)).toEqual(['theme:dark']);
  });

  it('also matches the group and keywords, below a title match', () => {
    expect(filterCommands(COMMANDS, 'select').map((c) => c.id)).toEqual(['pick-component']);
    expect(filterCommands(COMMANDS, 'theme').map((c) => c.id)[0]).toBe('theme:dark');
  });
});

@Component({
  imports: [CommandPalette],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Open</button>
    <app-command-palette [commands]="commands" [(open)]="open" (picked)="picked.push($event)" />
  `,
})
class Host {
  readonly commands = COMMANDS;
  readonly open = signal(false);
  readonly picked: string[] = [];
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function key(target: Element, name: string) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

async function openPalette() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  const opener = fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
  opener.focus();
  opener.click();
  await settle(fixture);
  const root = fixture.nativeElement as HTMLElement;
  const input = root.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { fixture, root, input, opener };
}

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

describe('CommandPalette', () => {
  it('is a modal dialog with a combobox that controls a listbox', async () => {
    const { root, input } = await openPalette();
    const dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = root.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.textContent?.trim()).toBe('Command palette');
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const list = root.querySelector(`#${input.getAttribute('aria-controls')}`)!;
    expect(list.getAttribute('role')).toBe('listbox');
    const options = list.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(COMMANDS.length);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
  });

  it('filters as you type and says when nothing matches', async () => {
    const { fixture, root, input } = await openPalette();
    input.value = 'sig';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    const options = [...root.querySelectorAll('[role="option"]')];
    expect(options[0].textContent).toContain('Go to Signals');
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/command/);

    input.value = 'zzzz';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(root.querySelector('.empty')?.textContent).toContain('No commands match “zzzz”');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('moves with the arrow keys, wraps, and runs the active command on Enter', async () => {
    const { fixture, root, input, opener } = await openPalette();
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    await settle(fixture);
    const options = root.querySelectorAll('[role="option"]');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[2].id);
    key(input, 'ArrowUp');
    key(input, 'ArrowUp');
    key(input, 'ArrowUp');
    await settle(fixture);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[COMMANDS.length - 1].id);

    key(input, 'Enter');
    await settle(fixture);
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.componentInstance.picked).toEqual(['theme:dark']);
    // Focus went back to what opened it before the command ran.
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape without running anything, and keeps Tab inside', async () => {
    const { fixture, root, input, opener } = await openPalette();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    input.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    await settle(fixture);
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.componentInstance.picked).toEqual([]);
    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('runs a command on click and starts empty the next time', async () => {
    const { fixture, root, input } = await openPalette();
    input.value = 'pick';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    (root.querySelector('[role="option"]') as HTMLElement).click();
    await settle(fixture);
    expect(fixture.componentInstance.picked).toEqual(['pick-component']);
    fixture.componentInstance.open.set(true);
    await settle(fixture);
    expect((root.querySelector('input[role="combobox"]') as HTMLInputElement).value).toBe('');
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(COMMANDS.length);
  });
});
