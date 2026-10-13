import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { VirtualWindow } from '../ui/virtual-window';

// A windowed list that gets shorter while scrolled near its end, such as a
// filter taking 2000 rows down to 301.

const ROW = 20;

function setup() {
  const count = signal(2000);
  const win = TestBed.runInInjectionContext(
    () => new VirtualWindow({ count, estimate: ROW, fixed: true }),
  );
  const host = document.createElement('div');
  host.style.overflowY = 'auto';
  let scrollTop = 0;
  Object.defineProperty(host, 'scrollTop', {
    get: () => scrollTop,
    set: (v: number) => (scrollTop = v),
  });
  Object.defineProperty(host, 'clientHeight', { get: () => 600 });
  document.body.appendChild(host);
  win.attach(host);
  const scrollTo = (top: number) => {
    scrollTop = top;
    host.dispatchEvent(new Event('scroll'));
  };
  const render = () => TestBed.inject(ApplicationRef).tick();
  return { count, win, host, scrollTo, setScroll: (top: number) => (scrollTop = top), render };
}

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

describe('virtual window', () => {
  it('still renders rows when the list shrinks below the scroll position', () => {
    const { count, win, scrollTo } = setup();
    scrollTo(1990 * ROW);
    expect(win.range().end).toBe(2000);
    count.set(301);
    const { start, end } = win.range();
    expect(end).toBe(301);
    expect(start).toBeLessThan(301);
    // The rows that fill the viewport at the end of the list, plus the overscan.
    expect(end - start).toBeGreaterThanOrEqual(600 / ROW);
    expect(win.padTop() + (end - start) * ROW + win.padBottom()).toBe(301 * ROW);
  });

  it('reads the scroll position again when the row count changes', () => {
    const { count, win, scrollTo, setScroll, render } = setup();
    scrollTo(1990 * ROW);
    render();
    count.set(301);
    // The browser clamps the scroll position to the shorter list, with no scroll event.
    setScroll(301 * ROW - 600);
    render();
    // The list grows back before the next scroll: the window follows where the list really is.
    count.set(2000);
    expect(win.range().start).toBe((301 * ROW - 600) / ROW - 12);
  });
});
