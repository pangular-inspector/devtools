import {
  REDACTED,
  detailOf,
  type CollectedForm,
  type FormEvent,
  type FormFieldNode,
} from '../forms.ts';
import { REDACT_LABELS } from '../forms-privacy.ts';
import { lintForm, lintSetupErrors, type FormLintFinding } from './forms-lint.ts';
import {
  UNTRUSTED,
  code,
  freshness,
  matchForms,
  noMatch,
  onPage,
  sourceLabel,
  subtreeAt,
  type FormsState,
} from './forms-tools.ts';
import { droppedNote } from '../timeline-limits.ts';

export interface FieldArgs {
  form?: string;
  path?: string;
  page?: string;
}

const MAX_HISTORY = 200;

function walk(node: FormFieldNode, visit: (node: FormFieldNode) => void) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function pickForm(state: FormsState, args: FieldArgs): CollectedForm | string {
  const forms = matchForms(state.forms, args.form, args.page);
  if (!forms.length) {
    return state.forms.length
      ? noMatch(onPage(state.forms, args.page), args.form ?? '')
      : 'No forms have been reported.';
  }
  if (forms.length === 1) return forms[0];
  return exactForm(forms, args.form) ?? ambiguous(forms);
}

function exactForm(forms: CollectedForm[], query: string | undefined): CollectedForm | null {
  if (!query) return null;
  const full = forms.find((f) => f.id === query);
  if (full) return full;
  const short = forms.filter((f) => f.id.split('@')[0] === query);
  return short.length === 1 ? short[0] : null;
}

function ambiguous(forms: CollectedForm[]): string {
  return `${forms.length} forms match; pass the full \`form\` id: ${forms.map((f) => `${f.id} ${code(f.label)}`).join(', ')}.`;
}

export function resolveForm(
  forms: CollectedForm[],
  query: string | undefined,
): CollectedForm | string {
  const match = exactForm(forms, query);
  if (match) return match;
  const short = forms.filter((f) => f.id.split('@')[0] === query);
  return short.length > 1
    ? ambiguous(short)
    : `No form ${query ?? ''}. Forms: ${forms.map((f) => f.id).join(', ')}.`;
}

export function latestMarker(state: FormsState): number {
  return state.events.reduce((max, event) => Math.max(max, event.seq ?? 0), 0);
}

function flags(node: FormFieldNode): string {
  const out = [
    node.status,
    node.touched ? 'touched' : 'untouched',
    node.dirty
      ? node.changed === false
        ? 'dirty (value back to its original)'
        : 'dirty'
      : 'pristine',
  ];
  if (node.required) out.push('required');
  if (node.hidden) out.push(`hidden${node.hiddenBy === 'parent' ? ' (by a parent)' : ''}`);
  if (node.readonly) out.push(`readonly${node.readonlyBy === 'parent' ? ' (by a parent)' : ''}`);
  if (node.updateOn) out.push(`updateOn ${node.updateOn}`);
  return out.join(', ');
}

export function fieldOwner(
  state: FormsState,
  args: FieldArgs,
): { owner: string; property?: string; path: string } | null {
  const form = pickForm(state, args);
  return typeof form === 'string'
    ? null
    : { owner: form.owner, property: form.property, path: args.path ?? '' };
}

