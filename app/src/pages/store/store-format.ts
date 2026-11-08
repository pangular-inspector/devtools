import type { VirtualWindow } from '../../ui/virtual-window';
import type { NgrxActionOrigin } from '../store-types';

const KIND_COLORS: Record<string, string> = {
  action: '#f59e0b',
  reducer: '#a78bfa',
  effect: '#fb923c',
  selector: '#60a5fa',
  feature: '#34d399',
  'store-setup': '#94a3b8',
  'signal-store': '#e879f9',
  'signal-state': '#22d3ee',
  'signal-method': '#fb7185',
  store: '#a78bfa',
  event: 'var(--warn)',
  redux: '#38bdf8',
};

const KIND_LABELS: Record<string, string> = {
  'signal-store': 'signalStore',
  'signal-state': 'signalState',
  'signal-method': 'signalMethod',
  'store-setup': 'store setup',
  store: '@ngrx/store',
  event: 'event',
  redux: 'Redux DevTools',
};

const ORIGIN_TEXT: Record<NgrxActionOrigin, string> = {
  dispatch: 'store.dispatch(action)',
  effect: 'NgRx effect (Store.next)',
  reactive: 'store.dispatch(() => action)',
};

export const CLASSIC_KINDS = new Set([
  'action',
  'reducer',
  'effect',
  'selector',
  'feature',
  'store-setup',
]);

export function parsePayload(text: string): { payload?: Record<string, unknown>; error?: string } {
  if (!text.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: 'The payload is not valid JSON.' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'The payload must be a JSON object, like {"id": 7}.' };
  }
  if (Object.prototype.hasOwnProperty.call(value, 'type')) {
    return {
      error: 'The payload cannot have a "type" key. Put the action type in the Type field.',
    };
  }
  return { payload: value as Record<string, unknown> };
}

export function kindColor(kind: string) {
  return KIND_COLORS[kind] ?? 'var(--text-3)';
}

export function kindLabel(kind: string) {
  return KIND_LABELS[kind] ?? kind;
}

export function originText(origin: NgrxActionOrigin) {
  return ORIGIN_TEXT[origin] ?? origin;
}

export function opLabel(op: string) {
  return op === 'add' ? 'added' : op === 'remove' ? 'removed' : 'changed';
}

export function formatDuration(ms: number): string {
  return ms <= 0 ? '<1ms' : `${Math.round(ms)}ms`;
}

export function methodDuration(method: {
  lastDurationMs?: number;
  avgDurationMs?: number;
}): string {
  const parts: string[] = [];
  if (method.avgDurationMs !== undefined) parts.push(`avg ${formatDuration(method.avgDurationMs)}`);
  if (method.lastDurationMs !== undefined)
    parts.push(`last ${formatDuration(method.lastDurationMs)}`);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

/** The entries of `list` the window renders, with their index in the whole list. */
export function slice<T>(list: T[], window: VirtualWindow) {
  const { start, end } = window.range();
  return list.slice(start, end).map((entry, i) => ({ entry, index: start + i }));
}
