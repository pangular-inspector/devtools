import type { ComponentDebugNg } from './component-tree.ts';
import { createComponentValues } from './component-values.ts';
import { elementById } from './element-id.ts';
import { documentTree, type HostTree } from './host-tree.ts';

interface ValuesRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    handler: (message: never) => unknown;
  }): void;
}

export interface ComponentValuesOptions<H extends object> {
  getNg: () => ComponentDebugNg<H> | undefined;
  tree?: HostTree<H>;
  /** Runs when the opened levels change, so the next push carries them. */
  changed?: () => void;
}

/**
 * Answers the server's `component-value` events for this page with one level
 * of a component value, and returns the levels to add to each detail push
 * (`collectComponentTree`'s `withDetail`). It only reads.
 */
export function registerComponentValues<H extends object = Element>(
  rpc: ValuesRpc,
  pageId: string,
  options: ComponentValuesOptions<H>,
) {
  const tree = options.tree ?? documentTree<H>();
  const connected = (host: object) => tree.isHost(host) && tree.connected(host);
  const values = createComponentValues<H>({
    getNg: options.getNg,
    find: (id) => elementById<H>(id, connected),
  });
  rpc.register({
    name: 'component-value',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; request?: unknown } | null) => {
      if (!message || typeof message.requestId !== 'string' || message.pageId !== pageId) return;
      let answer;
      try {
        answer = values.handle(message.request);
      } catch (error) {
        answer = { result: { error: String((error as Error)?.message ?? error) }, changed: false };
      }
      void rpc
        .call('component-value-result', {
          requestId: message.requestId,
          pageId,
          result: answer.result,
        })
        .catch(() => {});
      if (answer.changed) options.changed?.();
    },
  });
  return values.attach;
}
