import { createSharedState } from 'devframe/utils/shared-state';
import type { PangularInspector } from '../config.ts';
import type { ComponentPage, HttpState } from '../types.ts';
import { withoutAxeOwners, withoutOwnerSubjects } from './audit-audience.ts';
import { createAxeRequests } from './audit-axe.ts';
import {
  AUDIT_AREAS,
  buildAudit,
  type AuditArea,
  type AuditInputs,
  type AuditMetrics,
  type AuditReport,
  type AuditSeverity,
} from './audit-findings.ts';
import {
  createAuditSessions,
  diffAudits,
  snapshotOf,
  type AuditDiff,
  type AuditMark,
  type AuditSession,
  type AuditSharedState,
  type AuditSnapshot,
} from './audit-sessions.ts';
import { AUDIT_DEFAULT_LIMIT, AUDIT_MAX_LIMIT, auditText } from './audit-text.ts';
import type { CdState } from './cd-tools.ts';
import type { ErrorsState } from './errors-tools.ts';
import type { FormsState } from './forms-tools.ts';
import { code } from './forms-tools.ts';
import type { LeaksState } from './leaks-tools.ts';
import { PAGE_ARGUMENT, byRecency, pageArgument, unknownPageText } from './pages.ts';
import type { PipeLintFinding } from './pipe-lint.ts';
import type { RouterState } from './router-tools.ts';

type AnyRecord = Record<string, any>;

/** How often sessions past their time are dropped. */
const EXPIRE_EVERY_MS = 60_000;

/** The inspector each area reads, so an agent only sees areas whose agent tools are on. */
export const AREA_INSPECTOR: Record<AuditArea, PangularInspector | undefined> = {
  accessibility: undefined,
  'change-detection': 'components',
  leaks: 'components',
  hydration: 'components',
  errors: 'errors',
  router: 'router',
  forms: 'forms',
  http: 'http',
  pipes: 'pipes',
};

const METRIC_AREA: Partial<Record<keyof AuditMetrics, AuditArea>> = {
  cdCycles: 'change-detection',
  cdMeanMs: 'change-detection',
  cdMaxMs: 'change-detection',
  wastedChecks: 'change-detection',
  wastedPercent: 'change-detection',
  retained: 'leaks',
  openSubscriptions: 'leaks',
  errorGroups: 'errors',
  errors: 'errors',
  axeViolations: 'accessibility',
  axeNodes: 'accessibility',
  httpFailures: 'http',
};

/** Where the audit reads each inspector's data. Missing when that inspector is off. */
export interface AuditSources {
  cd?: () => CdState;
  leaks?: () => LeaksState;
  errors?: () => ErrorsState;
  router?: () => RouterState;
  forms?: () => FormsState;
  /** The component tree report of one page, `null` when it has none. */
  components?: (pageId: string) => ComponentPage | null;
  http?: () => HttpState;
  /** Pipe lint over the project's source. */
  pipes?: () => PipeLintFinding[];
}

export interface AuditHost {
  my: {
    rpc: {
      sharedState(name: string, options: AnyRecord): Promise<AnyRecord>;
      broadcast(message: { method: string; args: unknown[]; optional?: boolean }): unknown;
    };
  };
  register(definition: AnyRecord): void;
  agent: { registerTool(tool: AnyRecord): void };
  answersFor(target: string, pageId: unknown): boolean;
  sources: AuditSources;
  /** The pages that report to the server, with their URL and title when known. */
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  /** Whether an agent may read an inspector (`agent.tools`). */
  agentSees(inspector: PangularInspector): boolean;
  /** Whether the agent may run axe on the page: off in `agent.readOnly`. */
  agentAxe: boolean;
  /**
   * `agent.readOnly`: the agent may read the audit and compare with a
   * baseline, but not drop or replace the baseline the user took.
   */
  agentReadOnly?: boolean;
  timeoutMs?: number;
}

export interface AuditRegistration {
  /** The audit as the panel or an agent sees it, for tests. */
  audit(pageId: string, audience?: 'panel' | 'agent'): AuditReport;
  sessions: ReturnType<typeof createAuditSessions>;
  /**
   * A page loaded again (it claimed its page id): its last axe pass names
   * elements that are gone, so it is dropped. The baseline stays.
   */
  pageLoaded(pageId: string): void;
  stop(): void;
}

const MARKS = ['before', 'after', 'clear'] as const;
type SessionAction = (typeof MARKS)[number];

