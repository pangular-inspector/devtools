// The audit: one ranked list of findings over what the inspectors already
// collected. Every check here reuses an inspector's own function (cdHints,
// isRetained, lintRoutes, lintFormsFor, lintPipes, serverCallFor) and only
// turns its result into a finding, so the audit and the inspector's own tool
// always agree.

import { cdHints } from '../cd-data.ts';
import type { AxeImpact, AxeReport } from '../axe-runner.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { redactText } from '../serialize.ts';
import { clip } from '../text.ts';
import type { ComponentPage, HttpState } from '../types.ts';
import type { CdState } from './cd-tools.ts';
import type { ErrorsState } from './errors-tools.ts';
import { lintFormsFor } from './forms-explain.ts';
import { onPage as formsOnPage, type FormsState } from './forms-tools.ts';
import { isRetained, type LeaksState } from './leaks-tools.ts';
import type { PipeLintFinding } from './pipe-lint.ts';
import { lintRoutes } from './router-config-tools.ts';
import type { RouterState } from './router-tools.ts';
import { serverCallFor } from './ssr-tools.ts';

export type AuditSeverity = 'error' | 'warning' | 'info';

/** The inspector, or the axe pass, a finding comes from. */
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

export const AUDIT_AREA_LABEL: Record<AuditArea, string> = {
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

/** One problem the audit found. */
export interface AuditFinding {
  /**
   * `area:rule:subject`. It stays the same across audits and reloads, so a
   * before and an after audit can be compared.
   */
  key: string;
  severity: AuditSeverity;
  area: AuditArea;
  /** The check's rule id, such as `onpush-candidate` or `image-alt`. */
  rule: string;
  /** What it is about: a component class, a route, a form, a URL or a pipe. */
  subject?: string;
  /** One line: why it is a problem. Masked like other live values. */
  why: string;
  /** The agent tool that explains it in detail, with the arguments to pass. */
  tool: string;
  args?: Record<string, string | number | boolean>;
  /** How many times or places it occurs. */
  count?: number;
  /** An element id on the page (Components tab, `highlight`), when the finding maps to one. */
  elementId?: string;
}

/** The numbers a before and after comparison looks at. Lower is better for each. */
export interface AuditMetrics {
  /** Recorded change detection cycles. */
  cdCycles?: number;
  /** Mean change detection cycle time, in ms. */
  cdMeanMs?: number;
  /** Slowest change detection cycle, in ms. */
  cdMaxMs?: number;
  /** Refreshed component checks where nothing changed. */
  wastedChecks?: number;
  /** Share of refreshed checks that changed nothing, 0 to 100. */
  wastedPercent?: number;
  /** Destroyed components still in memory after enough navigations. */
  retained?: number;
  /** Subscriptions still open after their component went away. */
  openSubscriptions?: number;
  /** Error groups on the page. */
  errorGroups?: number;
  /** Error occurrences on the page. */
  errors?: number;
  /** axe rules the app breaks. */
  axeViolations?: number;
  /** Elements that break an axe rule. */
  axeNodes?: number;
  /** HttpClient calls that failed. */
  httpFailures?: number;
  /** Findings by severity. */
  findingsError: number;
  findingsWarning: number;
  findingsInfo: number;
}

export const METRIC_LABEL: Record<keyof AuditMetrics, string> = {
  cdCycles: 'Change detection cycles',
  cdMeanMs: 'Mean cycle time (ms)',
  cdMaxMs: 'Slowest cycle (ms)',
  wastedChecks: 'Wasted checks',
  wastedPercent: 'Wasted checks (%)',
  retained: 'Retained components',
  openSubscriptions: 'Open subscriptions after destroy',
  errorGroups: 'Error groups',
  errors: 'Error occurrences',
  axeViolations: 'axe rules broken',
  axeNodes: 'axe elements',
  httpFailures: 'Failed HTTP calls',
  findingsError: 'Errors found',
  findingsWarning: 'Warnings found',
  findingsInfo: 'Info found',
};

/** The order numbers are listed in, by area. */
export const METRIC_ORDER: (keyof AuditMetrics)[] = [
  'cdCycles',
  'cdMeanMs',
  'cdMaxMs',
  'wastedChecks',
  'wastedPercent',
  'retained',
  'openSubscriptions',
  'errorGroups',
  'errors',
  'axeViolations',
  'axeNodes',
  'httpFailures',
  'findingsError',
  'findingsWarning',
  'findingsInfo',
];

/** Whether the audit could read an area, and why not. */
export interface AuditSource {
  area: AuditArea;
  /**
   * `ok`: read; `empty`: on, with nothing to read yet; `off`: its inspector is
   * off; `hidden`: on, but the agent's tools for it are off (`agent.tools`).
   */
  state: 'ok' | 'empty' | 'off' | 'hidden';
  note?: string;
}

export interface AuditReport {
  pageId?: string;
  url?: string;
  title?: string;
  /** Server clock when the audit ran. */
  at: number;
  findings: AuditFinding[];
  metrics: AuditMetrics;
  sources: AuditSource[];
  /** When the axe pass in this audit ran, on the page clock. Missing without one. */
  axeAt?: number;
}

/**
 * What the audit reads. A missing entry means that inspector is off (or
 * hidden from the caller), and the audit says so instead of reading it.
 */
export interface AuditInputs {
  cd?: CdState;
  leaks?: LeaksState;
  errors?: ErrorsState;
  router?: RouterState;
  forms?: FormsState;
  /** The page's component tree report, for hydration. `null` when it reports none. */
  components?: ComponentPage | null;
  http?: HttpState;
  /** Pipe lint over the source. Not tied to a page. */
  pipes?: () => PipeLintFinding[];
  /** The page's last axe pass. `null` when none ran. */
  axe?: AxeReport | null;
  /** Why axe can't run on this page, such as an app on a device with no DOM. */
  noAxe?: string;
  /** Configured lint rules to enable or turn off. */
  rules?: Record<string, boolean>;
}

/** Most findings an audit keeps. */
export const MAX_AUDIT_FINDINGS = 300;
const MAX_WHY = 300;
const MAX_SUBJECT = 160;
/** A component check slower than one frame at 60 Hz. */
export const SLOW_CHECK_MS = 16;

const SEVERITY_ORDER: Record<AuditSeverity, number> = { error: 0, warning: 1, info: 2 };
// Within a severity, what users notice first comes first.
const AREA_ORDER: Record<AuditArea, number> = Object.fromEntries(
  AUDIT_AREAS.map((area, index) => [area, index]),
) as Record<AuditArea, number>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const firstSentence = (text: string) => /^.*?[.:](?=\s|$)/.exec(text)?.[0] ?? text;
const why = (text: string) => clip(redactText(text.replace(/\s+/g, ' ').trim()), MAX_WHY);
const subject = (text: string | undefined) =>
  text ? clip(redactText(text.replace(/\s+/g, ' ').trim()), MAX_SUBJECT) : undefined;
const round = (n: number) => Math.round(n * 10) / 10;

/** Findings in the order an agent should look at them: severity, then area, then how often. */
export function rankFindings(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      AREA_ORDER[a.area] - AREA_ORDER[b.area] ||
      (b.count ?? 1) - (a.count ?? 1) ||
      a.key.localeCompare(b.key),
  );
}

