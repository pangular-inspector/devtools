export interface PlatformPage {
  pageId: string;
  reportedAt: number;
  platform?: string;
}

export function isAngularNativePage(page: { platform?: string } | null | undefined): boolean {
  return page?.platform === 'angular-native';
}

export function angularNativePage(
  pages: Record<string, PlatformPage> | null | undefined,
  previous: string | null,
): string | null {
  const native = Object.values(pages ?? {}).filter(isAngularNativePage);
  if (previous && native.some((page) => page.pageId === previous)) return previous;
  let latest: PlatformPage | null = null;
  for (const page of native) {
    if (!latest || page.reportedAt > latest.reportedAt) latest = page;
  }
  return latest?.pageId ?? null;
}
