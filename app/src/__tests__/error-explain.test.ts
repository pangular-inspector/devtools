import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ErrorGroup, InjectionExplanation } from '../pages/errors-types';

vi.mock('devframe/client', () => ({ connectDevframe: () => new Promise(() => {}) }));

const { ErrorsInspector } = await import('../pages/errors-inspector');
const { codeSegments } = await import('../pages/errors-types');

const group = (extra: Partial<ErrorGroup>): ErrorGroup => ({
  id: 'e1',
  message: 'Error: something',
  count: 1,
  firstAt: 1_000,
  lastAt: 2_000,
  sources: ['handler'],
  owner: { id: 'c1-7', name: 'TripList' },
  ...extra,
});

type RpcCall = (name: string, args?: unknown) => Promise<unknown>;

function client(errors: ErrorGroup[], call: RpcCall = vi.fn<RpcCall>()) {
  const value = {
    pages: {
      p1: {
        pageId: 'p1',
        url: '/p1',
        title: 'Trips',
        reportedAt: 5_000,
        handler: 'wrapped',
        errors: Object.fromEntries(errors.map((e) => [e.id, e])),
        console: {},
        dropped: { errors: 0, console: 0 },
      },
    },
  };
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => value, on: () => () => {} }),
  };
  return { scope: () => ({ rpc }), events: { on: () => () => {} } } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function mount(errors: ErrorGroup[], options: { call?: RpcCall; injectors?: boolean } = {}) {
  const fixture = TestBed.createComponent(ErrorsInspector);
  fixture.componentRef.setInput('rpc', client(errors, options.call));
  fixture.componentRef.setInput('canExplainInjection', options.injectors ?? true);
  document.body.append(fixture.nativeElement);
  await settle(fixture);
  return fixture;
}

