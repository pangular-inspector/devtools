import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_REFRESH_DELAY_MS, AuditInspector } from '../pages/audit-inspector';
import type { AuditFinding, AuditResponse } from '../pages/audit-types';

const NOW = Date.UTC(2026, 9, 13, 10, 0, 0);

const finding = (extra: Partial<AuditFinding>): AuditFinding => ({
  key: `${extra.area ?? 'errors'}:${extra.rule ?? 'x'}:${extra.subject ?? ''}`,
  severity: 'error',
  area: 'errors',
  rule: 'NG0201',
  why: 'NullInjectorError: No provider for TripApi!',
  tool: 'pangular:explain-error',
  ...extra,
});

const findings: AuditFinding[] = [
  finding({
    area: 'accessibility',
    rule: 'image-alt',
    subject: 'TripPhoto',
    why: 'Images must have alternative text (critical).',
    tool: 'pangular:audit',
    args: { page: 'p1', area: 'accessibility' },
    count: 2,
    elementId: 'c1-9',
  }),
  finding({ subject: 'TripList', elementId: 'c1-2', args: { page: 'p1', id: 'e1' }, count: 3 }),
  finding({
    severity: 'warning',
    area: 'change-detection',
    rule: 'onpush-candidate',
    subject: 'TripList',
    why: 'TripList was refreshed 40 times and changed something in 2.',
    tool: 'pangular:diagnose-change-detection',
  }),
];

function response(extra: Partial<AuditResponse> = {}): AuditResponse {
  return {
    pages: [{ pageId: 'p1', url: '/trips', title: 'Trips' }],
    report: {
      pageId: 'p1',
      url: '/trips',
      at: NOW,
      findings,
      metrics: { cdMeanMs: 4.5, errors: 3, findingsError: 2, findingsWarning: 1, findingsInfo: 0 },
      sources: [
        { area: 'accessibility', state: 'ok' },
        { area: 'router', state: 'off' },
        { area: 'leaks', state: 'empty', note: 'No leak report yet.' },
      ],
    },
    session: { before: null, after: null, diff: null },
    axe: null,
    ...extra,
  };
}

let fixture: ComponentFixture<AuditInspector>;
let calls: { name: string; arg: unknown }[];
let answers: Record<string, unknown>;
let listeners: (() => void)[];
const host = () => fixture.nativeElement as HTMLElement;
const text = () => host().textContent!.replace(/\s+/g, ' ');
const button = (label: string) =>
  [...host().querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(label))!;
const settle = async () => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  fixture.detectChanges();
};

function start(backend = 'websocket') {
  const client = {
    connectionMeta: { backend },
    scope: () => ({
      rpc: {
        call: vi.fn(async (name: string, arg: unknown) => {
          calls.push({ name, arg });
          const answer = answers[name];
          return typeof answer === 'function' ? answer(arg) : answer;
        }),
        sharedState: async () => ({
          value: () => ({ pages: {} }),
          on: (_: string, listener: () => void) => {
            listeners.push(listener);
            return () => {};
          },
        }),
      },
    }),
  };
  fixture = TestBed.createComponent(AuditInspector);
  fixture.componentRef.setInput('rpc', client as unknown as DevframeRpcClient);
}

