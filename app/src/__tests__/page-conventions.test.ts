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
    readdirSync(path: string): string[];
  };
  const files = fs.readdirSync(PAGES).filter((file) => file.endsWith('.ts'));
  return new Map(files.map((file) => [file, fs.readFileSync(`${PAGES}${file}`, 'utf8')]));
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
    expect(labels).toEqual(['component-tree.ts: Filter values']);
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
    expect(page('store-inspector.ts')).toMatch(
      /<app-splitter[^>]*view="store-log"[^>]*pane="before"/s,
    );
    expect(page('store-inspector.ts')).toContain("storedPaneSize('store-log', 300)");
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
      'store-inspector.ts',
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
