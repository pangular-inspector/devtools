import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewMemory, rememberSelection, restoreScroll } from '../view-memory';

@Component({ selector: 'app-picker', template: '' })
class Picker {
  readonly selected = signal<string | null>(null);
  constructor() {
    rememberSelection('picker', this.selected);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('ViewMemory', () => {
  it('keeps values per view in sessionStorage', () => {
    const memory = TestBed.inject(ViewMemory);
    let view = 'angular';
    memory.useView(() => view);
    memory.write('network:selection', 'c7');
    expect(memory.read('network:selection')).toBe('c7');
    expect(Object.keys(sessionStorage).some((key) => key.includes('angular'))).toBe(true);

    view = 'analog';
    expect(memory.read('network:selection')).toBeUndefined();

    view = 'angular';
    memory.write('network:selection', null);
    expect(memory.read('network:selection')).toBeUndefined();
  });

  it('falls back to memory when storage is blocked', () => {
    const memory = TestBed.inject(ViewMemory);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    memory.write('timeline:scroll', 120);
    expect(memory.read('timeline:scroll')).toBe(120);
  });
});

describe('rememberSelection', () => {
  it('gives a page its last selection back when it is created again', async () => {
    const first = TestBed.createComponent(Picker);
    expect(first.componentInstance.selected()).toBeNull();
    first.componentInstance.selected.set('row-3');
    await first.whenStable();
    first.destroy();

    const again = TestBed.createComponent(Picker);
    expect(again.componentInstance.selected()).toBe('row-3');

    again.componentInstance.selected.set(null);
    await again.whenStable();
    again.destroy();
    expect(TestBed.createComponent(Picker).componentInstance.selected()).toBeNull();
  });
});

describe('restoreScroll', () => {
  function scroller(max: () => number) {
    const el = document.createElement('div');
    let top = 0;
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = Math.max(0, Math.min(value, max()));
      },
    });
    return el;
  }

  function frames() {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queue.push(callback);
      return queue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    return () => queue.shift()?.(0);
  }

  it('waits for the content to grow until it reaches the saved position', () => {
    const tick = frames();
    let height = 100;
    const el = scroller(() => height);
    restoreScroll(el, 300);
    expect(el.scrollTop).toBe(100);
    height = 200;
    tick();
    expect(el.scrollTop).toBe(200);
    height = 1000;
    tick();
    expect(el.scrollTop).toBe(300);
  });

  it('stops as soon as the user scrolls', () => {
    const tick = frames();
    let height = 100;
    const el = scroller(() => height);
    restoreScroll(el, 300);
    el.dispatchEvent(new Event('wheel'));
    height = 1000;
    tick();
    expect(el.scrollTop).toBe(100);
  });

  it('says when it ends, whether it got there or the user took over', () => {
    const tick = frames();
    let height = 100;
    const el = scroller(() => height);
    let ended = 0;
    restoreScroll(el, 300, 120, () => ended++);
    expect(ended).toBe(0);
    height = 1000;
    tick();
    expect(ended).toBe(1);

    restoreScroll(el, 900, 120, () => ended++);
    expect(ended).toBe(2);

    height = 100;
    restoreScroll(el, 900, 120, () => ended++);
    el.dispatchEvent(new Event('keydown'));
    expect(ended).toBe(3);
  });

  it('goes to the top for a tab with no saved position', () => {
    const el = scroller(() => 1000);
    el.scrollTop = 500;
    restoreScroll(el, 0);
    expect(el.scrollTop).toBe(0);
  });
});