export function explainFieldText(
  state: FormsState,
  args: FieldArgs,
  now = Date.now(),
  source = '',
): string {
  const form = pickForm(state, args);
  if (typeof form === 'string') return form;
  const node = subtreeAt(form.root, args.path ?? '');
  if (!node) {
    const top = (form.root.children ?? []).map((c) => c.key).join(', ');
    return `No field at ${code(args.path ?? '')} in ${form.id}; top-level fields: ${top}.`;
  }
  const where = code(node.path || '(form)');
  const lines = [`${where} in ${code(form.label)} (${form.kind}, ${form.id}): ${flags(node)}.`];
  if (node.type === 'control') {
    lines.push(
      `Value: ${detailOf(node.value)}${node.redacted ? ` (redacted: ${REDACT_LABELS[node.redacted] ?? node.redacted})` : ''}.`,
    );
  }
  if (node.uncommitted !== undefined) {
    lines.push(
      node.debouncing
        ? `Typed but debounced: the control shows ${detailOf(node.uncommitted)}; the model updates after the debounce.`
        : `Uncommitted: the input holds ${detailOf(node.uncommitted)}, which reaches the model on ${node.updateOn ?? 'the next update'}.`,
    );
  }
  if (node.modelDrift) {
    lines.push(
      `ngModel drift: [ngModel] is ${detailOf(node.modelDrift.model)}, the view model ${detailOf(node.modelDrift.viewModel)}.`,
    );
  }
  if (node.errors.length) {
    lines.push('Errors:');
    for (const error of node.errors) {
      lines.push(`- [${error.kind}] ${error.message} (${sourceLabel(error)})`);
    }
  } else if (node.status === 'INVALID') {
    lines.push('No error of its own; a descendant is invalid.');
  }
  if (node.skipped) {
    lines.push(
      `Validation is skipped because the field is ${node.skipped}. Hidden, disabled and readonly fields never report errors and never become touched or dirty.`,
    );
  }
  if (node.asyncWaiting) lines.push('Async rules wait until the sync rules pass.');
  if (node.status === 'PENDING' && node.pendingSince) {
    lines.push(`Pending for ${Math.round((now - node.pendingSince) / 1000)}s.`);
  }
  if (node.stale?.length) {
    lines.push(
      `Stale: validators now report ${node.stale.join(', ')}, but errors were computed before the validators changed. Call updateValueAndValidity().`,
    );
  }
  if (node.disabledReasons?.length) {
    const inherited = node.inheritedDisabled ?? 0;
    lines.push(
      `Disabled: ${node.disabledReasons
        .map((reason, i) => (i < inherited ? `${reason} (from a parent)` : reason))
        .join('; ')}.`,
    );
  }
  if (node.rules) {
    lines.push(
      `Rules: ${Object.entries(node.rules)
        .map(([kind, count]) => `${count} ${kind}`)
        .join(', ')}.`,
    );
  }
  if (node.validatorNames?.length) lines.push(`Validators: ${node.validatorNames.join(', ')}.`);
  if (node.asyncValidatorNames?.length)
    lines.push(`Async validators: ${node.asyncValidatorNames.join(', ')}.`);
  if (node.constraints) {
    lines.push(
      `Constraints: ${Object.entries(node.constraints)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}.`,
    );
  }
  lines.push(bindingText(node));
  const dom = domText(node);
  if (dom) lines.push(dom);
  const recent = state.events
    .filter((e) => e.formId === form.id && e.path === node.path)
    .slice(-5)
    .map(eventLine);
  if (source) lines.push(source);
  if (recent.length) lines.push('Recent changes:', ...recent);
  return `${UNTRUSTED}\n\n${lines.join('\n')}${freshness(state, now)}`;
}

function bindingText(node: FormFieldNode): string {
  const b = node.binding;
  if (!node.bound || !b) return 'Not bound to any element on the page.';
  const el = b.element ? `<${b.element}>` : 'an element';
  switch (b.kind) {
    case 'native':
      return `Bound to ${el} through Angular's ${b.accessor}.`;
    case 'accessor':
      return `Bound to ${el} through the custom ControlValueAccessor ${b.accessor}.`;
    case 'custom-control':
      return `Bound to ${el}, a custom control (FormValueControl) used through a reactive directive.`;
    case 'signal-field':
      return `Bound with [formField] to ${el}${b.count ? ` (${b.count} bindings)` : ''}.`;
    default:
      return `Bound to ${el}.`;
  }
}

