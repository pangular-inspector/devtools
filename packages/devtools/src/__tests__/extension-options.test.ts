// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = join(import.meta.dirname, '../../../../extension');
const source = readFileSync(join(root, 'options.js'), 'utf8');
const html = readFileSync(join(root, 'options.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as {
  host_permissions: string[];
};

function open(origins: string[], { removable = true } = {}) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  body.querySelectorAll('script').forEach((script) => script.remove());
  document.body.innerHTML = body.innerHTML;
  let granted = [...manifest.host_permissions, ...origins];
  const remove = vi.fn(async ({ origins: gone }: { origins: string[] }) => {
    if (!removable) return false;
    granted = granted.filter((origin) => !gone.includes(origin));
    return true;
  });
  const chrome = {
    runtime: { getManifest: () => manifest },
    permissions: { getAll: async () => ({ origins: granted }), remove },
  };
  runInNewContext(source, { chrome, document });
  const sites = () =>
    [...document.querySelectorAll('#hosts code')].map((code) => code.textContent?.trim());
  const button = (site: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label="Remove access to ${site}"]`)!;
  const status = () => document.getElementById('status')!.textContent?.trim();
  return { remove, sites, button, status };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('extension site access page', () => {
  it('lists the sites allowed from the panel, not the loopback hosts it has from install', async () => {
    const page = open(['https://staging.example.com/*', 'http://192.168.1.20/*']);
    await vi.waitFor(() => expect(page.sites()).toHaveLength(2));
    expect(page.sites()).toEqual(['http://192.168.1.20', 'https://staging.example.com']);
    expect(document.getElementById('hosts')!.getAttribute('aria-label')).toBe('Allowed sites');
    expect(document.getElementById('empty')!.hidden).toBe(true);
  });

  it('removes a site, says so and keeps focus on the list', async () => {
    const page = open(['https://a.example.com/*', 'https://b.example.com/*']);
    await vi.waitFor(() => expect(page.sites()).toHaveLength(2));
    page.button('https://a.example.com').click();
    await vi.waitFor(() => expect(page.sites()).toEqual(['https://b.example.com']));
    expect(page.remove).toHaveBeenCalledWith({ origins: ['https://a.example.com/*'] });
    expect(page.status()).toBe('Removed access to https://a.example.com.');
    expect(document.activeElement).toBe(page.button('https://b.example.com'));

    page.button('https://b.example.com').click();
    await vi.waitFor(() => expect(page.sites()).toEqual([]));
    expect(document.getElementById('empty')!.hidden).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('empty'));
  });

  it('says when Chrome keeps the access', async () => {
    const page = open(['https://a.example.com/*'], { removable: false });
    await vi.waitFor(() => expect(page.sites()).toHaveLength(1));
    page.button('https://a.example.com').click();
    await vi.waitFor(() => expect(page.status()).toMatch(/^Couldn't remove access/));
    expect(page.sites()).toEqual(['https://a.example.com']);
  });

  it('shows the empty state when only the loopback hosts are granted', async () => {
    open([]);
    await vi.waitFor(() => expect(document.getElementById('empty')!.hidden).toBe(false));
    expect(document.getElementById('hosts')!.hidden).toBe(true);
  });
});
