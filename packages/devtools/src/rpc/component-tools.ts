import type { ComponentPage, DeferBlockInfo, LiveComponentNode } from '../types.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { untrusted } from './forms-tools.ts';
import { PAGE_TTL_MS, fixedTtl, type PageTtl } from './page-ttl.ts';
import { capped } from './router-tools.ts';

export const COMPONENT_PAGE_TTL = PAGE_TTL_MS;

export function isComponentReport(value: unknown): value is Omit<ComponentPage, 'reportedAt'> {
  const report = value as Partial<ComponentPage> | null;
  return (
    !!report &&
    typeof report === 'object' &&
    typeof report.pageId === 'string' &&
    report.pageId.length > 0 &&
    report.pageId.length < 50 &&
    Array.isArray(report.roots)
  );
}

export function toComponentPage(report: Omit<ComponentPage, 'reportedAt'>, now = Date.now()) {
  const page: ComponentPage = {
    pageId: report.pageId,
    roots: report.roots,
    count: typeof report.count === 'number' ? report.count : 0,
    detail: report.detail ?? null,
    reportedAt: now,
  };
  if (report.truncated) page.truncated = true;
  const cap = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
  const components = cap(report.truncatedBy?.components);
  const depth = cap(report.truncatedBy?.depth);
  if (report.truncated && (components || depth)) {
    page.truncatedBy = {
      ...(components ? { components } : {}),
      ...(depth ? { depth } : {}),
    };
  }
  if (typeof report.url === 'string') page.url = redactUrl(report.url.slice(0, 2000));
  if (typeof report.title === 'string') page.title = redactMessage(report.title.slice(0, 200));
  if (Array.isArray(report.deferBlocks)) page.deferBlocks = report.deferBlocks.slice(0, 500);
  if (report.platform === 'angular-native' || report.platform === 'nativescript') {
    page.platform = report.platform;
  }
  return page;
}

export function truncationText(pages: Iterable<ComponentPage>): string {
  const notes: string[] = [];
  for (const page of pages) {
    if (!page.truncated) continue;
    const by = page.truncatedBy ?? {};
    const caps = [
      ...(by.components ? [`the first ${by.components} component instances`] : []),
      ...(by.depth ? [`${by.depth} levels of DOM nesting`] : []),
    ];
    notes.push(
      `The tree of page \`${page.pageId}\` stops at ${caps.length ? caps.join(' and ') : 'its size limit'}, so instances past it are not listed or searchable.`,
    );
  }
  return notes.join(' ');
}

export function latestComponentPage(pages: Iterable<ComponentPage>): ComponentPage | undefined {
  let latest: ComponentPage | undefined;
  for (const page of pages) {
    if (!latest || page.reportedAt > latest.reportedAt) latest = page;
  }
  return latest;
}

export function expireComponentPages(
  pages: Map<string, ComponentPage>,
  now = Date.now(),
  ttl: PageTtl = fixedTtl(COMPONENT_PAGE_TTL),
) {
  let changed = false;
  for (const [id, page] of pages) {
    if (now - page.reportedAt > ttl(id)) {
      pages.delete(id);
      changed = true;
    }
  }
  return changed;
}

export function findComponents(pages: Iterable<ComponentPage>, query: string) {
  const needle = query.trim().toLowerCase();
  const hits: { pageId: string; node: LiveComponentNode }[] = [];
  const visit = (pageId: string, nodes: LiveComponentNode[]) => {
    for (const node of nodes) {
      if (
        node.id === query ||
        node.name.toLowerCase() === needle ||
        node.tag.toLowerCase() === needle
      ) {
        hits.push({ pageId, node });
      }
      visit(pageId, node.children);
    }
  };
  for (const page of pages) visit(page.pageId, page.roots);
  return hits;
}

export type ComponentHit = ReturnType<typeof findComponents>[number];

const LISTED_MATCHES = 20;

