import { describe, expect, it } from 'vitest';
import { toComponentPage } from '../rpc/component-tools.ts';
import { PAGE_TTL_MS } from '../rpc/page-ttl.ts';
import { listPagesText, pageDetails, summarizePages } from '../rpc/pages.ts';

const report = { pageId: 'ab12', roots: [], count: 0, detail: null };

describe('page platform', () => {
  it('keeps the Angular Native platform of a component report', () => {
    expect(toComponentPage({ ...report, platform: 'angular-native' }, 1).platform).toBe(
      'angular-native',
    );
  });

  it('leaves a browser page, or an unknown platform, without one', () => {
    expect(toComponentPage(report, 1)).not.toHaveProperty('platform');
    expect(toComponentPage({ ...report, platform: 'flutter' as never }, 1)).not.toHaveProperty(
      'platform',
    );
  });

  it('lists the platform of each page for agents', () => {
    const pages = summarizePages({
      components: [
        { pageId: 'ab12', reportedAt: 2000, url: '/', platform: 'angular-native' },
        { pageId: 'cd34', reportedAt: 1000, url: '/trips' },
      ],
      signals: [{ pageId: 'ab12', reportedAt: 2500 }],
    });
    expect(pages.map((page) => [page.pageId, page.platform])).toEqual([
      ['ab12', 'angular-native'],
      ['cd34', undefined],
    ]);
    const text = listPagesText(pages, 3000);
    expect(text).toContain('| Page | URL | Title | Platform | Last report | Reports |');
    expect(text).toContain('| `ab12` | `/` |  | Angular Native | 1s ago | components, signals |');
    expect(text).toContain('| `cd34` | `/trips` |  | browser | 2s ago | components |');
  });
});

describe('list-pages details', () => {
  it('takes the URL and title from a component-tree-only page', () => {
    const details = pageDetails({
      components: [
        {
          pageId: 'ab12',
          reportedAt: 1000,
          url: 'http://localhost:4200/trips?access_token=s3cr3t',
          title: '  Trips\n| Demo  ',
        },
      ],
    });
    const detail = details.get('ab12');
    expect(detail?.url).toMatch(/^http:\/\/localhost:4200\/trips\?access_token=/);
    expect(detail?.url).not.toContain('s3cr3t');
    const pages = summarizePages({
      components: [{ pageId: 'ab12', reportedAt: 1000, ...detail }],
    });
    const text = listPagesText(pages, 2000);
    expect(text).toContain('| `ab12` | `http://localhost:4200/trips?access_token=');
    expect(text).toContain('| Trips \\| Demo | browser | 1s ago | components |');
  });

  it('prefers the HTTP and router URL unless it is clearly older than the tree', () => {
    const tree = { pageId: 'ab12', reportedAt: 10_000, url: 'http://x/tree', title: 'Tree' };
    expect(
      pageDetails({
        http: [{ pageId: 'ab12', reportedAt: 9000, url: 'http://x/http', title: 'Old' }],
        components: [tree],
      }).get('ab12'),
    ).toEqual({ url: 'http://x/http', title: 'Tree' });
    expect(
      pageDetails({
        router: [{ pageId: 'ab12', reportedAt: 9000, url: '/route' }],
        components: [tree],
      }).get('ab12')?.url,
    ).toBe('/route');
    expect(
      pageDetails({
        router: [{ pageId: 'ab12', reportedAt: 10_000 - PAGE_TTL_MS - 1, url: '/route' }],
        components: [tree],
      }).get('ab12')?.url,
    ).toBe('http://x/tree');
    // A stale HTTP report does not hide a fresh router URL.
    expect(
      pageDetails({
        http: [{ pageId: 'ab12', reportedAt: 10_000 - PAGE_TTL_MS - 1, url: 'http://x/http' }],
        router: [{ pageId: 'ab12', reportedAt: 9000, url: '/route' }],
        components: [tree],
      }).get('ab12')?.url,
    ).toBe('/route');
  });

  it('keeps a pipe in a URL inside its table cell', () => {
    const text = listPagesText(
      summarizePages({ components: [{ pageId: 'ab12', reportedAt: 1000, url: '/q?a=1|2' }] }),
      2000,
    );
    expect(text).toContain('| `ab12` | `/q?a=1\\|2` |');
  });

  it('clips long titles', () => {
    const title = pageDetails({
      components: [{ pageId: 'ab12', reportedAt: 1, title: 'x'.repeat(500) }],
    }).get('ab12')?.title;
    expect(title?.length).toBeLessThanOrEqual(121);
  });

  it('flags a hidden page as background', () => {
    const pages = summarizePages(
      {
        components: [
          { pageId: 'ab12', reportedAt: 1000, url: '/' },
          { pageId: 'cd34', reportedAt: 2000, url: '/trips' },
        ],
      },
      ['ab12'],
    );
    expect(pages.map((page) => [page.pageId, page.background])).toEqual([
      ['cd34', undefined],
      ['ab12', true],
    ]);
    const text = listPagesText(pages, 121_000);
    expect(text).toContain('| `ab12` | `/` |  | browser | 120s ago (background) | components |');
    expect(text).toContain('| `cd34` | `/trips` |  | browser | 119s ago | components |');
    expect(text).toMatch(/`\(background\)` is a tab the user switched away from/);
  });
});
