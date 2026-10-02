import { describe, expect, it } from 'vitest';
import { toComponentPage } from '../rpc/component-tools.ts';
import { listPagesText, summarizePages } from '../rpc/pages.ts';

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
    expect(text).toContain('| Page | URL | Platform | Last report | Reports |');
    expect(text).toContain('| `ab12` | `/` | Angular Native | 1s ago | components, signals |');
    expect(text).toContain('| `cd34` | `/trips` | browser | 2s ago | components |');
  });
});
