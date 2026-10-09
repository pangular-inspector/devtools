import { addProfilerListener, keepaliveDue } from './change-detection.ts';
import { createCdRecorder, type CdRecording } from './cd-recorder.ts';
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

export interface CdReport extends CdRecording {
  pageId: string;
  /** False when the page has no profiler hook to record with (before Angular 20). */
  supported: boolean;
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
) {
  const recorder = createCdRecorder({ maxCycles });
  const hostIds = new WeakMap<object, string | null>();
  let removeListener: (() => void) | null = null;
  let supported = true;
  let lastJson = '';
  let sentAt = 0;

  const hostId = (instance: object) => {
    if (hostIds.has(instance)) return hostIds.get(instance)!;
    let id: string | null = null;
    try {
      const ng = getNg() as { getHostElement?: (instance: object) => unknown } | undefined;
      const host = ng?.getHostElement?.(instance);
      id = host instanceof Element ? elementId(host) : null;
    } catch {
      id = null;
    }
    hostIds.set(instance, id);
    return id;
  };

  const setRecording = (on: boolean) => {
    if (on) {
      removeListener ??= addProfilerListener(getNg(), recorder.onEvent);
      supported = removeListener !== null;
      if (supported) recorder.start();
      return;
    }
    recorder.stop();
    removeListener?.();
    removeListener = null;
  };

  const push = async (force = false) => {
    if (!force && !recorder.recording && !lastJson) return;
    const report: CdReport = { pageId, supported, ...recorder.snapshot(hostId) };
    const json = JSON.stringify(report);
    if (!force && json === lastJson) {
      if (!keepaliveDue(sentAt, tickMs())) return;
      sentAt = Date.now();
      const answer = (await my.rpc.call('ping-change-detection', pageId)) as
        { known?: boolean } | undefined;
      if (answer?.known !== false) return;
    }
    lastJson = json;
    sentAt = Date.now();
    await my.rpc.call('push-change-detection', report);
  };

  my.rpc.register({
    name: 'change-detection-record',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; on?: unknown; clear?: unknown } | null) => {
      if (typeof message?.pageId === 'string' && message.pageId !== pageId) return;
      if (typeof message?.on === 'boolean') setRecording(message.on);
      if (message?.clear === true) recorder.clear();
      void push(true).catch(() => {});
    },
  });

  return {
    push,
    get recording() {
      return recorder.recording;
    },
    leave: () => {
      lastJson = '';
      void my.rpc.call('forget-change-detection-page', pageId).catch(() => {});
    },
    stop: () => setRecording(false),
  };
}
