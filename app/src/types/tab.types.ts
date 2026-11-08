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
  | 'queries'
  | 'forms'
  | 'network'
  | 'analog'
  | 'capacitor'
  | 'settings'
  | 'errors'
  | 'plugins'
  | 'performance'
  | 'build';

export type Tabs = {
  id: Tab;
  label: string;
};