const host = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<unknown>) =>
  (host(fixture).textContent ?? '').replace(/\s+/g, ' ');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the Errors tab explainers', () => {
  it('shows what changed for an NG0100: binding, both values, fields and the signal write', async () => {
    const fixture = await mount([
      group({
        code: 'NG0100',
        explain: {
          kind: 'expression-changed',
          binding: 'title',
          template: 'TripList_Template',
          previous: 'Trips',
          current: 'Trips (3)',
          members: ['title'],
          writes: [
            {
              signal: 'heading',
              at: 4_000,
              stack: ['TripList.ngAfterViewInit (trip-list.ts:22:5)'],
            },
          ],
          writesKnown: true,
        },
      }),
    ]);
    const explain = host(fixture).querySelector('app-error-explain')!;
    expect(explain.querySelector('h3')?.textContent).toBe('What changed');
    const facts = [...explain.querySelectorAll('dt')].map((dt) => [
      dt.textContent?.trim(),
      dt.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim(),
    ]);
    expect(facts).toEqual([
      ['Binding', 'title in TripList_Template'],
      ['Previous', 'Trips'],
      ['Current', 'Trips (3)'],
      ['Held by', 'title'],
    ]);
    expect(text(fixture)).toContain('Signal heading at');
    expect(explain.querySelector('.frames code')?.textContent).toBe(
      'TripList.ngAfterViewInit (trip-list.ts:22:5)',
    );
  });

  it('says how to find the writer when no signal matched', async () => {
    const fixture = await mount([
      group({
        explain: { kind: 'expression-changed', previous: 'a', current: 'b', writesKnown: true },
      }),
    ]);
    expect(text(fixture)).toContain("A text interpolation (Angular doesn't name it)");
    expect(text(fixture)).toContain('No named signal was written with this value');
  });

  it('shows the server vs client DOM diff with signs a screen reader can tell apart', async () => {
    const fixture = await mount([
      group({
        code: 'NG0500',
        explain: {
          kind: 'hydration-mismatch',
          summary: 'During hydration Angular expected <div> but found <span>.',
          diff: [
            { op: 'same', text: '<p>' },
            { op: 'expected', text: '  <div>…</div>' },
            { op: 'actual', text: '  <span>…</span>' },
          ],
          external: true,
        },
      }),
    ]);
    const region = host(fixture).querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Server vs client DOM diff');
    expect(region.getAttribute('tabindex')).toBe('0');
    const lines = [...region.querySelectorAll('li')].map((li) => ({
      op: li.getAttribute('data-op'),
      label: li.querySelector('.sr-only')?.textContent ?? '',
      code: li.querySelector('code')?.textContent,
    }));
    expect(lines).toEqual([
      { op: 'same', label: '', code: '<p>' },
      { op: 'expected', label: 'Server only:', code: '  <div>…</div>' },
      { op: 'actual', label: 'Client only:', code: '  <span>…</span>' },
    ]);
    expect(text(fixture)).toContain('During hydration Angular expected <div> but found <span>.');
    expect(text(fixture)).toContain('browser extension or third-party script');
  });

  it('walks the lookup of a missing provider through explain-injection', async () => {
    const answer: InjectionExplanation = {
      pageId: 'p1',
      token: 'TripApi',
      flags: [],
      outcome: 'error',
      summary: 'No injector Angular asks provides `TripApi`, so it throws NG0201.',
      steps: [
        {
          id: 'el-list',
          name: '<app-trip-list>',
          type: 'element',
          component: 'TripList',
          status: 'missing',
          reason: 'Not in its providers.',
        },
        {
          id: 'env-r',
          name: 'Root',
          type: 'environment',
          status: 'missing',
          reason: "An `@Injectable({ providedIn: 'root' })` class would be created here.",
        },
      ],
    };
    const call = vi.fn<RpcCall>().mockResolvedValue(answer);
    const fixture = await mount(
      [
        group({
          code: 'NG0201',
          explain: { kind: 'missing-provider', token: 'TripApi', path: ['TripList', 'TripApi'] },
        }),
      ],
      { call },
    );
    expect(text(fixture)).toContain('TokenTripApi');
    expect(text(fixture)).toContain('PathTripList → TripApi');
    const button = [...host(fixture).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Explain lookup',
    )!;
    button.click();
    await settle(fixture);
    expect(call).toHaveBeenCalledWith('explain-injection', {
      selector: 'c1-7',
      token: 'TripApi',
      pageId: 'p1',
    });
    const steps = [...host(fixture).querySelectorAll('ol.steps > li')];
    expect(steps).toHaveLength(2);
    expect(steps[0]!.querySelector('.chip')?.textContent?.trim()).toBe('Not provided');
    // Code spans in reasons render as <code>, not as backticks.
    expect(steps[1]!.querySelector('.reason code')?.textContent).toBe(
      "@Injectable({ providedIn: 'root' })",
    );
    expect(host(fixture).querySelector('.summary code')?.textContent).toBe('TripApi');
    // No stray space between a code span and the text after it.
    expect(host(fixture).querySelector('.summary')?.textContent?.trim()).toBe(
      'No injector Angular asks provides TripApi, so it throws NG0201.',
    );
    // Only the summary is announced; the steps sit outside the live region.
    const live = host(fixture).querySelector('[aria-live="polite"]')!;
    expect(live.querySelector('.summary')).not.toBeNull();
    expect(live.querySelector('ol.steps')).toBeNull();
  });

  it('keeps Explain lookup enabled while it loads and ignores more clicks', async () => {
    let resolve!: (value: unknown) => void;
    const call = vi.fn<RpcCall>((name) =>
      name === 'explain-injection' ? new Promise((r) => (resolve = r)) : Promise.resolve(null),
    );
    const fixture = await mount(
      [group({ code: 'NG0201', explain: { kind: 'missing-provider', token: 'TripApi' } })],
      { call },
    );
    const button = [...host(fixture).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Explain lookup',
    )!;
    button.focus();
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);
    button.click();
    expect(call.mock.calls.filter(([name]) => name === 'explain-injection')).toHaveLength(1);
    resolve({ error: 'No injector data available.' });
    await settle(fixture);
    expect(button.hasAttribute('aria-disabled')).toBe(false);
  });

  it('shows why the lookup failed, and hides the button without the Injectors tab', async () => {
    const call = vi.fn<RpcCall>().mockResolvedValue({ error: 'No injector data available.' });
    const errors = [group({ explain: { kind: 'missing-provider', token: 'TripApi' } })];
    const fixture = await mount(errors, { call });
    [...host(fixture).querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Explain lookup')!
      .click();
    await settle(fixture);
    expect(host(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'No injector data available.',
    );
    const off = await mount(errors, { injectors: false });
    expect(
      [...host(off).querySelectorAll('button')].some((b) =>
        b.textContent?.includes('Explain lookup'),
      ),
    ).toBe(false);
  });

  it('splits code spans out of text', () => {
    expect(codeSegments('a `b` c')).toEqual([
      { code: false, text: 'a ' },
      { code: true, text: 'b' },
      { code: false, text: ' c' },
    ]);
  });
});
