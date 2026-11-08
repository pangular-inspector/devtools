/**
 * A pipe to select in the Pipes tab, by name. `pageId` names the page whose
 * live data the tab shows; without it the tab shows the page the panel
 * belongs to.
 */
export interface PipeFocus {
  name: string;
  pageId?: string;
}
