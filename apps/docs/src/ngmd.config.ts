/**
 * NgMd site configuration.
 *
 * Edit this file to customise navigation, site metadata, and external links.
 * Sidebar, command palette, breadcrumb, and header all read from here.
 */

import type {BadgeVariant} from './types/badge.ts';

export interface NavItem {
  label: string;
  href: string;
  /** Optional lifecycle marker rendered as a coloured chip beside the
   * sidebar label. Accepts any value from the shared `BadgeVariant` set
   * (`new`, `updated`, `alpha`, `beta`, `stable`, `deprecated`), so the
   * sidebar chip and inline `<ngmd-badge>` always stay in sync. */
  status?: BadgeVariant;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Lifecycle marker for a documentation version. Drives the chip rendered
 * beside the version label in the switcher and the banner shown above
 * content when this deployment isn't the current stable release.
 *
 *   - `current`: the production stable. Most visitors should land here.
 *   - `next`: the upcoming release, served from a `next.*` subdomain.
 *   - `rc`: release candidate, served from an `rc.*` subdomain.
 *   - `deprecated`: older stable that's been superseded.
 */
export type VersionStatus = 'current' | 'next' | 'rc' | 'deprecated';

export interface VersionEntry {
  /** Switcher label, e.g. `v17`, `v18`, `next`. */
  label: string;
  /** External deployment URL. NgMd follows the adev / PrimeNG model of
   *  per-version subdomains (`v17.example.com`, `next.example.com`). The
   *  live deployment renders one version of the docs; other entries link
   *  out via `<a href target="_blank">`. */
  url: string;
  /** Lifecycle marker. */
  status: VersionStatus;
}

export interface VersionsConfig {
  /** Label of the entry that represents THIS deployment. The switcher
   *  marks it as the active row (no external link), and the content
   *  banner reads its status to decide whether to nudge visitors toward
   *  the current stable. */
  self: string;
  /** Ordered list rendered in the version switcher dropdown. Newest at
   *  the top is the convention adev and PrimeNG both follow. */
  list: VersionEntry[];
}

export interface SiteConfig {
  /** Brand name shown in the header next to the logo. */
  name: string;
  /** One-liner description used in meta tags + social previews. */
  description: string;
  /** Short tagline shown after the brand in the homepage `<title>`. */
  tagline?: string;
  /** Public origin (no trailing slash). Used by sitemap.xml + robots.txt. */
  url: string;
  /** Repository URL. Powers the GitHub icon in the header. */
  githubUrl: string;
  /** Default branch used to build GitHub blob/edit links (e.g. the
   *  "view source" link on API symbol pages). Defaults to `main` when
   *  omitted. Set this if the repo's default branch isn't `main`. */
  githubBranch?: string;
  /** Path from the repository root to this site, for sites inside a
   *  monorepo (e.g. `apps/docs`). Prefixes the file paths in GitHub edit and
   *  source links. Omit when the site is the repository root. */
  githubDir?: string;
  /** Optional community links. `discord` adds an icon to the header and a
   *  link to the footer; `sponsor` adds a "Sponsor" link to the footer. */
  links?: {
    twitter?: string;
    discord?: string;
    sponsor?: string;
  };
  /**
   * Optional Algolia DocSearch credentials. When all three are set, the
   * command palette queries Algolia instead of the bundled Orama index.
   * Requires `algoliasearch` as a runtime dep: `pnpm add algoliasearch`.
   * Leave undefined to keep the default local search.
   */
  algolia?: {
    appId: string;
    apiKey: string;
    indexName: string;
  };
}

export interface Sponsor {
  /** Display name, also used as the avatar's alt text. */
  name: string;
  /** GitHub login. Drives the avatar and the profile link. */
  login: string;
}

export interface NgmdConfig {
  site: SiteConfig;
  /** Links rendered in the header next to the brand, in order. Internal
   *  paths route in-app; `http(s)` URLs open in a new tab. Leave undefined
   *  for no header links. */
  headerNav?: NavItem[];
  /** Sponsors listed by `<app-sponsor-list>`. Leave undefined to render
   *  nothing. */
  sponsors?: Sponsor[];
  /** Sidebar sections, in render order. */
  nav: NavSection[];
  /**
   * Inline-link keywords. In any `.md` body, `*Keyword` resolves to a link
   * pointing at the configured URL. Unknown keywords log a warning and fall
   * back to literal `*Keyword` text. Change the URL here once, every doc
   * follows.
   */
  keywords?: Record<string, string>;
  /**
   * Documentation version registry. When set with more than one entry, the
   * version switcher renders in the header. Each entry is a separate
   * deployment (its own URL); the live site renders one version and the
   * switcher links out to the others — the adev / PrimeNG model, no in-repo
   * historical content. Leave undefined for single-version sites.
   */
  versions?: VersionsConfig;
}

const config: NgmdConfig = {
  site: {
    name: 'Angular DevTools',
    description:
      'Inspect Angular components, signals, dependency injection, routes, forms and stores. In the page, from the CLI, or through a coding agent over MCP.',
    tagline: 'Devtools for Angular apps and coding agents',
    url: 'https://santoshyadavdev.github.io/angular-devtools',
    githubUrl: 'https://github.com/santoshyadavdev/angular-devtools',
    githubDir: 'apps/docs',
    links: {
      discord: 'https://discord.gg/YRTyJd6Qx',
      sponsor: 'https://github.com/sponsors/santoshyadavdev',
    },
  },

  headerNav: [
    {label: 'Docs', href: '/getting-started/introduction'},
    {label: 'Inspectors', href: '/inspectors/dashboard'},
    {label: 'Agents', href: '/agents/mcp-server'},
  ],

  sponsors: [
    {name: 'CodeRabbit', login: 'coderabbitai'},
    {name: 'umairhm', login: 'umairhm'},
    {name: 'Sonichigo', login: 'Sonichigo'},
  ],

  keywords: {
    Angular: 'https://angular.dev',
    Analog: 'https://analogjs.org',
    Devframe: 'https://devfra.me',
    NgRx: 'https://ngrx.io',
    MCP: 'https://modelcontextprotocol.io',
    Vite: 'https://vite.dev',
  },

  nav: [
    {
      label: 'Getting Started',
      items: [
        {label: 'Introduction', href: '/getting-started/introduction'},
        {label: 'Installation', href: '/getting-started/installation'},
        {label: 'Angular CLI and Express', href: '/getting-started/express'},
        {label: 'Hono, h3 and Fastify', href: '/getting-started/other-servers', status: 'new'},
        {label: 'Vite and Analog', href: '/getting-started/vite'},
        {label: 'Standalone CLI', href: '/getting-started/cli'},
        {label: 'Configuration', href: '/getting-started/configuration', status: 'new'},
        {label: 'Popup and hub', href: '/getting-started/popup-and-hub', status: 'new'},
        {label: 'Browser overlay', href: '/getting-started/overlay', status: 'updated'},
        {label: 'Chrome extension', href: '/getting-started/chrome-extension'},
      ],
    },
    {
      label: 'Inspectors',
      items: [
        {label: 'Dashboard', href: '/inspectors/dashboard'},
        {label: 'Components', href: '/inspectors/components'},
        {label: 'Injectors', href: '/inspectors/injectors', status: 'updated'},
        {label: 'Signals', href: '/inspectors/signals'},
        {label: 'NgRx Store', href: '/inspectors/ngrx-store'},
        {label: 'Forms', href: '/inspectors/forms', status: 'new'},
        {label: 'Router', href: '/inspectors/router', status: 'new'},
        {label: 'Pipes', href: '/inspectors/pipes', status: 'new'},
        {label: 'SSR & HTTP', href: '/inspectors/ssr-http', status: 'new'},
        {label: 'Analog', href: '/inspectors/analog', status: 'new'},
      ],
    },
    {
      label: 'Agent Tools',
      items: [
        {label: 'MCP server', href: '/agents/mcp-server', status: 'updated'},
        {label: 'Tools', href: '/agents/tools'},
        {label: 'Resources', href: '/agents/resources'},
      ],
    },
    {
      label: 'Guides',
      items: [
        {label: 'Restore NgRx signal state', href: '/guides/ngrx-signals-restore'},
        {label: 'Set up SSR & HTTP', href: '/guides/ssr-http'},
        {label: 'Set up Analog', href: '/guides/analog'},
      ],
    },
    {
      label: 'Security',
      items: [{label: 'Access and redaction', href: '/security'}],
    },
    {
      label: 'Community',
      items: [
        {label: 'Get involved', href: '/community'},
        {label: 'Sponsors', href: '/sponsors'},
      ],
    },
    {
      label: 'Contributing',
      items: [
        {label: 'Development setup', href: '/contributing/development'},
        {label: 'Demo apps', href: '/contributing/demo-apps'},
        {label: 'Build the extension', href: '/contributing/chrome-extension'},
        {label: 'Publishing', href: '/contributing/publishing'},
        {label: 'Write documentation', href: '/contributing/writing-docs'},
        {label: 'Kitchen sink', href: '/contributing/kitchen-sink'},
      ],
    },
  ],
};

export default config;

/** Flattened list of all nav items, useful for command palette / search. */
export const navItems = config.nav.flatMap((section) =>
  section.items.map((item) => ({
    label: item.label,
    href: item.href,
    section: section.label,
  })),
);

/** Map of last URL segment to its human label, useful for breadcrumb. */
export const navLabels = Object.fromEntries(
  config.nav.flatMap((section) =>
    section.items.map((item) => [item.href.split('/').pop() ?? '', item.label]),
  ),
);
