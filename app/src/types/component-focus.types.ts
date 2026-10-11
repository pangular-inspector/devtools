/**
 * A component to select in the Components tab. `pageId` names the page the
 * component belongs to; without it the tab looks on the page it already shows.
 */
export interface ComponentFocus {
  id: string;
  pageId?: string;
}
