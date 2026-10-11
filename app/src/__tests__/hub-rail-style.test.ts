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
