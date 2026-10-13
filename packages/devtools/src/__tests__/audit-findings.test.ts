import { describe, expect, it } from 'vitest';
import type { AxeReport } from '../axe-runner.ts';
import type { ComponentPage, HttpState } from '../types.ts';
import { toAxeReport, toAxeRunResult } from '../rpc/audit-axe.ts';
import { buildAudit, rankFindings, type AuditFinding } from '../rpc/audit-findings.ts';
import {
  createAuditSessions,
  diffAudits,
  snapshotOf,
  type AuditSnapshot,
} from '../rpc/audit-sessions.ts';
import type { CdState } from '../rpc/cd-tools.ts';
import type { ErrorsState } from '../rpc/errors-tools.ts';
import type { FormsState } from '../rpc/forms-tools.ts';
import { RETAINED_AFTER_MS, type LeaksPageView, type LeaksState } from '../rpc/leaks-tools.ts';
import type { RouterState } from '../rpc/router-tools.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');
const NOW = 1_000_000;

const cd = (): CdState => ({
  pages: {
    tab1: {
      pageId: 'tab1',
      supported: true,
      recording: false,
      startedAt: 1,
      reportedAt: NOW,
      dropped: 0,
      hosts: {},
      cycles: [
        { id: 1, at: 1, ms: 4, passes: 1, checks: 3, components: [] },
        { id: 2, at: 2, ms: 20, passes: 1, checks: 3, components: [] },
      ],
      components: [
        { name: 'TripList', checks: 40, ms: 60, maxMs: 25, cycles: 2 },
        { name: 'Banner', checks: 2, ms: 1, maxMs: 1, cycles: 2 },
      ],
      diagnosis: {
        triggers: true,
        waste: true,
        causes: { event: 2 },
        components: [
          { name: 'TripList', refreshed: 40, unchanged: 38, strategy: 'Eager' },
          { name: 'Banner', refreshed: 10, unchanged: 9, strategy: 'OnPush' },
        ],
        inputs: [
          { name: 'TripCard', input: 'trip', parent: 'TripList', inPlace: 3, sameContents: 0 },
        ],
        zone: [{ name: 'Clock', ticks: 4, tasks: ['setInterval'] }],
      },
    },
  },
});

const leaksPage = (retention: LeaksPageView['support']['retention']): LeaksPageView => ({
  pageId: 'tab1',
  url: '/trips',
  title: 'Trips',
  at: NOW,
  reportedAt: NOW,
  support: { retention, effects: true, subscriptions: 'on' },
  navigations: 4,
  totals: { components: 1, effects: 0, subscriptions: 2, destroyed: 1, collected: 0, dropped: 0 },
  components: [],
  destroyed: [
    {
      id: 'c9',
      name: 'TripCard',
      route: '/trips/7',
      destroyedAt: NOW - RETAINED_AFTER_MS - 1000,
      navigations: 3,
    },
  ],
  subscriptions: [
    {
      name: 'TripCard',
      count: 2,
      route: '/trips/7',
      openedAt: NOW - 5000,
      reason: 'instance-destroyed',
      source: 'TripCard.ngOnInit (trip-card.ts:12:7)',
    },
  ],
});

const errors = (): ErrorsState => ({
  pages: {
    tab1: {
      pageId: 'tab1',
      url: '/trips',
      title: 'Trips',
      reportedAt: NOW,
      handler: 'wrapped',
      dropped: { errors: 0, console: 0 },
      console: {},
      errors: {
        e1: {
          id: 'e1',
          message: 'NullInjectorError: No provider for TripApi!',
          code: 'NG0201',
          count: 3,
          firstAt: 1,
          lastAt: 2,
          sources: ['handler'],
          owner: { id: 'c1', name: 'TripList' },
          explain: { kind: 'missing-provider', token: 'TripApi' },
        },
      },
    },
  },
});

