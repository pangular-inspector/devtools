export type Tab =
  | 'dashboard'
  | 'timeline'
  | 'audit'
  | 'components'
  | 'pipes'
  | 'routes'
  | 'signals'
  | 'injectors'
  | 'store'
  | 'forms'
  | 'network'
  | 'analog'
  | 'capacitor'
  | 'settings'
  | 'errors';

export type Tabs = {
  id: Tab;
  label: string;
};
