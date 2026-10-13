import type { AngularPageInfo } from '../config.ts';
import { unsupportedToolText } from './angular-pages.ts';
import { MAX_DEFER_BLOCKS } from '../defer-blocks.ts';
import { MAX_FOR_BLOCKS } from '../for-blocks.ts';
import type {
  ComponentPage,
  DeferBlockInfo,
  HydrationReport,
  LiveComponentNode,
} from '../types.ts';
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
  const directiveHosts = cap(report.truncatedBy?.directiveHosts);
  if (report.truncated && (components || depth || directiveHosts)) {
    page.truncatedBy = {
      ...(components ? { components } : {}),
      ...(depth ? { depth } : {}),
      ...(directiveHosts ? { directiveHosts } : {}),
    };
  }
  const hosts = cap(report.directiveHostCount);
  if (hosts) page.directiveHostCount = hosts;
  const hydration = toHydrationReport(report.hydration);
  if (hydration) page.hydration = hydration;
  if (typeof report.url === 'string') page.url = redactUrl(report.url.slice(0, 2000));
  if (typeof report.title === 'string') page.title = redactMessage(report.title.slice(0, 200));
  if (Array.isArray(report.deferBlocks)) {
    page.deferBlocks = report.deferBlocks.slice(0, MAX_DEFER_BLOCKS);
    if (report.deferTruncated === true || report.deferBlocks.length > MAX_DEFER_BLOCKS) {
      page.deferTruncated = true;
    }
  }
  if (Array.isArray(report.forBlocks)) {
    page.forBlocks = report.forBlocks.slice(0, MAX_FOR_BLOCKS);
    if (report.forBlocksTruncated || report.forBlocks.length > MAX_FOR_BLOCKS) {
      page.forBlocksTruncated = true;
    }
  }
  if (report.platform === 'angular-native' || report.platform === 'nativescript') {
    page.platform = report.platform;
  }
  return page;
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const text = (value: unknown, max: number) =>
  typeof value === 'string' && value ? redactMessage(value.slice(0, max)) : undefined;

/** A page's hydration report with only the fields and sizes the server keeps. */
export function toHydrationReport(value: unknown): HydrationReport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<HydrationReport>;
  const counts = (raw.counts ?? {}) as Partial<HydrationReport['counts']>;
  const mismatches = Array.isArray(raw.mismatches) ? raw.mismatches.slice(0, 20) : [];
  return {
    hydrated: raw.hydrated === true,
    counts: {
      hydrated: count(counts.hydrated),
      skipped: count(counts.skipped),
      mismatched: count(counts.mismatched),
      client: count(counts.client),
      dehydratedBlocks: count(counts.dehydratedBlocks),
    },
    mismatches: mismatches
      .filter((m) => m && typeof m.id === 'string')
      .map((m) => {
        const expected = text(m.expected, 600);
        const actual = text(m.actual, 600);
        return {
          id: m.id.slice(0, 50),
          name: String(m.name ?? '').slice(0, 200),
          tag: String(m.tag ?? '').slice(0, 200),
          ...(expected ? { expected } : {}),
          ...(actual ? { actual } : {}),
        };
      }),
    ...(raw.overlay === true ? { overlay: true } : {}),
  };
}

export function truncationText(pages: Iterable<ComponentPage>): string {
  const notes: string[] = [];
  for (const page of pages) {
    if (!page.truncated) continue;
    const by = page.truncatedBy ?? {};
    const caps = [
      ...(by.components ? [`the first ${by.components} component instances`] : []),
      ...(by.depth ? [`${by.depth} levels of DOM nesting`] : []),
      ...(by.directiveHosts ? [`the first ${by.directiveHosts} directive hosts`] : []),
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
      // A directive host is found by its id only: a class name or tag names a component.
      if (
        node.id === query ||
        (node.kind !== 'directive' &&
          (node.name.toLowerCase() === needle || node.tag.toLowerCase() === needle))
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

/** The inspect-component answer for an element that hosts directives but no component. */
export function directiveHostText(node: LiveComponentNode, pageId: string): string {
  const names = (node.directives ?? [node.name]).map((name) => `\`${name}\``).join(', ');
  const attributes = node.attributes?.length
    ? ` (${node.attributes.map((name) => `\`[${name}]\``).join(', ')})`
    : '';
  return `\`${node.id}\` on page \`${pageId}\` is a \`<${node.tag}>\` that hosts ${names}${attributes} but no component, so it has no component detail. Pass the id to pangular:highlight to show it. The inputs of those directives belong to the template of the component that renders the element.`;
}

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
export function deferBlocksText(
  pages: ComponentPage[],
  now = Date.now(),
  angularOf: (pageId: string) => AngularPageInfo | undefined = () => undefined,
): string {
  if (!pages.length) {
    return 'No component tree has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.';
  }
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  const narrow = `${pages.length > 1 ? ' Pass `page` to read one tab.' : ''} ${PANEL}.`;
  const sections = pages.map((page) => {
    const title = `Page \`${page.pageId}\`${page.url ? ` (${page.url})` : ''}`;
    if (!page.deferBlocks) {
      const unsupported = unsupportedToolText(angularOf(page.pageId), 'deferBlocks');
      if (unsupported) return `${title}: ${unsupported}`;
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
    const count = page.deferTruncated
      ? `more than ${MAX_DEFER_BLOCKS} defer blocks. Only the first ${MAX_DEFER_BLOCKS} are collected, so blocks past them are not listed or counted here.`
      : `${page.deferBlocks.length} defer ${page.deferBlocks.length === 1 ? 'block' : 'blocks'}.`;
    return [
      `${title}: ${count}`,
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