type Collected = { findings: AuditFinding[]; source: AuditSource; metrics?: Partial<AuditMetrics> };

function make(
  area: AuditArea,
  rule: string,
  severity: AuditSeverity,
  text: string,
  tool: string,
  extra: Partial<Omit<AuditFinding, 'area' | 'rule' | 'severity' | 'why' | 'tool' | 'key'>> = {},
): AuditFinding {
  const about = subject(extra.subject);
  return {
    key: `${area}:${rule}:${about ?? ''}`,
    severity,
    area,
    rule,
    why: why(text),
    tool,
    ...extra,
    ...(about ? { subject: about } : {}),
  };
}

/** Merges findings with the same key into one, adding their counts. */
function merge(findings: AuditFinding[]): AuditFinding[] {
  const byKey = new Map<string, AuditFinding>();
  for (const finding of findings) {
    const seen = byKey.get(finding.key);
    if (!seen) byKey.set(finding.key, { ...finding });
    else seen.count = (seen.count ?? 1) + (finding.count ?? 1);
  }
  return [...byKey.values()];
}

function changeDetection(state: CdState | undefined, pageId: string): Collected {
  const area = 'change-detection';
  const tool = 'pangular:diagnose-change-detection';
  if (!state) return { findings: [], source: { area, state: 'off' } };
  const page = state.pages[pageId];
  if (!page || !page.cycles.length) {
    return {
      findings: [],
      source: {
        area,
        state: 'empty',
        note:
          page && !page.supported
            ? 'The page cannot record change detection (Angular 20 or later, development build).'
            : 'No recording. Start one with pangular:change-detection and `record: "start"`, or Record in the panel, then use the app.',
      },
    };
  }
  const findings: AuditFinding[] = [];
  const args = { page: pageId };
  for (const hint of cdHints(page.diagnosis)) {
    const rule = {
      'on-push': 'onpush-candidate',
      'already-on-push': 'onpush-marked-often',
      'in-place': 'input-mutated',
      'same-contents': 'input-same-contents',
      zone: 'zone-dependent',
    }[hint.kind];
    const severity: AuditSeverity =
      hint.kind === 'in-place' || hint.kind === 'zone' || hint.kind === 'on-push'
        ? 'warning'
        : 'info';
    findings.push(
      make(area, rule, severity, firstSentence(hint.text), tool, { subject: hint.name, args }),
    );
  }
  for (const stat of page.components) {
    if (stat.maxMs < SLOW_CHECK_MS) continue;
    findings.push(
      make(
        area,
        'slow-component',
        'warning',
        `Its slowest check took ${round(stat.maxMs)} ms, more than a frame (${SLOW_CHECK_MS} ms); ${plural(stat.checks, 'check')}, ${round(stat.ms)} ms in all.`,
        'pangular:change-detection',
        { subject: stat.name, args },
      ),
    );
  }
  const times = page.cycles.map((cycle) => cycle.ms);
  const stats = page.diagnosis?.components ?? [];
  const refreshed = stats.reduce((sum, stat) => sum + stat.refreshed, 0);
  const wasted = stats.reduce((sum, stat) => sum + stat.unchanged, 0);
  const metrics: Partial<AuditMetrics> = {
    cdCycles: times.length,
    cdMeanMs: round(times.reduce((sum, ms) => sum + ms, 0) / times.length),
    cdMaxMs: round(Math.max(...times)),
    ...(page.diagnosis?.waste
      ? {
          wastedChecks: wasted,
          wastedPercent: refreshed ? Math.round((wasted / refreshed) * 100) : 0,
        }
      : {}),
  };
  return { findings, source: { area, state: 'ok' }, metrics };
}