const SEVERITIES: readonly AuditSeverity[] = ['error', 'warning', 'info'];

/** The source each area reads, to tell an area that is off from one hidden from the agent. */
const AREA_SOURCE: Record<AuditArea, keyof AuditSources | undefined> = {
  accessibility: undefined,
  'change-detection': 'cd',
  leaks: 'leaks',
  hydration: 'components',
  errors: 'errors',
  router: 'router',
  forms: 'forms',
  http: 'http',
  pipes: 'pipes',
};

/**
 * The audit, shared by every inspector: the `audit` shared state (sessions
 * and axe passes per page), the `get-audit`, `audit-session`,
 * `request-axe-run` and `axe-result` RPC functions, and the `audit` agent
 * tool. It reads what the inspectors already hold and runs nothing in the
 * page, except the axe pass when the panel or an agent asks for one.
 */
export async function registerAudit(host: AuditHost): Promise<AuditRegistration> {
  const shared = await host.my.rpc.sharedState('audit', {
    sharedState: createSharedState<AuditSharedState>({ initialValue: { pages: {} } }),
  });
  const sessions = createAuditSessions({
    onChange: () =>
      shared['mutate']((draft: AuditSharedState) => {
        draft.pages = sessions.summary().pages;
      }),
  });
  const axe = createAxeRequests({
    broadcast: (method, message) =>
      void Promise.resolve(
        host.my.rpc.broadcast({ method, args: [message], optional: true }),
      ).catch(() => {}),
    answersFor: host.answersFor,
    onRunning: (pageId, running) => sessions.setRunning(pageId, running),
    timeoutMs: host.timeoutMs,
  });

  const visible = (area: AuditArea, audience: 'panel' | 'agent') => {
    const inspector = AREA_INSPECTOR[area];
    return audience === 'panel' || !inspector || host.agentSees(inspector);
  };

  const inputsFor = (pageId: string, audience: 'panel' | 'agent'): AuditInputs => {
    const { sources } = host;
    const sees = (area: AuditArea) => visible(area, audience);
    return {
      ...(sources.cd && sees('change-detection') ? { cd: sources.cd() } : {}),
      ...(sources.leaks && sees('leaks') ? { leaks: sources.leaks() } : {}),
      ...(sources.errors && sees('errors') ? { errors: sources.errors() } : {}),
      ...(sources.router && sees('router') ? { router: sources.router() } : {}),
      ...(sources.forms && sees('forms') ? { forms: sources.forms() } : {}),
      ...(sources.components && sees('hydration')
        ? { components: sources.components(pageId) }
        : {}),
      ...(sources.http && sees('http') ? { http: sources.http() } : {}),
      ...(sources.pipes && sees('pipes') ? { pipes: sources.pipes } : {}),
      axe: sessions.get(pageId)?.axe ?? null,
    };
  };

  const pageList = () => {
    const seen = new Map<
      string,
      { pageId: string; reportedAt: number; url?: string; title?: string }
    >();
    for (const page of byRecency(host.pages())) {
      if (!seen.has(page.pageId)) seen.set(page.pageId, page);
    }
    return [...seen.values()];
  };

  /** Whether axe elements may name their components: the agent sees them with the Components inspector. */
  const ownersFor = (audience: 'panel' | 'agent') =>
    audience === 'panel' || host.agentSees('components');

  /** Drops the areas an agent can't see, and the axe owners when it can't see components. */
  const forAudience = <T extends { findings: AuditSnapshot['findings']; metrics: AuditMetrics }>(
    snapshot: T,
    audience: 'panel' | 'agent',
  ): T => {
    if (audience === 'panel') return snapshot;
    const metrics = Object.fromEntries(
      Object.entries(snapshot.metrics).filter(([key]) => {
        const area = METRIC_AREA[key as keyof AuditMetrics];
        return !area || visible(area, audience);
      }),
    ) as unknown as AuditMetrics;
    const shown = snapshot.findings.filter((finding) => visible(finding.area, audience));
    const findings = ownersFor(audience) ? shown : withoutOwnerSubjects(shown);
    const count = (severity: AuditSeverity) =>
      findings.filter((finding) => finding.severity === severity).length;
    return {
      ...snapshot,
      findings,
      metrics: {
        ...metrics,
        findingsError: count('error'),
        findingsWarning: count('warning'),
        findingsInfo: count('info'),
      },
    };
  };

  const audit = (pageId: string, audience: 'panel' | 'agent' = 'panel'): AuditReport => {
    const page = pageList().find((entry) => entry.pageId === pageId);
    const report = buildAudit(inputsFor(pageId, audience), pageId, page ?? {});
    if (audience === 'panel') return report;
    // Name the areas that are on but hidden from the agent apart from the ones that are off.
    const sources = report.sources.map((source) => {
      const inspector = AREA_INSPECTOR[source.area];
      const from = AREA_SOURCE[source.area];
      return source.state === 'off' && inspector && from && host.sources[from]
        ? {
            area: source.area,
            state: 'hidden' as const,
            note: `its agent tools are off (\`agent.tools.${inspector}\`).`,
          }
        : source;
    });
    return { ...forAudience(report, audience), sources };
  };

  const diffOf = (session: AuditSession | undefined, audience: 'panel' | 'agent') =>
    session?.before && session.after
      ? diffAudits(forAudience(session.before, audience), forAudience(session.after, audience))
      : undefined;

  /** Saves the full audit, so a baseline the agent took compares with an after audit of the panel. */
  const mark = (pageId: string, action: AuditMark) =>
    sessions.mark(pageId, action, snapshotOf(audit(pageId, 'panel')));

  /** The page a call names, else the most recent; an error text when it names none that reports. */
  const resolvePage = (asked: unknown): { pageId: string; others: number } | { error: string } => {
    const pages = pageList();
    if (typeof asked === 'string' && asked) {
      if (pages.some((page) => page.pageId === asked)) {
        return { pageId: asked, others: pages.length - 1 };
      }
      return { error: unknownPageText(asked, pages, 'live data') };
    }
    const latest = pages[0];
    if (!latest) {
      return {
        error:
          'No page reports live data, so there is nothing to audit. Open the app in a browser with the overlay loaded, through the server that runs it. The stdio MCP server has no page attached.',
      };
    }
    return { pageId: latest.pageId, others: pages.length - 1 };
  };

  const agentAxeReport = (pageId: string) => {
    const report = sessions.get(pageId)?.axe;
    return report && !ownersFor('agent') ? withoutAxeOwners(report) : report;
  };

  const timer = setInterval(() => sessions.expire(), EXPIRE_EVERY_MS);
  timer.unref?.();

  host.register({
    name: 'axe-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => axe.answer(message),
  });

  const runAxe = async (pageId: string) => {
    const result = await axe.run(pageId);
    if (result.ok) sessions.setAxe(pageId, result.report);
    return result;
  };

  host.register({
    name: 'request-axe-run',
    type: 'action',
    jsonSerializable: true,
    handler: async (message: { pageId?: unknown } | null) => {
      const page = resolvePage(message?.pageId);
      if ('error' in page) return { ok: false, error: page.error };
      const result = await runAxe(page.pageId);
      return result.ok
        ? { ok: true, violations: result.report.violations.length }
        : { ok: false, error: result.error };
    },
  });

  host.register({
    name: 'get-audit',
    type: 'query',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown } | null) => {
      const pages = pageList().map(({ pageId, url, title }) => ({ pageId, url, title }));
      const page = resolvePage(message?.pageId);
      if ('error' in page) return { pages, report: null };
      const session = sessions.use(page.pageId);
      return {
        pages,
        report: audit(page.pageId),
        session: {
          before: session?.before ?? null,
          after: session?.after ?? null,
          diff: diffOf(session, 'panel') ?? null,
        },
        axe: session?.axe ?? null,
      };
    },
  });

  host.register({
    name: 'audit-session',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; action?: unknown } | null) => {
      const action = message?.action;
      if (!MARKS.includes(action as SessionAction)) {
        return { ok: false, error: 'Pass `action`: before, after or clear.' };
      }
      const page = resolvePage(message?.pageId);
      if ('error' in page) return { ok: false, error: page.error };
      if (action === 'clear') {
        sessions.clear(page.pageId);
        return { ok: true };
      }
      if (action === 'after' && !sessions.get(page.pageId)?.before) {
        return { ok: false, error: 'Take a baseline first.' };
      }
      mark(page.pageId, action as AuditMark);
      return { ok: true };
    },
  });

  const axeArgument = host.agentAxe
    ? {
        axe: {
          type: 'boolean',
          description:
            'Run an axe-core pass over the app first (it loads axe-core into the page on demand, reads the DOM and changes nothing). Without it, the last pass on the page is used.',
        },
      }
    : {};

  host.agent.registerTool({
    id: 'pangular:audit',
    description: `One ranked list of what is wrong on the running page: change detection (needs a pangular:change-detection recording), leaks, errors, hydration, route and form lint, failed HTTP calls and transfer cache misses, pipe lint and axe-core violations. Each finding has severity, area, target, why and the tool for detail, then key numbers. ${
      host.agentAxe ? '`axe: true` runs a fresh axe pass first. ' : ''
    }\`session\`: \`before\` saves a baseline, \`after\` compares, \`clear\` drops it; kept per page 30 minutes.${
      host.agentReadOnly
        ? " Read-only: uses the panel's last axe pass; cannot clear or replace a baseline."
        : ''
    } Areas turned off are named under Coverage. Uses \`page\` or the most recent page.`,
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        ...axeArgument,
        session: {
          type: 'string',
          enum: MARKS,
          description:
            '`before`: save this audit as the baseline. `after`: audit again and compare with the baseline. `clear`: drop the baseline.',
        },
        area: {
          type: 'string',
          enum: AUDIT_AREAS,
          description:
            'Only findings of one area. `accessibility` also lists the elements of each axe rule.',
        },
        severity: {
          type: 'string',
          enum: SEVERITIES,
          description: 'Only findings at this severity or above.',
        },
        limit: {
          type: 'integer',
          description: `Rows to list (1-${AUDIT_MAX_LIMIT}, default ${AUDIT_DEFAULT_LIMIT}).`,
        },
      },
    },
    handler: async (args: AnyRecord) => {
      const page = resolvePage(pageArgument(args));
      if ('error' in page) return { markdown: page.error };
      const { pageId } = page;
      const session = args?.['session'] as SessionAction | undefined;
      if (session !== undefined && !MARKS.includes(session)) {
        return { markdown: 'Pass `session`: `before`, `after` or `clear`.' };
      }
      sessions.use(pageId);
      const kept = sessions.get(pageId)?.before;
      if (host.agentReadOnly && (session === 'clear' || (session === 'before' && kept))) {
        return {
          markdown: `The agent is read-only (\`agent.readOnly\`), so it can't ${session === 'clear' ? 'drop' : 'replace'} the audit session of page ${code(pageId)}, which the user may have taken.${kept ? ' Call with `session: "after"` to compare with the baseline.' : ''} Clear it in the panel's Audit tab.`,
        };
      }
      if (session === 'clear') {
        return {
          markdown: sessions.clear(pageId)
            ? `Dropped the audit session of page ${code(pageId)}.`
            : `Page ${code(pageId)} had no audit session.`,
        };
      }
      if (session === 'after' && !sessions.get(pageId)?.before) {
        return {
          markdown: `Page ${code(pageId)} has no baseline. Call with \`session: "before"\` first, make the change, then call with \`session: "after"\`.`,
        };
      }
      let axeNote = '';
      if (host.agentAxe && args?.['axe'] === true) {
        const result = await runAxe(pageId);
        axeNote = result.ok
          ? `Ran axe-core over the app in ${result.report.ms} ms.`
          : `The axe pass did not run: ${result.error}`;
      }
      const report = audit(pageId, 'agent');
      let sessionNote = axeNote;
      let diff: AuditDiff | undefined;
      if (session === 'before' || session === 'after') {
        const saved = mark(pageId, session);
        if (session === 'before') {
          sessionNote =
            `${axeNote} Saved this audit as the baseline of page ${code(pageId)}. Make your change, reload or use the app the same way (record change detection again if you compare its numbers), then call with \`session: "after"\`.`.trim();
        } else {
          diff = diffOf(saved, 'agent');
        }
      }
      const limit = Math.min(
        Math.max(Math.floor(Number(args?.['limit']) || AUDIT_DEFAULT_LIMIT), 1),
        AUDIT_MAX_LIMIT,
      );
      const area = AUDIT_AREAS.includes(args?.['area']) ? (args['area'] as AuditArea) : undefined;
      const severity = SEVERITIES.includes(args?.['severity'])
        ? (args['severity'] as AuditSeverity)
        : undefined;
      return {
        markdown: auditText(report, {
          area,
          severity,
          limit,
          otherPages: page.others,
          axe: agentAxeReport(pageId),
          axeOwners: ownersFor('agent'),
          session: sessions.get(pageId),
          sessionNote,
          diff,
        }),
      };
    },
  });

  return {
    audit,
    sessions,
    pageLoaded: (pageId) => void sessions.dropAxe(pageId),
    stop: () => clearInterval(timer),
  };
}
