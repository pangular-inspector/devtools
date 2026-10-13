// The declarative view a Pangular plugin reports: sections the panel renders
// with its own components and agents read as markdown, so a plugin never ships
// code into the panel. It has no imports, so the page, the server and the
// panel all share it. Values reach it after `serialize()`, which masks
// secrets; `sanitizePluginView()` then keeps only the known shapes and sizes.

/** The tone of a badge, a stat or a table cell. */
export type PluginTone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral';

export interface PluginBadge {
  label: string;
  tone?: PluginTone;
}

/** A table cell: plain text or a number, or text with a tone. */
export type PluginCell = string | number | boolean | null | { text: string; tone?: PluginTone };

export interface PluginTableSection {
  kind: 'table';
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, PluginCell>[];
  /** Shown when `rows` is empty. */
  empty?: string;
}

/** A value shown as a tree of keys and values, folded past the first level. */
export interface PluginTreeSection {
  kind: 'tree';
  title: string;
  value: unknown;
}

export interface PluginListSection {
  kind: 'list';
  title: string;
  items: { label: string; detail?: string; badge?: PluginBadge }[];
  empty?: string;
}

export interface PluginStatsSection {
  kind: 'stats';
  title: string;
  items: { label: string; value: string | number; tone?: PluginTone }[];
}

export interface PluginTextSection {
  kind: 'text';
  title: string;
  text: string;
}

export type PluginSection =
  | PluginTableSection
  | PluginTreeSection
  | PluginListSection
  | PluginStatsSection
  | PluginTextSection;

/** A button the panel shows for one of the plugin's page actions. */
export interface PluginViewAction {
  /** A key of the plugin's `actions`. */
  name: string;
  label: string;
  /** Asks before running, for actions that lose data. */
  confirm?: string;
}

/** What a plugin reports for one page. */
export interface PluginView {
  /** One line under the plugin's title. */
  summary?: string;
  badges?: PluginBadge[];
  sections: PluginSection[];
  actions?: PluginViewAction[];
}

export const PLUGIN_VIEW_LIMITS = {
  sections: 20,
  columns: 12,
  rows: 200,
  items: 200,
  badges: 12,
  actions: 8,
  label: 120,
  text: 2000,
  cell: 500,
} as const;

/** How the page and the server serialize a view before `sanitizePluginView()`. */
export const PLUGIN_VIEW_SERIALIZE = {
  depth: 8,
  keys: 60,
  items: 200,
  text: 2000,
  budget: 20_000,
} as const;

/** Whether a page plugin runs, failed, or needs a later plugin API. */
export type PluginStatus = 'running' | 'error' | 'unsupported';

const TONES: readonly PluginTone[] = ['ok', 'warn', 'danger', 'accent', 'neutral'];
const NAME = /^[a-z][a-z0-9-]{0,39}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function tone(value: unknown): PluginTone | undefined {
  return TONES.includes(value as PluginTone) ? (value as PluginTone) : undefined;
}

function badge(value: unknown): PluginBadge | undefined {
  if (!isRecord(value)) return undefined;
  const label = text(value['label'], PLUGIN_VIEW_LIMITS.label);
  if (!label) return undefined;
  const shade = tone(value['tone']);
  return shade ? { label, tone: shade } : { label };
}

function list<T>(value: unknown, max: number, read: (item: unknown) => T | undefined): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (out.length >= max) break;
    const entry = read(item);
    if (entry !== undefined) out.push(entry);
  }
  return out;
}

function cell(value: unknown): PluginCell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'string') return text(value, PLUGIN_VIEW_LIMITS.cell) ?? '';
  if (isRecord(value) && typeof value['text'] === 'string') {
    const shown = text(value['text'], PLUGIN_VIEW_LIMITS.cell) ?? '';
    const shade = tone(value['tone']);
    return shade ? { text: shown, tone: shade } : { text: shown };
  }
  // A nested value in a cell shows as compact JSON text.
  try {
    return text(JSON.stringify(value), PLUGIN_VIEW_LIMITS.cell) ?? '';
  } catch {
    return '';
  }
}

