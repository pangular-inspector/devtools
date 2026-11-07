import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Splitter, storePaneSize, storedPaneSize } from '../ui/splitter';

@Component({
  imports: [Splitter],
  template: `
    <app-splitter
      view="demo"
      [pane]="pane()"
      [min]="200"
      [max]="600"
      [defaultSize]="300"
      [(size)]="size"
    />
  `,
})
class Host {
  readonly pane = signal<'before' | 'after'>('after');
  readonly size = signal(300);
}

async function setup(pane: 'before' | 'after' = 'after', size = 300) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.pane.set(pane);
  fixture.componentInstance.size.set(size);
  document.body.append(fixture.nativeElement);
  await fixture.whenStable();
  const bar = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('app-splitter')!;
  const key = async (name: string, shiftKey = false) => {
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }));
    await fixture.whenStable();
  };
  const pointer = (type: string, clientX: number) => {
    const event = new MouseEvent(type, { clientX, button: 0, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    bar.dispatchEvent(event);
  };
  return { fixture, bar, key, pointer, size: () => fixture.componentInstance.size() };
}

describe('Splitter', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('is a focusable vertical separator that says its width', async () => {
    const { bar } = await setup();
    expect(bar.getAttribute('role')).toBe('separator');
    expect(bar.getAttribute('tabindex')).toBe('0');
    expect(bar.getAttribute('aria-orientation')).toBe('vertical');
    expect(bar.getAttribute('aria-label')).toBe('Resize the detail panel');
    expect(bar.getAttribute('aria-valuenow')).toBe('300');
    expect(bar.getAttribute('aria-valuemin')).toBe('200');
    expect(bar.getAttribute('aria-valuemax')).toBe('600');
    expect(bar.getAttribute('aria-valuetext')).toBe('300 pixels wide');
  });

  it('widens the pane after it with ArrowLeft and saves the width for its view', async () => {
    const { key, size, bar } = await setup('after');
    await key('ArrowLeft');
    expect(size()).toBe(316);
    await key('ArrowRight', true);
    expect(size()).toBe(252);
    expect(bar.getAttribute('aria-valuenow')).toBe('252');
    expect(storedPaneSize('demo', 0)).toBe(252);
  });

  it('widens the pane before it with ArrowRight', async () => {
    const { key, size } = await setup('before');
    await key('ArrowRight');
    expect(size()).toBe(316);
  });

  it('jumps to the limits with Home and End and never leaves them', async () => {
    const { key, size } = await setup();
    await key('End');
    expect(size()).toBe(600);
    await key('ArrowLeft', true);
    expect(size()).toBe(600);
    await key('Home');
    expect(size()).toBe(200);
  });

  it('follows a drag and saves once it ends', async () => {
    const { pointer, size, fixture } = await setup('after');
    pointer('pointerdown', 500);
    pointer('pointermove', 450);
    await fixture.whenStable();
    expect(size()).toBe(350);
    expect(storedPaneSize('demo', 0)).toBe(0);
    pointer('pointerup', 450);
    expect(storedPaneSize('demo', 0)).toBe(350);
    // No drag without a press first.
    pointer('pointermove', 100);
    await fixture.whenStable();
    expect(size()).toBe(350);
  });

  it('goes back to the default width on a double click and forgets the saved one', async () => {
    storePaneSize('demo', 500);
    const { bar, size, fixture } = await setup('after', 500);
    bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await fixture.whenStable();
    expect(size()).toBe(300);
    expect(localStorage.getItem('pangular-pref:pane:demo')).toBeNull();
  });

  it('reads the saved width, and falls back on bad or blocked storage', () => {
    expect(storedPaneSize('demo', 420)).toBe(420);
    localStorage.setItem('pangular-pref:pane:demo', 'wide');
    expect(storedPaneSize('demo', 420)).toBe(420);
    storePaneSize('demo', 512.4);
    expect(storedPaneSize('demo', 420)).toBe(512);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(storedPaneSize('demo', 420)).toBe(420);
    } finally {
      get.mockRestore();
    }
  });
});