/** Names every instance a query matched, so an agent can pick another one by id. */
export function otherMatchesText(hits: ComponentHit[], query: string): string {
  if (hits.length < 2) return '';
  const pages = new Set(hits.map((hit) => hit.pageId)).size;
  const listed = hits
    .slice(0, LISTED_MATCHES)
    .map((hit) => `\`${hit.node.id}\`${pages > 1 ? ` (page \`${hit.pageId}\`)` : ''}`)
    .join(', ');
  const more = hits.length > LISTED_MATCHES ? `, and ${hits.length - LISTED_MATCHES} more` : '';
  return `${hits.length} instances match \`${query}\`: ${listed}${more}. This used the first one; pass an instance id to pick another.`;
}

export const STUCK_PLACEHOLDER_MS = 10_000;

/** Triggers that wait for the user, so a long wait on the placeholder is normal. */
const USER_TRIGGER = /^on (viewport|interaction|hover)\b/;

/**
 * Whether a block waits only for the user: every main trigger (not `prefetch`
 * or `hydrate`) is `on viewport`, `on interaction` or `on hover`.
 */
function waitsForUser(triggers: string[]): boolean {
  const main = triggers.filter((trigger) => !/^(prefetch|hydrate) /.test(trigger));
  return main.length > 0 && main.every((trigger) => USER_TRIGGER.test(trigger));
}

function deferNotes(block: DeferBlockInfo, now: number): string[] {
  const notes: string[] = [];
  const age = Math.max(0, Math.round((now - block.since) / 1000));
  if (block.state === 'error') notes.push('failed to load');
  if (
    (block.state === 'placeholder' || block.state === 'initial') &&
    age * 1000 >= STUCK_PLACEHOLDER_MS
  ) {
    notes.push(
      waitsForUser(block.triggers)
        ? `waiting for its trigger for ${age}s`
        : `on its placeholder for ${age}s`,
    );
  }
  if (block.hydrateNever) notes.push('hydrate never: the server HTML stays static');
  else if (block.hydration === 'dehydrated') notes.push('still dehydrated');
  return notes;
}

/** Table rows, and entries under "Needs attention", the defer-blocks tool lists per page. */
export const DEFER_ROWS = 50;

const PANEL = 'The Defer blocks list on the Components page of the panel has every block';

/**
 * Markdown answer for the defer-blocks agent tool, one section per page. Each
 * page lists at most {@link DEFER_ROWS} blocks, and the whole answer is cut
 * by {@link capped}.
 */
export function deferBlocksText(pages: ComponentPage[], now = Date.now()): string {
  if (!pages.length) {
    return 'No component tree has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.';
  }
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  const narrow = `${pages.length > 1 ? ' Pass `page` to read one tab.' : ''} ${PANEL}.`;
  const sections = pages.map((page) => {
    const title = `Page \`${page.pageId}\`${page.url ? ` (${page.url})` : ''}`;
    if (!page.deferBlocks) {
      return `${title}: this page's Angular exposes no defer block util (\`ng.ɵgetControlFlowBlocks\` or \`ng.ɵgetDeferBlocks\`). It needs a development build.`;
    }
    if (!page.deferBlocks.length) return `${title}: no \`@defer\` blocks are rendered.`;
    const attention: string[] = [];
    const rows = page.deferBlocks.map((block) => {
      const notes = deferNotes(block, now);
      const owner = block.owner ? `${block.owner.name} (\`${block.owner.id}\`)` : 'unknown';
      if (block.state === 'error' || notes.some((n) => n.startsWith('on its placeholder'))) {
        attention.push(
          `- \`${block.id}\` in ${owner}: ${notes.join(', ')}. Triggers: ${block.triggers.join(', ') || 'none'}${block.hasErrorBlock ? '' : '. It has no @error block'}.`,
        );
      }
      return `| \`${block.id}\` | ${cell(owner)} | ${block.state} | ${block.hydration} | ${cell(block.triggers.join(', ') || 'none')} | ${cell(notes.join(', '))} |`;
    });
    const more = (hidden: number, what: string) =>
      hidden > 0 ? ['', `${hidden} more ${what} not shown.${narrow}`] : [];
    const hiddenRows = rows.length - DEFER_ROWS;
    return [
      `${title}: ${page.deferBlocks.length} defer ${page.deferBlocks.length === 1 ? 'block' : 'blocks'}.`,
      '',
      '| Block | Owner | State | Hydration | Triggers | Notes |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows.slice(0, DEFER_ROWS),
      ...more(hiddenRows, hiddenRows === 1 ? 'block' : 'blocks'),
      ...(attention.length
        ? [
            '',
            'Needs attention:',
            '',
            ...attention.slice(0, DEFER_ROWS),
            ...more(attention.length - DEFER_ROWS, 'that need attention'),
          ]
        : []),
    ].join('\n');
  });
  return capped(
    untrusted(sections.join('\n\n')),
    pages.length > 1
      ? 'pass `page` to read one tab'
      : 'see the Defer blocks list on the Components page of the panel',
  );
}
