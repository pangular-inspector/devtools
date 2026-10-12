import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const extension = new URL('../../../../extension/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', extension), 'utf8')) as Record<
  string,
  unknown
>;

describe('extension manifest', () => {
  it('runs no content scripts, so it reads no page DevTools is not inspecting', () => {
    expect(manifest['content_scripts']).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain('<all_urls>');
  });

  it('asks for no permissions and loopback hosts only', () => {
    expect(manifest['permissions']).toEqual([]);
    for (const host of manifest['host_permissions'] as string[]) {
      expect(host).toMatch(/^https?:\/\/(\*\.localhost|127\.0\.0\.1|\[::1\])\/\*$/);
    }
    expect(manifest['optional_host_permissions']).toEqual(['http://*/*', 'https://*/*']);
  });

  it('lists only files that exist', () => {
    const files = [
      manifest['devtools_page'],
      (manifest['background'] as { service_worker?: string } | undefined)?.service_worker,
      ...Object.values(manifest['icons'] as Record<string, string>),
    ].filter((file): file is string => typeof file === 'string');
    for (const file of files) expect(existsSync(new URL(file, extension)), file).toBe(true);
  });
});

describe('extension panel page', () => {
  it('gives the UI frame a title', () => {
    const html = readFileSync(new URL('panel.html', extension), 'utf8');
    const frame = html.match(/<iframe\b[^>]*>/)?.[0] ?? '';
    expect(frame).toMatch(/\btitle="[^"]+"/);
  });
});
