// Runs in the page context (not the content script sandbox).
// Detects whether Angular is present and posts the result back.

(function detectAngular() {
  function check() {
    const ngVersion = document.querySelector('[ng-version]')?.getAttribute('ng-version') ?? null;
    const hasNgGlobal = typeof window.ng !== 'undefined';

    if (ngVersion || hasNgGlobal) {
      window.postMessage(
        {
          type: '__PANGULAR_ANGULAR_DETECTED__',
          version: ngVersion,
        },
        '*',
      );
      return true;
    }
    return false;
  }

  // Check immediately, then retry a few times for lazy-loaded apps
  if (!check()) {
    let retries = 0;
    const interval = setInterval(() => {
      if (check() || ++retries > 10) clearInterval(interval);
    }, 500);
  }
})();
