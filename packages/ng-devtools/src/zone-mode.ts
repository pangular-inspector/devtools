import type { ZoneMode } from './types.ts';

/**
 * How the app runs change detection, read from the `NgZone` its root injector
 * created: `NoopNgZone` when zoneless, a real `NgZone` (with an `_inner` zone)
 * after `provideZoneChangeDetection`. `null` when there is none yet.
 */
export function zoneModeOf(
  rootInjector: unknown,
  global: { Zone?: unknown } = globalThis as { Zone?: unknown },
): ZoneMode | null {
  const records = (rootInjector as { records?: unknown } | null)?.records;
  if (!(records instanceof Map)) return null;
  for (const [token, record] of records) {
    if (typeof token !== 'function' || token.name.replace(/^_(?=[A-Z])/, '') !== 'NgZone') continue;
    const zone = (record as { value?: unknown } | null)?.value;
    if (
      !zone ||
      typeof zone !== 'object' ||
      typeof (zone as { run?: unknown }).run !== 'function'
    ) {
      return null;
    }
    if ('_inner' in zone) return 'zone';
    return typeof global.Zone === 'undefined' ? 'zoneless' : 'zone-unused';
  }
  return null;
}

export const ZONE_MODES: readonly ZoneMode[] = ['zoneless', 'zone', 'zone-unused'];

export function zoneModeText(mode: ZoneMode | null | undefined, pageId: string): string {
  const page = `Page \`${pageId}\``;
  switch (mode) {
    case 'zoneless':
      return `${page} runs zoneless change detection, and zone.js is not loaded.`;
    case 'zone':
      return `${page} runs change detection with zone.js (\`provideZoneChangeDetection\`).`;
    case 'zone-unused':
      return `${page} runs zoneless change detection, but zone.js is still loaded. Angular does not use it, so it can likely come out of the polyfills.`;
    default:
      return '';
  }
}
