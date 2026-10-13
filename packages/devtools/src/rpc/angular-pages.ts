// The Angular version and debug API capabilities each page reports, kept per
// page with the same expiry as the other live reports, so the panel and the
// agent tools can say why an inspector has no data on that page.

import {
  ANGULAR_CAPABILITIES,
  angularUnavailableText,
  type AngularCapability,
  type AngularPageInfo,
} from '../config.ts';

export interface AngularPage extends AngularPageInfo {
  pageId: string;
  reportedAt: number;
}

export interface AngularPagesState {
  pages: Record<string, AngularPage>;
}

/** The report as the page sent it, checked field by field. Null when it is not one. */
export function sanitizeAngularReport(
  report: unknown,
): (AngularPageInfo & { pageId: string }) | null {
  if (!report || typeof report !== 'object') return null;
  const { pageId, version, capabilities } = report as Record<string, unknown>;
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return null;
  const out: AngularPageInfo & { pageId: string } = { pageId, capabilities: {} };
  if (typeof version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}[\w.+-]{0,30}$/.test(version)) {
    out.version = version;
  }
  if (capabilities && typeof capabilities === 'object') {
    for (const name of ANGULAR_CAPABILITIES) {
      const value = (capabilities as Record<string, unknown>)[name];
      if (typeof value === 'boolean') out.capabilities[name] = value;
    }
  }
  return out;
}

/** One `Map` per server, keyed by `pageId`, with expiry and a newest-first lookup. */
export function createAngularPages(now: () => number = Date.now) {
  const pages = new Map<string, AngularPage>();
  return {
    /** Stores a report. True when the stored value changed (not only its time). */
    set(report: AngularPageInfo & { pageId: string }): boolean {
      const before = pages.get(report.pageId);
      const next: AngularPage = { ...report, reportedAt: now() };
      pages.set(report.pageId, next);
      return (
        !before ||
        before.version !== next.version ||
        JSON.stringify(before.capabilities) !== JSON.stringify(next.capabilities)
      );
    },
    forget(pageId: string): boolean {
      return pages.delete(pageId);
    },
    /** Drops pages that stopped reporting. True when one was dropped. */
    expire(ttl: (pageId: string) => number): boolean {
      let dropped = false;
      for (const [id, page] of pages) {
        if (now() - page.reportedAt > ttl(id)) dropped = pages.delete(id) || dropped;
      }
      return dropped;
    },
    get(pageId: string | undefined): AngularPage | undefined {
      return pageId ? pages.get(pageId) : undefined;
    },
    /** The asked page, else the newest one. */
    pick(pageId?: string): AngularPage | undefined {
      if (pageId) return pages.get(pageId);
      let newest: AngularPage | undefined;
      for (const page of pages.values()) {
        if (!newest || page.reportedAt > newest.reportedAt) newest = page;
      }
      return newest;
    },
    snapshot(): AngularPagesState {
      return { pages: Object.fromEntries(pages) };
    },
  };
}

export type AngularPages = ReturnType<typeof createAngularPages>;

/**
 * The answer an agent tool gives when the page lacks the capability it needs:
 * a clear "unsupported" result that names the version, never an error or an
 * empty list. Null when the page has it, or never said (an older overlay or a
 * native platform), so the tool answers as usual.
 */
export function unsupportedToolText(
  page: AngularPageInfo | undefined,
  capability: AngularCapability,
  fallback?: string,
): string | null {
  if (!page || page.capabilities[capability] !== false) return null;
  const text = `**Unsupported on this Angular version.** ${angularUnavailableText(capability, page.version)}`;
  return fallback ? `${text} ${fallback}` : text;
}
