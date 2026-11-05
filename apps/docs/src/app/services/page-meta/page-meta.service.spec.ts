import {DOCUMENT} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Meta} from '@angular/platform-browser';
import siteConfig from '../../../ngmd.config';
import {PageMetaService, canonicalUrl} from './page-meta.service';

vi.mock('virtual:ngmd/page-meta', () => ({
  pageMeta: {
    '/inspectors/router': {editUrl: '', lastUpdated: '', description: 'The Router tab.'},
    '/contributing/kitchen-sink': {editUrl: '', lastUpdated: '', noIndex: true},
  },
}));

describe('canonicalUrl', () => {
  it('drops the query, fragment and trailing slash', () => {
    expect(canonicalUrl('/inspectors/router/?tab=1#agent-tools')).toBe(
      'https://pangular-inspector.dev/inspectors/router',
    );
  });

  it('keeps the slash of the homepage', () => {
    expect(canonicalUrl('/')).toBe('https://pangular-inspector.dev/');
  });
});

describe('PageMetaService', () => {
  const tag = (selector: string) => TestBed.inject(Meta).getTag(selector)?.content;

  it('sets the canonical link, og:url, titles and the page description', () => {
    TestBed.inject(PageMetaService).setPage(
      '/inspectors/router#agent-tools',
      'Pangular Inspector | Router',
    );

    const canonical = TestBed.inject(DOCUMENT).head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe(
      'https://pangular-inspector.dev/inspectors/router',
    );
    expect(tag('property="og:url"')).toBe('https://pangular-inspector.dev/inspectors/router');
    expect(tag('property="og:title"')).toBe('Pangular Inspector | Router');
    expect(tag('name="twitter:title"')).toBe('Pangular Inspector | Router');
    for (const selector of [
      'name="description"',
      'property="og:description"',
      'name="twitter:description"',
    ])
      expect(tag(selector)).toBe('The Router tab.');
    expect(tag('name="robots"')).toBeUndefined();
  });

  it('falls back to the site description, and marks a noIndex page', () => {
    const pageMeta = TestBed.inject(PageMetaService);

    pageMeta.setPage('/contributing/kitchen-sink', 'Kitchen sink');
    expect(tag('name="description"')).toBe(siteConfig.site.description);
    expect(tag('name="robots"')).toBe('noindex');

    pageMeta.setPage('/inspectors/router', 'Router');
    expect(tag('name="robots"')).toBeUndefined();
  });

  it('keeps one canonical link across pages', () => {
    const pageMeta = TestBed.inject(PageMetaService);
    pageMeta.setPage('/a', 'A');
    pageMeta.setPage('/b', 'B');

    const links = TestBed.inject(DOCUMENT).head.querySelectorAll('link[rel="canonical"]');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://pangular-inspector.dev/b');
  });
});
