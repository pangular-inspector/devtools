import type { AxeReport } from '../axe-runner.ts';
import {
  AUDIT_AREA_LABEL,
  METRIC_LABEL,
  METRIC_ORDER,
  type AuditArea,
  type AuditFinding,
  type AuditMetrics,
  type AuditReport,
  type AuditSeverity,
} from './audit-findings.ts';
import type { AuditDiff, AuditSession } from './audit-sessions.ts';
import { code, untrusted } from './forms-tools.ts';
import { capped } from './router-tools.ts';

/** Rows the audit tool lists by default. */
export const AUDIT_DEFAULT_LIMIT = 30;
export const AUDIT_MAX_LIMIT = 200;

const SEVERITY_RANK: Record<AuditSeverity, number> = { error: 0, warning: 1, info: 2 };

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

function argsText(finding: AuditFinding): string {
  const args = Object.entries(finding.args ?? {})
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');
  return `${finding.tool.replace(/^pangular:/, '')}${args ? ` { ${args} }` : ''}`;
}

/** Findings narrowed by area and minimum severity. */
export function filterFindings(
  findings: AuditFinding[],
  args: { area?: AuditArea; severity?: AuditSeverity },
): AuditFinding[] {
  const floor = SEVERITY_RANK[args.severity ?? 'info'];
  return findings.filter(
    (finding) =>
      (!args.area || finding.area === args.area) && SEVERITY_RANK[finding.severity] <= floor,
  );
}

function findingRows(findings: AuditFinding[], limit: number): string {
  if (!findings.length) return '';
  const rows = findings.slice(0, limit).map((finding, index) => {
    const count = finding.count && finding.count > 1 ? ` (${finding.count}×)` : '';
    return `| ${index + 1} | ${finding.severity} | ${AUDIT_AREA_LABEL[finding.area]} | ${finding.subject ? code(finding.subject) : ''} | ${code(finding.rule)} ${cell(finding.why)}${count} | ${code(argsText(finding))} |`;
  });
  const more =
    findings.length > limit
      ? `\n\n${findings.length - limit} more; raise \`limit\` or pass \`area\`.`
      : '';
  return `| # | Severity | Area | Where | Why | Detail tool |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}${more}`;
}

function metricsText(metrics: AuditMetrics): string {
  const parts = METRIC_ORDER.filter((key) => metrics[key] !== undefined).map(
    (key) => `${METRIC_LABEL[key]} ${metrics[key]}`,
  );
  return `**Key numbers**: ${parts.join(', ')}.`;
}

function sourcesText(report: AuditReport): string {
  const lines = report.sources
    .filter((source) => source.state !== 'ok' || source.note)
    .map(
      (source) =>
        `- ${AUDIT_AREA_LABEL[source.area]}: ${source.state === 'off' ? 'its inspector is turned off.' : (source.note ?? 'nothing to read yet.')}`,
    );
  return lines.length ? `**Coverage**\n${lines.join('\n')}` : '';
}

/**
 * The nodes of each axe rule, for `area: "accessibility"`. Without `owners`
 * (the agent can't see the Components inspector), pass a report without
 * owners and the hint to the component tools is left out.
 */
export function axeDetailText(report: AxeReport, limit: number, owners = true): string {
  if (!report.violations.length) {
    return `**axe pass** (${report.ms} ms${report.version ? `, axe-core ${report.version}` : ''}): no violations in the app.`;
  }
  const sections = report.violations.slice(0, limit).map((violation) => {
    const nodes = violation.nodes
      .map(
        (node) =>
          `  - ${code(node.target)}${node.owner ? ` in ${code(node.owner.name)} (instance ${code(node.owner.id)})` : ''}: ${code(node.html)}${node.summary ? ` ${cell(node.summary)}` : ''}`,
      )
      .join('\n');
    const more =
      violation.count > violation.nodes.length
        ? `\n  - and ${violation.count - violation.nodes.length} more`
        : '';
    return `- **${code(violation.id)}** ${violation.impact ?? ''} (${violation.count}): ${cell(violation.help)}${violation.helpUrl ? ` [Rule](${violation.helpUrl})` : ''}${violation.tags.length ? ` ${violation.tags.map(code).join(' ')}` : ''}\n${nodes}${more}`;
  });
  const hint = owners
    ? ' Pass an instance id to pangular:inspect-component, or an element to pangular:highlight.'
    : '';
  return `**axe pass** (${report.ms} ms${report.version ? `, axe-core ${report.version}` : ''}), rules by elements affected. Selectors and attributes are masked, and text content is left out.${hint}\n\n${sections.join('\n')}`;
}

