/**
 * Spaces out the router lookups that need a full DOM scan. A page with no
 * `[ng-version]` root makes the overlay walk every element to find Angular
 * hosts; when that finds nothing bootstrapped, the next scan waits 1, 2, 4 ...
 * up to `maxSkip` pushes instead of running on every push forever.
 */
export function createScanBackoff(maxSkip = 32) {
  let skip = 0;
  let wait = 0;
  return {
    /** True when a scan may run on this push. */
    due(): boolean {
      if (wait <= 0) return true;
      wait--;
      return false;
    },
    /** The scan found nothing: wait longer before the next one. */
    miss(): void {
      skip = Math.min(maxSkip, skip ? skip * 2 : 1);
      wait = skip;
    },
  };
}
