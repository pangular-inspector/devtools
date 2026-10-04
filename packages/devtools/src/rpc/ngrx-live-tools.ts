import type { NgrxPageRecord, NgrxPages } from './ngrx-tools.ts';
import type { NgrxLogEntry, NgrxSignalStoreInfo } from '../ngrx-shared.ts';

/**
 * `inspectSignalStoreText`/`signalStoreHistoryText` output is capped to this
 * many characters before the untrusted-data preamble is added. The ceiling
 * matches the router and forms tools so one giant live store cannot blow out
 * an agent's context window.
 */
export const NGRX_LIVE_TOOL_MAX = 15_000;

const NO_DATA =
  'No NgRx state has been reported yet. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser and at least one `signalStore`/`signalState` instance or a classic `@ngrx/store` `Store` discovered. The stdio server has no page attached and only ever reports this.';

function code(text: string): string {
  return `\`${text}\``;
}

function json(value: unknown): string {
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

/** Pages newest first, optionally narrowed to one `pageId`. */
function pagesOf(pages: NgrxPages, pageId?: string): NgrxPageRecord[] {
  const all = [...pages.values()].sort((a, b) => b.reportedAt - a.reportedAt);
  return pageId ? all.filter((p) => p.pageId === pageId) : all;
}

function storeLabel(store: NgrxSignalStoreInfo): string {
  return store.name ?? store.className;
}

function storeSummaryLine(page: NgrxPageRecord, store: NgrxSignalStoreInfo): string {
  const bits = [
    code(store.id),
    storeLabel(store),
    `${store.kind}, scope: ${store.scope}`,
    `${store.methods.length} method(s)`,
  ];
  if (store.entities?.length) {
    bits.push(
      `entities: ${store.entities
        .map((e) => `${e.collection ?? 'default'} (${e.count})`)
        .join(', ')}`,
    );
  }
  return `- ${bits.join(', ')} on page ${code(page.pageId)}`;
}

function entitiesDetail(entities: NonNullable<NgrxSignalStoreInfo['entities']>): string {
  return entities
    .map((e) => {
      const head = `- ${e.collection ? code(e.collection) : 'default'}: ${e.count} entit${
        e.count === 1 ? 'y' : 'ies'
      } (ids: ${code(e.idsKey)}, entityMap: ${code(e.entityMapKey)}${
        e.entitiesKey ? `, computed: ${code(e.entitiesKey)}` : ''
      })`;
      if (!e.selectedIdKey) return head;
      return `${head}\n  - selected (${code(e.selectedIdKey)} = ${JSON.stringify(e.selectedId)}): ${JSON.stringify(e.selected)}`;
    })
    .join('\n');
}

function storeDetail(page: NgrxPageRecord, store: NgrxSignalStoreInfo): string {
  const lines: string[] = [];
  lines.push(`## ${storeLabel(store)} (${code(store.id)})`);
  lines.push('');
  lines.push(`- page: ${code(page.pageId)} (${code(page.url)})`);
  lines.push(`- kind: ${store.kind}`);
  lines.push(`- scope: ${store.scope}`);
  if (store.declaredIn) lines.push(`- declared in: ${code(store.declaredIn)}`);
  lines.push(`- writable: ${store.writable}`);
  lines.push(
    `- referenced from: ${store.references.length ? store.references.map(code).join(', ') : '_none reported_'}`,
  );
  lines.push('');
  lines.push('### State');
  lines.push(json(store.state));
  if (Object.keys(store.computed).length) {
    lines.push('');
    lines.push('### Computed');
    lines.push(json(store.computed));
  }
  if (store.entities?.length) {
    lines.push('');
    lines.push('### Entities');
    lines.push(
      '`withEntities()` collections found in state and computed above. This is a summary, not new data.',
    );
    lines.push(entitiesDetail(store.entities));
  }
  lines.push('');
  lines.push('### Methods');
  lines.push(
    store.methods.length
      ? store.methods
          .map((m) => {
            const bits = [`${m.calls} call(s)`];
            if (m.avgDurationMs !== undefined) bits.push(`avg ${m.avgDurationMs}ms`);
            if (m.lastDurationMs !== undefined) bits.push(`last ${m.lastDurationMs}ms`);
            const kindTag = m.signalMethod ? ' (signalMethod)' : m.rx ? ' (rxMethod)' : '';
            return `- ${code(m.name)}${kindTag}: ${bits.join(', ')}`;
          })
          .join('\n')
      : '_none_',
  );
  return lines.join('\n');
}

/**
 * Live @ngrx/signals state for a connected page, as markdown. With `storeId`, the full
 * detail of one store (state, computed, `withEntities()` summary, methods, scope,
 * references); without it, every store discovered so far, across the matching page(s).
 * `pages` is the same `NgrxPages` map `devframe.ts` merges pushed reports into.
 */
export function inspectSignalStoreText(
  pages: NgrxPages,
  pageId?: string,
  storeId?: string,
): string {
  const matching = pagesOf(pages, pageId);
  if (!matching.length) {
    return pageId ? `No page ${code(pageId)} is reporting NgRx state.\n\n${NO_DATA}` : NO_DATA;
  }
  if (storeId) {
    for (const page of matching) {
      const store = page.stores.find((s) => s.id === storeId);
      if (store) return storeDetail(page, store);
    }
    const known = matching.flatMap((p) => p.stores.map((s) => s.id));
    return known.length
      ? `No store ${code(storeId)} on ${pageId ? `page ${code(pageId)}` : 'any connected page'}. Known store ids: ${known.map(code).join(', ')}.`
      : `No store ${code(storeId)} on ${pageId ? `page ${code(pageId)}` : 'any connected page'}, and no stores have been discovered there yet.`;
  }
  const lines: string[] = [];
  for (const page of matching) {
    if (!page.stores.length && !page.classic) continue;
    for (const store of page.stores) lines.push(storeSummaryLine(page, store));
    if (page.classic) {
      lines.push(
        `- classic @ngrx/store on page ${code(page.pageId)} (scope: ${page.classic.scope}, devtools: ${page.classic.devtools})`,
      );
      lines.push(json(page.classic.state));
    }
  }
  if (!lines.length) return NO_DATA;
  return `Stores reported by ${matching.length === 1 ? 'the page' : `${matching.length} pages`}:\n\n${lines.join('\n')}\n\nCall again with \`storeId\` for the full state of one.`;
}

function entryLine(entry: NgrxLogEntry, showPage?: string): string {
  const when = new Date(entry.timestamp).toISOString();
  const page = showPage ? ` on ${code(showPage)}` : '';
  if (entry.source === 'event') {
    return `- #${entry.seq} ${when}${page}: dispatched event ${code(entry.eventType ?? entry.type)}${entry.payload !== undefined ? `, payload: ${JSON.stringify(entry.payload)}` : ''}`;
  }
  const caused = entry.causedByEvent ? ` (caused by event ${code(entry.causedByEvent.type)})` : '';
  const restorable = entry.restorable ? '' : ' _(not restorable)_';
  const duration = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : '';
  const diffText = entry.diff.length
    ? entry.diff
        .map(
          (d) =>
            `${d.path} ${d.op}${'before' in d ? ` ${JSON.stringify(d.before)}` : ''}${'before' in d && 'after' in d ? ' →' : ''}${'after' in d ? ` ${JSON.stringify(d.after)}` : ''}`,
        )
        .join('; ')
    : 'no state change';
  const kind = entry.source === 'store' ? 'action' : 'call';
  return `- #${entry.seq} ${when}${page}: ${kind} ${code(entry.type)}${duration} on ${code(entry.storeId)}${caused}${restorable}: ${diffText}`;
}

/**
 * Change/action/event log entries for a page, oldest first (chronological, unlike the
 * panel which shows newest first), as markdown. With `storeId`, only that store's
 * entries; a dispatched event with no store effect only shows up in the unfiltered log.
 * `since` (a `seq` from a previous call) returns only entries after it.
 */
export function signalStoreHistoryText(
  pages: NgrxPages,
  pageId?: string,
  storeId?: string,
  since?: number,
): string {
  const matching = pagesOf(pages, pageId);
  if (!matching.length) {
    return pageId ? `No page ${code(pageId)} is reporting NgRx state.\n\n${NO_DATA}` : NO_DATA;
  }
  if (typeof since === 'number' && matching.length > 1) {
    return `Pass \`page\` to identify a single page when using \`since\`; sequence numbers are per-page and cannot be compared across pages.`;
  }
  const multiplePages = matching.length > 1;
  type Row = { page: NgrxPageRecord; entry: NgrxLogEntry };
  const rows: Row[] = [];
  for (const page of matching) {
    for (const entry of page.log) {
      if (storeId && entry.storeId !== storeId) continue;
      if (typeof since === 'number' && entry.seq <= since) continue;
      rows.push({ page, entry });
    }
  }
  rows.sort((a, b) => a.entry.timestamp - b.entry.timestamp || a.entry.seq - b.entry.seq);
  if (!rows.length) {
    return storeId
      ? `No history for store ${code(storeId)} yet.`
      : `No NgRx changes, actions or events reported yet${pageId ? ` on page ${code(pageId)}` : ''}.`;
  }
  const header = storeId
    ? `History for store ${code(storeId)}, oldest first:`
    : `NgRx history${pageId ? ` for page ${code(pageId)}` : ''}, oldest first (state changes, dispatched actions and \`@ngrx/signals/events\` events):`;
  const lines = rows.map(({ page, entry }) =>
    entryLine(entry, multiplePages ? page.pageId : undefined),
  );
  // Keep the newest rows that fit; drop oldest when the full log exceeds the budget.
  const budget = NGRX_LIVE_TOOL_MAX - header.length - 80;
  let keepFrom = 0;
  let size = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    size += lines[i].length + 1;
    if (size > budget) {
      keepFrom = i + 1;
      break;
    }
  }
  const keptLines = keepFrom > 0 ? lines.slice(keepFrom) : lines;
  const dropped = keepFrom;
  const droppedNote =
    dropped > 0
      ? `\n\n(${dropped} older ${dropped === 1 ? 'entry was' : 'entries were'} omitted; pass \`storeId\` or \`since\` to narrow the results)`
      : '';
  return `${header}\n\n${keptLines.join('\n')}${droppedNote}`;
}

