import { editComponent, type ComponentEditRequest, type EditDebugNg } from './component-edit.ts';
import { actionBlockedMessage } from './config.ts';
import { elementById } from './element-id.ts';
import { documentTree, type HostTree } from './host-tree.ts';

interface EditRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    handler: (message: never) => unknown;
  }): void;
}

export interface ComponentEditOptions<H extends object> {
  getNg: () => EditDebugNg<H> | undefined;
  /** `actions.components` from the config the server published. */
  allowed: boolean;
  tree?: HostTree<H>;
  /** Runs after a write, so the next push carries the new value. */
  edited?: () => void;
}

/**
 * Answers the server's `component-edit` events for this page. The server
 * checks the action gate first; the page checks it again, so a server
 * started with writes off never gets one through.
 */
export function registerComponentEdit<H extends object = Element>(
  rpc: EditRpc,
  pageId: string,
  options: ComponentEditOptions<H>,
): void {
  const tree = options.tree ?? documentTree<H>();
  const connected = (host: object) => tree.isHost(host) && tree.connected(host);
  rpc.register({
    name: 'component-edit',
    type: 'event',
    jsonSerializable: true,
    handler: (
      message: { requestId?: unknown; pageId?: unknown; request?: ComponentEditRequest } | null,
    ) => {
      if (!message || typeof message.requestId !== 'string' || message.pageId !== pageId) return;
      let result;
      if (!options.allowed) {
        result = { error: actionBlockedMessage('components') };
      } else {
        try {
          result = editComponent(options.getNg(), message.request as ComponentEditRequest, (id) =>
            elementById<H>(id, connected),
          );
        } catch (error) {
          result = { error: String((error as Error)?.message ?? error) };
        }
      }
      void rpc
        .call('component-edit-result', { requestId: message.requestId, pageId, result })
        .catch(() => {});
      if ('ok' in result && result.ok) options.edited?.();
    },
  });
}
