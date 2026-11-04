import type { DevframeNodeContext } from 'devframe/types';

const PANGULAR_STATE_PREFIX = 'pangular:';
const REMOTE_WRITE_REFUSAL =
  'Remote writes to Pangular Inspector shared state are not allowed; use the inspector RPC actions.';

/**
 * Keep remote clients from bypassing the validated report handlers by
 * replacing or patching Pangular-owned shared state directly.
 */
export function guardPangularSharedStateWrites(rpc: DevframeNodeContext['rpc']): void {
  const setDefinition = rpc.get('devframe:rpc:server-state:set');
  const setHandler = setDefinition?.handler;
  if (!setDefinition || !setHandler) {
    throw new Error('The devframe shared-state setter is unavailable.');
  }
  rpc.update({
    ...setDefinition,
    handler: async (key: string, value: unknown, syncId: string) => {
      rejectRemotePangularWrite(rpc, key);
      return setHandler(key, value, syncId);
    },
  });

  const patchDefinition = rpc.get('devframe:rpc:server-state:patch');
  const patchHandler = patchDefinition?.handler;
  if (!patchDefinition || !patchHandler) {
    throw new Error('The devframe shared-state patcher is unavailable.');
  }
  rpc.update({
    ...patchDefinition,
    handler: async (key: string, patches: unknown[], syncId: string) => {
      rejectRemotePangularWrite(rpc, key);
      return patchHandler(key, patches, syncId);
    },
  });
}

function rejectRemotePangularWrite(rpc: DevframeNodeContext['rpc'], key: string): void {
  if (key.startsWith(PANGULAR_STATE_PREFIX) && rpc.getCurrentRpcSession()) {
    throw new Error(REMOTE_WRITE_REFUSAL);
  }
}
