import type { Router } from '@angular/router';

export const PING_PONG_HOPS = 6;

const DETAILS = '/examples/routes/details';
const SUMMARY = '/examples/routes/summary';

/** Navigates back and forth between two lab routes from code, then stops. */
export async function pingPong(router: Router, hops = PING_PONG_HOPS): Promise<void> {
  const first = router.url === DETAILS ? SUMMARY : DETAILS;
  const second = first === DETAILS ? SUMMARY : DETAILS;
  for (let hop = 0; hop < hops; hop++) {
    await router.navigateByUrl(hop % 2 === 0 ? first : second);
  }
}
