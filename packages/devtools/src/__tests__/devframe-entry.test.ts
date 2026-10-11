import { initDevframe as devframeInit } from 'devframe/initiate';
import { describe, expect, it } from 'vitest';
import { initDevframe } from '../devframe.ts';

describe('@pangular-inspector/devtools/devframe', () => {
  it('re-exports initDevframe from the devframe copy the package depends on', () => {
    expect(initDevframe).toBe(devframeInit);
  });
});
