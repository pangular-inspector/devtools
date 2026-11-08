import { pipeMigrationsText } from './rpc/pipe-migrations.ts';
import { pipePageFor } from './rpc/pipes-agent.ts';
import { playwrightTestText } from './rpc/forms-playwright.ts';
import type { FieldArgs } from './rpc/forms-explain.ts';
import { lintPipesText } from './rpc/pipe-lint.ts';
import {
  explainPipeOnPage,
  pipeRecordRequest,
  pipeRecordTargets,
  pipeRecordText,
} from './rpc/pipes-agent.ts';
import {
  explainFormsText,
  inspectFormsText,
  type PageReport,
  type FormsState,
  type InspectFormsArgs,
  untrusted,
} from './rpc/forms-tools.ts';
import {
  explainCustomControlText,
  explainFieldText,
  explainSubmitText,
  fieldOwner,
  exportFormText,
  formDiffText,
  formHistoryText,
  formPayloadText,
  latestMarker,
  lintFormsText,
  resolveForm,
  waitSatisfied,
  type WaitUntil,
} from './rpc/forms-explain.ts';
import { findFormSource, sourceText } from './rpc/forms-source.ts';
import { type PipePageReport } from './rpc/pipes-tools.ts';
import { PAGE_ARGUMENT, pageArgument, unknownPageText } from './rpc/pages.ts';
import { type ResolvedPangularConfig } from './config.ts';
import { type MarkdownAnswer } from './rpc/agent-output.ts';
import { defaultPage, notePageRead } from './rpc/default-page.ts';
import { refusal, refusedAnswer } from './rpc/refusal.ts';
import type { AgentRegistrar, DevframeNodeContext, SharedState } from './devframe-env.ts';