const router = (): RouterState =>
  ({
    pages: [
      {
        pageId: 'tab1',
        reportedAt: NOW,
        changedAt: NOW,
        snapshot: null,
        navigations: [],
        config: [
          { id: 'r1', path: '**', fullPath: '/**', kind: 'redirect', redirectTo: '' },
          {
            id: 'r2',
            path: 'trips',
            fullPath: '/trips',
            kind: 'component',
            component: 'Trips',
            title: 'Trips',
          },
        ],
      },
    ],
  }) as unknown as RouterState;

const forms = (): FormsState => ({
  forms: [],
  events: [],
  reportedAt: NOW,
  setupErrors: [
    { pageId: 'tab1', message: 'NG01203: No value accessor for form control name: email' },
    { pageId: 'other', message: 'NG01050: formControlName must be used with a parent' },
  ],
});

const components = (): ComponentPage =>
  ({
    pageId: 'tab1',
    reportedAt: NOW,
    roots: [],
    count: 0,
    detail: null,
    hydration: {
      hydrated: true,
      counts: { hydrated: 4, skipped: 2, mismatched: 1, client: 0, dehydratedBlocks: 0 },
      mismatches: [{ id: 'c5', name: 'TripMap', tag: 'app-trip-map' }],
    },
  }) as ComponentPage;

const call = (extra: Record<string, unknown>) => ({
  id: String(Math.random()),
  url: '/api/trips?id=1',
  method: 'GET',
  status: 200,
  durationMs: 5,
  side: 'client',
  cacheHit: false,
  faulted: false,
  at: NOW,
  ...extra,
});

const http = (): HttpState =>
  ({
    serverCalls: [call({ side: 'server', url: '/api/cities', cacheSkip: 'post' })],
    requests: [],
    rules: [],
    pages: [
      {
        pageId: 'tab1',
        url: '/trips',
        initialUrl: '/trips',
        title: 'Trips',
        hydration: null,
        firstSeenAt: NOW,
        reportedAt: NOW,
        calls: [
          call({ status: 500, url: `/api/trips?token=${JWT}` }),
          call({ status: 500, url: '/api/trips?id=2' }),
          call({ status: 404, url: '/api/photos/1' }),
          call({ status: 0, cancelled: true, url: '/api/search' }),
          call({ status: 503, faulted: true, url: '/api/slow' }),
          call({ url: '/api/cities' }),
        ],
      },
    ],
  }) as unknown as HttpState;

const axe = (): AxeReport => ({
  at: NOW,
  ms: 120,
  url: '/trips',
  violations: [
    {
      id: 'image-alt',
      impact: 'critical',
      help: 'Images must have alternative text',
      tags: ['wcag2a'],
      count: 3,
      nodes: [
        { target: 'img.a', html: '<img class="a">', owner: { id: 'c2', name: 'TripPhoto' } },
        { target: 'img.b', html: '<img class="b">', owner: { id: 'c2', name: 'TripPhoto' } },
      ],
    },
    {
      id: 'region',
      impact: 'moderate',
      help: 'All page content should be contained by landmarks',
      tags: ['best-practice'],
      count: 1,
      nodes: [{ target: 'p', html: '<p>' }],
    },
  ],
});

const keys = (findings: AuditFinding[]) => findings.map((finding) => finding.key);