function domText(node: FormFieldNode): string {
  const dom = node.dom;
  if (!dom) return '';
  const parts: string[] = [];
  if (dom.drift !== undefined)
    parts.push(
      `the element shows ${dom.drift === true ? 'a different value' : detailOf(dom.drift)}, not the model value`,
    );
  if (dom.labelled === false) parts.push('no accessible label');
  if (dom.errorShown === false) parts.push('no visible error text');
  if (dom.ariaInvalid !== undefined) parts.push(`aria-invalid=${dom.ariaInvalid}`);
  if (dom.disabled !== undefined)
    parts.push(`element ${dom.disabled ? 'is' : 'is not'} disabled, unlike the model`);
  return parts.length ? `DOM: ${parts.join('; ')}.` : '';
}

function eventLine(event: FormEvent): string {
  const time = new Date(event.timestamp).toISOString().slice(11, 23);
  const change =
    event.prev !== undefined ? `${event.prev} → ${event.detail ?? ''}` : (event.detail ?? '');
  const extra = [
    event.origin,
    event.count && event.count > 1 ? `×${event.count}` : '',
    event.outcome ?? '',
    event.ms !== undefined ? `pending ${event.ms}ms` : '',
    event.renders ? `${event.renders} template updates: ${(event.rendered ?? []).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const caller = event.caller ? ` from ${event.caller}` : '';
  return `- #${event.seq ?? '?'} ${time} ${code(event.path || '(form)')} ${event.type} ${change}${extra ? ` (${extra})` : ''}${caller}`;
}

function blockingLeaves(root: FormFieldNode) {
  const invalid: FormFieldNode[] = [];
  const pending: FormFieldNode[] = [];
  walk(root, (node) => {
    if (node.errors.length) invalid.push(node);
    if (node.status === 'PENDING' && !(node.children ?? []).some((c) => c.status === 'PENDING')) {
      pending.push(node);
    }
  });
  return { invalid, pending };
}

export function explainSubmitText(state: FormsState, args: FieldArgs, now = Date.now()): string {
  const form = pickForm(state, args);
  if (typeof form === 'string') return form;
  const { invalid, pending } = blockingLeaves(form.root);
  const lines: string[] = [];
  if (form.kind === 'signal') {
    const s = form.submit;
    if (!s) lines.push('Submit setup unknown (older page script).');
    else {
      lines.push(
        s.hasAction
          ? `submit() ${s.willRun ? 'will run the action' : 'will not run the action'}${s.ignoreValidators ? ` (ignoreValidators: ${s.ignoreValidators})` : ''}.`
          : 'The form has no submission action: submit(form) without an action throws NG01915.',
      );
      if (s.submitting)
        lines.push('A submit is in progress; a second submit() returns false right away.');
      if (!s.willRun && s.hasAction) {
        lines.push(
          s.hasOnInvalid
            ? 'onInvalid runs instead, and every interactive field is marked touched.'
            : 'Nothing visible happens except fields becoming touched (no onInvalid).',
        );
      }
    }
  } else {
    lines.push(
      `ngSubmit fires on every submit, valid or not; the handler must check form.valid. Status now: ${form.root.status}${form.submitted ? ', already submitted' : ''}.`,
    );
  }
  for (const reason of form.submitDom?.reasons ?? []) lines.push(`DOM: ${reason}`);
  if (!form.submitDom)
    lines.push('No <form> element was found for this form, so only code can submit it.');
  if (invalid.length) {
    lines.push('Blocking fields:');
    for (const node of invalid.slice(0, 20)) {
      lines.push(
        `- ${code(node.path || '(form)')}: ${node.errors.map((e) => `${e.kind} (${sourceLabel(e)})`).join(', ')}${node.touched ? '' : ', not touched yet'}`,
      );
    }
  }
  if (pending.length) {
    lines.push(`Pending: ${pending.map((n) => code(n.path || '(form)')).join(', ')}.`);
  }
  const submits = state.events.filter((e) => e.formId === form.id && e.type === 'submit').slice(-5);
  if (submits.length) lines.push('Recent submits:', ...submits.map(eventLine));
  return `${UNTRUSTED}\n\n**${form.label.replace(/[`*]/g, "'")}** (${form.id})\n${lines.join('\n')}${freshness(state, now)}`;
}

interface Payload {
  value: unknown;
  raw: unknown;
  excluded: string[];
  unvalidated: string[];
  changed: string[];
}

export function payloadOf(form: CollectedForm): Payload {
  const excluded: string[] = [];
  const unvalidated: string[] = [];
  const changed: string[] = [];
  const build = (node: FormFieldNode, raw: boolean): unknown => {
    if (node.type === 'control' || !node.children) return node.value;
    const kids = node.children.filter((child) => {
      if (raw || form.kind === 'signal') return true;
      const drop = node.status !== 'DISABLED' && child.status === 'DISABLED';
      return !drop;
    });
    const entries = kids.map((child) => [child.key, build(child, raw)] as const);
    return node.type === 'array' ? entries.map(([, v]) => v) : Object.fromEntries(entries);
  };
  walk(form.root, (node) => {
    if (!node.path) return;
    if (form.kind !== 'signal' && node.status === 'DISABLED') excluded.push(node.path);
    if (form.kind === 'signal' && node.skipped && node.hiddenBy !== 'parent')
      unvalidated.push(`${node.path} (${node.skipped})`);
    if (node.type === 'control' && node.dirty && node.changed !== false) changed.push(node.path);
  });
  const topExcluded = excluded.filter(
    (p) => !excluded.some((q) => q !== p && p.startsWith(`${q}.`)),
  );
  return {
    value: build(form.root, false),
    raw: build(form.root, true),
    excluded: topExcluded,
    unvalidated,
    changed,
  };
}

export function formPayloadText(state: FormsState, args: FieldArgs, now = Date.now()): string {
  const form = pickForm(state, args);
  if (typeof form === 'string') return form;
  const p = payloadOf(form);
  const lines = [
    `${form.kind === 'signal' ? 'form().value()' : 'form.value'}: ${JSON.stringify(p.value)}`,
  ];
  if (form.kind !== 'signal') {
    lines.push(
      p.excluded.length
        ? `Left out of form.value because they are disabled: ${p.excluded.map(code).join(', ')}. Use getRawValue() to include them: ${JSON.stringify(p.raw)}`
        : 'getRawValue() is the same (nothing disabled).',
    );
  } else if (p.unvalidated.length) {
    lines.push(
      `Sent but not validated (Signal Forms keeps hidden, disabled and readonly fields in the value): ${p.unvalidated.map(code).join(', ')}. Strip them before sending if the server should not get them.`,
    );
  }
  lines.push(
    p.changed.length
      ? `Changed by the user: ${p.changed.map(code).join(', ')}.`
      : 'No field changed since it was created or last reset.',
  );
  if (JSON.stringify(p.raw).includes(REDACTED)) lines.push('Secret values show as [redacted].');
  return `${UNTRUSTED}\n\n${lines.join('\n')}${freshness(state, now)}`;
}

export interface HistoryArgs extends FieldArgs {
  type?: string;
  origin?: string;
  since?: number;
  limit?: number;
}

export function formHistoryText(state: FormsState, args: HistoryArgs): string {
  const forms = matchForms(state.forms, args.form, args.page);
  const ids = new Set(forms.map((f) => f.id));
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_HISTORY);
  const events = state.events.filter(
    (e) =>
      (ids.has(e.formId) || (!args.form && !args.page)) &&
      (args.path === undefined || e.path === args.path || e.path.startsWith(`${args.path}.`)) &&
      (!args.type || e.type === args.type) &&
      (!args.origin || e.origin === args.origin) &&
      (args.since === undefined || (e.seq ?? 0) > args.since),
  );
  const marker = latestMarker(state);
  const pages = new Set(forms.map((f) => f.id.split('@')[1] ?? ''));
  const dropped = Object.entries(state.dropped ?? {})
    .filter(([pageId]) => (!args.form && !args.page) || pages.has(pageId))
    .reduce((sum, [, count]) => sum + count, 0);
  const note = droppedNote(dropped, 'form events', 'formTimeline');
  if (!events.length) return `No matching form events. Marker: ${marker}.${note}`;
  const byForm = new Map(state.forms.map((f) => [f.id, f.label]));
  const lines = events
    .slice(-limit)
    .map((e) => `${eventLine(e)} in ${code(byForm.get(e.formId) ?? e.formId)}`);
  return `${UNTRUSTED}\n\n${lines.join('\n')}\n\nMarker: ${marker} (pass as \`since\` to form-diff or form-history).${note}`;
}

