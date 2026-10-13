// What an agent may see of the axe pass. Each axe element names the component
// that holds it (class name and instance id), which is component data: when
// the agent can't see the Components inspector, the owners, the element ids
// and the findings grouped by owner are folded away before the answer.

import type { AxeReport } from '../axe-runner.ts';
import { rankFindings, type AuditFinding } from './audit-findings.ts';

/** The axe pass without the component that owns each element, nor its element id. */
export function withoutAxeOwners(report: AxeReport): AxeReport {
  return {
    ...report,
    violations: report.violations.map((violation) => ({
      ...violation,
      nodes: violation.nodes.map(({ owner: _owner, elementId: _elementId, ...node }) => node),
    })),
  };
}

/**
 * Accessibility findings folded to one per rule, without the owning
 * component as subject. Applied to both sides of a comparison, keys stay
 * comparable.
 */
export function withoutOwnerSubjects(findings: AuditFinding[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  const byRule = new Map<string, AuditFinding>();
  for (const finding of findings) {
    if (finding.area !== 'accessibility') {
      out.push(finding);
      continue;
    }
    const key = `accessibility:${finding.rule}:`;
    const seen = byRule.get(key);
    if (seen) {
      seen.count = (seen.count ?? 1) + (finding.count ?? 1);
      continue;
    }
    const { subject: _subject, elementId: _elementId, ...rest } = finding;
    const folded: AuditFinding = { ...rest, key };
    byRule.set(key, folded);
    out.push(folded);
  }
  return byRule.size ? rankFindings(out) : out;
}