describe('buildAudit', () => {
  it('gathers every area into one list ranked by severity, area and count', () => {
    const report = buildAudit(
      {
        cd: cd(),
        leaks: { pages: { tab1: leaksPage(true) } },
        errors: errors(),
        router: router(),
        forms: forms(),
        components: components(),
        http: http(),
        pipes: () => [
          {
            rule: 'json-pipe',
            severity: 'info',
            pipe: 'json',
            file: 'src/app/trips.ts',
            line: 4,
            message: '`| json` is a debugging aid.',
            fix: 'Remove it.',
          },
        ],
        axe: axe(),
      },
      'tab1',
      { url: '/trips', title: 'Trips' },
      NOW,
    );
    const ranks = { error: 0, warning: 1, info: 2 };
    const severities = report.findings.map((finding) => ranks[finding.severity]);
    expect(severities).toEqual([...severities].sort((a, b) => a - b));
    expect(report.findings[0]).toMatchObject({
      area: 'accessibility',
      rule: 'image-alt',
      subject: 'TripPhoto',
      count: 2,
    });
    expect(keys(report.findings)).toEqual(
      expect.arrayContaining([
        'accessibility:image-alt:(more elements)',
        'accessibility:region:p',
        'errors:NG0201:TripList',
        'hydration:hydration-mismatch:TripMap',
        'hydration:hydration-skipped:',
        'change-detection:onpush-candidate:TripList',
        'change-detection:onpush-marked-often:Banner',
        'change-detection:input-mutated:TripCard',
        'change-detection:zone-dependent:Clock',
        'change-detection:slow-component:TripList',
        'leaks:retained-after-destroy:TripCard',
        'leaks:subscription-after-destroy:TripCard',
        'router:wildcard-not-last:/**',
        'forms:setup-error:NG01203: No value accessor for form control name: email',
        'http:request-failed:GET /api/trips',
        'http:client-error:GET /api/photos/1',
        'http:faulted-by-rule:GET /api/slow',
        'http:fetched-twice:GET /api/cities',
        'pipes:json-pipe:json in src/app/trips.ts:4',
      ]),
    );
    // The other page's setup error and the cancelled call are not findings.
    expect(JSON.stringify(report)).not.toContain('NG01050');
    expect(JSON.stringify(report)).not.toContain('/api/search');
    expect(JSON.stringify(report)).not.toContain(JWT);
    const failed = report.findings.find((finding) => finding.rule === 'request-failed');
    expect(failed).toMatchObject({ count: 2, severity: 'error', tool: 'pangular:list-http-calls' });
    const error = report.findings.find((finding) => finding.area === 'errors');
    expect(error).toMatchObject({
      tool: 'pangular:explain-error',
      args: { page: 'tab1', id: 'e1' },
      elementId: 'c1',
      count: 3,
    });
    expect(error!.why).toContain('No provider for TripApi');
    expect(report.metrics).toMatchObject({
      cdCycles: 2,
      cdMeanMs: 12,
      cdMaxMs: 20,
      wastedChecks: 47,
      wastedPercent: 94,
      retained: 1,
      openSubscriptions: 2,
      errorGroups: 1,
      errors: 3,
      axeViolations: 2,
      axeNodes: 4,
      httpFailures: 3,
    });
    expect(report.sources.every((source) => source.state === 'ok')).toBe(true);
    expect(report.axeAt).toBe(NOW);
  });

  it('judges no retention when Angular keeps DI debug data, and says so', () => {
    const report = buildAudit(
      { leaks: { pages: { tab1: leaksPage('dev-di-debug') } } },
      'tab1',
      {},
      NOW,
    );
    expect(keys(report.findings)).toEqual(['leaks:subscription-after-destroy:TripCard']);
    expect(report.metrics.retained).toBeUndefined();
    expect(report.sources.find((source) => source.area === 'leaks')?.note).toMatch(/DI debug data/);
  });

  it('names the areas it could not read: off, empty and waiting for a recording or a pass', () => {
    const report = buildAudit({ cd: { pages: {} }, components: null, axe: null }, 'tab1', {}, NOW);
    const state = Object.fromEntries(report.sources.map((s) => [s.area, s.state]));
    expect(state).toMatchObject({
      accessibility: 'empty',
      'change-detection': 'empty',
      hydration: 'empty',
      errors: 'off',
      router: 'off',
      forms: 'off',
      http: 'off',
      pipes: 'off',
      leaks: 'off',
    });
    expect(report.findings).toEqual([]);
    expect(report.sources.find((s) => s.area === 'change-detection')?.note).toContain(
      'record: "start"',
    );
  });

  it('keeps finding keys the same across audits of a reloaded page', () => {
    const first = buildAudit({ errors: errors() }, 'tab1', {}, NOW);
    const reloaded = errors();
    reloaded.pages['tab1']!.errors = { e7: { ...reloaded.pages['tab1']!.errors['e1']!, id: 'e7' } };
    const second = buildAudit({ errors: reloaded }, 'tab1', {}, NOW + 1000);
    expect(keys(second.findings)).toEqual(keys(first.findings));
  });
});

