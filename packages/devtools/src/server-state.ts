import { httpRegistry } from './http-rules.ts';
import { stopAnalog } from './rpc/analog-register.ts';

/**
 * Turns off the process-wide server capture (HTTP registry timers, SSR
 * recording, Analog log) that the hub context `owner` installed. A newer
 * server that took over keeps its own state.
 */
export function releaseServerState(owner: unknown) {
  const registry = httpRegistry();
  if (registry.owner === owner) registry.dispose?.();
  stopAnalog(owner);
}
