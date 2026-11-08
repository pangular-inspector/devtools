// The Forms inspector on the devframe server (`devframe.ts`): the `forms`
// shared state, its push, ping and forget, and the form actions a page runs.
// Its agent tools live in `devframe-forms-tools.ts`.

import {
  FORM_WRITE_ACTIONS,
  FORMLESS_FORM_ACTIONS,
  actionBlockedMessage,
  type ResolvedPangularConfig,
} from './config.ts';
import type { HubFeed } from './hub-messages.ts';
import { FORMS_SHAPE } from './push-delta.ts';
import {
  explainFieldText,
  explainSubmitText,
  exportFormText,
  type FieldArgs,
  formPayloadText,
  lintFormsFor,
} from './rpc/forms-explain.ts';
import { playwrightTestText } from './rpc/forms-playwright.ts';
import { findFormSource } from './rpc/forms-source.ts';
import {
  currentForms,
  isPageReport,
  mergePageReport,
  type FormsState,
  type PageReport,
} from './rpc/forms-tools.ts';
import type { OwnerBroadcast, PageOwners } from './rpc/page-owners.ts';
import type { PageTtl } from './rpc/page-ttl.ts';
import { createReportDeltas, deltaPush } from './rpc/report-deltas.ts';
import type {
  AnswersFor,
  DevframeNodeContext,
  Owns,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** What `createFormsState` reads from the devframe server's setup (`devframe.ts`). */
export interface FormsStateEnv {
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  owns: Owns;
  feed: HubFeed;
  liveTtl: PageTtl;
}

/** The forms of each page and `push-forms`, which writes them. */
export async function createFormsState(env: FormsStateEnv) {
  const { my, config, register, owns, feed, liveTtl } = env;
  const limits = config.limits;
  // What each page's next delta builds on (`push-delta.ts`).
  const formDeltas = createReportDeltas(FORMS_SHAPE);
  const formPages = new Map<string, PageReport & { reportedAt: number }>();
  const formsState = await my.rpc.sharedState('forms', {
    initialValue: { forms: [], events: [], reportedAt: 0, setupErrors: [] } as FormsState,
  });

  const applyForms = (next: FormsState) =>
    formsState.mutate((draft) => {
      draft.forms = next.forms;
      draft.events = next.events;
      draft.reportedAt = next.reportedAt;
      draft.pagesReportedAt = next.pagesReportedAt ?? {};
      draft.setupErrors = next.setupErrors ?? [];
      draft.instrumented = next.instrumented ?? [];
      draft.dropped = next.dropped ?? {};
      draft.webMcp = next.webMcp ?? [];
    });
  /** A sign of life from a page with forms: its report time, here and in the shared state. */
  const touchFormsPage = (pageId: string, now = Date.now()): boolean => {
    const page = formPages.get(pageId);
    if (!page) return false;
    page.reportedAt = now;
    formsState.mutate((draft) => {
      draft.pagesReportedAt = { ...draft.pagesReportedAt, [pageId]: now };
      draft.reportedAt = Math.min(...[...formPages.values()].map((p) => p.reportedAt));
    });
    return true;
  };

  register({
    name: 'push-forms',
    type: 'action',
    jsonSerializable: true,
    handler: deltaPush(formDeltas, owns, (report) => {
      if (!isPageReport(report) || !owns(report.pageId)) return false;
      applyForms(mergePageReport(formPages, report, Date.now(), limits.formTimeline, liveTtl));
      feed.ngErrors(report.pageId, 'forms', report.setupErrors ?? []);
      return true;
    }),
  });

  return { formPages, formsState, formDeltas, applyForms, touchFormsPage };
}

export type FormsStateHolder = Awaited<ReturnType<typeof createFormsState>>;

/** `ping-forms` and `forget-forms-page`. */
export function registerFormsPages(env: {
  config: ResolvedPangularConfig;
  register: Register;
  owns: Owns;
  mayForget: Owns;
  state: FormsStateHolder;
}): void {
  const { register, owns, mayForget } = env;
  const limits = env.config.limits;
  const { formPages, formDeltas, applyForms, touchFormsPage } = env.state;
  register({
    name: 'ping-forms',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => ({ known: owns(pageId) && touchFormsPage(pageId) }),
  });

  register({
    name: 'forget-forms-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: string) => {
      if (!mayForget(pageId)) return;
      formDeltas.forget(pageId);
      if (formPages.delete(pageId)) applyForms(currentForms(formPages, limits.formTimeline));
    },
  });
}

/** What `registerFormActions` reads from the devframe server's setup (`devframe.ts`). */
export interface FormActionsEnv {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  owners: PageOwners;
  answersFor: AnswersFor;
  formsState: FormsStateHolder['formsState'];
  /** The address of the page a form is on, for the Playwright test export (`devframe-pages.ts`). */
  formPageUrl: (state: FormsState, args: FieldArgs) => string | undefined;
}

