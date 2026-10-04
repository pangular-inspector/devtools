import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import type { CollectedForm, FormEvent, FormFieldNode } from '../forms.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    ((await ctx.agent.invoke(`pangular:${tool}`, args)) as { markdown: string }).markdown;
  return { ctx, push, call };
}

function leaf(key: string, extra: Partial<FormFieldNode> = {}): FormFieldNode {
  return {
    key,
    path: key,
    type: 'control',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: true,
    errors: [],
    value: '',
    ...extra,
  };
}

const signup: CollectedForm = {
  id: 'form-1@pg1',
  kind: 'reactive',
  owner: 'Signup',
  property: 'form',
  label: 'Signup.form',
  submitted: false,
  submitDom: {
    tag: 'form',
    buttons: 0,
    disabledButtons: 0,
    novalidate: true,
    nativeInvalid: 0,
    reasons: [
      'No submit button: the buttons in this form are type="button", so clicking them does not submit.',
    ],
  },
  root: {
    key: 'form',
    path: '',
    type: 'group',
    status: 'INVALID',
    touched: true,
    dirty: true,
    bound: false,
    errors: [],
    children: [
      leaf('email', {
        status: 'INVALID',
        touched: true,
        value: 'x',
        errors: [{ kind: 'email', message: 'is not a valid email address', source: 'own' }],
        validatorNames: ['email', 'required (template)'],
        binding: { kind: 'native', accessor: 'DefaultValueAccessor', element: 'input' },
        dom: { labelled: false, errorShown: false, required: true },
      }),
      leaf('password', { value: '[redacted]', redacted: 'key' }),
      leaf('nickname', { status: 'DISABLED', value: 'kam' }),
      leaf('age', {
        value: 3,
        stale: ['min'],
        updateOn: 'blur',
        uncommitted: 30,
        binding: {
          kind: 'accessor',
          accessor: 'AgePicker',
          element: 'age-picker',
          disabledHook: false,
        },
        dom: { drift: '7', labelled: true },
      }),
      leaf('code', { status: 'PENDING', pendingSince: Date.now() - 9000 }),
    ],
  },
};

const profile: CollectedForm = {
  id: 'form-2@pg2',
  kind: 'signal',
  owner: 'Profile',
  property: 'form',
  label: 'Profile.form',
  submit: { hasAction: false, hasOnInvalid: false, submitting: false, willRun: true },
  submitDom: {
    tag: 'form',
    buttons: 1,
    disabledButtons: 0,
    novalidate: true,
    nativeInvalid: 0,
    reasons: [],
  },
  root: {
    key: 'form',
    path: '',
    type: 'group',
    status: 'INVALID',
    touched: false,
    dirty: false,
    bound: false,
    errors: [],
    children: [
      leaf('confirm', {
        status: 'INVALID',
        errors: [{ kind: 'mismatch', message: 'Must match', source: 'tree', from: '' }],
        rules: { tree: 1 },
      }),
      leaf('card', { hidden: true, skipped: 'hidden', required: true }),
      leaf('bio', { required: true, bound: false }),
    ],
  },
};

const events: FormEvent[] = [
  {
    formId: 'form-1@pg1',
    path: 'email',
    type: 'value',
    detail: '"x"',
    prev: '""',
    origin: 'user',
    count: 3,
    timestamp: 1000,
    seq: 1,
  },
  {
    formId: 'form-1@pg1',
    path: 'email',
    type: 'status',
    detail: 'VALID → INVALID',
    origin: 'user',
    timestamp: 1001,
    seq: 2,
  },
  {
    formId: 'form-1@pg1',
    path: '',
    type: 'submit',
    detail: 'status INVALID at submit',
    outcome: 'ran',
    origin: 'user',
    timestamp: 1002,
    seq: 3,
  },
  {
    formId: 'form-1@pg1',
    path: 'email',
    type: 'value',
    detail: '"xy"',
    prev: '"x"',
    origin: 'code',
    timestamp: 1003,
    seq: 4,
  },
];

