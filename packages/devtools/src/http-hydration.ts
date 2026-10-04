export const HYDRATION_CODE = /\bNG05\d\d\b/;

export interface HydrationMismatch {
  component: string;
  expected?: string;
  actual?: string;
}

export interface HydrationScan {
  hydrated: number;
  skipped: number;
  mismatched: number;
  mismatches: HydrationMismatch[];
}

const INFO_KEY = '__ngDebugHydrationInfo__';
const MAX_NODES = 50_000;
const MAX_MISMATCHES = 20;
const MAX_DETAIL = 500;

export function isHydrationMessage(text: string): boolean {
  return HYDRATION_CODE.test(text);
}

/** The APP_ID the server used, read from the `{appId}-state` TransferState script. */
export function appIdOf(doc: Document): string {
  const script = doc.querySelector('script[id$="-state"][type="application/json"]');
  return script?.id.replace(/-state$/, '') || 'ng';
}

export function hasStateScript(doc: Document): boolean {
  const script = doc.getElementById(`${appIdOf(doc)}-state`);
  return script?.tagName === 'SCRIPT';
}

const detail = (value: unknown) =>
  typeof value === 'string' && value ? value.slice(0, MAX_DETAIL) : undefined;

/** Counts the hydration status Angular patches on DOM nodes in dev mode. */
export function scanHydration(root: Node): HydrationScan {
  const scan: HydrationScan = { hydrated: 0, skipped: 0, mismatched: 0, mismatches: [] };
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ALL);
  let seen = 0;
  for (let node: Node | null = walker.currentNode; node && seen < MAX_NODES; seen++) {
    const info = (node as unknown as Record<string, unknown>)[INFO_KEY] as
      { status?: unknown; expectedNodeDetails?: unknown; actualNodeDetails?: unknown } | undefined;
    if (info && typeof info === 'object') {
      if (info.status === 'hydrated') scan.hydrated++;
      else if (info.status === 'skipped') scan.skipped++;
      else if (info.status === 'mismatched') {
        scan.mismatched++;
        if (scan.mismatches.length < MAX_MISMATCHES) {
          scan.mismatches.push({
            component: node.nodeName.toLowerCase(),
            expected: detail(info.expectedNodeDetails),
            actual: detail(info.actualNodeDetails),
          });
        }
      }
    }
    node = walker.nextNode();
  }
  return scan;
}
