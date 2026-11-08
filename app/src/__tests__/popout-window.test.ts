import { describe, expect, it, vi } from 'vitest';
import { popoutOpener, postToOpener, returnFromPopout } from '../shell-prefs';

/** A stand-in for a window, with the fields the helpers read. */
function fakeWindow(name: string, opener: unknown, referrer = '') {
  const win = { name, opener, document: { referrer } } as unknown as Window & {
    top: Window;
  };
  Object.defineProperty(win, 'top', { value: win });
  return win;
}

describe('the pop-out window', () => {
  it('knows the app page only in the window the popup opened', () => {
    const opener = { postMessage: vi.fn(), location: { origin: 'http://localhost:4200' } };
    expect(popoutOpener(fakeWindow('pangular-inspector-k3x9', opener))).toBe(opener);
    expect(popoutOpener(fakeWindow('other', opener))).toBeNull();
    expect(popoutOpener(fakeWindow('pangular-inspector-k3x9', null))).toBeNull();
  });

  it('asks the popup to take the panel back, on the app page origin', () => {
    const opener = { postMessage: vi.fn(), location: { origin: 'http://localhost:4200' } };
    expect(returnFromPopout(fakeWindow('pangular-inspector-k3x9', opener))).toBe(true);
    expect(opener.postMessage).toHaveBeenCalledWith(
      { type: 'pangular:popup-return' },
      'http://localhost:4200',
    );
  });

  it('falls back to the referrer when the app page is on another origin', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(opener, 'location', {
      get: () => {
        throw new Error('cross origin');
      },
    });
    const win = fakeWindow('pangular-inspector-k3x9', opener, 'http://app.test/trips');
    expect(returnFromPopout(win)).toBe(true);
    expect(opener.postMessage).toHaveBeenCalledWith(
      { type: 'pangular:popup-return' },
      'http://app.test',
    );
    expect(returnFromPopout(fakeWindow('pangular-inspector-k3x9', opener))).toBe(false);
  });

  it('sends a setting to the app page only from the window the popup opened', () => {
    const opener = { postMessage: vi.fn(), location: { origin: 'http://localhost:4200' } };
    const message = { type: 'pangular:popup-pill', pill: true };
    expect(postToOpener(message, fakeWindow('pangular-inspector-k3x9', opener))).toBe(true);
    expect(opener.postMessage).toHaveBeenCalledWith(message, 'http://localhost:4200');
    expect(postToOpener(message, fakeWindow('other', opener))).toBe(false);
    expect(opener.postMessage).toHaveBeenCalledTimes(1);
  });
});
