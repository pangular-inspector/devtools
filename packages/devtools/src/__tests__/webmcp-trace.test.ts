import { describe, expect, it } from 'vitest';
import { traceCall, type WebMcpCallEntry, type WebMcpPageTool } from '../webmcp-trace.ts';

const T = 1_000_000;
const readOnly: WebMcpPageTool = {
  name: 'search',
  description: 'Search',
  status: 'registered',
  seen: 'register',
  annotations: { readOnlyHint: true },
};

function call(over: Partial<WebMcpCallEntry> = {}): WebMcpCallEntry {
  return { id: 1, tool: 'search', at: T, ms: 100, outcome: 'done', ...over };
}

const sources = {
  http: {
    pages: [
      {
        pageId: 'p1',
        calls: [
          { id: 'c1', method: 'GET', url: 'http://x/api/search?q=a', at: T + 10, status: 200 },
          { id: 'c2', method: 'POST', url: '/api/log', at: T + 400, status: 201 },
          { id: 'c3', method: 'POST', url: '/api/late', at: T + 6000, status: 201 },
          { id: 'c4', method: 'GET', url: '/before', at: T - 10 },
        ],
      },
      { pageId: 'p2', calls: [{ id: 'o1', method: 'DELETE', url: '/x', at: T + 10 }] },
    ],
  },
  ngrx: {
    pages: [{ pageId: 'p1', log: [{ seq: 3, type: '[Search] Done', timestamp: T + 2000 }] }],
  },
  router: {
    pages: [
      {
        pageId: 'p1',
        navigations: [
          { id: 1, url: '/a', startedAt: T - 5000, outcome: 'succeeded' },
          { id: 2, url: '/a?q=1', startedAt: T + 20, outcome: 'succeeded' },
        ],
      },
    ],
  },
  forms: {
    events: [
      { formId: 'f@p1', seq: 4, type: 'value', path: 'q', timestamp: T + 1, origin: 'agent' },
      { formId: 'f@p2', seq: 5, type: 'value', path: 'q', timestamp: T + 1, origin: 'agent' },
    ],
  },
  signals: {
    pages: {
      p1: {
        nodes: [
          { id: 'n1', label: 'results', kind: 'signal' },
          { id: 'n2', label: 'status', kind: 'signal', framework: true },
        ],
        history: {
          n1: [
            { epoch: 1, at: T - 100, source: 'initial' },
            { epoch: 2, at: T + 50, source: 'write' },
          ],
          n2: [{ epoch: 9, at: T + 60, source: 'write' }],
        },
      },
    },
  },
};

describe('traceCall', () => {
  it('lists effects in the call window for its page only, with what each changes', () => {
    const trace = traceCall(call(), 'p1', sources, { now: T + 10_000 });
    const keys = trace.effects.map((e) => `${e.layer}:${e.key}:${e.certainty}:${e.change}`);
    expect(keys).toEqual([
      'forms:f@p1:4:caused:write',
      'http:c1:during:none',
      // A navigation that only changes the query string does not count as a change.
      'router:2:during:none',
      'signals:n1:2:during:signal',
      'signals:n2:9:during:signal',
      'http:c2:during:write',
    ]);
  });

  it('keeps effects a collector tied to the call past the window, up to 5 s', () => {
    const trace = traceCall(
      call({
        caused: [
          { layer: 'ngrx', key: '3' },
          { layer: 'http', key: 'c3' },
        ],
      }),
      'p1',
      sources,
      { now: T + 10_000 },
    );
    const caused = trace.effects.filter((e) => e.certainty === 'caused').map((e) => e.key);
    expect(caused).toContain('3');
    expect(caused).not.toContain('c3');
  });

  it('leaves out untied effects when the user was active', () => {
    const trace = traceCall(call({ userInput: true }), 'p1', sources, { now: T + 10_000 });
    expect(trace.userInput).toBe(true);
    expect(trace.effects.map((e) => e.key)).toEqual(['f@p1:4']);
  });

  it('warns when a read-only tool changed data, and notes app signal writes alone', () => {
    expect(traceCall(call(), 'p1', sources, { tool: readOnly }).verdict).toBe('warning');
    const signalsOnly = { signals: sources.signals };
    expect(traceCall(call(), 'p1', signalsOnly, { tool: readOnly }).verdict).toBe('info');
    const angularOnly = {
      signals: {
        pages: {
          p1: {
            nodes: [{ id: 'n2', label: 'status', kind: 'signal', framework: true }],
            history: { n2: [{ epoch: 9, at: T + 60, source: 'write' }] },
          },
        },
      },
    };
    expect(traceCall(call(), 'p1', angularOnly, { tool: readOnly }).verdict).toBeUndefined();
    // A tool that does not claim to only read gets no verdict.
    expect(traceCall(call(), 'p1', sources, {}).verdict).toBeUndefined();
  });

  it('uses the time now as the end of a call that still runs', () => {
    const running = call({ ms: undefined, outcome: 'running' });
    const late = {
      http: { pages: [{ pageId: 'p1', calls: [{ id: 'c9', method: 'POST', at: T + 800 }] }] },
    };
    expect(traceCall(running, 'p1', late, { now: T + 5 }).effects).toEqual([]);
    expect(traceCall(running, 'p1', late, { now: T + 400 }).effects.map((e) => e.key)).toEqual([
      'c9',
    ]);
  });
});