export interface AuditTextArgs {
  area?: AuditArea;
  severity?: AuditSeverity;
  limit: number;
  /** Other pages the caller could pick, for a note. */
  otherPages?: number;
  axe?: AxeReport;
  /** Whether the axe elements may name their components (the agent sees the Components inspector). */
  axeOwners?: boolean;
  session?: AuditSession;
  /** What the call did to the session. */
  sessionNote?: string;
  diff?: AuditDiff;
}

function diffRow(finding: AuditFinding & { countBefore?: number }): string {
  const counts =
    finding.countBefore !== undefined && finding.countBefore !== finding.count
      ? ` (${finding.countBefore}× → ${finding.count ?? 1}×)`
      : '';
  return `- ${finding.severity} ${AUDIT_AREA_LABEL[finding.area]} ${code(finding.rule)}${finding.subject ? ` ${code(finding.subject)}` : ''}: ${cell(finding.why)}${counts}`;
}

/** The before and after comparison. */
export function diffText(diff: AuditDiff, limit: number): string {
  const list = (items: (AuditFinding & { countBefore?: number })[]) =>
    items.length
      ? `${items.slice(0, limit).map(diffRow).join('\n')}${items.length > limit ? `\n- and ${items.length - limit} more` : ''}`
      : '- None.';
  const metrics = diff.metrics
    .map((change) => {
      const before = change.before ?? '?';
      const after = change.after ?? '?';
      const delta =
        change.delta === undefined
          ? ''
          : change.delta === 0
            ? ' (same)'
            : ` (${change.delta > 0 ? '+' : ''}${change.delta}, ${change.delta < 0 ? 'better' : 'worse'})`;
      return `| ${METRIC_LABEL[change.metric]} | ${before} | ${after}${delta} |`;
    })
    .join('\n');
  const changed = diff.remaining.filter(
    (finding) => finding.countBefore !== undefined && finding.countBefore !== finding.count,
  );
  return [
    '## Before and after',
    diff.notes.join(' '),
    `| Number | Before | After |\n| --- | --- | --- |\n${metrics}`,
    `**Resolved** (${diff.resolved.length})\n${list(diff.resolved)}`,
    `**New** (${diff.added.length})\n${list(diff.added)}`,
    `**Still there** (${diff.remaining.length})${changed.length ? `, ${changed.length} with a different count` : ''}\n${list(changed.length ? changed : diff.remaining.slice(0, 5))}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The answer of the `audit` agent tool. */
export function auditText(report: AuditReport, args: AuditTextArgs): string {
  const shown = filterFindings(report.findings, args);
  const { findingsError, findingsWarning, findingsInfo } = report.metrics;
  const where = `page ${code(report.pageId ?? '?')}${report.url ? ` (${code(report.url)})` : ''}`;
  const narrowed = args.area || args.severity ? ` ${shown.length} match the filters.` : '';
  const parts = [
    `Audit of ${where}: ${plural(findingsError, 'error')}, ${plural(findingsWarning, 'warning')}, ${findingsInfo} info.${narrowed} Ranked by severity, then area, then count. Each row names the tool that explains it.`,
  ];
  if (args.otherPages) {
    parts.push(`${args.otherPages} other pages report; pass \`page\` to audit another one.`);
  }
  if (args.sessionNote) parts.push(args.sessionNote);
  parts.push(shown.length ? findingRows(shown, args.limit) : 'No finding.');
  if (args.area === 'accessibility' && args.axe) {
    parts.push(axeDetailText(args.axe, args.limit, args.axeOwners ?? true));
  }
  parts.push(metricsText(report.metrics));
  const coverage = sourcesText(report);
  if (coverage) parts.push(coverage);
  if (args.diff) parts.push(diffText(args.diff, args.limit));
  else if (args.session?.before && !args.session.after && !args.sessionNote) {
    parts.push(
      'A baseline is saved for this page. After your change, call again with `session: "after"` to compare.',
    );
  }
  return capped(untrusted(parts.join('\n\n')), 'pass `area`, `severity` or a smaller `limit`');
}