export function formDiffText(state: FormsState, args: FieldArgs & { since?: number }): string {
  const since = args.since ?? 0;
  const forms = matchForms(state.forms, args.form, args.page);
  const ids = new Set(forms.map((f) => f.id));
  const net = new Map<
    string,
    { from?: string; to?: string; count: number; type: string; formId: string; path: string }
  >();
  for (const event of state.events) {
    if ((event.seq ?? 0) <= since || !ids.has(event.formId)) continue;
    const key = `${event.formId}|${event.path}|${event.type}`;
    const entry = net.get(key);
    if (!entry) {
      net.set(key, {
        from:
          event.prev ?? (event.type === 'status' ? event.detail?.split('→')[0]?.trim() : undefined),
        to: event.detail,
        count: event.count ?? 1,
        type: event.type,
        formId: event.formId,
        path: event.path,
      });
    } else {
      entry.to = event.detail;
      entry.count += event.count ?? 1;
    }
  }
  const marker = latestMarker(state);
  if (!net.size) return `Nothing changed since marker ${since}. Marker now: ${marker}.`;
  const oldest = Math.min(...state.events.map((event) => event.seq ?? 0));
  const lines = Array.from(net.values())
    .map((entry) => {
      const to = entry.type === 'status' ? entry.to?.split('→').pop()?.trim() : entry.to;
      if (entry.from !== undefined && entry.from === to) return null;
      const change = entry.from !== undefined ? `${entry.from} → ${to ?? ''}` : (to ?? '');
      return `- ${code(entry.path || '(form)')} ${entry.type}: ${change}${entry.count > 1 ? ` (${entry.count} changes)` : ''}`;
    })
    .filter(Boolean);
  const gap =
    since && oldest > since + 1
      ? '\n\n_Older events were dropped from the buffer; the diff may be incomplete._'
      : '';
  return `${UNTRUSTED}\n\n${lines.length ? lines.join('\n') : 'Changes cancelled out.'}\n\nMarker now: ${marker}.${gap}`;
}

