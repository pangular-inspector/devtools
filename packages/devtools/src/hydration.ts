// Hydration status of component hosts, read from what Angular records in
// development builds, and the regions the hydration overlay outlines.

import { hasStateScript } from './http-hydration.ts';
import { redactMessage } from './router.ts';
import type {
  DeferBlockInfo,
  ComponentHydrationMismatch,
  HydrationReport,
  HydrationStatus,
  LiveComponentNode,
} from './types.ts';

/** The `ng` utils that may read hydration info. Neither exists in Angular 22.1. */
export interface HydrationDebugNg {
  ɵgetHydrationInfo?(node: unknown): unknown;
  ɵreadHydrationInfo?(node: unknown): unknown;
}

/**
 * The property Angular's dev mode sets on each node hydration claims, skips or
 * finds mismatched (`HYDRATION_INFO_KEY` in `@angular/core`, Angular 17.1+):
 * `{ status: 'hydrated' | 'skipped' | 'mismatched', expectedNodeDetails?,
 * actualNodeDetails? }`.
 */
export const HYDRATION_INFO_KEY = '__ngDebugHydrationInfo__';

/** The attribute the server puts on the root element of a server-rendered app. */
const SERVER_CONTEXT_ATTRIBUTE = 'ng-server-context';

const MAX_MISMATCHES = 20;
const MAX_DETAIL_TEXT = 500;
/** The most regions the overlay outlines at once. */
export const MAX_HYDRATION_REGIONS = 300;

const STATUSES = new Set(['hydrated', 'skipped', 'mismatched']);

export interface HydrationInfo {
  status: Exclude<HydrationStatus, 'client'>;
  expected?: string;
  actual?: string;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function detailText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const text = redactMessage(value.trim());
  return text.length > MAX_DETAIL_TEXT ? `${text.slice(0, MAX_DETAIL_TEXT)}…` : text;
}

/**
 * The hydration info of a host: through an `ng` util when the page's Angular
 * publishes one, else the property Angular's dev mode sets on the node. Null
 * when the host has none (not hydrated, or a production build).
 */
export function readHydration(
  ng: HydrationDebugNg | undefined,
  host: object,
): HydrationInfo | null {
  const util = ng?.ɵgetHydrationInfo ?? ng?.ɵreadHydrationInfo;
  const raw = read(
    () =>
      typeof util === 'function'
        ? util.call(ng, host)
        : (host as Record<string, unknown>)[HYDRATION_INFO_KEY],
    null as unknown,
  );
  if (!raw || typeof raw !== 'object') return null;
  const info = raw as {
    status?: unknown;
    expectedNodeDetails?: unknown;
    actualNodeDetails?: unknown;
  };
  if (typeof info.status !== 'string' || !STATUSES.has(info.status)) return null;
  const out: HydrationInfo = { status: info.status as HydrationInfo['status'] };
  if (out.status === 'mismatched') {
    const expected = detailText(info.expectedNodeDetails);
    const actual = detailText(info.actualNodeDetails);
    if (expected) out.expected = expected;
    if (actual) out.actual = actual;
  }
  return out;
}

/**
 * Whether the document came from the server: its root carries
 * `ng-server-context`, or it has the TransferState script the server writes.
 */
export function hasServerContext(doc: Document | undefined): boolean {
  if (!doc) return false;
  return read(
    () => !!doc.querySelector(`[${SERVER_CONTEXT_ATTRIBUTE}]`) || hasStateScript(doc),
    false,
  );
}

/**
 * Tallies hydration while the component tree is walked. `add` reads one
 * component host, `finish` marks the hosts without info as `client` when the
 * page was server rendered, and returns the report, or `undefined` for a page
 * that was not.
 */
export function createHydrationTally(ng: HydrationDebugNg | undefined) {
  const counts = { hydrated: 0, skipped: 0, mismatched: 0, client: 0, dehydratedBlocks: 0 };
  const mismatches: ComponentHydrationMismatch[] = [];
  const unknown: LiveComponentNode[] = [];
  return {
    add(node: LiveComponentNode, host: object) {
      const info = readHydration(ng, host);
      if (!info) {
        unknown.push(node);
        return;
      }
      node.hydration = info.status;
      counts[info.status]++;
      if (info.status === 'mismatched' && mismatches.length < MAX_MISMATCHES) {
        mismatches.push({
          id: node.id,
          name: node.name,
          tag: node.tag,
          ...(info.expected ? { expected: info.expected } : {}),
          ...(info.actual ? { actual: info.actual } : {}),
        });
      }
    },
    finish(doc: Document | undefined): HydrationReport | undefined {
      const hydrated = counts.hydrated + counts.skipped + counts.mismatched > 0;
      if (!hydrated && !hasServerContext(doc)) return undefined;
      if (hydrated) {
        for (const node of unknown) node.hydration = 'client';
        counts.client = unknown.length;
      }
      return { hydrated, counts, mismatches };
    },
  };
}

/** Adds the `@defer` blocks still dehydrated, and whether the overlay is on, to a report. */
export function withDeferHydration(
  report: HydrationReport | undefined,
  deferBlocks: DeferBlockInfo[] | undefined,
  overlay: boolean,
): HydrationReport | undefined {
  if (!report) return undefined;
  const dehydratedBlocks = (deferBlocks ?? []).filter((b) => b.hydration === 'dehydrated').length;
  return {
    ...report,
    counts: { ...report.counts, dehydratedBlocks },
    ...(overlay ? { overlay: true } : {}),
  };
}

/** What the overlay outlines: hosts by status and `@defer` blocks still dehydrated. */
export type HydrationRegionKind = 'hydrated' | 'skipped' | 'mismatched' | 'dehydrated';

export interface HydrationRegion {
  kind: HydrationRegionKind;
  /** Element ids (from `element-id.ts`) whose boxes together make the region. */
  ids: string[];
  label: string;
}

/**
 * The regions of a page: each skipped or mismatched host, each hydrated host
 * whose nearest component ancestor is not hydrated (the top of a hydrated
 * region, so nested hosts don't stack boxes), and each dehydrated `@defer`
 * block by its root elements. At most {@link MAX_HYDRATION_REGIONS}.
 */
export function hydrationRegions(
  roots: LiveComponentNode[],
  deferBlocks: DeferBlockInfo[] | undefined,
): HydrationRegion[] {
  const out: HydrationRegion[] = [];
  const visit = (nodes: LiveComponentNode[], parent: HydrationStatus | undefined) => {
    for (const node of nodes) {
      if (out.length >= MAX_HYDRATION_REGIONS) return;
      let inherited = parent;
      if (node.kind !== 'directive' && node.hydration) {
        const status = node.hydration;
        if (
          status === 'skipped' ||
          status === 'mismatched' ||
          (status === 'hydrated' && parent !== 'hydrated')
        ) {
          out.push({ kind: status, ids: [node.id], label: node.name });
        }
        inherited = status;
      }
      visit(node.children, inherited);
    }
  };
  visit(roots, undefined);
  for (const block of deferBlocks ?? []) {
    if (out.length >= MAX_HYDRATION_REGIONS) break;
    if (block.hydration !== 'dehydrated' || !block.rootIds.length) continue;
    out.push({
      kind: 'dehydrated',
      ids: block.rootIds,
      label: `@defer${block.owner ? ` in ${block.owner.name}` : ''}`,
    });
  }
  return out;
}