describe('rankFindings', () => {
  it('puts errors first, then by area, then the most frequent', () => {
    const finding = (key: string, extra: Partial<AuditFinding>): AuditFinding => ({
      key,
      severity: 'warning',
      area: 'http',
      rule: key,
      why: '',
      tool: 'x',
      ...extra,
    });
    const ranked = rankFindings([
      finding('a', { severity: 'info' }),
      finding('b', { count: 2 }),
      finding('c', { count: 9 }),
      finding('d', { severity: 'error', area: 'pipes' }),
      finding('e', { area: 'accessibility' }),
    ]);
    expect(keys(ranked)).toEqual(['d', 'e', 'c', 'b', 'a']);
  });
});

const snapshot = (findings: AuditFinding[], metrics: object, axeRan = true): AuditSnapshot => ({
  at: NOW,
  findings,
  axe: axeRan,
  metrics: { findingsError: 0, findingsWarning: 0, findingsInfo: 0, ...metrics },
});

describe('diffAudits', () => {
  const f = (key: string, area: AuditFinding['area'] = 'errors', count?: number): AuditFinding => ({
    key,
    severity: 'error',
    area,
    rule: key,
    why: key,
    tool: 'x',
    ...(count ? { count } : {}),
  });

  it('lists resolved, new and remaining findings and each number before and after', () => {
    const diff = diffAudits(
      snapshot([f('a'), f('b', 'errors', 4)], { cdMeanMs: 10, errors: 4 }),
      snapshot([f('b', 'errors', 1), f('c')], { cdMeanMs: 6.5, errors: 1, retained: 0 }),
    );
    expect(keys(diff.resolved)).toEqual(['a']);
    expect(keys(diff.added)).toEqual(['c']);
    expect(diff.remaining).toEqual([
      expect.objectContaining({ key: 'b', count: 1, countBefore: 4 }),
    ]);
    expect(diff.metrics).toEqual(
      expect.arrayContaining([
        { metric: 'cdMeanMs', before: 10, after: 6.5, delta: -3.5 },
        { metric: 'errors', before: 4, after: 1, delta: -3 },
        { metric: 'retained', after: 0 },
      ]),
    );
  });

  it('does not compare accessibility when only one side ran axe', () => {
    const diff = diffAudits(snapshot([f('x', 'accessibility')], {}, true), snapshot([], {}, false));
    expect(diff.resolved).toEqual([]);
    expect(diff.notes.join(' ')).toContain('Only the before audit ran axe');
  });

  it('does not compare accessibility when both sides reuse one axe pass', () => {
    const a11y = f('x', 'accessibility');
    const before = { ...snapshot([a11y], { axeViolations: 1 }), axeAt: NOW };
    const same = diffAudits(before, { ...before, at: NOW + 10 });
    expect(same.resolved).toEqual([]);
    expect(same.remaining).toEqual([]);
    expect(same.metrics.map((m) => m.metric)).not.toContain('axeViolations');
    expect(same.notes.join(' ')).toContain('Both audits used the same axe pass');

    const fresh = diffAudits(before, { ...snapshot([], { axeViolations: 0 }), axeAt: NOW + 5 });
    expect(keys(fresh.resolved)).toEqual(['x']);
    expect(fresh.notes).toEqual([]);
  });
});

