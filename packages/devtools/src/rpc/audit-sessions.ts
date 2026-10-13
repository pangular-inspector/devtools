// Before and after measurement sessions: an audit taken as the baseline, one
// taken after a change, and the difference between them. Kept per page id on
// the server, bounded, and dropped when nobody touched them for a while, so a
// reload (same page id) keeps the baseline but a closed tab doesn't keep it forever.

import type { AxeReport } from '../axe-runner.ts';
import {
  METRIC_ORDER,
  type AuditFinding,
  type AuditMetrics,
  type AuditReport,
} from './audit-findings.ts';

/** How long a session lives after its last use. Long enough to edit code and rebuild. */
export const AUDIT_SESSION_TTL_MS = 30 * 60_000;
/** Pages that keep a session or an axe pass at once; the least recently used goes first. */
export const MAX_AUDIT_PAGES = 10;

export type AuditMark = 'before' | 'after';

/** One measurement: the audit as it was when it was taken. */
export interface AuditSnapshot {
  at: number;
  url?: string;
  findings: AuditFinding[];
  metrics: AuditMetrics;
  /** Whether an axe pass was part of it, so accessibility numbers compare like with like. */
  axe: boolean;
  /** When that axe pass ran, on the page clock, so two audits that reuse one pass are not compared. */
  axeAt?: number;
}

export interface MetricChange {
  metric: keyof AuditMetrics;
  before?: number;
  after?: number;
  /** `after - before`, when both are known. Lower is better for every metric. */
  delta?: number;
}

export interface AuditDiff {
  /** Findings in the before audit that the after audit no longer has. */
  resolved: AuditFinding[];
  /** Findings only the after audit has. */
  added: AuditFinding[];
  /** Findings in both, with the count before. */
  remaining: (AuditFinding & { countBefore?: number })[];
  metrics: MetricChange[];
  /** Areas compared on one side only, such as an axe pass only after. */
  notes: string[];
}

/** What a page's session holds. */
export interface AuditSession {
  pageId: string;
  before?: AuditSnapshot;
  after?: AuditSnapshot;
  /** The page's last axe pass. */
  axe?: AxeReport;
  /** Server clock of the last use: a change, or a read by the panel or an agent. */
  updatedAt: number;
}

/**
 * The `audit` shared state: when each page's session and axe pass last
 * changed, so the panel knows when to fetch again. Times and flags only:
 * every client can read it, and counts would tell what hidden areas hold.
 */
export interface AuditSharedState {
  pages: Record<
    string,
    {
      before?: number;
      after?: number;
      axe?: number;
      /** An axe pass is running on the page. */
      running?: boolean;
    }
  >;
}

export function snapshotOf(report: AuditReport): AuditSnapshot {
  return {
    at: report.at,
    ...(report.url ? { url: report.url } : {}),
    findings: report.findings,
    metrics: report.metrics,
    axe: report.axeAt !== undefined,
    ...(report.axeAt !== undefined ? { axeAt: report.axeAt } : {}),
  };
}

/** Compares two audits by finding key and by each metric both or either has. */
export function diffAudits(before: AuditSnapshot, after: AuditSnapshot): AuditDiff {
  const beforeByKey = new Map(before.findings.map((finding) => [finding.key, finding]));
  const afterKeys = new Set(after.findings.map((finding) => finding.key));
  // An axe pass on one side only would read as every violation fixed or added,
  // and one pass reused by both says nothing about the change.
  const samePass =
    before.axe && after.axe && before.axeAt !== undefined && before.axeAt === after.axeAt;
  const axeComparable = before.axe && after.axe && !samePass;
  const comparable = (finding: AuditFinding) => finding.area !== 'accessibility' || axeComparable;
  const resolved = before.findings.filter(
    (finding) => !afterKeys.has(finding.key) && comparable(finding),
  );
  const added = after.findings.filter(
    (finding) => !beforeByKey.has(finding.key) && comparable(finding),
  );
  const remaining = after.findings
    .filter((finding) => beforeByKey.has(finding.key) && comparable(finding))
    .map((finding) => {
      const countBefore = beforeByKey.get(finding.key)?.count;
      return countBefore === undefined ? finding : { ...finding, countBefore };
    });
  const metrics: MetricChange[] = [];
  for (const metric of METRIC_ORDER) {
    const was = before.metrics[metric];
    const now = after.metrics[metric];
    if (was === undefined && now === undefined) continue;
    if (samePass && (metric === 'axeViolations' || metric === 'axeNodes')) continue;
    metrics.push({
      metric,
      ...(was === undefined ? {} : { before: was }),
      ...(now === undefined ? {} : { after: now }),
      ...(was !== undefined && now !== undefined
        ? { delta: Math.round((now - was) * 10) / 10 }
        : {}),
    });
  }
  const notes: string[] = [];
  if (before.axe !== after.axe) {
    notes.push(
      `Only the ${before.axe ? 'before' : 'after'} audit ran axe, so accessibility findings are not compared. Run axe for both to compare them.`,
    );
  } else if (samePass) {
    notes.push(
      'Both audits used the same axe pass, so accessibility findings are not compared. Run axe again after the change.',
    );
  }
  if (before.url && after.url && before.url !== after.url) {
    notes.push(`The page was on ${before.url} before and on ${after.url} after.`);
  }
  return { resolved, added, remaining, metrics, notes };
}

