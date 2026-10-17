import type { ComponentDebugNg } from './component-tree.ts';
import { actionBlockedMessage } from './config.ts';
import { elementById } from './element-id.ts';
import { documentTree, type HostTree } from './host-tree.ts';
import { className } from './injector-tree.ts';
import { serializeNamed } from './serialize.ts';
import type { RawEntryLookup } from './signal-history.ts';
import { boundField } from './signal-locator.ts';

/**
 * Writes a past value from a signal's history back to the signal, asked for
 * from the panel's Restore button. The value is the one the page kept when
 * it recorded the entry, never the serialized copy the panel shows, so
 * values cut by the size limits or masked by the redaction come back whole.
 * It never leaves the page. The write is the `.set()` that `set-signal` uses,
 * behind the same `actions.components` gate.
 */

export interface SignalRestoreRequest {
  /** The component instance id from the node's `locator`. */
  component: string;
  /** The graph node id. */
  node: string;
  /** The `epoch` of the history entry to restore. */
  epoch: number;
}

export type SignalRestoreResult =
  | {
      ok: true;
      component: string;
      key: string;
      epoch: number;
      /** The value now in the app, serialized and redacted like the history. */
      value: unknown;
    }
  | { ok?: false; error: string };

export interface RawHistory {
  rawEntry(id: string, epoch: number): RawEntryLookup;
}

const RESULT_LIMITS = { depth: 3, keys: 30, items: 30, text: 300 };

const fail = (error: string): SignalRestoreResult => ({ error });

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function toRestoreRequest(value: unknown): SignalRestoreRequest | null {
  const r = (value ?? {}) as Record<string, unknown>;
  const { component, node, epoch } = r;
  if (typeof component !== 'string' || !component || component.length > 100) return null;
  if (typeof node !== 'string' || !node || node.length > 100) return null;
  if (typeof epoch !== 'number' || !Number.isInteger(epoch) || epoch < 0) return null;
  return { component, node, epoch };
}

export function restoreSignalEntry<H extends object>(
  ng: ComponentDebugNg<H> | undefined,
  request: unknown,
  history: RawHistory,
  find: (id: string) => H | null,
): SignalRestoreResult {
  if (!ng?.getComponent) return fail('Angular debug APIs are not available on this page.');
  const wanted = toRestoreRequest(request);
  if (!wanted) return fail('Pass the component id, the signal node id and the entry epoch.');
  const host = find(wanted.component);
  const instance = host ? read(() => ng.getComponent?.(host) ?? null, null) : null;
  if (!instance || typeof instance !== 'object') {
    return fail('The component is no longer on the page, so nothing was restored.');
  }
  const component = className((instance as { constructor: new () => unknown }).constructor);
  const field = boundField(ng, instance, wanted.node);
  if (!field) {
    return fail(
      `This signal is not a writable field of ${component} the page could match, so it cannot be restored.`,
    );
  }
  const entry = history.rawEntry(wanted.node, wanted.epoch);
  if (!entry.found) {
    return fail(
      entry.reason === 'gone'
        ? `Epoch ${wanted.epoch} is no longer in the page's history of \`${field.key}\`. The page keeps the last 50 entries, and a reload starts over.`
        : `The page did not keep the value of epoch ${wanted.epoch}, so it cannot be restored exactly.`,
    );
  }
  if (!entry.intact) {
    return fail(
      `The value of epoch ${wanted.epoch} was changed in place after it was recorded, so restoring it would not bring back what the history shows.`,
    );
  }
  try {
    field.signal.set(entry.value);
  } catch (error) {
    return fail(`Setting \`${field.key}\` threw: ${String((error as Error)?.message ?? error)}`);
  }
  const now = read(() => (field.signal as unknown as () => unknown)(), entry.value);
  return {
    ok: true,
    component,
    key: field.key,
    epoch: wanted.epoch,
    value: serializeNamed(field.key, now, RESULT_LIMITS),
  };
}

interface RestoreRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    handler: (message: never) => unknown;
  }): void;
}

export interface SignalRestoreOptions<H extends object> {
  getNg: () => ComponentDebugNg<H> | undefined;
  history: RawHistory;
  /** `actions.components` from the config the server published. */
  allowed: boolean;
  tree?: HostTree<H>;
  /** Runs after a restore, so the next push carries the new value. */
  restored?: () => void;
}

/**
 * Answers the server's `signal-restore` events for this page with a
 * `signal-restore-result`. The server checks the action gate first; the page
 * checks it again.
 */
export function registerSignalRestore<H extends object = Element>(
  rpc: RestoreRpc,
  pageId: string,
  options: SignalRestoreOptions<H>,
): void {
  const tree = options.tree ?? documentTree<H>();
  const connected = (host: object) => tree.isHost(host) && tree.connected(host);
  rpc.register({
    name: 'signal-restore',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; request?: unknown } | null) => {
      if (!message || typeof message.requestId !== 'string' || message.pageId !== pageId) return;
      let result: SignalRestoreResult;
      if (!options.allowed) {
        result = fail(actionBlockedMessage('components'));
      } else {
        try {
          result = restoreSignalEntry(options.getNg(), message.request, options.history, (id) =>
            elementById<H>(id, connected),
          );
        } catch (error) {
          result = fail(String((error as Error)?.message ?? error));
        }
      }
      void rpc
        .call('signal-restore-result', { requestId: message.requestId, pageId, result })
        .catch(() => {});
      if (result.ok) options.restored?.();
    },
  });
}
