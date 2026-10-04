import type { DevframeRpcClient } from 'devframe/client';
import {
  actionBlockedMessage,
  configFromConnection,
  type NgDevtoolsAction,
  type NgDevtoolsInspector,
  type ResolvedNgDevtoolsConfig,
} from '@pangular-inspector/devtools/config';
import type { Tab } from './types/tab.types';

export { actionBlockedMessage };

/** The config the server published in its connection info; everything is on without one. */
export function panelConfig(client: DevframeRpcClient | null): ResolvedNgDevtoolsConfig {
  return configFromConnection(client?.connectionMeta);
}

export function actionAllowed(client: DevframeRpcClient | null, action: NgDevtoolsAction): boolean {
  return panelConfig(client).actions[action];
}

const TAB_INSPECTOR: Partial<Record<Tab, NgDevtoolsInspector>> = {
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

export function tabEnabled(tab: Tab, config: ResolvedNgDevtoolsConfig): boolean {
  const inspector = TAB_INSPECTOR[tab];
  return !inspector || config.inspectors[inspector];
}