/** The form actions a page runs for the panel and the agents, and the forms reads of the panel. */
export function registerFormActions(env: FormActionsEnv) {
  const { ctx, my, config, register, owners, answersFor, formsState, formPageUrl } = env;
  const pendingFormActions = new Map<
    string,
    { pageId: string | undefined; settle: (result: unknown) => void }
  >();
  let formActionSeq = 0;

  const requestFormAction = (request: Record<string, unknown>, timeoutMs = 15_000) => {
    const action = request['action'] as string;
    if (!config.actions.forms && FORM_WRITE_ACTIONS.includes(action)) {
      return Promise.resolve<Record<string, unknown>>({
        ok: false,
        error: actionBlockedMessage('forms'),
      });
    }
    const formId = request['formId'];
    if (!FORMLESS_FORM_ACTIONS.includes(action) && (typeof formId !== 'string' || !formId)) {
      return Promise.resolve<Record<string, unknown>>({
        ok: false,
        error: `${String(action)} needs a formId.`,
      });
    }
    return sendFormAction(request, timeoutMs);
  };

  const sendFormAction = (request: Record<string, unknown>, timeoutMs: number) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const requestId = `f${++formActionSeq}`;
      const formId = typeof request['formId'] === 'string' ? request['formId'] : undefined;
      const explicit = typeof request['page'] === 'string' ? request['page'] : undefined;
      const pageId = explicit ?? (formId?.includes('@') ? formId.split('@')[1] : undefined);
      const { page: _page, ...payload } = request;
      const timer = setTimeout(() => {
        pendingFormActions.delete(requestId);
        resolve({
          ok: false,
          error: `No page answered within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser (or the device app in the foreground), with that form on screen?`,
        });
      }, timeoutMs);
      timer.unref?.();
      pendingFormActions.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pendingFormActions.delete(requestId);
          resolve(
            (result && typeof result === 'object'
              ? result
              : { ok: false, error: 'Empty answer.' }) as Record<string, unknown>,
          );
        },
      });
      // Only the page's own connection gets the request: it can carry the values an agent fills in.
      // The scoped `broadcast` passes `filter` through to devframe's host; its type leaves it out.
      void (my.rpc.broadcast as (options: OwnerBroadcast) => Promise<void>)({
        method: 'form-action',
        args: [{ requestId, pageId, request: payload }],
        optional: true,
        filter: owners.deliversTo(pageId),
      });
    });

  register({
    name: 'form-action-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown }) => {
      if (typeof message?.requestId !== 'string') return;
      const pending = pendingFormActions.get(message.requestId);
      if (pending && answersFor(pending.pageId, message.pageId)) pending.settle(message.result);
    },
  });

  register({
    name: 'request-form-action',
    type: 'action',
    jsonSerializable: true,
    handler: (request: unknown) =>
      request && typeof request === 'object'
        ? requestFormAction(request as Record<string, unknown>)
        : { ok: false, error: 'Bad request.' },
  });

  register({
    name: 'forms-lint',
    type: 'query',
    jsonSerializable: true,
    handler: (args: { form?: unknown; page?: unknown } | null) =>
      lintFormsFor(
        formsState.value() as FormsState,
        {
          form: typeof args?.form === 'string' ? args.form : undefined,
          page: typeof args?.page === 'string' ? args.page : undefined,
        },
        undefined,
        { rules: config.lint.rules },
      ),
  });

  register({
    name: 'forms-owners',
    type: 'query',
    jsonSerializable: true,
    handler: () =>
      (formsState.value() as FormsState).forms.map((form) => ({
        formId: form.id,
        label: form.label,
        file: findFormSource(ctx.cwd, form.owner, form.property)?.form?.file ?? null,
      })),
  });

  register({
    name: 'forms-explain',
    type: 'query',
    jsonSerializable: true,
    handler: (args: { kind?: unknown; form?: unknown; path?: unknown } | null) => {
      const state = formsState.value() as FormsState;
      const target = {
        form: typeof args?.form === 'string' ? args.form : undefined,
        path: typeof args?.path === 'string' ? args.path : undefined,
      };
      switch (args?.kind) {
        case 'submit':
          return explainSubmitText(state, target);
        case 'payload':
          return formPayloadText(state, target);
        case 'fixture':
          return exportFormText(state, { ...target, format: 'fixture' });
        case 'playwright':
          return playwrightTestText(state, { ...target, url: formPageUrl(state, target) });
        default:
          return explainFieldText(state, target);
      }
    },
  });

  return requestFormAction;
}
