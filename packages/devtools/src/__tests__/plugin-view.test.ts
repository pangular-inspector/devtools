import { describe, expect, it } from 'vitest';
import {
  PLUGIN_VIEW_LIMITS,
  pluginCellText,
  pluginViewMarkdown,
  sanitizePluginView,
} from '../plugin-view.ts';

describe('sanitizePluginView', () => {
  it('keeps the known section kinds and drops the rest', () => {
    const view = sanitizePluginView({
      summary: '2 queries',
      badges: [{ label: 'online', tone: 'ok' }, { label: '' }, { label: 'x', tone: 'purple' }],
      sections: [
        { kind: 'stats', title: 'Totals', items: [{ label: 'Queries', value: 2, tone: 'warn' }] },
        { kind: 'html', title: 'Script', html: '<script>alert(1)</script>' },
        { kind: 'text', title: 'Note', text: 'Plain text' },
        { kind: 'tree', title: 'Cache', value: { a: { b: 1 } } },
        {
          kind: 'list',
          title: 'Keys',
          items: ['todos', { label: 'user', badge: { label: 'stale' } }],
        },
        { kind: 'table', title: 'No columns', columns: [], rows: [{ a: 1 }] },
      ],
      actions: [{ name: 'refetch-all', label: 'Refetch' }, { name: 'Bad Name' }],
    });
    expect(view?.sections.map((section) => section.kind)).toEqual([
      'stats',
      'text',
      'tree',
      'list',
    ]);
    expect(view?.badges).toEqual([{ label: 'online', tone: 'ok' }, { label: 'x' }]);
    expect(view?.actions).toEqual([{ name: 'refetch-all', label: 'Refetch' }]);
  });

  it('keeps only the declared columns of each row and caps the rows', () => {
    const rows = Array.from({ length: PLUGIN_VIEW_LIMITS.rows + 5 }, (_, i) => ({
      key: `q${i}`,
      status: { text: 'stale', tone: 'warn' },
      hidden: 'not a column',
      data: { nested: true },
    }));
    const view = sanitizePluginView({
      sections: [
        {
          kind: 'table',
          title: 'Queries',
          columns: [
            { key: 'key', label: 'Key' },
            { key: 'status' },
            { key: 'data', label: 'Data' },
          ],
          rows,
        },
      ],
    });
    const table = view?.sections[0];
    expect(table?.kind).toBe('table');
    if (table?.kind !== 'table') return;
    expect(table.rows).toHaveLength(PLUGIN_VIEW_LIMITS.rows);
    expect(table.columns[1]).toEqual({ key: 'status', label: 'status' });
    expect(table.rows[0]).toEqual({
      key: 'q0',
      status: { text: 'stale', tone: 'warn' },
      data: '{"nested":true}',
    });
  });

  it('is null for a value that is not a view', () => {
    expect(sanitizePluginView(null)).toBeNull();
    expect(sanitizePluginView({ sections: 'no' })).toBeNull();
    expect(sanitizePluginView([])).toBeNull();
  });
});

describe('pluginViewMarkdown', () => {
  it('writes tables, lists, stats, trees and text', () => {
    const view = sanitizePluginView({
      summary: 'Two queries',
      sections: [
        { kind: 'stats', title: 'Totals', items: [{ label: 'Queries', value: 2 }] },
        {
          kind: 'table',
          title: 'Queries',
          columns: [{ key: 'key', label: 'Key' }],
          rows: [{ key: 'a|b' }, { key: { text: 'todos', tone: 'ok' } }],
        },
        { kind: 'list', title: 'Keys', items: [], empty: 'None.' },
        { kind: 'tree', title: 'Cache', value: { todos: 1 } },
      ],
    })!;
    const text = pluginViewMarkdown(view);
    expect(text).toContain('Two queries');
    expect(text).toContain('- Queries: 2');
    expect(text).toContain('| a\\|b |');
    expect(text).toContain('| todos |');
    expect(text).toContain('None.');
    expect(text).toContain('"todos": 1');
    expect(pluginCellText({ text: 'x' })).toBe('x');
    expect(pluginCellText(null)).toBe('');
  });

  it('says how many rows it left out', () => {
    const view = sanitizePluginView({
      sections: [
        {
          kind: 'table',
          title: 'Rows',
          columns: [{ key: 'n' }],
          rows: Array.from({ length: 12 }, (_, n) => ({ n })),
        },
      ],
    })!;
    expect(pluginViewMarkdown(view, 10)).toContain('2 more rows.');
  });
});