function leaks(state: LeaksState | undefined, pageId: string, now: number): Collected {
  const area = 'leaks';
  const tool = 'pangular:find-leaks';
  if (!state) return { findings: [], source: { area, state: 'off' } };
  const page = state.pages[pageId];
  if (!page) return { findings: [], source: { area, state: 'empty', note: 'No leak report yet.' } };
  const findings: AuditFinding[] = [];
  const notes: string[] = [];
  // With DI debug data every destroyed instance stays in memory, so none is a finding.
  let retained: number | undefined;
  if (page.support.retention === 'dev-di-debug') {
    notes.push(
      "Retention is not judged: the page's Angular keeps DI debug data that holds every destroyed component.",
    );
  } else if (page.support.retention) {
    const kept = page.destroyed.filter((item) => isRetained(page, item, now));
    retained = kept.length;
    for (const item of kept) {
      findings.push(
        make(
          area,
          'retained-after-destroy',
          'warning',
          `Destroyed on ${item.route || '/'} and still in memory after ${plural(item.navigations, 'navigation')}. A hint to check its retainers in the Memory panel, not proof of a leak.`,
          tool,
          { subject: item.name, args: { page: pageId, component: item.name } },
        ),
      );
    }
  }
  let open = 0;
  for (const sub of page.subscriptions) {
    open += sub.count;
    findings.push(
      make(
        area,
        'subscription-after-destroy',
        'warning',
        `${plural(sub.count, 'subscription')} still open after the component went away${sub.source ? `, made at ${sub.source}` : ''}. Tear it down with takeUntilDestroyed().`,
        tool,
        { subject: sub.name, count: sub.count, args: { page: pageId, component: sub.name } },
      ),
    );
  }
  if (page.support.subscriptions !== 'on') {
    notes.push(
      'Subscription tracking is off, so open subscriptions are not counted (pangular:track-subscriptions).',
    );
  }
  return {
    findings: merge(findings),
    source: { area, state: 'ok', ...(notes.length ? { note: notes.join(' ') } : {}) },
    metrics: {
      ...(retained === undefined ? {} : { retained }),
      ...(page.support.subscriptions === 'on' ? { openSubscriptions: open } : {}),
    },
  };
}

