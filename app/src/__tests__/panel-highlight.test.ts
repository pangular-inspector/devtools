import type { DevframeRpcClient } from 'devframe/client';
import { describe, expect, it, vi } from 'vitest';
import { clearHighlightsOnHide } from '../rpc';

function fakeClient() {
  const callEvent = vi.fn(() => Promise.resolve());
  const client = { scope: () => ({ rpc: { callEvent } }) } as unknown as DevframeRpcClient;
  return { client, callEvent };
}

describe('panel highlights', () => {
  it('clears the page and form highlights when the panel page hides', () => {
    const { client, callEvent } = fakeClient();
    const stop = clearHighlightsOnHide(() => client);
    expect(callEvent).not.toHaveBeenCalled();

    dispatchEvent(new Event('pagehide'));
    expect(callEvent.mock.calls).toEqual([
      ['request-page-highlight', null],
      ['request-form-highlight', null],
    ]);

    callEvent.mockClear();
    stop();
    expect(callEvent).toHaveBeenCalledTimes(2);
    callEvent.mockClear();
    dispatchEvent(new Event('pagehide'));
    expect(callEvent).not.toHaveBeenCalled();
  });

  it('does nothing before the panel connects', () => {
    const stop = clearHighlightsOnHide(() => null);
    expect(() => dispatchEvent(new Event('pagehide'))).not.toThrow();
    stop();
  });
});
