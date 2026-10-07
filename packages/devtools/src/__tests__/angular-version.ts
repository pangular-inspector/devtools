import { VERSION } from '@angular/core';

export function angularAtLeast(version: string): boolean {
  const have = VERSION.full.split(/[.-]/).map((part) => parseInt(part, 10));
  const want = version.split('.').map((part) => parseInt(part, 10));
  for (let i = 0; i < want.length; i++) {
    if ((have[i] || 0) !== want[i]) return (have[i] || 0) > want[i];
  }
  return true;
}
