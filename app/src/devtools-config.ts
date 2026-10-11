import type { DevframeRpcClient } from 'devframe/client';
import {
  actionBlockedMessage,
  configFromConnection,
  type PangularAction,
  type PangularInspector,
  type ResolvedPangularConfig,
} from '@pangular-inspector/devtools/config';
import type { Tab } from './types/tab.types';

export { actionBlockedMessage };

/** The config the server published in its connection info; everything is on without one. */
export function panelConfig(client: DevframeRpcClient | null): ResolvedPangularConfig {
  return configFromConnection(client?.connectionMeta);
}

export function actionAllowed(client: DevframeRpcClient | null, action: PangularAction): boolean {
  return panelConfig(client).actions[action];
}

const TAB_INSPECTOR: Partial<Record<Tab, PangularInspector>> = {
  components: 'components',
  routes: 'router',
  signals: 'signals',
  injectors: 'injectors',
  store: 'ngrx',
  forms: 'forms',
  pipes: 'pipes',
  network: 'http',
  analog: 'analog',
};

export function tabEnabled(tab: Tab, config: ResolvedPangularConfig): boolean {
  const inspector = TAB_INSPECTOR[tab];
  return !inspector || config.inspectors[inspector];
}
