// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { styleHubRail } from '../hub-rail-style';

function makeDock() {
  const shadow = document.createElement('devframes-dock-standalone');
  shadow.attachShadow({ mode: 'open' });
  document.body.append(shadow);
  return shadow;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('styleHubRail', () => {
  it('injects a style tag into the shadow root', () => {
    const dock = makeDock();
    styleHubRail(document, 'dark');
    expect(dock.shadowRoot!.querySelector('style[data-pangular]')).not.toBeNull();
  });

  it('does nothing when document is null', () => {
    expect(() => styleHubRail(null, 'dark')).not.toThrow();
  });

  it('sets dark iframe background for dark theme', () => {
    makeDock();
    styleHubRail(document, 'dark');
    const style = document
      .querySelector('devframes-dock-standalone')!
      .shadowRoot!.querySelector<HTMLStyleElement>('style[data-pangular]')!;
    expect(style.textContent).toContain('#0b0b0e');
  });

  it('sets light iframe background for light theme', () => {
    makeDock();
    styleHubRail(document, 'light');
    const style = document
      .querySelector('devframes-dock-standalone')!
      .shadowRoot!.querySelector<HTMLStyleElement>('style[data-pangular]')!;
    expect(style.textContent).toContain('#ffffff');
  });

  it('updates existing style tag when called again with a different theme', () => {
    makeDock();
    styleHubRail(document, 'dark');
    styleHubRail(document, 'light');
    const shadows = document.querySelectorAll('devframes-dock-standalone');
    const styleTags = [...shadows].flatMap((el) => [
      ...(el.shadowRoot?.querySelectorAll('style[data-pangular]') ?? []),
    ]);
    expect(styleTags).toHaveLength(1);
    expect(styleTags[0].textContent).toContain('#ffffff');
  });

  it('dims the icon of an inactive dock but not its badge, and darkens the badge palette', () => {
    makeDock();
    styleHubRail(document, 'dark');
    const css = document
      .querySelector('devframes-dock-standalone')!
      .shadowRoot!.querySelector<HTMLStyleElement>('style[data-pangular]')!.textContent!;
    expect(css).toContain('button:not(.scale-120) > :not(.absolute)');
    expect(css).not.toMatch(/button:not\(\.scale-120\) \{/);
    expect(css).toMatch(/\[style\*="59, 130, 246"\] \{\s*background-color: #2563eb !important;/);
    expect(css).toMatch(/\[style\*="239, 68, 68"\] \{\s*background-color: #dc2626 !important;/);
  });

  it('keeps group sidebar badges at full opacity and colours them from the dock title', () => {
    const dock = makeDock();
    const base = document.createElement('style');
    // hub-ui's own rules for the classes the group sidebar uses.
    base.textContent =
      '.op60 { opacity: 0.6; } .bg-gray-6 { background-color: rgb(75, 85, 99); } .text-white { color: rgb(255, 255, 255); }';
    const sidebar = document.createElement('div');
    sidebar.className = 'devframes-group-sidebar';
    const button = (label: string) =>
      `<button aria-label="${label}" class="relative op60"><svg></svg><div class="absolute bg-gray-6 text-white">1</div></button>`;
    sidebar.innerHTML = [
      button('Angular (1 new, with errors)'),
      button('NgRx (2 new, with warnings)'),
      button('Analog (3 new)'),
      button('Show more'),
    ].join('');
    dock.shadowRoot!.append(base, sidebar);
    styleHubRail(document, 'light');

    const buttons = [...sidebar.querySelectorAll('button')];
    const style = (el: Element) => getComputedStyle(el);
    expect(buttons.map((b) => style(b).opacity)).toEqual(['1', '1', '1', '1']);
    expect(buttons.map((b) => style(b.querySelector('svg')!).opacity)).toEqual([
      '0.6',
      '0.6',
      '0.6',
      '0.6',
    ]);
    expect(buttons.map((b) => style(b.querySelector('.absolute')!).backgroundColor)).toEqual([
      'rgb(220, 38, 38)',
      'rgb(220, 38, 38)',
      'rgb(37, 99, 235)',
      'rgb(75, 85, 99)',
    ]);
    expect(style(buttons[0].querySelector('.absolute')!).color).toBe('rgb(255, 255, 255)');
  });

  it('retries when the shadow host is not yet in the DOM', () => {
    vi.useFakeTimers();
    styleHubRail(document, 'dark');
    expect(document.querySelector('devframes-dock-standalone')).toBeNull();

    const dock = makeDock();
    vi.advanceTimersByTime(100);
    expect(dock.shadowRoot!.querySelector('style[data-pangular]')).not.toBeNull();
  });

  it('deduplicates retry timers for the same document', () => {
    vi.useFakeTimers();
    styleHubRail(document, 'dark');
    styleHubRail(document, 'light');
    const dock = makeDock();
    vi.advanceTimersByTime(100);
    const styles = dock.shadowRoot!.querySelectorAll('style[data-pangular]');
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain('#ffffff');
  });
});