describe('AuditInspector', () => {
  beforeEach(() => {
    calls = [];
    listeners = [];
    answers = { 'get-audit': response() };
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('lists the findings ranked as the server sent them, with the agent tool for each', async () => {
    start();
    await settle();
    const rows = [...host().querySelectorAll('.finding')];
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain('Accessibility');
    expect(rows[0]!.textContent).toContain('TripPhoto');
    expect(rows[0]!.textContent).toContain('2×');
    expect(rows[1]!.textContent).toContain('explain-error { id: "e1" }');
    expect(text()).toContain('3 of 3 findings');
    expect(text()).toContain('Mean cycle time4.5 ms');
    expect(text()).toContain('Router Its inspector is turned off.');
    expect(text()).toContain('Leaks No leak report yet.');
    expect(host().querySelector('h2')?.textContent).toContain('Before and after');
    expect(calls[0]).toEqual({ name: 'get-audit', arg: { pageId: undefined } });
  });

  it('filters by text and shows Clear filters when nothing matches', async () => {
    start();
    await settle();
    const search = host().querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'onpush';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(host().querySelectorAll('.finding')).toHaveLength(1);
    expect(text()).toContain('1 of 3 findings');
    search.value = 'nothing like this';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(text()).toContain('No finding matches the filters.');
    button('Clear filters').click();
    await settle();
    expect(host().querySelectorAll('.finding')).toHaveLength(3);
  });

  it('runs axe on the page and reads the audit again, or says why it did not run', async () => {
    answers['request-axe-run'] = { ok: true, violations: 1 };
    start();
    await settle();
    answers['get-audit'] = response({ axe: { at: NOW, ms: 30, violations: [{}] } });
    button('Run axe').click();
    await settle();
    expect(calls.map((c) => c.name)).toEqual(['get-audit', 'request-axe-run', 'get-audit']);
    expect(calls[1]!.arg).toEqual({ pageId: 'p1' });
    expect(text()).toContain('1 rule broken');

    answers['request-axe-run'] = { ok: false, error: 'The page did not answer within 60s.' };
    button('Run axe').click();
    await settle();
    expect(host().querySelector('[role="alert"]')?.textContent).toContain('did not answer');
  });

  it('takes a baseline and an after audit, and shows the comparison', async () => {
    answers['audit-session'] = { ok: true };
    start();
    await settle();
    expect(button('Take after audit').disabled).toBe(true);
    const before = { at: NOW, findings, metrics: {}, axe: true };
    answers['get-audit'] = response({ session: { before, after: null, diff: null } });
    button('Take baseline').click();
    await settle();
    expect(calls.find((c) => c.name === 'audit-session')?.arg).toEqual({
      pageId: 'p1',
      action: 'before',
    });
    expect(text()).toContain('Baseline at');
    expect(button('Take after audit').disabled).toBe(false);

    answers['get-audit'] = response({
      session: {
        before,
        after: { ...before, findings: findings.slice(1) },
        diff: {
          resolved: [findings[0]!],
          added: [],
          remaining: [{ ...findings[1]!, count: 1, countBefore: 3 }],
          metrics: [
            { metric: 'cdMeanMs', before: 6, after: 4.5, delta: -1.5 },
            { metric: 'errors', before: 3, after: 4, delta: 1 },
            { metric: 'retained', after: 0 },
          ],
          notes: [],
        },
      },
    });
    button('Take after audit').click();
    await settle();
    const rows = [...host().querySelectorAll('tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent!.trim()).join(' | '),
    );
    expect(rows).toEqual([
      'Mean cycle time | 6 ms | 4.5 ms | −1.5 ms, better',
      'Retained components | Not measured | 0 | Not compared',
      'Error occurrences | 3 | 4 | +1, worse',
    ]);
    expect(text()).toContain('Resolved (1)');
    expect(text()).toContain('image-alt in TripPhoto');
    expect(text()).toContain('NG0201 in TripList: 3× → 1×');
    expect([...host().querySelectorAll('h3')].map((h) => h.textContent?.trim())).toEqual([
      'Resolved (1)',
      'New (0)',
      'Changed count (1)',
    ]);
  });

  it('opens a component for errors and highlights an element for axe findings', async () => {
    start();
    await settle();
    const emitted: unknown[] = [];
    fixture.componentInstance.showComponent.subscribe((focus) => emitted.push(focus));
    button('Show component').click();
    expect(emitted).toEqual([{ id: 'c1-2', pageId: 'p1' }]);
    button('Show in page').click();
    await settle();
    expect(calls.find((c) => c.name === 'request-page-highlight')?.arg).toEqual({
      pageId: 'p1',
      id: 'c1-9',
      reveal: true,
    });
  });

  it('reads the audit again once for a burst of session or axe pass changes', async () => {
    start();
    await settle();
    expect(listeners).toHaveLength(1);
    // An axe pass starting, its result and its end arrive together.
    listeners[0]!();
    listeners[0]!();
    listeners[0]!();
    await settle();
    expect(calls.filter((c) => c.name === 'get-audit')).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, AUDIT_REFRESH_DELAY_MS + 20));
    await settle();
    expect(calls.filter((c) => c.name === 'get-audit')).toHaveLength(2);
  });

  it('offers no Show component, Show in page nor outline with the Components inspector off', async () => {
    start();
    fixture.componentRef.setInput('canShowComponent', false);
    await settle();
    expect(button('Show component')).toBeUndefined();
    expect(button('Show in page')).toBeUndefined();
    host().querySelector<HTMLElement>('.finding')!.dispatchEvent(new Event('mouseenter'));
    await settle();
    expect(calls.some((c) => c.name === 'request-page-highlight')).toBe(false);
  });

  it('says what to do without a page, after an error, and in a static report', async () => {
    answers['get-audit'] = { pages: [], report: null };
    start();
    await settle();
    expect(text()).toContain('No page reports live data yet.');
    fixture.destroy();

    answers['get-audit'] = () => Promise.reject(new Error('gone'));
    start();
    await settle();
    expect(text()).toContain("Can't read the audit");
    expect(button('Retry')).toBeTruthy();
    fixture.destroy();

    start('static');
    await settle();
    expect(text()).toContain('a static report has none');
  });
});
