/**
 * A component whose signal graph the Signals tab should show, named by its id
 * in the Components tab. `pageId` names the page it belongs to; without it the
 * tab looks on the page it already shows. `key` is a property of the component
 * that holds a signal, whose node the tab selects once the graph arrives.
 */
export interface SignalFocus {
  componentId: string;
  pageId?: string;
  key?: string;
}
