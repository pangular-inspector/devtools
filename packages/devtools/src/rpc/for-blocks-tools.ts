import type { AngularPageInfo } from '../config.ts';
import type { ComponentPage, ForBlockInfo } from '../types.ts';
import { unsupportedToolText } from './angular-pages.ts';
import { untrusted } from './forms-tools.ts';
import { capped } from './router-tools.ts';

/** Table rows the for-blocks tool lists per page. */
export const FOR_ROWS = 50;

const PANEL = 'The @for blocks list on the Components page of the panel has every block';

const TRACK_TEXT: Record<NonNullable<ForBlockInfo['track']>, string> = {
  $index: '`$index`',
  item: 'the item itself',
  function: 'an expression',
};

function notes(block: ForBlockInfo): string {
  if (block.showingEmpty) return 'showing @empty';
  if (block.count === 0) return 'no items and no @empty block, so it renders nothing';
  return '';
}

/**
 * Markdown answer for the for-blocks agent tool, one section per page. Each
 * page lists at most {@link FOR_ROWS} blocks, and the whole answer is cut by
 * {@link capped}.
 */
export function forBlocksText(
  pages: ComponentPage[],
  angularOf: (pageId: string) => AngularPageInfo | undefined = () => undefined,
): string {
  if (!pages.length) {
    return 'No component tree has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.';
  }
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  const narrow = `${pages.length > 1 ? ' Pass `page` to read one tab.' : ''} ${PANEL}.`;
  const sections = pages.map((page) => {
    const title = `Page \`${page.pageId}\`${page.url ? ` (${page.url})` : ''}`;
    const blocks = page.forBlocks;
    if (!blocks) {
      const unsupported = unsupportedToolText(
        angularOf(page.pageId),
        'forBlocks',
        'Its `@for` blocks cannot be listed.',
      );
      if (unsupported) return `${title}: ${unsupported}`;
      return `${title}: this page's Angular has no \`ng.ɵgetControlFlowBlocks\`, which Angular 22.0 added for development builds, so its \`@for\` blocks cannot be listed. Update Angular or use a development build.`;
    }
    if (!blocks.length) return `${title}: no \`@for\` blocks are rendered.`;
    const rows = blocks.map((block) => {
      const owner = block.owner ? `${block.owner.name} (\`${block.owner.id}\`)` : 'unknown';
      const track = block.track ? TRACK_TEXT[block.track] : 'unknown';
      const empty = block.hasEmptyBlock ? (block.showingEmpty ? 'showing' : 'yes') : 'no';
      return `| \`${block.id}\` | ${cell(owner)} | ${block.count} | ${track} | ${empty} | ${notes(block)} |`;
    });
    const hidden = rows.length - FOR_ROWS;
    const total = page.forBlocksTruncated ? `${blocks.length} or more` : `${blocks.length}`;
    return [
      `${title}: ${total} \`@for\` ${blocks.length === 1 ? 'block' : 'blocks'}.`,
      ...(page.forBlocksTruncated
        ? ['', `The page has more \`@for\` blocks than the ${blocks.length} it reports.`]
        : []),
      '',
      '| Block | Owner | Items | Tracks by | @empty | Notes |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows.slice(0, FOR_ROWS),
      ...(hidden > 0
        ? ['', `${hidden} more ${hidden === 1 ? 'block' : 'blocks'} not shown.${narrow}`]
        : []),
    ].join('\n');
  });
  return capped(
    untrusted(sections.join('\n\n')),
    pages.length > 1
      ? 'pass `page` to read one tab'
      : 'see the @for blocks list on the Components page of the panel',
  );
}
