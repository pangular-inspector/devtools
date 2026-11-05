import {DOCUMENT, Service, inject} from '@angular/core';
import {Meta} from '@angular/platform-browser';
import {pageMeta} from 'virtual:ngmd/page-meta';
import siteConfig from '../../../ngmd.config';
import {stripUrl} from '../route-url/route-url.service';

/**
 * The head tags that differ per page: the canonical URL, `og:url`, the
 * Open Graph and Twitter titles, the description in its three tags, and
 * `robots: noindex` for a page whose frontmatter sets `noIndex`. The
 * description comes from the page's frontmatter (see `page-meta.plugin.ts`),
 * or is the site's. `index.html` holds the site-wide values, and the
 * prerendered HTML carries each page's own.
 */
@Service()
export class PageMetaService {
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  /** Point the tags at the page at `url`, titled `title`. */
  setPage(url: string, title: string): void {
    const canonical = canonicalUrl(url);
    const page = pageMeta[stripUrl(url)];
    const description = page?.description?.trim() || siteConfig.site.description;

    this.meta.updateTag({property: 'og:url', content: canonical});
    this.meta.updateTag({property: 'og:title', content: title});
    this.meta.updateTag({name: 'twitter:title', content: title});
    this.meta.updateTag({name: 'description', content: description});
    this.meta.updateTag({property: 'og:description', content: description});
    this.meta.updateTag({name: 'twitter:description', content: description});
    if (page?.noIndex) this.meta.updateTag({name: 'robots', content: 'noindex'});
    else this.meta.removeTag('name="robots"');
    this.setCanonical(canonical);
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}

/** The absolute URL of a page, without a query, fragment or trailing slash, as the sitemap lists it. */
export function canonicalUrl(url: string): string {
  const base = siteConfig.site.url.replace(/\/+$/, '');
  const path = stripUrl(url);
  return path === '/' ? `${base}/` : `${base}${path}`;
}