function errors(state: ErrorsState | undefined, pageId: string): Collected {
  const area = 'errors';
  if (!state) return { findings: [], source: { area, state: 'off' } };
  const page = state.pages[pageId];
  if (!page)
    return { findings: [], source: { area, state: 'empty', note: 'No error report yet.' } };
  const groups = Object.values(page.errors);
  const findings = groups.map((group) => {
    const explain = group.explain;
    const detail =
      explain?.kind === 'missing-provider'
        ? ` No provider for ${explain.token}.`
        : explain?.kind === 'expression-changed' && explain.binding
          ? ` Binding ${explain.binding} changed after the check.`
          : '';
    // The message names the error; the group id changes with each reload, the message does not.
    return make(
      area,
      group.code ?? group.name ?? 'error',
      'error',
      `${clip(group.message, 200)}${detail}`,
      'pangular:explain-error',
      {
        subject: group.owner?.name ?? clip(group.message, 80),
        count: group.count,
        args: { page: pageId, id: group.id },
        ...(group.owner ? { elementId: group.owner.id } : {}),
      },
    );
  });
  return {
    findings: merge(findings),
    source: { area, state: 'ok' },
    metrics: {
      errorGroups: groups.length,
      errors: groups.reduce((sum, group) => sum + group.count, 0),
    },
  };
}

function router(
  state: RouterState | undefined,
  pageId: string,
  rules?: Record<string, boolean>,
): Collected {
  const area = 'router';
  if (!state) return { findings: [], source: { area, state: 'off' } };
  const page = state.pages.find((entry) => entry.pageId === pageId);
  if (!page?.config) {
    return {
      findings: [],
      source: {
        area,
        state: 'empty',
        note:
          page?.setup?.mode === 'events-only'
            ? 'The page has not reported its route config yet (events-only mode only limits setup detection), so the lint has not run.'
            : 'No route config reported yet.',
      },
    };
  }
  const findings = lintRoutes(page, { rules }).map((finding) =>
    make(area, finding.rule, finding.severity, finding.message, 'pangular:lint-routes', {
      subject: finding.route || '/',
      args: { page: pageId },
    }),
  );
  return { findings: merge(findings), source: { area, state: 'ok' } };
}

function forms(
  state: FormsState | undefined,
  pageId: string,
  now: number,
  rules?: Record<string, boolean>,
): Collected {
  const area = 'forms';
  if (!state) return { findings: [], source: { area, state: 'off' } };
  const onPage = formsOnPage(state.forms, pageId).length > 0;
  const setup = (state.setupErrors ?? []).some((error) => error.pageId === pageId);
  if (!onPage && !setup) {
    return { findings: [], source: { area, state: 'empty', note: 'No form on the page.' } };
  }
  const findings = lintFormsFor(state, { page: pageId }, now, { rules }).map((finding) =>
    make(area, finding.rule, finding.severity, finding.message, 'pangular:lint-forms', {
      // A setup error names no form, so its message tells it apart.
      subject: [finding.label, finding.path].filter(Boolean).join(' ') || clip(finding.message, 80),
      args: { page: pageId, ...(finding.form ? { form: finding.form } : {}) },
    }),
  );
  return { findings: merge(findings), source: { area, state: 'ok' } };
}