import type { PushAcks } from './rpc/push-acks.ts';
import type { PipeInstrumentRequest } from './rpc/pipes-tools.ts';
/** What `registerFormsAgentTools` reads from the devframe server's setup (`devframe.ts`). */
export interface RegisterFormsAgentToolsEnv {
  agent: AgentRegistrar;
  config: ResolvedPangularConfig;
  ctx: DevframeNodeContext;
  formPages: Map<string, PageReport & { reportedAt: number }>;
  formsState: SharedState<FormsState>;
  pipeAcks: PushAcks<PipePageReport>;
  pipePages: Map<string, PipePageReport & { reportedAt: number }>;
  requestFormAction: (
    request: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<Record<string, unknown>>;
  requestPipeRecording: (message: unknown) => {
    request: PipeInstrumentRequest;
    pages: { pages: number };
  };
  formPageUrl: (state: FormsState, args: FieldArgs) => string | undefined;
}

/** `wait-for` with `condition: "form"`, which the forms tools set up. */
export type WaitForForm = (
  args: Record<string, unknown>,
  timeoutMs: number,
) => Promise<MarkdownAnswer>;

export function registerFormsAgentTools(env: RegisterFormsAgentToolsEnv): {
  waitForForm: WaitForForm;
} {
  const {
    agent,
    config,
    ctx,
    formPages,
    formsState,
    pipeAcks,
    pipePages,
    requestFormAction,
    requestPipeRecording,
    formPageUrl,
  } = env;
  const noForms = `No forms have been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser, on a page that renders a form. The stdio MCP server has no page, so there it always answers this.`;
  /**
   * `args` with `page` set to the default page (`default-page.ts`) when the
   * call names neither a page nor a form, so a form tool reads one tab like
   * every other tool. A `form` names its page itself.
   */
  const onDefaultFormPage = <A>(args: A): A => {
    const record = (args ?? {}) as { page?: unknown; form?: unknown };
    if (pageArgument(record as Record<string, unknown>)) return args;
    if (typeof record.form === 'string' && record.form) return args;
    const forms = (formsState.value() as FormsState).forms;
    const reporting = [...formPages.values()].filter((page) =>
      forms.some((form) => form.id.endsWith(`@${page.pageId}`)),
    );
    const page = defaultPage(reporting);
    return page ? ({ ...record, page: page.pageId } as A) : args;
  };
  const unknownFormPage = (args: unknown) => {
    const page = pageArgument(args as Record<string, unknown> | undefined);
    if (!page || formPages.has(page)) return undefined;
    return { markdown: unknownPageText(page, [...formPages.values()], 'forms') };
  };
  const formProperty = {
    type: 'string',
    description:
      'Form id (Checkout.form@ab12, or Checkout.form without the page) or part of its label (Component.property).',
  };

  agent.registerTool({
    id: 'pangular:inspect-forms',
    title: 'Inspect forms',
    description:
      'Forms on the page (Signal Forms, reactive, template-driven). Without `form`: each form with status and error counts. With `form`: the field tree; narrow with `path`, `onlyInvalid`, `includeValues`. Reads 100 fields per group and says when it cut one. Masked; cut at 20,000 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        form: formProperty,
        page: {
          type: 'string',
          description: 'Page id (the part after @ in a form id) when several tabs are connected.',
        },
        path: {
          type: 'string',
          description:
            'Dotted field path to start the tree at, e.g. address.city or tags.1. Applies to every matched form.',
        },
        onlyInvalid: {
          type: 'boolean',
          description: 'Only include invalid or pending fields and their parents.',
        },
        includeValues: {
          type: 'boolean',
          description:
            "Include field values in this tool's output (default true). When false, values and value-bearing error params are left out; a custom error message that quotes the value is still returned as is.",
        },
      },
    },
    handler: async (args: InspectFormsArgs) => {
      const state = formsState.value() as FormsState;
      if (!state.forms.length) return { markdown: noForms };
      const elsewhere = unknownFormPage(args);
      if (elsewhere) return elsewhere;
      return { markdown: inspectFormsText(state, onDefaultFormPage(args)) };
    },
  });

  agent.registerTool({
    id: 'pangular:explain-invalid-forms',
    title: 'Explain invalid forms',
    description:
      'Why forms are invalid: each failing field with value, validator, message and touched state, plus pending async validators and disabled reasons. Without `form`, every invalid form. Reads 100 fields per group; says when a failing field may be past that.',
    inputSchema: {
      type: 'object',
      properties: {
        form: formProperty,
        page: {
          type: 'string',
          description: 'Page id (the part after @ in a form id) when several tabs are connected.',
        },
        path: {
          type: 'string',
          description:
            'Dotted field path to explain only that group or field, e.g. address or items.3. Applies to every matched form.',
        },
      },
    },
    handler: async (args: { form?: string; page?: string; path?: string }) => {
      const state = formsState.value() as FormsState;
      if (!state.forms.length) return { markdown: noForms };
      const elsewhere = unknownFormPage(args);
      if (elsewhere) return elsewhere;
      return { markdown: explainFormsText(state, onDefaultFormPage(args)) };
    },
  });

  const formPageProperty = {
    type: 'string',
    description: 'Page id (the part after @ in a form id) when several tabs are connected.',
  };
  const pathProperty = {
    type: 'string',
    description: 'Dotted field path, e.g. address.city or items.0.qty. Empty for the form itself.',
  };
  const withForms =
    <A>(fn: (state: FormsState, args: A) => string) =>
    async (args: A) => {
      const state = formsState.value() as FormsState;
      if (!state.forms.length) return { markdown: noForms };
      const elsewhere = unknownFormPage(args);
      if (elsewhere) return elsewhere;
      return { markdown: fn(state, onDefaultFormPage(args ?? ({} as A))) };
    };
  const str = (value: unknown) => (typeof value === 'string' ? value : undefined);

  agent.registerTool({
    id: 'pangular:explain-field',
    title: 'Explain a form field',
    description:
      'One form field in depth (`form` + `path`, or `selector`): value, flags, each error and where it comes from, why validation is skipped, pending input, the binding and DOM facts.',
    inputSchema: {
      type: 'object',
      properties: {
        form: formProperty,
        path: pathProperty,
        selector: { type: 'string', description: 'CSS selector of an input bound to a field.' },
        page: formPageProperty,
      },
    },
    handler: async (args: { form?: string; path?: string; selector?: string; page?: string }) => {
      const state = formsState.value() as FormsState;
      if (!state.forms.length) return { markdown: noForms };
      const elsewhere = unknownFormPage(args);
      if (elsewhere) return elsewhere;
      let target = onDefaultFormPage({ form: args?.form, path: args?.path, page: args?.page });
      if (args?.selector) {
        const located = await requestFormAction(
          { action: 'locate', selector: args.selector, page: args.page },
          5000,
        );
        if (!located['ok']) return { markdown: String(located['error'] ?? 'Not found.') };
        target = {
          form: str(located['formId']),
          path: str(located['path']) ?? '',
          page: undefined,
        };
      }
      const owner = fieldOwner(state, target);
      const source = owner
        ? sourceText(findFormSource(ctx.cwd, owner.owner, owner.property, owner.path))
        : '';
      return { markdown: explainFieldText(state, target, Date.now(), source) };
    },
  });

  agent.registerTool({
    id: 'pangular:explain-submit',
    title: 'Explain a form submit',
    description:
      'What submitting a form will do and why it might do nothing: submit setup, DOM reasons, blocking and pending fields, and recent submits with their outcome.',
    inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
    handler: withForms(explainSubmitText),
  });

  agent.registerTool({
    id: 'pangular:inspect-form-payload',
    title: 'Show a form payload',
    description:
      'What a form would send: form.value against getRawValue() and the fields each drops or keeps, plus what the user changed. `path` narrows to one group.',
    inputSchema: {
      type: 'object',
      properties: { form: formProperty, path: pathProperty, page: formPageProperty },
    },
    handler: withForms(formPayloadText),
  });

  agent.registerTool({
    id: 'pangular:list-form-changes',
    title: 'Show form history',
    description:
      'Timeline of form changes (value, status, submit, fields added or removed) tagged with origin (user, code, devtools, binding, agent). Filter by form, path, type, origin or `after` (a marker); returns the current marker.',
    inputSchema: {
      type: 'object',
      properties: {
        form: formProperty,
        path: pathProperty,
        type: {
          type: 'string',
          enum: [
            'value',
            'status',
            'touched',
            'dirty',
            'submit',
            'reset',
            'added',
            'removed',
            'moved',
            'validators',
          ],
        },
        origin: { type: 'string', enum: ['user', 'code', 'devtools', 'binding', 'agent'] },
        after: { type: 'number', description: 'Only events after this marker.' },
        limit: { type: 'number', description: 'Max events (default 50, max 200).' },
        page: formPageProperty,
      },
    },
    handler: withForms(formHistoryText),
  });

  agent.registerTool({
    id: 'pangular:explain-form-changes',
    title: 'Diff form values',
    description:
      'Net change of a form since a marker: each field whose value or status ended different, with from → to and how many changes happened in between. Get a marker from list-form-changes, inspect-forms or a run-form-action result, act, then call this.',
    inputSchema: {
      type: 'object',
      properties: {
        form: formProperty,
        after: {
          type: 'number',
          description: 'Marker to diff from (default: everything buffered).',
        },
        page: formPageProperty,
      },
    },
    handler: withForms(formDiffText),
  });

  agent.registerTool({
    id: 'pangular:lint-forms',
    title: 'Lint forms',
    description:
      'Checks live forms: stale validity, stuck PENDING, unreachable submit, hidden fields still rendered, view and model out of sync, [disabled] on reactive controls, unbound required fields, NG01xxx errors and accessibility.',
    inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
    handler: async (args: { form?: string; page?: string }) => {
      const state = formsState.value() as FormsState;
      if (!state.forms.length && !state.setupErrors?.length) return { markdown: noForms };
      const elsewhere = unknownFormPage(args);
      if (elsewhere) return elsewhere;
      return {
        markdown: lintFormsText(state, onDefaultFormPage(args ?? {}), undefined, {
          rules: config.lint.rules,
        }),
      };
    },
  });

  agent.registerTool({
    id: 'pangular:scan-pipe-usage',
    title: 'Lint pipes',
    description:
      'Source checks of pipes: impure pipes inside @for, `| json` left in templates, pure pipes that read signals, and method calls piped to `| async`.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ markdown: lintPipesText(ctx.cwd, { rules: config.lint.rules }) }),
  });

  agent.registerTool({
    id: 'pangular:explain-pipe',
    title: 'Explain a pipe',
    description:
      'One pipe by name: where it is declared and used, purity, live instances and calls, time, errors and last input and output while recording, async misuse and lint findings.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The pipe name as used after `|` in a template.' },
        page: PAGE_ARGUMENT,
      },
      required: ['name'],
    },
    handler: async (args: { name?: string; page?: string }) => {
      if (!args?.name) return { markdown: 'Pass a pipe `name`.' };
      return {
        markdown: explainPipeOnPage(args.name, ctx.cwd, pipePages, pageArgument(args), {
          rules: config.lint.rules,
        }),
      };
    },
  });

  agent.registerTool({
    id: 'pangular:suggest-pipe-migrations',
    title: 'Suggest pipe migrations',
    description:
      'Read-only suggestions for moving pipes to signals, with the file and line of each use: `| async` to toSignal(), impure or signal-reading custom pipes to computed(), and, while recording, churning or stale pipes. Changes no file.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Only this pipe, by the name used after `|`.' },
        page: PAGE_ARGUMENT,
      },
    },
    handler: async (args: { name?: string; page?: string }) => {
      const picked = pipePageFor(pipePages, pageArgument(args));
      if ('markdown' in picked) return picked;
      return {
        markdown: pipeMigrationsText(ctx.cwd, picked.pageId ? picked.state : undefined, {
          name: args?.name || undefined,
          rules: config.lint.rules,
        }),
      };
    },
  });

  agent.registerTool({
    id: 'pangular:record-pipes',
    title: 'Record pipe calls',
    description:
      'Start or stop recording pipe calls (`action`), like Record calls in the Pipes panel; explain-pipe then shows counts, time, inputs and stale-argument checks. `start` uses the default page; `stop` without `page` stops every page that records.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop'] },
        page: PAGE_ARGUMENT,
      },
      required: ['action'],
    },
    handler: async (args: { action?: string; page?: string }) => {
      const asked = pipeRecordRequest(args?.action, pipePages, pageArgument(args));
      if ('markdown' in asked) return asked;
      const { on } = asked.request;
      const targets = pipeRecordTargets(asked.request, pipePages);
      // A page already in the asked state pushes nothing new; it counts as confirmed.
      const already = targets.filter((id) => (pipePages.get(id)?.instrumented ?? false) === on);
      const pending = targets.filter((id) => !already.includes(id));
      const confirmed = pipeAcks.wait(pending, (report) => (report.instrumented ?? false) === on);
      if (pending.length) {
        requestPipeRecording(targets.length === 1 ? { pageId: targets[0], on } : { on });
      }
      const done = new Set([...already, ...(await confirmed)]);
      return {
        markdown: pipeRecordText(
          on,
          targets,
          targets.filter((id) => done.has(id)),
        ),
      };
    },
  });

  agent.registerTool({
    id: 'pangular:explain-custom-control',
    title: 'Explain a custom form control',
    description:
      'Explain how a field is bound to its element (built-in accessor, custom ControlValueAccessor, custom control, [formField]) and what is wrong with it: value drift, missing setDisabledState, touched never set, captured NG01xxx setup errors.',
    inputSchema: {
      type: 'object',
      properties: { form: formProperty, path: pathProperty, page: formPageProperty },
    },
    handler: withForms(explainCustomControlText),
  });

  agent.registerTool({
    id: 'pangular:export-form',
    title: 'Export a form',
    description:
      'Export a form as a JSON snapshot, a test fixture (setValue / signal model plus the expected status), or a Playwright test replaying its recorded history. Secret values stay [redacted]. A snapshot keeps as many fields as fit in 20,000 characters (at most 200).',
    inputSchema: {
      type: 'object',
      properties: {
        form: formProperty,
        format: { type: 'string', enum: ['snapshot', 'fixture', 'playwright'] },
        page: formPageProperty,
      },
    },
    handler: withForms((state, args: FieldArgs & { format?: string }) =>
      args.format === 'playwright'
        ? playwrightTestText(state, { ...args, url: formPageUrl(state, args) })
        : exportFormText(state, {
            ...args,
            format: args.format === 'fixture' ? 'fixture' : 'snapshot',
          }),
    ),
  });

  // `wait-for` with `condition: "form"`: polls the forms state until the condition holds.
  const waitForForm: WaitForForm = async (raw, timeout) => {
    const args = raw as {
      form?: string;
      until?: WaitUntil;
      after?: number;
      page?: string;
    };
    const elsewhere = unknownFormPage(args);
    if (elsewhere) return elsewhere as MarkdownAnswer;
    const start = Date.now();
    while (true) {
      const state = formsState.value() as FormsState;
      if (waitSatisfied(state, args)) {
        return {
          markdown: `Condition \`${args.until ?? 'settled'}\` holds after ${Date.now() - start}ms. Marker: ${latestMarker(state)}.\n\n${explainFormsText(state, { form: args.form, page: args.page })}`,
        };
      }
      if (Date.now() - start >= timeout) {
        return {
          markdown: `Timed out after ${timeout}ms waiting for \`${args.until ?? 'settled'}\`.\n\n${explainFormsText(state, { form: args.form, page: args.page })}`,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  /**
   * The forms state once the page pushed the events of a write, so the
   * marker an answer gives includes them. Waits at most 1s.
   */
  const formsAfter = async (marker: number, result: Record<string, unknown>) => {
    // A refused write changed nothing, so there is nothing to wait for.
    if (!result['ok']) return formsState.value() as FormsState;
    for (let waited = 0; waited < 1000; waited += 50) {
      const state = formsState.value() as FormsState;
      if (latestMarker(state) > marker) return state;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return formsState.value() as FormsState;
  };

  const actionText = (result: Record<string, unknown>, state: FormsState) => {
    const lines = [
      result['ok']
        ? `Done: ${String(result['message'] ?? '')}`
        : `Refused: ${String(result['error'] ?? result['message'] ?? 'failed')}`,
    ];
    const skipped = Array.isArray(result['skipped'])
      ? (result['skipped'] as { path: string; reason: string }[])
      : [];
    if (skipped.length)
      lines.push(`Skipped: ${skipped.map((s) => `\`${s.path}\` ${s.reason}`).join('; ')}.`);
    if (typeof result['status'] === 'string') lines.push(`Form status now: ${result['status']}.`);
    const invalid = Array.isArray(result['invalid']) ? (result['invalid'] as string[]) : [];
    if (invalid.length)
      lines.push(`Fields with errors: ${invalid.map((p) => `\`${p || '(form)'}\``).join(', ')}.`);
    if (typeof result['expression'] === 'string') lines.push(`Console: ${result['expression']}`);
    if (typeof result['snapshot'] === 'string')
      lines.push(`Snapshot id: ${result['snapshot']} (use with restore).`);
    lines.push(
      `Marker: ${latestMarker(state)}. Call explain-form-changes with \`after\` set to the marker you had before this action to see what changed.`,
    );
    // The page writes the message, errors and skipped reasons.
    const text = untrusted(lines.join('\n'));
    return result['ok'] ? text : refusal(text);
  };

  agent.registerTool({
    id: 'pangular:run-form-action',
    title: 'Run a form action',
    description:
      'Act on a live form (dev only): set-value, mark-touched/untouched/dirty/pristine, touch-all, revalidate, reset, enable, disable, submit, focus, focus-first-invalid, store-as-global, snapshot, restore, instrument, try-webmcp (runs its WebMCP tool). reset, submit, restore, try-webmcp need confirm.',
    inputSchema: {
      type: 'object',
      required: ['action', 'form'],
      properties: {
        action: {
          type: 'string',
          enum: [
            'set-value',
            'mark-touched',
            'mark-untouched',
            'mark-dirty',
            'mark-pristine',
            'touch-all',
            'revalidate',
            'reset',
            'enable',
            'disable',
            'submit',
            'focus',
            'focus-first-invalid',
            'store-as-global',
            'snapshot',
            'restore',
            'instrument',
            'try-webmcp',
          ],
        },
        form: { type: 'string', description: 'Full form id, e.g. Checkout.form@ab12.' },
        path: pathProperty,
        value: {
          description: 'New value for set-value, or the input object for try-webmcp.',
        },
        mode: { type: 'string', enum: ['code', 'user'] },
        confirm: { type: 'boolean' },
        force: { type: 'boolean' },
        snapshot: { type: 'string', description: 'Snapshot id for restore.' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const state = formsState.value() as FormsState;
      if (!state.forms.length) return refusedAnswer(noForms);
      const match = resolveForm(state.forms, str(args?.['form']));
      if (typeof match === 'string') return { markdown: match };
      const { form: _form, ...rest } = args;
      // A form id ends with its page id, after the @.
      notePageRead(match.id.split('@')[1]);
      const before = latestMarker(state);
      const result = await requestFormAction({ ...rest, formId: match.id });
      return { markdown: actionText(result, await formsAfter(before, result)) };
    },
  });

  agent.registerTool({
    id: 'pangular:fill-form',
    title: 'Fill a form',
    description:
      'Fill several fields by dotted path through the inputs like a user would. Reports written and skipped fields (secret, hidden, readonly, disabled, missing) and the status. `submit` submits afterwards (needs `confirm: true`).',
    inputSchema: {
      type: 'object',
      required: ['form', 'values'],
      properties: {
        form: { type: 'string', description: 'Full form id, e.g. Checkout.form@ab12.' },
        values: { type: 'object', description: 'Map of field path to value.' },
        mode: { type: 'string', enum: ['code', 'user'] },
        submit: { type: 'boolean' },
        confirm: { type: 'boolean' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const state = formsState.value() as FormsState;
      if (!state.forms.length) return refusedAnswer(noForms);
      const match = resolveForm(state.forms, str(args?.['form']));
      if (typeof match === 'string') return { markdown: match };
      notePageRead(match.id.split('@')[1]);
      const before = latestMarker(state);
      const result = await requestFormAction({
        action: 'fill',
        formId: match.id,
        values: args['values'],
        mode: args['mode'],
        submit: args['submit'],
        confirm: args['confirm'],
      });
      return { markdown: actionText(result, await formsAfter(before, result)) };
    },
  });
  return { waitForForm };
}
