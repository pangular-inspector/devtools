/**
 * What the overlay remembers between the events of one Router: the caller of
 * the next navigation, a redirect waiting for the navigation it starts, the
 * config generation and the count of calls that threw before a navigation
 * started. Each Router has its own, so on a page that runs several Angular
 * apps one app's caller or redirect is never pinned on another app's
 * navigation.
 */
export interface RouterTrack {
  caller: { text: string; at: number; sticky?: boolean } | null;
  redirect: { from: number; kind: string } | null;
  generation: number;
  failedCalls: number;
}

function freshTrack(): RouterTrack {
  return { caller: null, redirect: null, generation: 0, failedCalls: 0 };
}

// Keyed by the Router, so a router the app drops takes its state with it.
const tracks = new WeakMap<object, RouterTrack>();
// For calls that name no router, such as tests that fold events into a list.
const unowned = freshTrack();

/** The state of one Router; calls that name no router share one state. */
export function trackOf(router: object | null | undefined): RouterTrack {
  if (!router || typeof router !== 'object') return unowned;
  let track = tracks.get(router);
  if (!track) {
    track = freshTrack();
    tracks.set(router, track);
  }
  return track;
}