async function withForms() {
  const booted = await boot();
  await booted.push('push-forms', {
    pageId: 'pg1',
    forms: [signup],
    events,
    setupErrors: [
      "NG01203: No value accessor for form control name: 'age'",
      'NG01050: formControlName in page header must be inside a formGroup',
    ],
  });
  await booted.push('push-forms', { pageId: 'pg2', forms: [profile], events: [] });
  return booted;
}

describe('forms MCP tools', () => {
  it('names the reporting pages for an unknown page instead of listing every form', async () => {
    const { call } = await withForms();
    for (const tool of [
      'inspect-forms',
      'explain-form-invalid',
      'explain-field',
      'explain-submit',
      'form-payload',
      'form-history',
      'form-diff',
      'lint-forms',
      'explain-custom-control',
      'export-form',
      'wait-for-form',
    ]) {
      const text = await call(tool, { page: 'gone', form: 'Signup' });
      expect(text, tool).toMatch(/^No page `gone` is reporting forms\. Pages that report forms: /);
      expect(text, tool).toContain('`pg1`');
      expect(text, tool).toContain('`pg2`');
      expect(text, tool).not.toContain('No form matches');
    }
    expect(await call('inspect-forms', { page: 'pg1' })).toContain('Signup.form');
  });

  it('every tool says so when no page reported forms', async () => {
    const { call } = await boot();
    for (const tool of [
      'inspect-forms',
      'explain-form-invalid',
      'explain-field',
      'explain-submit',
      'form-payload',
      'form-history',
      'form-diff',
      'lint-forms',
      'explain-custom-control',
      'export-form',
      'form-action',
      'fill-form',
    ]) {
      expect(await call(tool, { form: 'x', action: 'focus', values: {} }), tool).toMatch(
        /No forms have been reported/,
      );
    }
  });

  it('inspect-forms and explain-form-invalid filter by page and label sources', async () => {
    const { call } = await withForms();
    const list = await call('inspect-forms', { page: 'pg2' });
    expect(list).toContain('Profile.form');
    expect(list).not.toContain('Signup.form');
    const explained = await call('explain-form-invalid', { form: 'Signup' });
    expect(explained).toContain(
      '[email] is not a valid email address (validator; touched: yes, error not shown)',
    );
    expect(explained).toContain('validators now report min');
    expect(explained).toMatch(/`code` = "" is waiting for an async validator for \d+s/);
    expect(await call('explain-form-invalid', { form: 'Profile' })).toContain(
      'cross-field rule on the form',
    );
  });

  it('explain-field covers sources, uncommitted input, bindings and DOM', async () => {
    const { call } = await withForms();
    const email = await call('explain-field', { form: 'form-1', path: 'email' });
    expect(email).toContain('[email] is not a valid email address (validator)');
    expect(email).toContain('Validators: email, required (template).');
    expect(email).toContain("through Angular's DefaultValueAccessor");
    expect(email).toContain('no accessible label');
    expect(email).toMatch(/#4 .* value "x" → "xy" \(code\)/);
    const age = await call('explain-field', { form: 'form-1', path: 'age' });
    expect(age).toContain('Uncommitted: the input holds 30, which reaches the model on blur.');
    expect(age).toContain('Stale:');
    expect(await call('explain-field', { form: 'form-1', path: 'password' })).toContain(
      'Value: "[redacted]" (redacted: name looks secret).',
    );
    const card = await call('explain-field', { form: 'Profile', path: 'card' });
    expect(card).toContain('Validation is skipped because the field is hidden.');
    expect(await call('explain-field', { form: 'Profile', path: 'nope' })).toContain(
      'No field at `nope`',
    );
  });

  it('explain-field resolves a selector through the page', async () => {
    const { ctx, call } = await withForms();
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: any) => {
      const { requestId, request } = options.args[0];
      expect(request).toEqual({ action: 'locate', selector: '#email' });
      await ctx.rpc.invokeLocal(
        'pangular:form-action-result' as never,
        ...([{ requestId, result: { ok: true, formId: 'form-1@pg1', path: 'email' } }] as never),
      );
    }) as never);
    expect(await call('explain-field', { selector: '#email' })).toContain(
      '`email` in `Signup.form`',
    );
    expect(broadcast).toHaveBeenCalledOnce();
  });

  it('explain-submit explains ngSubmit, DOM reasons and missing actions', async () => {
    const { call } = await withForms();
    const reactive = await call('explain-submit', { form: 'Signup' });
    expect(reactive).toContain('ngSubmit fires on every submit, valid or not');
    expect(reactive).toContain('DOM: No submit button');
    expect(reactive).toContain('- `email`: email (validator)');
    expect(reactive).toMatch(/Recent submits:\n- #3 .*\(user, ran\)/);
    expect(await call('explain-submit', { form: 'Profile' })).toContain('throws NG01915');
    expect(await call('explain-submit', {})).toContain('2 forms match');
  });

  it('form-payload shows what value drops and what Signal Forms keeps', async () => {
    const { call } = await withForms();
    const reactive = await call('form-payload', { form: 'Signup' });
    expect(reactive).toContain('Left out of form.value because they are disabled: `nickname`');
    expect(reactive).toContain('"nickname":"kam"');
    expect(reactive).toContain('Secret values show as [redacted].');
    expect(await call('form-payload', { form: 'Profile' })).toContain('`card (hidden)`');
  });

  it('form-history filters by origin and returns a marker; form-diff nets changes', async () => {
    const { call } = await withForms();
    const history = await call('form-history', { form: 'Signup', origin: 'user' });
    expect(history).toContain('×3');
    expect(history).not.toContain('"xy"');
    expect(history).toContain('Marker: 4');
    const diff = await call('form-diff', { form: 'Signup', since: 0 });
    expect(diff).toContain('- `email` value: "" → "xy" (4 changes)');
    expect(diff).toContain('- `email` status: VALID → INVALID');
    expect(await call('form-diff', { form: 'Signup', since: 4 })).toContain(
      'Nothing changed since marker 4',
    );
  });

  it('form-history shows callers, async timing, render counts and moves', async () => {
    const { push, call } = await boot();
    await push('push-forms', {
      pageId: 'pg1',
      forms: [signup],
      instrumented: true,
      events: [
        {
          formId: 'form-1@pg1',
          path: 'email',
          type: 'value',
          detail: '"a@b.co"',
          origin: 'code',
          caller: 'setValue in Checkout.prefill (src/app/checkout.ts:42:7)',
          timestamp: 1,
          seq: 1,
        },
        {
          formId: 'form-1@pg1',
          path: 'code',
          type: 'status',
          detail: 'VALID',
          ms: 820,
          timestamp: 2,
          seq: 2,
        },
        {
          formId: 'form-1@pg1',
          path: 'email',
          type: 'value',
          detail: '"a"',
          origin: 'user',
          renders: 14,
          rendered: ['Checkout×9', 'Summary×5'],
          timestamp: 3,
          seq: 3,
        },
        {
          formId: 'form-1@pg1',
          path: 'items.0',
          type: 'moved',
          detail: 'items.2 → items.0',
          timestamp: 4,
          seq: 4,
        },
        {
          formId: 'form-1@pg1',
          path: 'age',
          type: 'validators',
          detail: 'setValidators',
          origin: 'code',
          timestamp: 5,
          seq: 5,
        },
      ],
    });
    const text = await call('form-history', { form: 'Signup' });
    expect(text).toContain('from setValue in Checkout.prefill (src/app/checkout.ts:42:7)');
    expect(text).toContain('pending 820ms');
    expect(text).toContain('14 template updates: Checkout×9, Summary×5');
    expect(text).toContain('`items.0` moved items.2 → items.0');
    expect(await call('form-history', { form: 'Signup', type: 'validators' })).toContain(
      'setValidators',
    );
  });

  it('lint-forms reports model-aware findings and setup errors', async () => {
    const { call } = await withForms();
    const text = await call('lint-forms', {});
    for (const rule of [
      'setup-error',
      'formroot-no-submission',
      'stale-validity',
      'stuck-pending',
      'view-out-of-sync',
      'missing-label',
      'submit-unreachable',
      'unbound-required',
      'no-focus-on-invalid-submit',
    ]) {
      expect(text, rule).toContain(rule);
    }
    expect(await call('lint-forms', { form: 'Profile' })).not.toContain('setup-error');
  });

  it('explain-custom-control explains accessor contracts and setup errors', async () => {
    const { call } = await withForms();
    const text = await call('explain-custom-control', { form: 'Signup', path: 'age' });
    expect(text).toContain('custom ControlValueAccessor AgePicker');
    expect(text).toContain('has no setDisabledState');
    expect(text).toContain('Drift:');
    expect(text).toContain('NG01203');
    expect(text).not.toContain('NG01050');
  });

  it('export-form writes a snapshot or a fixture with the secret still redacted', async () => {
    const { call } = await withForms();
    const fixture = await call('export-form', { form: 'Signup', format: 'fixture' });
    expect(fixture).toContain('form.patchValue(');
    expect(fixture).toContain("form.get('nickname')?.disable();");
    expect(fixture).toContain("expect(form.status).toBe('INVALID');");
    expect(fixture).toContain('[redacted]');
    const snapshot = await call('export-form', { form: 'Profile' });
    expect(snapshot).toContain('"kind": "signal"');
  });

  it('wait-for-form resolves when the condition holds and times out otherwise', async () => {
    const { call, push } = await withForms();
    expect(await call('wait-for-form', { form: 'Profile', until: 'not-pending' })).toMatch(
      /holds after \d+ms/,
    );
    expect(
      await call('wait-for-form', { form: 'Signup', until: 'valid', timeoutMs: 150 }),
    ).toContain('Timed out after 150ms');
    const waiting = call('wait-for-form', {
      form: 'Signup',
      until: 'submitted',
      since: 3,
      timeoutMs: 3000,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await push('push-forms', {
      pageId: 'pg1',
      forms: [signup],
      events: [
        ...events,
        { formId: 'form-1@pg1', path: '', type: 'submit', outcome: 'ran', timestamp: 2000, seq: 5 },
      ],
    });
    expect(await waiting).toContain('Marker: 5');
  });

  it('keeps markers valid across pages whose own counters differ, and across a reload', async () => {
    const { call, push } = await boot();
    const busy = Array.from({ length: 300 }, (_, i) => ({
      formId: 'form-1@pg1',
      path: 'email',
      type: 'status',
      detail: i % 2 ? 'VALID' : 'INVALID',
      timestamp: 1000 + i,
      seq: i + 1,
    }));
    await push('push-forms', { pageId: 'pg1', forms: [signup], events: busy });
    await push('push-forms', { pageId: 'pg2', forms: [profile], events: [] });
    const marker = Number((await call('form-history', {})).match(/Marker: (\d+)/)![1]);
    expect(marker).toBeGreaterThan(0);

    const waiting = call('wait-for-form', {
      form: 'Profile',
      until: 'submitted',
      since: marker,
      timeoutMs: 3000,
    });
    const filled = [
      {
        formId: 'form-2@pg2',
        path: 'name',
        type: 'value',
        detail: '"Kam"',
        prev: '""',
        timestamp: 5000,
        seq: 1,
      },
      { formId: 'form-2@pg2', path: '', type: 'submit', outcome: 'ran', timestamp: 5001, seq: 2 },
    ];
    await new Promise((resolve) => setTimeout(resolve, 150));
    await push('push-forms', { pageId: 'pg2', forms: [profile], events: filled });
    expect(await waiting).toMatch(/holds after/);
    expect(await call('form-diff', { form: 'Profile', since: marker })).toContain(
      '- `name` value: "" → "Kam"',
    );
    const history = await call('form-history', { form: 'Profile', since: marker });
    expect(history).toContain('`name` value');
    expect(history).toContain('submit');

    const after = Number(history.match(/Marker: (\d+)/)![1]);
    await push('push-forms', {
      pageId: 'pg2',
      forms: [profile],
      events: [{ ...filled[0], detail: '"Ada"', prev: '""', timestamp: 9000, seq: 1 }],
    });
    expect(await call('form-diff', { form: 'Profile', since: after })).toContain(
      '- `name` value: "" → "Ada"',
    );
  });

  it('form-action and fill-form ask the right page and report refusals', async () => {
    const { ctx, call } = await withForms();
    const seen: any[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: any) => {
      const { requestId, pageId, request } = options.args[0];
      seen.push({ pageId, request });
      const result =
        request.action === 'fill'
          ? {
              ok: true,
              message: 'Wrote 1 field(s), skipped 1.',
              skipped: [{ path: 'password', reason: 'looks secret' }],
              status: 'INVALID',
              invalid: ['email'],
            }
          : { ok: false, error: 'reset changes app state; call again with confirm: true.' };
      await ctx.rpc.invokeLocal(
        'pangular:form-action-result' as never,
        ...([{ requestId, result }] as never),
      );
    }) as never);
    const refused = await call('form-action', { action: 'reset', form: 'form-1' });
    expect(refused).toContain('Refused: reset changes app state');
    const filled = await call('fill-form', {
      form: 'form-1@pg1',
      values: { email: 'a@b.co', password: 'x' },
    });
    expect(filled).toContain('Skipped: `password` looks secret.');
    expect(filled).toContain('Fields with errors: `email`.');
    expect(seen.map((s) => s.pageId)).toEqual(['pg1', 'pg1']);
    expect(seen[1].request).toMatchObject({
      action: 'fill',
      formId: 'form-1@pg1',
      values: { email: 'a@b.co' },
    });
    expect(await call('form-action', { action: 'focus', form: 'nope' })).toContain('No form nope');
  });

  it('form-action times out when no page answers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const { ctx, call } = await withForms();
      vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async () => {}) as never);
      const pending = call('form-action', { action: 'focus', form: 'form-1', path: 'email' });
      await vi.advanceTimersByTimeAsync(15_001);
      expect(await pending).toContain('No page answered within 15s');
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses a short form id that matches forms on several pages', async () => {
    const { push, call } = await withForms();
    await push('push-forms', {
      pageId: 'pg3',
      forms: [{ ...signup, id: 'form-1@pg3' }],
      events: [],
    });
    for (const text of [
      await call('explain-field', { form: 'form-1', path: 'email' }),
      await call('form-action', { action: 'focus', form: 'form-1', path: 'email' }),
      await call('fill-form', { form: 'form-1', values: { email: 'a' } }),
    ]) {
      expect(text).toContain('pass the full `form` id');
      expect(text).toContain('form-1@pg1');
      expect(text).toContain('form-1@pg3');
    }
    expect(await call('explain-field', { form: 'form-1@pg3', path: 'email' })).not.toContain(
      'forms match',
    );
  });

  it('rejects reports with malformed new fields', async () => {
    const { push, call } = await boot();
    const bad = {
      ...signup,
      root: { ...signup.root, children: [leaf('a', { stale: [1 as never] })] },
    };
    await push('push-forms', { pageId: 'x', forms: [bad], events: [] });
    await push('push-forms', { pageId: 'y', forms: [signup], events: [], setupErrors: 'NG01203' });
    expect(await call('inspect-forms')).toMatch(/No forms have been reported/);
  });
});