export function lintFormsFor(
  state: FormsState,
  args: { form?: string; page?: string },
  now = Date.now(),
): FormLintFinding[] {
  const forms = matchForms(state.forms, args.form, args.page);
  const setup = (state.setupErrors ?? [])
    .filter((e) => !args.page || e.pageId === args.page)
    .map((e) => e.message);
  return [
    ...lintSetupErrors(args.form ? [] : setup),
    ...forms.flatMap((form) => lintForm(form, state.events, now)),
  ];
}

export function lintFormsText(
  state: FormsState,
  args: { form?: string; page?: string },
  now = Date.now(),
): string {
  const findings = lintFormsFor(state, args, now);
  if (!findings.length)
    return 'No form problems found by the lint rules. For generic accessibility, run axe-core scoped to the form.';
  const order = { error: 0, warning: 1, info: 2 };
  const lines = findings
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map(
      (f) =>
        `- **${f.severity}** ${f.rule}${f.label ? ` in ${code(f.label)}` : ''}${f.path ? ` at ${code(f.path)}` : ''}: ${f.message} Fix: ${f.fix}`,
    );
  return `${UNTRUSTED}\n\n${lines.join('\n')}`;
}

export function explainCustomControlText(state: FormsState, args: FieldArgs): string {
  const form = pickForm(state, args);
  if (typeof form === 'string') return form;
  const node = subtreeAt(form.root, args.path ?? '');
  if (!node) return `No field at ${code(args.path ?? '')} in ${form.id}.`;
  const lines = [bindingText(node)];
  const b = node.binding;
  if (b?.kind === 'accessor') {
    lines.push(
      `${b.accessor} must call the onChange callback from registerOnChange on every user edit, the onTouched callback on blur, and render the value it gets in writeValue.`,
    );
    if (!b.disabledHook) {
      lines.push(
        `${b.accessor} has no setDisabledState, so control.disable() never disables the element.`,
      );
    }
  }
  if (b?.kind === 'custom-control') {
    lines.push(
      'Custom controls built on FormValueControl expose a value model(); the directive writes it and listens to it.',
    );
  }
  if (node.dom?.drift !== undefined) {
    lines.push(
      'Drift: the element shows a different value than the model, so writeValue (or the value model) is not rendering updates.',
    );
  }
  if (node.dom?.disabled !== undefined) {
    lines.push(
      `Disabled drift: the element ${node.dom.disabled ? 'is' : 'is not'} disabled, the model says ${node.status === 'DISABLED' ? 'disabled' : 'enabled'}.`,
    );
  }
  if (node.bound && !node.touched && node.dirty) {
    lines.push(
      'The value changed but the field was never touched: check that onTouched is called on blur.',
    );
  }
  const pageId = form.id.split('@')[1];
  const keyPattern = node.key
    ? new RegExp(`(^|[^\\w])${node.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`)
    : null;
  const setup = (state.setupErrors ?? [])
    .filter((e) => !pageId || e.pageId === pageId)
    .map((e) => e.message)
    .filter((m) => !keyPattern || keyPattern.test(m));
  if (setup.length) lines.push('Setup errors:', ...setup.map((m) => `- ${m}`));
  return `${UNTRUSTED}\n\n${code(node.path || '(form)')} in ${code(form.label)}\n${lines.join('\n')}`;
}

