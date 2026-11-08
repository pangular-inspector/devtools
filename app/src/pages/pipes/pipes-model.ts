import type { SelectOption } from '../../ui/select';

export interface UsageSite {
  file: string;
  line: number;
}

export interface PipeInfo {
  name: string;
  className: string;
  file: string;
  line: number;
  isStandalone: boolean;
  isPure: boolean;
  builtin?: boolean;
  usageCount?: number;
  usages?: UsageSite[];
  /** Panel only: seen on the page but not found by the source scan, such as a pipe from a
   * library. It has no source location, so `file` is empty and `line` is 0. */
  runtime?: boolean;
}

export interface PipeTarget {
  pageId: string;
  id: string;
}

export interface PipeComponentUsage {
  name: string;
  count: number;
  targets?: PipeTarget[];
}

export interface PipeCallTiming {
  totalMs?: number;
  maxMs?: number;
  lastMs?: number;
  errorCount?: number;
  lastError?: string;
}

export interface PipeInstanceCall extends PipeCallTiming {
  component: string;
  callCount: number;
  lastArgs?: unknown[];
  lastResult?: unknown;
  lastCaller?: string;
  target?: PipeTarget;
}

export interface PipeCallInfo extends PipeCallTiming {
  callCount: number;
  instances?: PipeInstanceCall[];
  instanceTotal?: number;
  lastArgs?: unknown[];
  lastResult?: unknown;
  lastCaller?: string;
}

export interface StaleFinding {
  detectedAt: number;
}

export interface ChurnFinding {
  streak: number;
  detectedAt: number;
}

export interface LivePipeInfo {
  name: string;
  className: string;
  isPure: boolean;
  instanceCount: number;
  components: PipeComponentUsage[];
  call?: PipeCallInfo;
  stale?: StaleFinding;
  churn?: ChurnFinding;
  staleCheck?: 'unavailable';
}

export interface AsyncUsageInfo {
  component: string;
  hasSource: boolean;
  latestValue?: string;
  duplicate: boolean;
  resubscribing?: boolean;
  target?: PipeTarget;
}

export interface PipeLintFinding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  pipe: string;
  file: string;
  line: number;
  message: string;
  fix: string;
}

export interface PipesPageSnapshot {
  pageId: string;
  pipes: LivePipeInfo[];
  async: AsyncUsageInfo[];
  asyncTotal?: number;
}

export interface PipesSnapshot {
  pipes: LivePipeInfo[];
  async: AsyncUsageInfo[];
  asyncTotal?: number;
  instrumented: string[];
  pages?: PipesPageSnapshot[];
}

export const RECORD_CONFIRM_MS = 5000;

export type PipeKind = 'all' | 'custom' | 'builtin' | 'runtime' | 'impure' | 'live' | 'called';

export const KIND_OPTIONS: readonly SelectOption<PipeKind>[] = [
  { value: 'all', label: 'All pipes' },
  { value: 'custom', label: 'Custom' },
  { value: 'builtin', label: 'Built-in' },
  { value: 'runtime', label: 'Runtime only' },
  { value: 'impure', label: 'Impure' },
  { value: 'live', label: 'On the page' },
  { value: 'called', label: 'Called while recording' },
];

export type PipeSort = 'source' | 'calls' | 'time';

export const SORT_OPTIONS: readonly SelectOption<PipeSort>[] = [
  { value: 'source', label: 'Source order' },
  { value: 'calls', label: 'Most calls' },
  { value: 'time', label: 'Most time' },
];

/** Where a pipe comes from, for the detail panel. */
export function sourceLabel(p: PipeInfo): string {
  if (p.builtin) return '@angular/common';
  if (p.runtime) return 'Seen on the page only';
  return 'This project';
}

/** A duration in milliseconds, with two decimals under 10 ms. */
export function ms(value: number): string {
  return `${value < 10 ? value.toFixed(2) : Math.round(value)} ms`;
}

/** A short text form of a recorded pipe input or output. */
export function describe(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => describe(v)).join(', ');
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  try {
    const json = JSON.stringify(value);
    return json && json.length > 120 ? `${json.slice(0, 120)}…` : (json ?? String(value));
  } catch {
    return String(value);
  }
}