describe('createAuditSessions', () => {
  it('keeps a baseline per page, drops the after audit on a new baseline, and expires', () => {
    let changes = 0;
    const sessions = createAuditSessions({ ttlMs: 1000, onChange: () => changes++ });
    const base = snapshot([], {});
    sessions.mark('tab1', 'before', base, 0);
    sessions.mark('tab1', 'after', base, 10);
    expect(sessions.get('tab1')?.after).toBe(base);
    sessions.mark('tab1', 'before', base, 20);
    expect(sessions.get('tab1')?.after).toBeUndefined();
    sessions.mark('tab2', 'before', base, 900);
    sessions.expire(1500);
    expect(sessions.get('tab1')).toBeUndefined();
    expect(sessions.get('tab2')).toBeDefined();
    expect(changes).toBeGreaterThanOrEqual(5);
    expect(sessions.summary().pages['tab2']).toEqual({ before: NOW });
  });

  it('keeps at most maxPages, dropping the least recently used', () => {
    const sessions = createAuditSessions({ maxPages: 2 });
    const base = snapshot([], {});
    sessions.mark('a', 'before', base);
    sessions.mark('b', 'before', base);
    sessions.mark('a', 'after', base);
    sessions.mark('c', 'before', base);
    expect(Object.keys(sessions.summary().pages).sort()).toEqual(['a', 'c']);
  });

  it('marks a page as running while an axe pass is out', () => {
    const sessions = createAuditSessions();
    sessions.setRunning('tab1', true);
    expect(sessions.summary().pages['tab1']?.running).toBe(true);
    sessions.setRunning('tab1', false);
    expect(sessions.summary().pages['tab1']).toBeUndefined();
  });

  it('snapshots an audit with whether axe ran and when', () => {
    const report = buildAudit({ axe: axe() }, 'tab1', { url: '/trips' }, NOW);
    expect(snapshotOf(report)).toMatchObject({ axe: true, axeAt: NOW, url: '/trips', at: NOW });
  });

  it('keeps a session alive while it is read, without telling clients', () => {
    let changes = 0;
    const sessions = createAuditSessions({ ttlMs: 1000, onChange: () => changes++ });
    sessions.mark('tab1', 'before', snapshot([], {}), 0);
    changes = 0;
    expect(sessions.use('tab1', 900)).toBeDefined();
    expect(sessions.use('tab2', 900)).toBeUndefined();
    expect(sessions.get('tab2')).toBeUndefined();
    sessions.expire(1500);
    expect(sessions.get('tab1')).toBeDefined();
    expect(changes).toBe(0);
    sessions.expire(2000);
    expect(sessions.get('tab1')).toBeUndefined();
  });

  it('drops the axe pass of a page that loaded again and keeps its baseline', () => {
    const sessions = createAuditSessions();
    sessions.mark('tab1', 'before', snapshot([], {}));
    expect(sessions.dropAxe('tab1')).toBe(false);
    sessions.setAxe('tab1', axe());
    expect(sessions.summary().pages['tab1']).toEqual({ before: NOW, axe: NOW });
    expect(sessions.dropAxe('tab1')).toBe(true);
    expect(sessions.get('tab1')?.axe).toBeUndefined();
    expect(sessions.get('tab1')?.before).toBeDefined();
  });
});

describe('toAxeReport', () => {
  it('masks again on the server and drops links and ids it does not trust', () => {
    const report = toAxeReport({
      at: NOW,
      ms: 50,
      url: `/trips?token=${JWT}`,
      violations: [
        {
          id: 'image-alt',
          impact: 'critical',
          help: `Images must have alternative text ${JWT}`,
          helpUrl: 'https://evil.example/phish',
          tags: ['wcag2a', '<script>'],
          count: 30,
          nodes: [
            {
              target: `img[data-t="${JWT}"]`,
              html: '<img>',
              elementId: 'c1-2',
              owner: { id: 'bad id!', name: 'TripPhoto' },
            },
          ],
        },
        { id: '../../etc', nodes: [] },
        'junk',
      ],
    });
    expect(report).not.toBeNull();
    expect(JSON.stringify(report)).not.toContain(JWT);
    expect(report!.violations).toHaveLength(1);
    const [violation] = report!.violations;
    expect(violation!.helpUrl).toBeUndefined();
    expect(violation!.tags).toEqual(['wcag2a']);
    expect(violation!.count).toBe(30);
    expect(violation!.nodes[0]).toMatchObject({ elementId: 'c1-2' });
    expect(violation!.nodes[0]!.owner).toBeUndefined();
    expect(toAxeReport({ violations: 'nope' })).toBeNull();
    expect(toAxeRunResult({ ok: false })).toEqual({
      ok: false,
      error: 'The page sent no axe result.',
    });
  });
});
