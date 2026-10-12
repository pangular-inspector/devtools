// The change detection views the panel or an agent turns on while the app
// runs: the flash overlay, the Performance panel track and Angular's own
// profiling.

import { createCdFlash } from './cd-flash.ts';
import { createCdPerfTrack } from './cd-perf-track.ts';
import type { CdOptionsRequest } from './cd-data.ts';
import type { CdOptions } from './config.ts';

export type { CdOptions, CdOptionsRequest };

interface NgProfiling {
  enableProfiling?: () => unknown;
}

export function createCdLive(options: {
  getNg: () => unknown;
  doc?: Document;
  win?: Window;
  now?: () => number;
  console?: Console;
}) {
  const flash = createCdFlash(options);
  const track = createCdPerfTrack(options);
  let angularProfiling = false;
  let touched = false;

  const profilingAvailable = () => {
    try {
      return typeof (options.getNg() as NgProfiling | undefined)?.enableProfiling === 'function';
    } catch {
      return false;
    }
  };

  const enableAngularProfiling = () => {
    if (angularProfiling) return;
    try {
      const enable = (options.getNg() as NgProfiling | undefined)?.enableProfiling;
      if (typeof enable !== 'function') return;
      enable();
      angularProfiling = true;
    } catch {
      angularProfiling = false;
    }
  };

  return {
    apply(request: CdOptionsRequest) {
      touched = true;
      if (request.flash !== undefined) flash.set(request.flash);
      if (request.track !== undefined) track.set(request.track);
      if (request.angularProfiling) enableAngularProfiling();
    },
    /** What the page reports, or undefined until the panel or an agent asked for a view. */
    report(): CdOptions | undefined {
      if (!touched) return undefined;
      return {
        flash: flash.on,
        track: track.on,
        angularProfiling,
        angularProfilingAvailable: angularProfiling || profilingAvailable(),
      };
    },
    /** Turns the flash overlay and the track off. Angular's profiling stays on. */
    stop() {
      flash.set(false);
      track.set(false);
    },
  };
}

export type CdLive = ReturnType<typeof createCdLive>;
