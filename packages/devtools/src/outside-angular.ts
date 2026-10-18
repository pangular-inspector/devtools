/**
 * Scheduling for page-side code that the app's own calls reach: a signal
 * write, a `console.*` call, a router event, a store change, a form value
 * change or a plugin's `ctx.push`. Those calls usually run inside the Angular
 * zone, and a timer or microtask created there makes a zone.js app run change
 * detection again and keeps `NgZone.isStable` false until it fires. Every
 * collector schedules through these helpers instead of the bare globals.
 */

interface ZoneLike {
  root?: { run<T>(fn: () => T): T };
}

/**
 * Runs `fn` in the root zone when zone.js is loaded, so timers, microtasks and
 * promise callbacks created there don't make the app run change detection.
 * Without zone.js it just calls `fn`.
 */
export function outsideAngular<T>(fn: () => T): T {
  const root = (globalThis as { Zone?: ZoneLike }).Zone?.root;
  return root ? root.run(fn) : fn();
}

/** `setTimeout` in the root zone: the callback runs there too. */
export function setTimeoutOutside(fn: () => void, ms?: number): ReturnType<typeof setTimeout> {
  return outsideAngular(() => setTimeout(fn, ms));
}

/** `setInterval` in the root zone: each callback runs there too. */
export function setIntervalOutside(fn: () => void, ms?: number): ReturnType<typeof setInterval> {
  return outsideAngular(() => setInterval(fn, ms));
}

/** `queueMicrotask` in the root zone, so draining it doesn't make Angular tick. */
export function queueMicrotaskOutside(fn: () => void): void {
  outsideAngular(() => {
    if (typeof queueMicrotask === 'function') queueMicrotask(fn);
    else void Promise.resolve().then(fn);
  });
}

/** `requestAnimationFrame` in the root zone, with a 16 ms timer where there is none. */
export function nextFrameOutside(fn: () => void): void {
  outsideAngular(() => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fn());
    else setTimeout(fn, 16);
  });
}
