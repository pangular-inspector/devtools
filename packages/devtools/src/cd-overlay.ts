import {
  addProfilerListener,
  angularMajor,
  type Profiler,
  type ProfilerGate,
} from './change-detection.ts';
import { createCdDiagnosis } from './cd-diagnosis.ts';
import { createDeltaChannel } from './delta-channel.ts';
import { CHANGE_DETECTION_SHAPE } from './push-delta.ts';
import { toCdOptionsRequest } from './cd-data.ts';
import { createCdLive } from './cd-live.ts';
import { createCdRecorder, type CdReport } from './cd-recorder.ts';
import { elementId } from './element-id.ts';

interface RpcScope {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

export type { CdReport } from './cd-recorder.ts';

/**
 * What a platform without a DOM gives the recorder instead. The browser
 * defaults read the `ng-version` attribute, `[ng-version]` roots and host
 * elements, and draw the live views (flash boxes, the Performance track).
 */
export interface CdPlatform {
  /** The Angular major and whether the profiler slot is shared. */
  profilerGate: () => ProfilerGate;
  /** The app's root hosts, where the diagnosis finds Angular's scheduler. */
  roots: () => unknown[];
  /** The stable id of a component's host, or null when it is not a host of the tree. */
  hostId: (host: unknown) => string | null;
}

/**
 * Records change detection cycles while the panel or an agent turns recording
 * on, and reports them. It does nothing until then.
 */
export function attachChangeDetection(
  my: RpcScope,
  pageId: string,
  getNg: () => unknown,
  maxCycles: number,
  tickMs: () => number = () => 0,
  /** Whether a panel or an agent watches (`page-lease.ts`); an idle page only keeps itself alive. */
  active: () => boolean = () => true,
  /** Set on a platform without a DOM: no live views, and no DOM updates to tell wasted checks by. */
  platform?: CdPlatform,
) {
  const recorder = createCdRecorder({ maxCycles });
  const diagnosis = createCdDiagnosis({
    getNg,
    maxCycles,
    ...(platform ? { roots: platform.roots, doc: () => undefined } : {}),
  });
  // The diagnosis reads each event after the recorder, with the id it gave the cycle.
  const onEvent: Profiler = (event, instance, hook) => {
    recorder.onEvent(event, instance, hook);
    diagnosis.onEvent(event, instance, hook, recorder.cycleId);
  };
  const live = platform ? null : createCdLive({ getNg });
  const hostIds = new WeakMap<object, string>();
  let removeListener: (() => void) | null = null;
  let supported = true;
  // True once a report went out, so a stopped recording keeps being reported.
  let reported = false;
  const channel = createDeltaChannel({
    call: (name, ...args) => my.rpc.call(name, ...args),
    pageId,
    push: 'push-change-detection',
    ping: 'ping-change-detection',
    shape: CHANGE_DETECTION_SHAPE,
    tickMs,
  });

  const hostId = (instance: object) => {
    const known = hostIds.get(instance);
    if (known) return known;
    let id: string | null = null;
    try {
      const ng = getNg() as { getHostElement?: (instance: object) => unknown } | undefined;
      const host = ng?.getHostElement?.(instance);
      id = platform ? platform.hostId(host) : host instanceof Element ? elementId(host) : null;
    } catch {
      id = null;
    }
    // A host that cannot be read yet is tried again on the next snapshot.
    if (id) hostIds.set(instance, id);
    return id;
  };

  // Whether the panel or an agent asked to record. A start that could not
  // attach (Angular not started yet, `ɵsetProfiler` failed) is tried again on
  // each push while it is wanted.
  let wanted = false;
  const attach = () => {
    removeListener ??= addProfilerListener(
      getNg(),
      onEvent,
      platform ? platform.profilerGate() : document,
    );
    supported = removeListener !== null;
    // A second start, such as an agent start sent to every tab, keeps the
    // recording that is running. Only `clear` empties it.
    if (supported && !recorder.recording) {
      recorder.start();
      diagnosis.start();
    }
  };

  const setRecording = (on: boolean) => {
    wanted = on;
    if (on) {
      attach();
      return;
    }
    recorder.stop();
    diagnosis.stop();
    removeListener?.();
    removeListener = null;
  };

  const collect = (): Record<string, unknown> => {
    const options = live?.report();
    const recording = recorder.snapshot(hostId);
    const found = diagnosis.snapshot(platform ? platform.profilerGate().major : angularMajor());
    const report: CdReport = {
      pageId,
      supported,
      ...recording,
      cycles: recording.cycles.map((cycle) => ({ ...cycle, ...diagnosis.cycle(cycle.id) })),
      ...(found ? { diagnosis: found } : {}),
      ...(options ? { options } : {}),
    };
    return { ...report };
  };

  /** `wake`: sends what there is to send even on an idle page, as a panel or an agent just looked. */
  const push = async (force = false, wake = false) => {
    if (wanted && !removeListener) attach();
    // After leave() a stopped recording with cycles is still worth sending again.
    if (!force && !recorder.recording && !recorder.hasCycles && !reported) return;
    if (!force && !wake && !active()) {
      if (reported) await channel.keepalive(collect);
      return;
    }
    reported = true;
    await channel.send(collect(), force);
  };

  my.rpc.register({
    name: 'change-detection-record',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; on?: unknown; clear?: unknown } | null) => {
      if (typeof message?.pageId === 'string' && message.pageId !== pageId) return;
      if (typeof message?.on === 'boolean') setRecording(message.on);
      if (message?.clear === true) {
        recorder.clear();
        diagnosis.clear();
      }
      void push(true).catch(() => {});
    },
  });

  my.rpc.register({
    name: 'change-detection-options',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown } | null) => {
      if (typeof message?.pageId === 'string' && message.pageId !== pageId) return;
      // A platform without live views has nothing new to report.
      if (!live) return;
      live.apply(toCdOptionsRequest(message));
      void push(true).catch(() => {});
    },
  });

  return {
    push,
    get recording() {
      return recorder.recording;
    },
    leave: () => {
      reported = false;
      channel.resync();
      void my.rpc.call('forget-change-detection-page', pageId).catch(() => {});
    },
    stop: () => {
      setRecording(false);
      live?.stop();
    },
  };
}
