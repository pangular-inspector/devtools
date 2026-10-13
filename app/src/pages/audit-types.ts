/** The audit as the `get-audit` RPC returns it (`rpc/audit-findings.ts` in the package). */

export type AuditSeverity = 'error' | 'warning' | 'info';

export type AuditArea =
  | 'accessibility'
  | 'change-detection'
  | 'leaks'
  | 'errors'
  | 'router'
  | 'forms'
  | 'hydration'
  | 'http'
  | 'pipes';

export const AUDIT_AREAS: readonly AuditArea[] = [
  'accessibility',
  'errors',
  'hydration',
  'change-detection',
  'leaks',
  'router',
  'forms',
  'http',
  'pipes',
];

export const AREA_LABEL: Record<AuditArea, string> = {
  accessibility: 'Accessibility',
  'change-detection': 'Change detection',
  leaks: 'Leaks',
  errors: 'Errors',
  router: 'Router',
  forms: 'Forms',
  hydration: 'Hydration',
  http: 'HTTP',
  pipes: 'Pipes',
};

export interface AuditFinding {
  key: string;
  severity: AuditSeverity;
  area: AuditArea;
  rule: string;
  subject?: string;
  why: string;
  tool: string;
  args?: Record<string, string | number | boolean>;
  count?: number;
  elementId?: string;
}

export type AuditMetrics = Partial<Record<string, number>>;

/** The numbers in the order the panel lists them, with their labels. */
export const METRICS: readonly { key: string; label: string; unit?: string }[] = [
  { key: 'cdCycles', label: 'Change detection cycles' },
  { key: 'cdMeanMs', label: 'Mean cycle time', unit: 'ms' },
  { key: 'cdMaxMs', label: 'Slowest cycle', unit: 'ms' },
  { key: 'wastedChecks', label: 'Wasted checks' },
  { key: 'wastedPercent', label: 'Wasted checks', unit: '%' },
  { key: 'retained', label: 'Retained components' },
  { key: 'openSubscriptions', label: 'Open subscriptions after destroy' },
  { key: 'errorGroups', label: 'Error groups' },
  { key: 'errors', label: 'Error occurrences' },
  { key: 'axeViolations', label: 'axe rules broken' },
  { key: 'axeNodes', label: 'axe elements' },
  { key: 'httpFailures', label: 'Failed HTTP calls' },
  { key: 'findingsError', label: 'Errors found' },
  { key: 'findingsWarning', label: 'Warnings found' },
  { key: 'findingsInfo', label: 'Info found' },
];

export interface AuditSource {
  area: AuditArea;
  /** `hidden` only reaches agents; the panel sees every area that is on. */
  state: 'ok' | 'empty' | 'off' | 'hidden';
  note?: string;
}

export interface AuditReport {
  pageId?: string;
  url?: string;
  title?: string;
  at: number;
  findings: AuditFinding[];
  metrics: AuditMetrics;
  sources: AuditSource[];
  axeAt?: number;
}

export interface AuditSnapshot {
  at: number;
  url?: string;
  findings: AuditFinding[];
  metrics: AuditMetrics;
  axe: boolean;
  axeAt?: number;
}

export interface MetricChange {
  metric: string;
  before?: number;
  after?: number;
  delta?: number;
}

export interface AuditDiff {
  resolved: AuditFinding[];
  added: AuditFinding[];
  remaining: (AuditFinding & { countBefore?: number })[];
  metrics: MetricChange[];
  notes: string[];
}

export interface AuditPage {
  pageId: string;
  url?: string;
  title?: string;
}

export interface AuditResponse {
  pages: AuditPage[];
  report: AuditReport | null;
  session?: {
    before: AuditSnapshot | null;
    after: AuditSnapshot | null;
    diff: AuditDiff | null;
  };
  axe?: { at: number; ms: number; violations: unknown[] } | null;
}

/** The detail tool of a finding as an agent would call it, such as `explain-error { id: "e1" }`. */
export function toolCall(finding: AuditFinding): string {
  const args = Object.entries(finding.args ?? {})
    .filter(([key]) => key !== 'page')
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');
  return `${finding.tool.replace(/^pangular:/, '')}${args ? ` { ${args} }` : ''}`;
}

/** Reads a `get-audit` answer, dropping what does not fit. */
export function toAuditResponse(value: unknown): AuditResponse {
  const record = (value ?? {}) as Partial<AuditResponse>;
  const pages = Array.isArray(record.pages)
    ? record.pages.filter((page): page is AuditPage => typeof page?.pageId === 'string')
    : [];
  const report =
    record.report && Array.isArray(record.report.findings) && Array.isArray(record.report.sources)
      ? record.report
      : null;
  return {
    pages,
    report,
    session: record.session ?? { before: null, after: null, diff: null },
    axe: record.axe ?? null,
  };
}