function section(value: unknown): PluginSection | undefined {
  if (!isRecord(value)) return undefined;
  const title = text(value['title'], PLUGIN_VIEW_LIMITS.label);
  if (!title) return undefined;
  const empty = text(value['empty'], PLUGIN_VIEW_LIMITS.label);
  switch (value['kind']) {
    case 'table': {
      const columns = list(value['columns'], PLUGIN_VIEW_LIMITS.columns, (column) => {
        if (!isRecord(column)) return undefined;
        const key = text(column['key'], PLUGIN_VIEW_LIMITS.label);
        if (!key) return undefined;
        return { key, label: text(column['label'], PLUGIN_VIEW_LIMITS.label) ?? key };
      });
      if (!columns.length) return undefined;
      const rows = list(value['rows'], PLUGIN_VIEW_LIMITS.rows, (row) => {
        if (!isRecord(row)) return undefined;
        const out: Record<string, PluginCell> = {};
        for (const { key } of columns) out[key] = cell(row[key]);
        return out;
      });
      return { kind: 'table', title, columns, rows, ...(empty ? { empty } : {}) };
    }
    case 'tree':
      return { kind: 'tree', title, value: value['value'] ?? null };
    case 'list': {
      const items = list(value['items'], PLUGIN_VIEW_LIMITS.items, (item) => {
        if (typeof item === 'string') return { label: text(item, PLUGIN_VIEW_LIMITS.label)! };
        if (!isRecord(item)) return undefined;
        const label = text(item['label'], PLUGIN_VIEW_LIMITS.label);
        if (!label) return undefined;
        const detail = text(item['detail'], PLUGIN_VIEW_LIMITS.cell);
        const mark = badge(item['badge']);
        return { label, ...(detail ? { detail } : {}), ...(mark ? { badge: mark } : {}) };
      });
      return { kind: 'list', title, items, ...(empty ? { empty } : {}) };
    }
    case 'stats': {
      const items = list(value['items'], PLUGIN_VIEW_LIMITS.items, (item) => {
        if (!isRecord(item)) return undefined;
        const label = text(item['label'], PLUGIN_VIEW_LIMITS.label);
        const shown = text(item['value'], PLUGIN_VIEW_LIMITS.label);
        if (!label || shown === undefined) return undefined;
        const shade = tone(item['tone']);
        return {
          label,
          value: typeof item['value'] === 'number' ? (item['value'] as number) : shown,
          ...(shade ? { tone: shade } : {}),
        };
      });
      return { kind: 'stats', title, items };
    }
    case 'text': {
      const body = text(value['text'], PLUGIN_VIEW_LIMITS.text);
      return body === undefined ? undefined : { kind: 'text', title, text: body };
    }
    default:
      return undefined;
  }
}

/**
 * Keeps the known parts of a plugin view, within `PLUGIN_VIEW_LIMITS`, or
 * returns `null` when `value` is not a view. Unknown section kinds are dropped.
 */
export function sanitizePluginView(value: unknown): PluginView | null {
  if (!isRecord(value) || !Array.isArray(value['sections'])) return null;
  const summary = text(value['summary'], PLUGIN_VIEW_LIMITS.label * 2);
  const badges = list(value['badges'], PLUGIN_VIEW_LIMITS.badges, badge);
  const actions = list(value['actions'], PLUGIN_VIEW_LIMITS.actions, (action) => {
    if (!isRecord(action) || typeof action['name'] !== 'string' || !NAME.test(action['name'])) {
      return undefined;
    }
    const label = text(action['label'], PLUGIN_VIEW_LIMITS.label) ?? action['name'];
    const confirm = text(action['confirm'], PLUGIN_VIEW_LIMITS.label * 2);
    return { name: action['name'], label, ...(confirm ? { confirm } : {}) };
  });
  return {
    ...(summary ? { summary } : {}),
    ...(badges.length ? { badges } : {}),
    sections: list(value['sections'], PLUGIN_VIEW_LIMITS.sections, section),
    ...(actions.length ? { actions } : {}),
  };
}

/** The text of a cell, for markdown and search. */
export function pluginCellText(value: PluginCell): string {
  if (value === null) return '';
  if (typeof value === 'object') return value.text;
  return String(value);
}

function mdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** A plugin view as markdown, for agent tools. */
export function pluginViewMarkdown(view: PluginView, rowLimit = 50): string {
  const lines: string[] = [];
  if (view.summary) lines.push(view.summary, '');
  if (view.badges?.length) lines.push(view.badges.map((b) => `\`${b.label}\``).join(' '), '');
  for (const part of view.sections) {
    lines.push(`### ${part.title}`, '');
    switch (part.kind) {
      case 'table': {
        if (!part.rows.length) {
          lines.push(part.empty ?? 'No rows.', '');
          break;
        }
        lines.push(
          `| ${part.columns.map((c) => mdCell(c.label)).join(' | ')} |`,
          `| ${part.columns.map(() => '---').join(' | ')} |`,
        );
        for (const row of part.rows.slice(0, rowLimit)) {
          lines.push(
            `| ${part.columns.map((c) => mdCell(pluginCellText(row[c.key] ?? null))).join(' | ')} |`,
          );
        }
        if (part.rows.length > rowLimit)
          lines.push('', `${part.rows.length - rowLimit} more rows.`);
        lines.push('');
        break;
      }
      case 'tree':
        lines.push('```json', JSON.stringify(part.value, null, 2) ?? 'null', '```', '');
        break;
      case 'list':
        if (!part.items.length) lines.push(part.empty ?? 'Nothing listed.');
        for (const item of part.items.slice(0, rowLimit)) {
          const mark = item.badge ? ` \`${item.badge.label}\`` : '';
          lines.push(`- ${item.label}${mark}${item.detail ? `: ${item.detail}` : ''}`);
        }
        lines.push('');
        break;
      case 'stats':
        for (const item of part.items) lines.push(`- ${item.label}: ${item.value}`);
        lines.push('');
        break;
      case 'text':
        lines.push(part.text, '');
        break;
    }
  }
  return lines.join('\n').trim();
}
