/**
 * An element injector to select in the Injectors tab, named by the id its
 * component has in the Components tab. `pageId` names the page it belongs to;
 * without it the tab looks on the page it already shows.
 */
export interface InjectorFocus {
  componentId: string;
  pageId?: string;
}
