// @vitest-environment node
// Checks over the page sources: every page uses the shared search field, and the pages with a
// list and a detail use the splitter. Kept apart from the component tests, which the Angular
// compiler transforms.
import { describe, expect, it } from 'vitest';

const PAGES = new URL('../pages/', import.meta.url).pathname;

/** The page sources by file name. The panel tsconfig has no Node types, so fs is a loose import. */
async function pageSources(): Promise<Map<string, string>> {
  const fsName = 'node:fs';
  const fs = (await import(/* @vite-ignore */ fsName)) as {
    readFileSync(path: string, encoding: 'utf8'): string;
    readdirSync(path: string, options: { recursive: true }): string[];
  };
  // Recursive, so a page split into a folder (pages/network/) is still checked.
  const all = fs.readdirSync(PAGES, { recursive: true }).map((file) => file.replaceAll('\\', '/'));
  const files = all.filter((file) => file.endsWith('.ts'));
  // A component's template and style files count as part of its source.
  const read = (file: string) =>
    [file, file.replace(/\.ts$/, '.html'), file.replace(/\.ts$/, '.scss')]
      .filter((path) => all.includes(path))
      .map((path) => fs.readFileSync(`${PAGES}${path}`, 'utf8'))
      .join('\n');
  return new Map(files.map((file) => [file, read(file)]));
}

describe('every page uses the shared search field', () => {
  it('has no hand-written search input left in a page', async () => {
    const raw = [...(await pageSources())]
      .filter(([, source]) => /type="search"/.test(source))
      .map(([file]) => file);
    expect(raw).toEqual([]);
  });

  it('names no field anything other than Filter, except a second field on the same page', async () => {
    const labels = [...(await pageSources())].flatMap(([file, source]) =>
      [...source.matchAll(/<app-search-field[^>]*?\blabel="([^"]+)"/gs)].map(
        (match) => `${file}: ${match[1]}`,
      ),
    );
    // The values filter sits under the component filter in the Components detail panel.
    expect(labels).toEqual(['components/component-detail.ts: Filter values']);
  });

  it('uses Filter, not Find, in every placeholder', async () => {
    const placeholders = [...(await pageSources()).values()].flatMap((source) =>
      [...source.matchAll(/<app-search-field[^>]*?\bplaceholder="([^"]+)"/gs)].map(
        (match) => match[1]!,
      ),
    );
    expect(placeholders.length).toBeGreaterThan(15);
    for (const placeholder of placeholders) {
      expect(placeholder).toMatch(/^Filter\b/);
      expect(placeholder).not.toMatch(/…$/);
    }
  });
});

describe('pages with a splitter', () => {
  it('size the injector detail and the store change list from a saved width', async () => {
    const sources = await pageSources();
    const page = (name: string) => sources.get(name) ?? '';
    expect(page('di-inspector.ts')).toMatch(/<app-splitter[^>]*view="injectors"/s);
    expect(page('di-inspector.ts')).toContain("storedPaneSize('injectors', 420)");
    expect(page('store/store-log.ts')).toMatch(
      /<app-splitter[^>]*view="store-log"[^>]*pane="before"/s,
    );
    expect(page('store/store-log.ts')).toContain("storedPaneSize('store-log', 300)");
  });
});

describe('pages use the shared state component', () => {
  it('has no hand-written Retry alert left in the pages that moved to app-state', async () => {
    const sources = await pageSources();
    const moved = [
      'timeline.ts',
      'errors-inspector.ts',
      'capacitor-inspector.ts',
      'plugins-inspector.ts',
      'audit-inspector.ts',
      'query-inspector.ts',
      'store/store-live.ts',
      'network-inspector.ts',
      'live-route.ts',
      'route-lint.ts',
      'route-tree.ts',
      'route-timeline.ts',
      'route-inspector.ts',
    ];
    for (const file of moved) {
      const source = sources.get(file) ?? '';
      expect(source, file).toContain('<app-state');
      expect(source, file).not.toMatch(/role="alert"[^]{0,400}?>\s*(Retry|Try again)\s*<\/button>/);
      expect(source, file).not.toMatch(/class="state"[^>]*role="status"/);
    }
  });

  it('gives every error state a Retry', async () => {
    const states = [...(await pageSources())].flatMap(([file, source]) =>
      [...source.matchAll(/<app-state\s[^>]*kind="error"[^>]*>/g)].map((match) => ({
        file,
        tag: match[0],
      })),
    );
    expect(states.length).toBeGreaterThan(10);
    for (const { file, tag } of states) expect(tag, file).toMatch(/\(retry\)=/);
  });

  it('gives every no-match state a Clear filters action', async () => {
    const states = [...(await pageSources())].flatMap(([file, source]) =>
      [...source.matchAll(/<app-state\s[^>]*kind="no-match"[^>]*>/g)].map((match) => ({
        file,
        tag: match[0],
      })),
    );
    expect(states.length).toBeGreaterThan(3);
    for (const { file, tag } of states) expect(tag, file).toMatch(/\(clear\)=/);
  });
});

describe('pages with a keyboard list use the shared roving list', () => {
  it('has no hand-written arrow key list handler left in a page', async () => {
    // Trees, charts and the graph move in two dimensions and keep their own keys.
    const handWritten = [...(await pageSources())]
      .filter(([, source]) => /\['ArrowDown',\s*'ArrowUp',\s*'Home',\s*'End'\]/.test(source))
      .map(([file]) => file);
    expect(handWritten).toEqual([]);
  });

  it('puts appRovingList on the lists that moved to it', async () => {
    const sources = await pageSources();
    const lists = {
      'capacitor-inspector.ts': '[data-cap-call]',
      'pipes/pipe-list.ts': '[data-pipe-row]',
      'network/call-timeline.ts': '',
      'network/ssr-requests.ts': '',
      'query-inspector.ts': '',
      'signal-inspector.ts': '',
      'store/store-log.ts': '',
      'store/store-events.ts': '',
      'timeline.ts': '',
    };
    for (const [file, selector] of Object.entries(lists)) {
      const source = sources.get(file) ?? '';
      expect(source, file).toContain('appRovingList="');
      if (selector) expect(source, file).toContain(`appRovingList="${selector}"`);
    }
  });
});