function hydration(page: ComponentPage | null | undefined): Collected {
  const area = 'hydration';
  const tool = 'pangular:hydration';
  if (page === undefined) return { findings: [], source: { area, state: 'off' } };
  const report = page?.hydration;
  if (!page || !report) {
    return {
      findings: [],
      source: { area, state: 'empty', note: 'The page was not rendered on the server.' },
    };
  }
  const args = { page: page.pageId };
  const findings: AuditFinding[] = [];
  if (!report.hydrated) {
    findings.push(
      make(
        area,
        'not-hydrated',
        'warning',
        'The HTML came from the server but no component was hydrated, so the app rendered twice. Add provideClientHydration(), or this is a production build.',
        tool,
        { args },
      ),
    );
  }
  for (const mismatch of report.mismatches) {
    findings.push(
      make(
        area,
        'hydration-mismatch',
        'error',
        `The client DOM did not match the server HTML in <${mismatch.tag}>, so Angular threw it away and rendered again.`,
        tool,
        { subject: mismatch.name, elementId: mismatch.id, args },
      ),
    );
  }
  if (report.counts.skipped) {
    findings.push(
      make(
        area,
        'hydration-skipped',
        'info',
        `${plural(report.counts.skipped, 'component host')} skip hydration (ngSkipHydration) and render again on the client.`,
        tool,
        { count: report.counts.skipped, args },
      ),
    );
  }
  return { findings: merge(findings), source: { area, state: 'ok' } };
}

