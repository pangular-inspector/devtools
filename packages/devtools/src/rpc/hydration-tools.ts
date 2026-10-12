import type { ComponentPage, HydrationReport, LiveComponentNode } from '../types.ts';
import { code, untrusted } from './forms-tools.ts';
import { capped } from './router-tools.ts';

/** Hosts the hydration tool names per status and page. */
export const HYDRATION_ROWS = 30;

export const HYDRATION_DESCRIPTION =
  'Hydration of each page that was rendered on the server, read live from what Angular records in development builds: how many component hosts were hydrated (server HTML reused), skipped (`ngSkipHydration`, rendered again on the client), mismatched (the DOM did not match the server HTML, with what Angular expected and found) or created on the client, and the `@defer` blocks still dehydrated (incremental hydration). Names the skipped and client-created hosts and the dehydrated blocks by instance id, at most 30 each. Says when a page was not rendered on the server, or has server HTML but no hydrated host (client hydration off, or a production build). Each open tab reports its own; `page` picks one and lists every tab without it. The answer stops at 20,000 characters.';

export const HYDRATION_OVERLAY_DESCRIPTION =
  ' `overlay: true` outlines the regions on the page for a person watching it: hydrated (solid), skipped (dashed), mismatched (double) and dehydrated `@defer` blocks (dotted), each labelled, with a legend; `overlay: false` removes it. The overlay draws in its own layer, ignores the pointer and changes nothing in the app.';

const NO_TREE =
  'No component tree has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.';

function hostsWith(
  roots: LiveComponentNode[],
  status: NonNullable<LiveComponentNode['hydration']>,
): LiveComponentNode[] {
  const out: LiveComponentNode[] = [];
  const visit = (nodes: LiveComponentNode[]) => {
    for (const node of nodes) {
      if (node.kind !== 'directive' && node.hydration === status) out.push(node);
      visit(node.children);
    }
  };
  visit(roots);
  return out;
}

function hostList(nodes: LiveComponentNode[]): string {
  const listed = nodes
    .slice(0, HYDRATION_ROWS)
    .map((node) => `${code(node.name)} ${code(`<${node.tag}>`)} ${code(node.id)}`)
    .join(', ');
  const more = nodes.length > HYDRATION_ROWS ? `, and ${nodes.length - HYDRATION_ROWS} more` : '';
  return `${listed}${more}`;
}

function pageSection(page: ComponentPage): string {
  const title = `Page ${code(page.pageId)}${page.url ? ` (${code(page.url)})` : ''}`;
  const report: HydrationReport | undefined = page.hydration;
  if (!report) {
    return `${title}: not rendered on the server, so nothing was hydrated. Hydration applies to an app with server-side rendering and \`provideClientHydration()\`.`;
  }
  if (!report.hydrated) {
    return `${title}: the HTML came from the server, but no component host was hydrated. Client hydration is off (add \`provideClientHydration()\`), or the page is a production build, which records no hydration info.`;
  }
  const { counts } = report;
  const lines = [
    `${title}: hydrated from server HTML.${report.overlay ? ' The hydration overlay is on.' : ''}`,
    '',
    '| Status | Component hosts |',
    '| --- | --- |',
    `| Hydrated | ${counts.hydrated} |`,
    `| Skipped (ngSkipHydration) | ${counts.skipped} |`,
    `| Mismatched | ${counts.mismatched} |`,
    `| Created on the client | ${counts.client} |`,
    '',
    `Dehydrated \`@defer\` blocks: ${counts.dehydratedBlocks}.`,
  ];
  const skipped = hostsWith(page.roots, 'skipped');
  if (skipped.length) {
    lines.push('', `Skipped: ${hostList(skipped)}. Their content renders again on the client.`);
  }
  if (report.mismatches.length) {
    lines.push('', 'Mismatched:');
    for (const mismatch of report.mismatches) {
      lines.push(
        `- ${code(mismatch.name)} ${code(`<${mismatch.tag}>`)} ${code(mismatch.id)}${mismatch.expected ? `: expected ${code(mismatch.expected)}` : ''}${mismatch.actual ? `, found ${code(mismatch.actual)}` : ''}`,
      );
    }
  }
  const client = hostsWith(page.roots, 'client');
  if (client.length) {
    lines.push(
      '',
      `Created on the client (after hydration, or inside a skipped host): ${hostList(client)}.`,
    );
  }
  const dehydrated = (page.deferBlocks ?? []).filter((block) => block.hydration === 'dehydrated');
  if (dehydrated.length) {
    const listed = dehydrated
      .slice(0, HYDRATION_ROWS)
      .map(
        (block) =>
          `${code(block.id)}${block.owner ? ` in ${code(block.owner.name)}` : ''} (${block.triggers.filter((t) => t.startsWith('hydrate ')).join(', ') || 'no hydrate trigger'})`,
      )
      .join(', ');
    const more =
      dehydrated.length > HYDRATION_ROWS ? `, and ${dehydrated.length - HYDRATION_ROWS} more` : '';
    lines.push('', `Dehydrated @defer blocks: ${listed}${more}.`);
  }
  return lines.join('\n');
}

/** Markdown answer of the hydration agent tool, one section per page. */
export function hydrationText(pages: ComponentPage[]): string {
  if (!pages.length) return NO_TREE;
  const body = pages.map(pageSection).join('\n\n');
  return capped(
    untrusted(body),
    pages.length > 1
      ? 'pass `page` to read one tab'
      : 'see the Hydration section on the Components page of the panel',
  );
}

/** What the overlay argument did, or why it could not. */
export function hydrationOverlayText(on: boolean, pages: ComponentPage[]): string {
  if (!on) return 'Sent the request to remove the hydration overlay.';
  const hydrated = pages.filter((page) => page.hydration);
  if (!hydrated.length) {
    return 'No page reports hydration, so there is nothing to outline. The overlay applies to a page rendered on the server.';
  }
  return `Sent the request to outline hydration on ${hydrated.length === 1 ? `page ${code(hydrated[0].pageId)}` : `${hydrated.length} pages`}. It stays until \`overlay: false\` or a reload.`;
}
