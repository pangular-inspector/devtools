import '@angular/compiler';
import { beforeEach } from 'vitest';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

// Selections and scroll positions the panel remembers would carry over from one test to the next.
beforeEach(() => {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('pangular-view:')) sessionStorage.removeItem(key);
    }
  } catch {
    // no storage in this environment
  }
});