/** The path of a URL, without its query, so calls to one endpoint group together. */
function endpoint(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    return parsed.origin === 'http://x' ? parsed.pathname : `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function http(state: HttpState | undefined, pageId: string): Collected {
  const area = 'http';
  const tool = 'pangular:list-http-calls';
  if (!state) return { findings: [], source: { area, state: 'off' } };
  const page = state.pages.find((entry) => entry.pageId === pageId);
  if (!page) {
    return {
      findings: [],
      source: {
        area,
        state: 'empty',
        note: 'No HttpClient calls reported. Add withPangular() to provideHttpClient().',
      },
    };
  }
  const findings: AuditFinding[] = [];
  let failures = 0;
  for (const call of page.calls) {
    const target = `${call.method} ${redactUrl(endpoint(call.url))}`;
    // Unsubscribing early (switchMap, a destroy) is normal, not a fault.
    if (call.cancelled) continue;
    if (call.faulted) {
      findings.push(
        make(
          area,
          'faulted-by-rule',
          'info',
          `Failed with ${call.status || 'a network error'} because an HTTP fault rule asked for it.`,
          tool,
          { subject: target, args: { page: pageId, failed: true } },
        ),
      );
      continue;
    }
    if (call.status === 0 || call.status >= 400 || call.error) {
      failures++;
      const status = call.status ? `status ${call.status}` : 'no response';
      findings.push(
        make(
          area,
          call.status >= 400 && call.status < 500 ? 'client-error' : 'request-failed',
          call.status >= 400 && call.status < 500 ? 'warning' : 'error',
          `Failed with ${status}${call.error ? `: ${redactMessage(call.error)}` : ''}.`,
          tool,
          { subject: target, args: { page: pageId, failed: true } },
        ),
      );
      continue;
    }
    if (call.side === 'client' && !call.cacheHit) {
      const server = serverCallFor(call, state.serverCalls);
      if (server?.cacheSkip) {
        findings.push(
          make(
            area,
            'fetched-twice',
            'warning',
            'The server made this call while rendering but the transfer cache did not keep it, so the browser fetched it again.',
            'pangular:explain-ssr-request',
            { subject: target, args: { page: pageId } },
          ),
        );
      }
    }
  }
  return {
    findings: merge(findings),
    source: { area, state: 'ok' },
    metrics: { httpFailures: failures },
  };
}

function pipes(lint: (() => PipeLintFinding[]) | undefined): Collected {
  const area = 'pipes';
  if (!lint) return { findings: [], source: { area, state: 'off' } };
  let found: PipeLintFinding[];
  try {
    found = lint();
  } catch {
    return { findings: [], source: { area, state: 'empty', note: 'The source scan failed.' } };
  }
  const findings = found.map((finding) =>
    make(area, finding.rule, finding.severity, finding.message, 'pangular:scan-pipe-usage', {
      subject: `${finding.pipe} in ${finding.file}:${finding.line}`,
    }),
  );
  return {
    findings: merge(findings),
    source: { area, state: 'ok', note: 'From the source scan, not the page.' },
  };
}

const AXE_SEVERITY: Record<AxeImpact, AuditSeverity> = {
  critical: 'error',
  serious: 'error',
  moderate: 'warning',
  minor: 'info',
};

function accessibility(
  report: AxeReport | null | undefined,
  pageId: string,
  noAxe?: string,
): Collected {
  const area = 'accessibility';
  if (noAxe) return { findings: [], source: { area, state: 'off', note: noAxe } };
  if (report === undefined) return { findings: [], source: { area, state: 'off' } };
  if (!report) {
    return {
      findings: [],
      source: {
        area,
        state: 'empty',
        note: 'No axe pass yet. Run one with pangular:audit and `axe: true`, or Run axe in the panel.',
      },
    };
  }
  const findings: AuditFinding[] = [];
  for (const violation of report.violations) {
    // One finding per rule and component, so a fix in one component shows up on its own.
    const byOwner = new Map<string, typeof violation.nodes>();
    for (const node of violation.nodes) {
      const owner = node.owner?.name ?? '';
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), node]);
    }
    const unlisted = violation.count - violation.nodes.length;
    for (const [owner, nodes] of byOwner) {
      findings.push(
        make(
          area,
          violation.id,
          AXE_SEVERITY[violation.impact ?? 'moderate'],
          `${violation.help}${violation.impact ? ` (${violation.impact})` : ''}.`,
          'pangular:audit',
          {
            subject: owner || nodes[0]?.target,
            count: nodes.length,
            args: { page: pageId, area },
            ...(nodes[0]?.elementId ? { elementId: nodes[0].elementId } : {}),
          },
        ),
      );
    }
    if (unlisted > 0) {
      findings.push(
        make(
          area,
          violation.id,
          AXE_SEVERITY[violation.impact ?? 'moderate'],
          `${violation.help}${violation.impact ? ` (${violation.impact})` : ''}. More elements than the pass lists.`,
          'pangular:audit',
          { subject: '(more elements)', count: unlisted, args: { page: pageId, area } },
        ),
      );
    }
  }
  return {
    findings: merge(findings),
    source: { area, state: 'ok' },
    metrics: {
      axeViolations: report.violations.length + (report.droppedRules ?? 0),
      axeNodes: report.violations.reduce((sum, violation) => sum + violation.count, 0),
    },
  };
}

/**
 * The audit of one page: findings from every area the inputs cover, ranked,
 * with the numbers a before and after comparison reads.
 */
export function buildAudit(
  inputs: AuditInputs,
  pageId: string | undefined,
  page: { url?: string; title?: string } = {},
  now = Date.now(),
): AuditReport {
  const id = pageId ?? '';
  const parts: Collected[] = [
    accessibility(inputs.axe, id, inputs.noAxe),
    errors(inputs.errors, id),
    hydration(inputs.components),
    changeDetection(inputs.cd, id),
    leaks(inputs.leaks, id, now),
    router(inputs.router, id, inputs.rules),
    forms(inputs.forms, id, now, inputs.rules),
    http(inputs.http, id),
    pipes(inputs.pipes),
  ];
  const all = rankFindings(parts.flatMap((part) => part.findings));
  const findings = all.slice(0, MAX_AUDIT_FINDINGS);
  const metrics: AuditMetrics = Object.assign(
    {
      findingsError: all.filter((f) => f.severity === 'error').length,
      findingsWarning: all.filter((f) => f.severity === 'warning').length,
      findingsInfo: all.filter((f) => f.severity === 'info').length,
    },
    ...parts.map((part) => part.metrics ?? {}),
  );
  return {
    ...(pageId ? { pageId } : {}),
    ...(page.url ? { url: redactUrl(page.url) } : {}),
    ...(page.title ? { title: redactMessage(page.title) } : {}),
    at: now,
    findings,
    metrics,
    sources: parts.map((part) => part.source),
    ...(inputs.axe ? { axeAt: inputs.axe.at } : {}),
  };
}
