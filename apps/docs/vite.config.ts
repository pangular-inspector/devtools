/// <reference types="vitest" />

import {defineConfig, type Plugin} from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getBuildExtensions} from './src/marked-extensions/index.ts';
import {pageMetaPlugin} from './page-meta.plugin.ts';
import {internalLinkGuard} from './link-guard.plugin.ts';
import {mdLinksPlugin} from './md-links.plugin.ts';
import {sitemapPlugin} from './sitemap.plugin.ts';
import {searchIndexPlugin} from './search-index.plugin.ts';
import {rawMdPlugin} from './raw-md.plugin.ts';
import {varsPlugin} from './vars.plugin.ts';
import {apiGenPlugin} from './api-gen.plugin.ts';
import {prerenderRoutes, withoutCode} from './plugin-utils.ts';
import config from './src/ngmd.config.ts';

/**
 * Build-time guard: errors when a markdown file in `src/content/` contains
 * a raw HTML `<a href="http(s)://...">` without `target="_blank"`. Raw HTML
 * anchors bypass the marked link renderer (which would add target=_blank
 * automatically), so this catches external links that would silently open
 * in the same tab.
 *
 * Lifted from the adev docs pipeline pattern.
 */
function externalLinkGuard(): Plugin {
  return {
    name: 'ngmd-external-link-guard',
    enforce: 'pre',
    transform(_code, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.md')) return null;
      const content = withoutCode(readFileSync(file, 'utf8'));
      const anchorRe = /<a\b[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/g;
      const matches = content.match(anchorRe) ?? [];
      for (const m of matches) {
        if (!/target=["']_blank["']/.test(m)) {
          this.error(
            `[ngmd] External anchor in ${file} is missing target="_blank":\n  ${m}\n` +
              `Add target="_blank" rel="noopener noreferrer" so external links open in a new tab.`,
          );
        }
      }
      return null;
    },
  };
}

function siteHtml(): Plugin {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const values: Record<string, string> = {
    '%SITE_NAME%': config.site.name,
    '%SITE_DESCRIPTION%': config.site.description,
    '%SITE_URL%': config.site.url.replace(/\/+$/, ''),
  };
  return {
    name: 'site-html',
    transformIndexHtml(html) {
      return Object.entries(values).reduce(
        (out, [token, value]) => out.replaceAll(token, escape(value)),
        html,
      );
    },
  };
}

// Nx runs the build from apps/docs, so Analog would write to apps/docs/dist.
// The site goes to <repo>/dist/apps/docs like the other projects.
const outDir = resolve(import.meta.dirname, '../../dist/apps/docs');

export default defineConfig(async () => ({
  build: {
    target: ['es2020'],
    outDir: resolve(outDir, 'client'),
  },
  resolve: {
    mainFields: ['module'],
  },
  plugins: [
    siteHtml(),
    varsPlugin(),
    externalLinkGuard(),
    internalLinkGuard(),
    mdLinksPlugin(),
    pageMetaPlugin({
      repoUrl: config.site.githubUrl,
      branch: config.site.githubBranch ?? 'main',
      dir: config.site.githubDir,
    }),
    sitemapPlugin({siteUrl: config.site.url}),
    rawMdPlugin(),
    searchIndexPlugin(),
    apiGenPlugin(),
    analog({
      // The intermediate SSR bundle is only used for prerendering. It imports
      // packages installed in apps/docs/node_modules, which Node cannot find
      // from <repo>/dist, so it stays under apps/docs.
      ssrBuildDir: resolve(import.meta.dirname, '.analog/ssr'),
      nitro: {
        buildDir: resolve(import.meta.dirname, '.analog/nitro'),
        output: {
          dir: resolve(outDir, 'analog'),
          publicDir: resolve(outDir, 'analog/public'),
        },
      },
      prerender: {
        routes: async () => prerenderRoutes(import.meta.dirname),
      },
      apiPrefix: '_server',
      content: {
        highlighter: 'shiki',
        markedOptions: {
          extensions: await getBuildExtensions(),
        },
        shikiOptions: {
          highlight: {
            themes: {light: 'github-light-default', dark: 'github-dark-default'},
            defaultColor: false,
          },
          highlighter: {
            additionalLangs: ['bash', 'md', 'json'],
          },
        },
      },
    }),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['**/*.spec.ts'],
    reporters: ['default'],
  },
}));
