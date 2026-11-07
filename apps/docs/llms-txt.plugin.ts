import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Plugin} from 'vite';
import type {NgmdConfig} from './src/ngmd.config.ts';
import {isNoIndex, parseFrontmatter, walkContentFiles} from './plugin-utils.ts';
import {substituteMdVars} from './vars.plugin.ts';

/**
 * Emits `/llms.txt` and `/llms-full.txt` (https://llmstxt.org) next to the
 * raw `.md` routes that `rawMdPlugin` serves.
 *
 *   /llms.txt       the site name and summary, then one link per page, in
 *                   sidebar order, to its `.md` route with its description.
 *                   Content pages missing from the sidebar go under Optional.
 *   /llms-full.txt  the same pages' markdown, frontmatter dropped, one after
 *                   the other, each under a heading with its URL.
 *
 * `noIndex` pages are left out of both. The dev server answers the same two
 * paths from `src/content` on each request.
 */

interface LlmsPage {
  route: string;
  title: string;
  description: string;
  body: string;
}

function readPages(root: string): Map<string, LlmsPage> {
  const contentDir = join(root, 'src/content');
  const pages = new Map<string, LlmsPage>();
  if (!existsSync(contentDir)) return pages;
  for (const [rel, route] of walkContentFiles(contentDir, root)) {
    const {attributes, body} = parseFrontmatter(
      substituteMdVars(readFileSync(join(root, rel), 'utf8'), root),
    );
    if (isNoIndex(attributes)) continue;
    pages.set(route, {
      route,
      title: String(attributes['title'] ?? route),
      description: String(attributes['description'] ?? ''),
      body: body.trim(),
    });
  }
  return pages;
}

/** The pages in sidebar order, grouped by section, then the rest under Optional. */
function orderedSections(
  pages: Map<string, LlmsPage>,
  config: NgmdConfig,
): Array<[string, LlmsPage[]]> {
  const used = new Set<string>();
  const sections: Array<[string, LlmsPage[]]> = [];
  for (const section of config.nav) {
    const items: LlmsPage[] = [];
    for (const item of section.items) {
      const page = pages.get(item.href);
      if (!page || used.has(item.href)) continue;
      used.add(item.href);
      items.push(page);
    }
    if (items.length) sections.push([section.label, items]);
  }
  const rest = [...pages.values()]
    .filter((page) => !used.has(page.route))
    .sort((a, b) => a.route.localeCompare(b.route));
  if (rest.length) sections.push(['Optional', rest]);
  return sections;
}

export function buildLlmsTxt(root: string, config: NgmdConfig): {index: string; full: string} {
  const site = config.site.url.replace(/\/+$/, '');
  const sections = orderedSections(readPages(root), config);
  const mdUrl = (route: string) => `${site}${route === '/' ? '/index' : route}.md`;

  const index = [
    `# ${config.site.name}`,
    '',
    `> ${config.site.description}`,
    '',
    `Each link below is the page's markdown source. The whole site in one file is ${site}/llms-full.txt.`,
    '',
    ...sections.flatMap(([label, items]) => [
      `## ${label}`,
      '',
      ...items.map(
        (page) =>
          `- [${page.title}](${mdUrl(page.route)})${page.description ? `: ${page.description}` : ''}`,
      ),
      '',
    ]),
  ].join('\n');

  const full = [
    `# ${config.site.name}`,
    '',
    `> ${config.site.description}`,
    '',
    ...sections.flatMap(([, items]) =>
      items.flatMap((page) => [`<!-- ${site}${page.route} -->`, '', page.body, '']),
    ),
  ].join('\n');

  return {index, full};
}

export function llmsTxtPlugin(config: NgmdConfig): Plugin {
  let root = process.cwd();
  return {
    name: 'ngmd-llms-txt',
    configResolved(cfg) {
      root = cfg.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== '/llms.txt' && path !== '/llms-full.txt') return next();
        try {
          const {index, full} = buildLlmsTxt(root, config);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(path === '/llms.txt' ? index : full);
        } catch (err) {
          next(err);
        }
      });
    },
    generateBundle() {
      const {index, full} = buildLlmsTxt(root, config);
      this.emitFile({type: 'asset', fileName: 'llms.txt', source: index});
      this.emitFile({type: 'asset', fileName: 'llms-full.txt', source: full});
    },
  };
}
