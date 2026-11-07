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

  it('asks only for permissions with no install warning, and loopback hosts only', () => {
    // activeTab lets the toolbar popup read the tab it was opened on, once, and scripting runs
    // that one read. Neither shows a warning on install.
    expect(manifest['permissions']).toEqual(['activeTab', 'scripting']);
    for (const host of manifest['host_permissions'] as string[]) {
      expect(host).toMatch(/^https?:\/\/(\*\.localhost|127\.0\.0\.1|\[::1\])\/\*$/);
    }
    expect(manifest['optional_host_permissions']).toEqual(['http://*/*', 'https://*/*']);
  });

  it('lists only files that exist', () => {
    const action = manifest['action'] as {
      default_popup?: string;
      default_icon?: Record<string, string>;
    };
    const files = [
      manifest['devtools_page'],
      action.default_popup,
      ...Object.values(action.default_icon ?? {}),
      (manifest['options_ui'] as { page?: string } | undefined)?.page,
      (manifest['background'] as { service_worker?: string } | undefined)?.service_worker,
      ...Object.values(manifest['icons'] as Record<string, string>),
    ].filter((file): file is string => typeof file === 'string');
    for (const file of files) expect(existsSync(new URL(file, extension)), file).toBe(true);
  });
});

describe('extension pages', () => {
  it('has a toolbar popup and a site access page', () => {
    expect(manifest['action']).toMatchObject({ default_popup: 'popup.html' });
    expect(manifest['options_ui']).toEqual({ page: 'options.html', open_in_tab: false });
  });

  it('loads every script each page needs, in order', () => {
    const scripts = (page: string) =>
      [...readFileSync(new URL(page, extension), 'utf8').matchAll(/<script src="([^"]+)"/g)].map(
        (match) => match[1],
      );
    expect(scripts('devtools.html')).toEqual(['frames.js', 'devtools.js']);
    expect(scripts('panel.html')).toEqual([
      'panel-actions.js',
      'connection-probe.js',
      'frames.js',
      'panel-bridge.js',
    ]);
    expect(scripts('popup.html')).toEqual(['connection-probe.js', 'popup.js']);
    expect(scripts('options.html')).toEqual(['options.js']);
    for (const page of ['devtools.html', 'panel.html', 'popup.html', 'options.html']) {
      for (const file of scripts(page)) {
        expect(existsSync(new URL(file!, extension)), file).toBe(true);
      }
    }
  });
});

describe('extension panel page', () => {
  it('gives the UI frame a title', () => {
    const html = readFileSync(new URL('panel.html', extension), 'utf8');
    const frame = html.match(/<iframe\b[^>]*>/)?.[0] ?? '';
    expect(frame).toMatch(/\btitle="[^"]+"/);
  });
});
