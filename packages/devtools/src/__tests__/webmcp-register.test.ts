import { describe, expect, it } from 'vitest';
import {
  toWebMcpPage,
  webMcpCallsText,
  webMcpToolsText,
  type WebMcpState,
} from '../rpc/webmcp-register.ts';

const T = 1_000_000;

function state(): WebMcpState {
  const page = toWebMcpPage(
    {
      pageId: 'p1',
      url: 'http://localhost/search?token=abc',
      modelContext: true,
      tools: [
        {
          name: 'search',
          description: 'Search flights',
          status: 'registered',
          seen: 'register',
          annotations: { readOnlyHint: true, bogus: { nested: 1 } },
          inputs: ['q: string'],
        },
        { name: '' },
      ],
      calls: [
        {
          id: 1,
          tool: 'search',
          at: T,
          ms: 50,
          outcome: 'done',
          args: { q: 'paris', apiKey: 'k' },
          caused: [
            { layer: 'http', key: 'c1' },
            { layer: 'nope', key: 'x' },
          ],
        },
        { id: 'bad', tool: 'search', at: T },
      ],
      dropped: 3,
    },
    T,
  )!;
  return { pages: { p1: page } };
}

describe('toWebMcpPage', () => {
  it('keeps valid tools and calls, drops the rest, and masks values again', () => {
    const page = state().pages['p1']!;
    expect(page.tools.map((tool) => tool.name)).toEqual(['search']);
    expect(page.tools[0]!.annotations).toEqual({ readOnlyHint: true });
    expect(page.calls).toHaveLength(1);
    expect(page.calls[0]!.caused).toEqual([{ layer: 'http', key: 'c1' }]);
    expect(page.calls[0]!.args).toEqual({ q: 'paris', apiKey: '[redacted]' });
    expect(page.dropped).toBe(3);
  });

  it('drops a call whose time makes no valid date', () => {
    const page = toWebMcpPage({
      pageId: 'p1',
      tools: [],
      calls: [
        { id: 1, tool: 't', at: 1e16, outcome: 'done' },
        { id: 2, tool: 't', at: T, outcome: 'done', readOnly: true },
      ],
    })!;
    expect(page.calls.map((call) => call.id)).toEqual([2]);
    expect(page.calls[0]!.readOnly).toBe(true);
    expect(() => webMcpCallsText({ pages: { p1: page } }, {})).not.toThrow();
  });

  it('refuses a report without a page id', () => {
    expect(toWebMcpPage({ tools: [] })).toBeNull();
  });
});

describe('the WebMCP agent tool answers', () => {
  it('lists the tools with the annotations the page claims', () => {
    const text = webMcpToolsText(state());
    expect(text).toContain('`search`');
    expect(text).toContain('readOnlyHint: true');
    expect(text).toContain('Search flights');
  });

  it('lists calls with their effects and warns about a read-only tool that wrote', () => {
    const sources = {
      http: {
        pages: [
          {
            pageId: 'p1',
            calls: [{ id: 'c1', method: 'POST', url: '/api/log', at: T + 5, status: 201 }],
          },
        ],
      },
    };
    const text = webMcpCallsText(state(), sources, {}, T + 10_000);
    expect(text).toContain('#1: done in 50 ms');
    expect(text).toContain('POST /api/log (201), caused, changes data');
    expect(text).toContain('**Warning:**');
    expect(text).toContain('3 older calls were dropped');
  });

  it('says when no page reports WebMCP', () => {
    expect(webMcpCallsText({ pages: {} }, {})).toContain('No page reports WebMCP tools');
  });
});