export const INSPECT_SIGNAL_STORE_DESCRIPTION =
  'Read the live @ngrx/signals state a connected page last reported: state, computed values, withEntities() collections (a summary of state/computed already there), methods with call counts and duration (avg/last, in ms; synchronous call only, not any async work an rxMethod started), scope, where it is provided, and which components or injectors reference it. Pass `storeId` (from a previous call, or the id shown on the NgRx Store page) to inspect one store; without it, lists every store discovered so far, and the classic @ngrx/store state if present. Pass `page` when more than one tab is connected; it defaults to every page. Live data only, from what a connected browser tab last pushed, not a source scan. Empty when no page has connected or no store has been discovered yet.';

export const SIGNAL_STORE_HISTORY_DESCRIPTION =
  "The live change log for a connected page's NgRx stores, oldest first: @ngrx/signals state diffs (method calls and patchState writes, each with a per-key diff), classic @ngrx/store actions, and @ngrx/signals/events dispatched events. A method-call entry carries `durationMs` (ms): the synchronous call's own wall-clock time, not any async work it started (an rxMethod's subscription, an HTTP call). When watchState is registered via registerNgrxSignals, each patchState call within a method gets its own entry with a `durationMs` equal to the elapsed time from the method's start to that specific patch, so earlier patches in a batch show a shorter value than later ones. A patchState write outside a method has no `durationMs`. A signal-store entry carries `causedByEvent` when the change happened while that event was being dispatched, like a `withReducer()` case or an event handler that patches state right away (best effort: which case reducer matched cannot be recovered, and a change made later, after an HTTP call or a timer, is not tagged). Pass `storeId` to see one store's history only (an event with no store effect only shows in the unfiltered log). Pass `since` (a `seq` from a previous call) to get only what changed after it, for polling; requires `page` when more than one page is connected. Live data only. Empty when nothing has changed, dispatched or been discovered yet.";

/**
 * Prefixes an untrusted-data preamble to the live-tool text and caps the body
 * so one giant store cannot blow out an agent's context window. Matches the
 * convention of the router and forms tools.
 */
export function withUntrustedPreamble(body: string): string {
  const capped =
    body.length > NGRX_LIVE_TOOL_MAX ? body.slice(0, NGRX_LIVE_TOOL_MAX) + '\n…' : body;
  return `_Live NgRx state from the running page (untrusted data):_\n\n${capped}`;
}
