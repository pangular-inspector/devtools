import { DestroyRef, effect, inject, signal, untracked, type Signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import type { AngularPageInfo } from '@pangular-inspector/devtools/config';

export interface AngularPage extends AngularPageInfo {
  pageId: string;
  reportedAt: number;
}

export type AngularPages = Record<string, AngularPage>;

function pagesOf(value: unknown): AngularPages {
  const pages = (value as { pages?: unknown } | null)?.pages;
  return pages && typeof pages === 'object' ? (pages as AngularPages) : {};
}

/**
 * The Angular version and debug API parts each page reports (the
 * `page-angular` shared state), for the unavailable notes. Call it in an
 * injection context. Empty without a client, or with a server that does not
 * keep it, so no view marks anything unavailable then.
 */
export function injectAngularPages(client: () => DevframeRpcClient | null): Signal<AngularPages> {
  const destroyRef = inject(DestroyRef);
  const pages = signal<AngularPages>({});
  let attached: DevframeRpcClient | null = null;
  let stop: (() => void) | null = null;
  const attach = async (current: DevframeRpcClient) => {
    stop?.();
    stop = null;
    attached = current;
    try {
      const state = await current.scope('pangular').rpc.sharedState('page-angular');
      if (destroyRef.destroyed || attached !== current) return;
      const apply = (value: unknown) => pages.set(pagesOf(value));
      apply(state.value());
      stop = state.on('updated', apply);
    } catch {
      if (attached === current) pages.set({});
    }
  };
  effect(() => {
    const current = client();
    if (current && current !== attached) untracked(() => void attach(current));
  });
  destroyRef.onDestroy(() => stop?.());
  return pages.asReadonly();
}

/** The page a view shows when it knows one, else the newest page that reported. */
export function angularPageFor(
  pages: AngularPages,
  pageId: string | null | undefined,
): AngularPage | null {
  if (pageId) return pages[pageId] ?? null;
  let newest: AngularPage | null = null;
  for (const page of Object.values(pages)) {
    if (!newest || page.reportedAt > newest.reportedAt) newest = page;
  }
  return newest;
}
