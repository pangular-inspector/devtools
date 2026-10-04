// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

type Handler = (name: string, arg: unknown) => unknown;

const PROJECT = {
  analog: true,
  version: '2.7.5',
  routes: [],
  api: [],
  middleware: [],
  content: [],
  serverFns: [
    { name: 'getUsers', file: '/src/app/users.server.ts', id: 'aaaaaaaaaaaaaaaa', method: 'GET' },
  ],
};

let testBedReady = false;

async function mount(handler: Handler, state: unknown = {}) {
  await import('@angular/compiler');
  const { TestBed } = await import('@angular/core/testing');
  const { BrowserTestingModule, platformBrowserTesting } =
    await import('@angular/platform-browser/testing');
  const { Input, Output, ViewChild } = await import('@angular/core');
  const { AnalogInspector } = await import('../../../../app/src/pages/analog-inspector.ts');
  const { Select } = await import('../../../../app/src/ui/select.ts');
  const signalInput = (name: string, required = false) => [
    { type: Input, args: [{ isSignal: true, alias: name, required }] },
  ];
  (AnalogInspector as unknown as { propDecorators: unknown }).propDecorators = {
    rpc: signalInput('rpc'),
  };
  (Select as unknown as { propDecorators: unknown }).propDecorators = {
    options: signalInput('options', true),
    value: [...signalInput('value'), { type: Output, args: ['valueChange'] }],
    placeholder: signalInput('placeholder'),
    ariaLabel: signalInput('ariaLabel'),
    labelledBy: signalInput('labelledBy'),
    disabled: signalInput('disabled'),
    emptyText: signalInput('emptyText'),
    trigger: [{ type: ViewChild, args: ['trigger', { isSignal: true }] }],
    list: [{ type: ViewChild, args: ['list', { isSignal: true }] }],
  };
  if (!testBedReady) {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    testBedReady = true;
  }
  TestBed.resetTestingModule();
  const client = {
    connectionMeta: {},
    scope: () => ({
      rpc: {
        call: async (name: string, arg?: unknown) => handler(name, arg),
        sharedState: async () => ({ value: () => state, on: () => () => {} }),
      },
    }),
  };
  const fixture = TestBed.createComponent(AnalogInspector);
  document.body.append(fixture.nativeElement);
  fixture.componentRef.setInput('rpc', client);
  const settle = async () => {
    for (let i = 0; i < 5; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  await settle();
  const el = fixture.nativeElement as HTMLElement;
  const type = async (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const submit = async (selector: string) => {
    el.querySelector<HTMLFormElement>(selector)!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await settle();
  };
  const tab = async (id: string) => {
    el.querySelector<HTMLButtonElement>(`#analog-tab-${id}`)!.click();
    await settle();
  };
  return { fixture, el, settle, type, submit, tab, inspector: fixture.componentInstance };
}

const match = (file: string, params: Record<string, string>) => ({
  matched: true,
  chain: [{ id: file, fullPath: '/x', file, kind: 'page', params: [], children: [] }],
  params,
  rejected: [],
});

describe('Analog panel', () => {
  it('shows the URL that was explained, not the one being typed, and reports failures', async () => {
    let fail = false;
    const { el, type, submit } = await mount((name) => {
      if (name === 'analog-project') return PROJECT;
      if (name === 'analog-explain-url') {
        if (fail) throw new Error('socket closed');
        return match('/src/app/pages/products/[id].page.ts', { id: '42' });
      }
      return null;
    });
    await type('#analog-url', '/products/42');
    await submit('form.explain');
    const result = () => el.querySelector('.explain-result')!.textContent!.replace(/\s+/g, ' ');
    expect(result()).toContain('/products/42 renders');
    expect(result()).toContain('id = 42');
    await type('#analog-url', '/nope');
    expect(result()).toContain('/products/42 renders');
    expect(result()).not.toContain('/nope');
    await type('#analog-url', '  ');
    await submit('form.explain');
    expect(result()).toContain('Type a URL to explain');
    fail = true;
    await type('#analog-url', '/products/7');
    await submit('form.explain');
    expect(result()).toContain('Could not explain /products/7. socket closed.');
    expect(result()).not.toContain('renders');
  });

  it('clears the old response and blocks a second send while a request runs', async () => {
    let resolve: (value: unknown) => void = () => {};
    const sent: unknown[] = [];
    const { el, type, submit, tab, settle, inspector } = await mount((name, arg) => {
      if (name === 'analog-project') return PROJECT;
      if (name === 'analog-call-api') {
        sent.push(arg);
        return new Promise((r) => (resolve = r));
      }
      return null;
    });
    await tab('server');
    await type('#api-path', '/api/v1/hello');
    inspector.response.set({ ok: true, status: 200, ms: 1, type: 'x', body: '"old"' });
    await submit('form.playground');
    const button = () =>
      el.querySelector<HTMLButtonElement>('form.playground button[type=submit]')!;
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Sending');
    expect(el.querySelector('.response')).toBeNull();
    await submit('form.playground');
    expect(sent).toHaveLength(1);
    resolve({ ok: true, status: 201, ms: 3, type: 'application/json', body: '"new"' });
    await settle();
    expect(button().disabled).toBe(false);
    expect(el.querySelector('.response')!.textContent).toContain('201');
  });

  it('keeps Send off for data-changing methods until the checkbox is ticked', async () => {
    const sent: unknown[] = [];
    const { el, type, submit, tab, settle, inspector } = await mount((name, arg) => {
      if (name === 'analog-project') return PROJECT;
      if (name === 'analog-call-api') {
        sent.push(arg);
        return { ok: true, status: 200, ms: 1, type: '', body: '' };
      }
      return null;
    });
    await tab('server');
    await type('#api-path', '/api/v1/products');
    inspector.method.set('POST');
    await settle();
    const button = el.querySelector<HTMLButtonElement>('form.playground button[type=submit]')!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('analog-confirm-hint');
    expect(el.querySelector('#analog-confirm-hint')!.textContent).toContain('POST');
    await submit('form.playground');
    expect(sent).toHaveLength(0);
    el.querySelector<HTMLInputElement>('.check input')!.dispatchEvent(new Event('change'));
    await settle();
    expect(button.disabled).toBe(false);
    await submit('form.playground');
    expect(sent).toEqual([{ method: 'POST', path: '/api/v1/products', confirm: true }]);
  });

  it('shows each lint finding message, deduped', async () => {
    const findings = [
      {
        rule: 'hydration-error',
        severity: 'error',
        path: '/products/1',
        message: 'NG0500: During hydration Angular expected <p> but found <div>',
        fix: 'x',
      },
      {
        rule: 'hydration-error',
        severity: 'error',
        path: '/products/1',
        message: 'NG0500: During hydration Angular expected <p> but found <div>',
        fix: 'x',
      },
      {
        rule: 'duplicate-url',
        severity: 'error',
        path: '/about',
        file: '/src/app/pages/about.md',
        message:
          '/src/app/pages/about.md and /src/app/pages/about/index.page.ts both resolve to /about; only one is reachable.',
        fix: 'x',
      },
      {
        rule: 'missing-default-export',
        severity: 'error',
        path: '/team',
        file: '/src/app/pages/team.page.ts',
        message: 'The page has no default export, so Analog renders nothing.',
        fix: 'x',
      },
    ];
    const { el, tab } = await mount((name) => {
      if (name === 'analog-project') return PROJECT;
      if (name === 'analog-lint') return findings;
      return null;
    });
    await tab('lint');
    const text = el.querySelector('.findings')!.textContent!;
    expect(text.match(/During hydration Angular expected <p> but found <div>/g)).toHaveLength(1);
    expect(text).toContain('/src/app/pages/about/index.page.ts');
    expect(text).toContain('/src/app/pages/about.md and');
    expect(text).not.toContain('The page has no default export, so Analog renders nothing.');
  });

  it('names server functions, marks SSR seeds and lists form action outcomes', async () => {
    const id = 'aaaaaaaaaaaaaaaa';
    const state = {
      calls: [
        {
          id: 1,
          at: 1,
          kind: 'fn',
          method: 'SSR',
          url: `/_analog/fn/${id}`,
          route: id,
          status: 200,
          ms: 0,
          from: 'ssr',
          seeded: true,
        },
        {
          id: 2,
          at: 2,
          kind: 'fn',
          method: 'GET',
          url: `/_analog/fn/${id}`,
          route: id,
          status: 200,
          ms: 5,
          from: 'browser',
        },
        {
          id: 3,
          at: 3,
          kind: 'action',
          method: 'POST',
          url: '/api/_analog/pages/login',
          route: '/login',
          status: 422,
          ms: 4,
          from: 'browser',
          outcome: 'invalid',
        },
      ],
      refetches: [{ id, ssrAt: 1, browserAt: 2 }],
    };
    const { el, tab, inspector, settle } = await mount(
      (name) => (name === 'analog-project' ? PROJECT : null),
      state,
    );
    await tab('server');
    const text = el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Server function read ran twice: getUsers');
    const calls = el.querySelector('[aria-label="Server calls"]')!;
    expect(calls.querySelector('strong.url')!.textContent).toBe('getUsers');
    expect(calls.textContent).toContain('users.server.ts');
    expect(calls.textContent).not.toContain(`/_analog/fn/${id}`);
    expect(text).toContain('ran during server rendering');
    expect(text).toContain('in process');
    expect(text).toContain('validation errors');
    expect(el.querySelector('[aria-label="Server functions"]')!.textContent).toContain('getUsers');
    inspector.kind.set('action');
    await settle();
    const rows = el.querySelectorAll('[aria-label="Server calls"] tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('/api/_analog/pages/login');
  });
});