function literal(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? 'undefined';
}

export function exportFormText(
  state: FormsState,
  args: FieldArgs & { format?: 'snapshot' | 'fixture' },
): string {
  const form = pickForm(state, args);
  if (typeof form === 'string') return form;
  const p = payloadOf(form);
  const { invalid } = blockingLeaves(form.root);
  const header = [
    `// ${form.label} (${form.kind}) captured ${new Date(state.reportedAt).toISOString()}`,
    `// status ${form.root.status}${invalid.length ? `; errors: ${invalid.map((n) => `${n.path || '(form)'} ${n.errors.map((e) => e.kind).join('+')}`).join(', ')}` : ''}`,
    '// Secret values are [redacted]; replace them before running.',
  ].join('\n');
  if (args.format !== 'fixture') {
    return `${UNTRUSTED}\n\n\`\`\`json\n${literal({ id: form.id, label: form.label, kind: form.kind, status: form.root.status, value: p.raw, root: form.root })}\n\`\`\``;
  }
  const body =
    form.kind === 'signal'
      ? `const model = signal(${literal(p.raw)});\n// const f = form(model, schema);\n// expect(f().valid()).toBe(${form.root.status === 'VALID'});`
      : `form.${p.excluded.length ? 'patchValue' : 'setValue'}(${literal(p.raw)});\n${p.excluded.map((path) => `form.get('${path}')?.disable();`).join('\n')}\nexpect(form.status).toBe('${form.root.status}');`;
  return `${UNTRUSTED}\n\n\`\`\`ts\n${header}\n${body}\n\`\`\``;
}

export type WaitUntil = 'settled' | 'valid' | 'not-pending' | 'submitted';

export function waitSatisfied(
  state: FormsState,
  args: FieldArgs & { until?: WaitUntil; since?: number },
): boolean {
  const forms = matchForms(state.forms, args.form, args.page);
  if (!forms.length) return false;
  const until = args.until ?? 'settled';
  return forms.every((form) => {
    const status = form.root.status;
    if (until === 'valid') return status === 'VALID';
    if (until === 'not-pending') return status !== 'PENDING';
    if (until === 'submitted') {
      return state.events.some(
        (e) => e.formId === form.id && e.type === 'submit' && (e.seq ?? 0) > (args.since ?? 0),
      );
    }
    let debouncing = false;
    walk(form.root, (node) => {
      if (node.debouncing) debouncing = true;
    });
    return status !== 'PENDING' && !debouncing && !form.submit?.submitting;
  });
}