/** The sessions of every page, with expiry and a cap on how many pages keep one. */
export function createAuditSessions(
  options: { ttlMs?: number; maxPages?: number; onChange?: () => void } = {},
) {
  const ttlMs = options.ttlMs ?? AUDIT_SESSION_TTL_MS;
  const maxPages = options.maxPages ?? MAX_AUDIT_PAGES;
  const sessions = new Map<string, AuditSession>();
  const running = new Set<string>();
  const changed = () => options.onChange?.();

  const touch = (pageId: string, now: number): AuditSession => {
    const session = sessions.get(pageId) ?? { pageId, updatedAt: now };
    session.updatedAt = now;
    // Re-insert, so the map's order is least recently used first.
    sessions.delete(pageId);
    sessions.set(pageId, session);
    while (sessions.size > maxPages) {
      const oldest = sessions.keys().next().value as string;
      sessions.delete(oldest);
    }
    return session;
  };

  return {
    get: (pageId: string): AuditSession | undefined => sessions.get(pageId),
    /**
     * Marks a page's session as used by a read, so it lives on while the
     * panel or an agent keeps reading it. Changes nothing a client sees.
     */
    use(pageId: string, now = Date.now()): AuditSession | undefined {
      return sessions.has(pageId) ? touch(pageId, now) : undefined;
    },
    mark(pageId: string, mark: AuditMark, snapshot: AuditSnapshot, now = Date.now()) {
      const session = touch(pageId, now);
      session[mark] = snapshot;
      // A new baseline makes the old after audit meaningless.
      if (mark === 'before') delete session.after;
      changed();
      return session;
    },
    setAxe(pageId: string, report: AxeReport, now = Date.now()) {
      touch(pageId, now).axe = report;
      changed();
    },
    /**
     * Drops the page's axe pass when the page loads again: its element ids
     * name elements that are gone. The baseline stays.
     */
    dropAxe(pageId: string): boolean {
      const session = sessions.get(pageId);
      if (!session?.axe) return false;
      delete session.axe;
      changed();
      return true;
    },
    setRunning(pageId: string, on: boolean) {
      if (on === running.has(pageId)) return;
      if (on) running.add(pageId);
      else running.delete(pageId);
      changed();
    },
    clear(pageId: string): boolean {
      const had = sessions.delete(pageId);
      if (had) changed();
      return had;
    },
    expire(now = Date.now()) {
      let dropped = false;
      for (const [pageId, session] of sessions) {
        if (now - session.updatedAt > ttlMs) {
          sessions.delete(pageId);
          dropped = true;
        }
      }
      if (dropped) changed();
    },
    summary(): AuditSharedState {
      const pages: AuditSharedState['pages'] = {};
      for (const session of sessions.values()) {
        pages[session.pageId] = {
          ...(session.before ? { before: session.before.at } : {}),
          ...(session.after ? { after: session.after.at } : {}),
          ...(session.axe ? { axe: session.axe.at } : {}),
        };
      }
      for (const pageId of running) {
        pages[pageId] = { ...pages[pageId], running: true };
      }
      return { pages };
    },
  };
}

export type AuditSessions = ReturnType<typeof createAuditSessions>;
