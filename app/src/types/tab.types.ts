export type Tab =
  | 'dashboard'
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
