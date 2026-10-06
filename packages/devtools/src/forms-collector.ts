import {
  collectForms,
  controlPathOf,
  detailOf,
  diffForms,
  findFieldElement,
  findForms,
  createFormIds,
  formLabels,
  propertyHolding,
  serializeControl,
  watchControlEvents,
  type CollectedForm,
  type EventOrigin,
  type FormEvent,
  type FormFieldNode,
  type FoundForm,
  forgetFormSecrets,
  redactFormText,
} from './forms.ts';
import {
  isDevtoolsAction,
  isFormAction,
  locateElement,
  runFormAction,
  type ActionContext,
  type FormActionResult,
} from './forms-actions.ts';
import {
  VALIDATOR_METHODS,
  countRenders,
  instrumentForms,
  type InstrumentCall,
  type Instrumentation,
  type RenderCounter,
} from './forms-instrument.ts';
import { redactMessage } from './forms-privacy.ts';
import { fieldPath, probeEveryTime } from './forms-read.ts';
import { watchWebMcp } from './forms-webmcp.ts';

type AnyRecord = Record<string, any>;

interface Rpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

const MAX_FORM_EVENTS = 200;
const HEARTBEAT_MS = 5000;
const PUSH_DELAY_MS = 80;
const MAX_SETUP_ERRORS = 20;
const MERGE_MS = 2000;
const PICK_TIMEOUT_MS = 12_000;
const DIFFED_FOR_ALL: FormEvent['type'][] = [
  'value',
  'status',
  'touched',
  'dirty',
  'added',
  'removed',
];
const USER_EVENTS = ['input', 'change', 'focusout', 'submit', 'reset', 'click', 'keydown'];

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isFieldTarget(target: unknown): target is { formId: string; path: string } {
  const t = target as { formId?: unknown; path?: unknown } | null;
  return (
    typeof t?.formId === 'string' &&
    typeof t.path === 'string' &&
    t.formId.length < 200 &&
    t.path.length < 500
  );
}

export function describeElement(el: Element | null): string | undefined {
  if (!el || el === document.body) return undefined;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name') || el.getAttribute('formcontrolname') || el.id;
  return name ? `${tag}[${name}]` : tag;
}

export function setupErrorOf(args: unknown[]): string | null {
  const text = args
    .map((arg) => (arg instanceof Error ? arg.message : typeof arg === 'string' ? arg : ''))
    .join(' ');
  const match = text.match(
    /NG0?1\d{3}[^\n]*|Cannot register form "[^"\n]*" as a WebMCP tool[^\n]*/,
  );
  return match ? redactMessage(match[0]).slice(0, 300) : null;
}

function afterPaint(fn: () => void) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
  else setTimeout(fn, 16);
}

export interface FormsCollector {
  push(): void;
  stop(): void;
}

export function attachForms(
  my: Rpc,
  pageId: string,
  getNg: () => any,
  highlight: { show(el: HTMLElement): void; clear(): void },
  maxEvents = MAX_FORM_EVENTS,
): FormsCollector {
  const assignIds = createFormIds(pageId);
  let ids = new WeakMap<object, string>();
  const idOf = (root: object) => ids.get(root) ?? `form@${pageId}`;
  let hosts: Element[] | null = null;
  let hostsStale = true;
  const observer =
    typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          hostsStale = true;
        })
      : null;
  observer?.observe(document.documentElement, { childList: true, subtree: true });
  let lastForms: CollectedForm[] = [];
  let lastPayload = '';
  let lastPushAt = 0;
  const formEvents: FormEvent[] = [];
  let droppedEvents = 0;
  const watched = new Map<object, { formId: string; stop: () => void }>();
  const lastStatus = new Map<string, string>();
  const lastValue = new Map<string, string>();
  const pendingSince = new Map<string, number>();
  const wrappedSubmits = new WeakSet<object>();
  const signalRoots = new Map<object, { formId: string; unwrap: (() => void)[] }>();
  const setupErrors: string[] = [];
  let foundById = new Map<string, FoundForm>();
  let fieldElements = new WeakMap<object, Element>();
  let eventSeq = 0;
  let userActive = false;
  let userSincePush = false;
  let devtoolsSincePush = false;
  let userTimer: ReturnType<typeof setTimeout> | undefined;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let submittingForm: string | null = null;
  let instrumentation: Instrumentation | null = null;
  let renders: RenderCounter | null = null;
  let renderSince: number | null = null;
  let pendingCaller: { formId: string; text: string } | null = null;
  const signalCallers = new Map<string, string>();
  const pendingStarted = new Map<string, number>();
  let cancelPick: (() => void) | null = null;
  const ownerNames = new Set<string>();
  const webMcp = watchWebMcp(() => schedulePush());

  const originNow = (): EventOrigin =>
    isDevtoolsAction() ? 'devtools' : webMcp.active() ? 'agent' : userActive ? 'user' : 'code';

  function recordFormEvent(input: FormEvent, infer = true) {
    const event: FormEvent = { ...input, seq: ++eventSeq };
    if (infer) event.origin ??= originNow();
    const key = `${event.formId}:${event.path}`;
    if (pendingCaller?.formId === event.formId && !event.caller && event.origin !== 'devtools') {
      event.caller = pendingCaller.text;
    }
    if (event.type === 'status') {
      const next = event.detail?.split('→').pop()?.trim();
      if (next === 'PENDING') pendingStarted.set(key, event.timestamp);
      else if (pendingStarted.has(key)) {
        event.ms = event.timestamp - pendingStarted.get(key)!;
        pendingStarted.delete(key);
      }
    }
    if (event.type === 'value') {
      const previous = lastValue.get(key);
      if (previous === event.detail) return;
      if (previous !== undefined) event.prev = previous;
      lastValue.set(key, event.detail ?? '');
    }
    if (event.type === 'status') {
      const status = event.detail?.split('→').pop()?.trim() ?? '';
      if (lastStatus.get(key) === status) return;
      lastStatus.set(key, status);
    }
    if (event.type === 'value') {
      for (let i = formEvents.length - 1; i >= Math.max(0, formEvents.length - 6); i--) {
        const earlier = formEvents[i];
        if (earlier.formId !== event.formId || earlier.path !== event.path) break;
        if (earlier.type !== 'value') continue;
        if (earlier.origin !== event.origin || event.timestamp - earlier.timestamp > MERGE_MS)
          break;
        formEvents.splice(i, 1);
        formEvents.push({ ...event, prev: earlier.prev, count: (earlier.count ?? 1) + 1 });
        return;
      }
    }
    formEvents.push(event);
    if (formEvents.length > maxEvents) {
      droppedEvents += formEvents.length - maxEvents;
      formEvents.splice(0, formEvents.length - maxEvents);
    }
  }

  function seedStatuses(formId: string, node: FormFieldNode) {
    lastStatus.set(`${formId}:${node.path}`, node.status);
    if (node.type === 'control') lastValue.set(`${formId}:${node.path}`, detailOf(node.value));
    for (const child of node.children ?? []) seedStatuses(formId, child);
  }

  function forgetKeys(formId: string) {
    for (const map of [lastStatus, lastValue, pendingSince]) {
      for (const key of map.keys()) {
        if (key.startsWith(`${formId}:`)) map.delete(key);
      }
    }
  }

  function unwrapSignalRoot(root: object) {
    const entry = signalRoots.get(root);
    if (!entry) return;
    signalRoots.delete(root);
    for (const unwrap of entry.unwrap.splice(0)) unwrap();
    instrumentation?.forgetSignalRoot(root);
  }

  function watchRoots(found: FoundForm[]) {
    const live = new Set<object>();
    for (const form of found) {
      live.add(form.root);
      if (form.kind === 'signal') {
        wrapSignalSubmit(form);
        continue;
      }
      const formId = idOf(form.root);
      const existing = watched.get(form.root);
      if (existing?.formId === formId) continue;
      if (existing) {
        existing.stop();
        watched.delete(form.root);
      }
      const stop = watchControlEvents(
        form.root,
        formId,
        (event) => {
          if (event.type !== 'touched' && event.type !== 'dirty') {
            recordFormEvent({ ...event, formId: idOf(form.root) });
          }
          schedulePush();
        },
        {
          elements: () => fieldElements,
          rootKey: form.property ?? propertyHolding(form) ?? '',
          submitted: () => form.directive?.['submitted'],
        },
      );
      if (!stop) continue;
      watched.set(form.root, { formId, stop });
      seedStatuses(formId, serializeControl(form.root, fieldElements));
    }
    for (const [root, { formId, stop }] of watched) {
      if (live.has(root)) continue;
      stop();
      watched.delete(root);
      forgetKeys(formId);
    }
    for (const [root, { formId }] of signalRoots) {
      if (live.has(root)) continue;
      unwrapSignalRoot(root);
      forgetKeys(formId);
    }
  }

  function wrapSignalSubmit(form: FoundForm) {
    let entry = signalRoots.get(form.root);
    if (!entry) signalRoots.set(form.root, (entry = { formId: '', unwrap: [] }));
    entry.formId = idOf(form.root);
    const unwrap = entry.unwrap;
    const visit = (node: AnyRecord, depth: number) => {
      wrapSubmitFlag(form.root, node, unwrap);
      if (depth >= 8) return;
      const children = read(() => node['structure'].materializedChildren() as AnyRecord[], []);
      for (const child of children.slice(0, 200)) visit(child, depth + 1);
    };
    visit(form.root, 0);
  }

  function wrapSubmitFlag(root: AnyRecord, node: AnyRecord, unwrap: (() => void)[]) {
    const flag = read(() => node['submitState']['selfSubmitting'] as AnyRecord, null);
    if (!flag || wrappedSubmits.has(flag) || typeof flag['set'] !== 'function') return;
    wrappedSubmits.add(flag);
    const path = node === root ? '' : read(() => fieldPath(node), '');
    const original = flag['set'];
    unwrap.push(() => {
      flag['set'] = original;
      wrappedSubmits.delete(flag);
    });
    let started = false;
    flag['set'] = function (this: unknown, value: boolean) {
      const result = original.call(this, value);
      const formId = idOf(root);
      if (value) {
        if (node === root) webMcp.link(root);
        started = true;
        submittingForm = formId;
        recordFormEvent({
          formId,
          path,
          type: 'submit',
          outcome: 'ran',
          timestamp: Date.now(),
        });
      } else {
        if (!started) {
          recordFormEvent({
            formId,
            path,
            type: 'submit',
            outcome: 'blocked',
            detail: 'invalid, so the action did not run',
            timestamp: Date.now(),
          });
        }
        started = false;
        if (submittingForm === formId) setTimeout(() => (submittingForm = null), 0);
      }
      schedulePush();
      return result;
    };
  }

  function stampPending(formId: string, node: FormFieldNode, now: number) {
    const key = `${formId}:${node.path}`;
    if (node.status === 'PENDING') {
      if (!pendingSince.has(key)) pendingSince.set(key, now);
      node.pendingSince = pendingSince.get(key);
    } else pendingSince.delete(key);
    for (const child of node.children ?? []) stampPending(formId, child, now);
  }

  async function pushForms() {
    try {
      const ng = getNg();
      if (!ng?.getDirectives) return;
      const rescan = hostsStale || !hosts || !observer;
      const found = findForms(
        ng,
        rescan ? document.querySelectorAll('*') : hosts!.filter((el) => el.isConnected),
      );
      if (rescan) {
        hosts = found.hosts ?? null;
        hostsStale = false;
      }
      const labels = formLabels(found.forms);
      ids = assignIds(found.forms, labels);
      foundById = new Map(found.forms.map((form) => [idOf(form.root), form]));
      fieldElements = found.elements;
      watchRoots(found.forms);
      const forms = collectForms(found, (root) => idOf(root));
      const now = Date.now();
      for (const form of forms) stampPending(form.id, form.root, now);
      const streamed = new Set(Array.from(watched.values(), ({ formId }) => formId));
      const agentSincePush = webMcp.takeActivity();
      for (const event of diffForms(lastForms, forms)) {
        if (!streamed.has(event.formId) || DIFFED_FOR_ALL.includes(event.type)) {
          const caller = signalCallers.get(event.formId);
          const origin: EventOrigin | undefined = devtoolsSincePush
            ? 'devtools'
            : agentSincePush
              ? 'agent'
              : userSincePush
                ? 'user'
                : caller !== undefined
                  ? 'code'
                  : undefined;
          const tagged: FormEvent = origin ? { ...event, origin } : event;
          if (caller && origin !== 'devtools') tagged.caller = caller;
          recordFormEvent(tagged, false);
        }
      }
      lastForms = forms;
      for (const form of forms) ownerNames.add(form.owner);
      userSincePush = false;
      devtoolsSincePush = false;
      signalCallers.clear();
      attachRenders();
      if (instrumentation) {
        for (const form of found.forms) {
          if (form.kind === 'signal') instrumentation.addSignalRoot(form.root);
          else instrumentation.addControl(form.root);
        }
      }
      const mcp = webMcp.describe(
        found.forms
          .filter((form) => form.kind === 'signal')
          .map((form) => ({ root: form.root, formId: idOf(form.root), element: form.element })),
        ng,
      );
      for (const form of forms) {
        const root = foundById.get(form.id)?.root;
        const tool = root && mcp.forms.get(root);
        if (tool) form.webMcp = tool;
      }
      const report = {
        pageId,
        forms,
        ...(mcp.page ? { webMcp: mcp.page } : {}),
        events: formEvents,
        setupErrors,
        instrumented: !!instrumentation,
        ...(droppedEvents ? { dropped: droppedEvents } : {}),
      };
      const payload = JSON.stringify(report);
      if (payload === lastPayload && now - lastPushAt < HEARTBEAT_MS) return;
      lastPayload = payload;
      lastPushAt = now;
      await my.rpc.call('push-forms', report);
    } catch {
      return;
    }
  }

  function schedulePush() {
    if (pushTimer) return;
    pushTimer = setTimeout(() => {
      pushTimer = undefined;
      void pushForms();
    }, PUSH_DELAY_MS);
  }

  function attachRenders() {
    if (!renders || renderSince === null) return;
    const since = renderSince;
    const taken = renders.take();
    renderSince = null;
    if (!taken) return;
    for (let i = formEvents.length - 1; i >= 0; i--) {
      const event = formEvents[i];
      if ((event.seq ?? 0) <= since) break;
      if (event.type === 'value' && event.origin === 'user') {
        event.renders = taken.total;
        event.rendered = taken.top;
        return;
      }
    }
  }

  function onInstrumentedCall(call: InstrumentCall) {
    if (isDevtoolsAction()) return;
    const root = call.signalRoot ?? read(() => call.target['root'] as AnyRecord, null);
    if (!root) return;
    const formId = idOf(root);
    if (!foundById.has(formId)) return;
    const text = call.caller ? `${call.method} in ${call.caller}` : '';
    if (call.signalRoot) {
      if (!signalCallers.get(formId)) signalCallers.set(formId, text);
      schedulePush();
      return;
    }
    if (VALIDATOR_METHODS.includes(call.method)) {
      if (!call.caller) return;
      recordFormEvent({
        formId,
        path: read(() => controlPathOf(root, call.target), ''),
        type: 'validators',
        detail: call.method,
        caller: call.caller,
        origin: 'code',
        timestamp: Date.now(),
      });
      schedulePush();
      return;
    }
    if (!text) return;
    pendingCaller = { formId, text };
    setTimeout(() => {
      if (pendingCaller?.text === text) pendingCaller = null;
    }, 0);
  }

  function setInstrumented(on: boolean): FormActionResult {
    if (on && !instrumentation) {
      probeEveryTime(true);
      instrumentation = instrumentForms(onInstrumentedCall, ownerNames);
      renders = countRenders(getNg());
      void pushForms();
      return {
        ok: true,
        message: renders
          ? 'Recording callers, validator changes and renders per keystroke.'
          : 'Recording callers and validator changes (render counts need Angular debug APIs).',
      };
    }
    if (!on && instrumentation) {
      probeEveryTime(false);
      instrumentation.stop();
      renders?.stop();
      instrumentation = null;
      renders = null;
      void pushForms();
    }
    return { ok: true, message: on ? 'Already recording.' : 'Stopped recording.' };
  }

  function pick(ctx: ActionContext): Promise<FormActionResult> {
    cancelPick?.();
    const failed = (message: string): FormActionResult => ({ ok: false, message, error: message });
    return new Promise((resolve) => {
      const finish = (result: FormActionResult) => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('mouseover', onHover, true);
        document.removeEventListener('mouseout', onLeave, true);
        document.removeEventListener('keydown', onKey, true);
        clearTimeout(timer);
        highlight.clear();
        cancelPick = null;
        resolve(result);
      };
      const onHover = (event: Event) => {
        if (event.target instanceof HTMLElement) highlight.show(event.target);
      };
      const onLeave = (event: MouseEvent) => {
        if (!event.relatedTarget) highlight.clear();
      };
      const onClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target instanceof Element ? event.target : null;
        const field =
          target?.closest('input, select, textarea, [formcontrolname], [ngmodel]') ?? target;
        finish(
          (field && locateElement(ctx, field)) ??
            failed('That element is not bound to a form field.'),
        );
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') finish(failed('Picking cancelled.'));
      };
      const timer = setTimeout(() => finish(failed('No field was picked.')), PICK_TIMEOUT_MS);
      cancelPick = () => finish(failed('Picking cancelled.'));
      document.addEventListener('click', onClick, true);
      document.addEventListener('mouseover', onHover, true);
      document.addEventListener('mouseout', onLeave, true);
      document.addEventListener('keydown', onKey, true);
    });
  }

  const onUserEvent = (event: Event) => {
    if (!isDevtoolsAction()) userSincePush = true;
    if (renders && renderSince === null && (event.type === 'input' || event.type === 'change')) {
      renderSince = eventSeq;
      renders.start();
    }
    userActive = true;
    clearTimeout(userTimer);
    userTimer = setTimeout(() => (userActive = false), 0);
    if (event.type === 'submit') onSubmit(event);
    if (event.type !== 'click' && event.type !== 'keydown') schedulePush();
  };

  function onSubmit(event: Event) {
    const target = event.target;
    for (const [formId, form] of foundById) {
      if (form.formElement !== target || form.kind === 'signal') continue;
      const status = String(read(() => form.root['status'], ''));
      setTimeout(() => {
        afterPaint(() => {
          const focus = describeElement(document.activeElement);
          recordFormEvent({
            formId,
            path: '',
            type: 'submit',
            outcome: 'ran',
            detail: `status ${status} at submit${focus ? `, focus on ${focus}` : ''}`,
            origin: isDevtoolsAction() ? 'devtools' : 'user',
            timestamp: Date.now(),
          });
          schedulePush();
        });
      }, 0);
    }
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    if (!submittingForm) return;
    recordFormEvent({
      formId: submittingForm,
      path: '',
      type: 'submit',
      outcome: 'threw',
      detail: redactFormText(
        submittingForm,
        String(event.reason?.message ?? event.reason ?? 'error'),
      ).slice(0, 200),
      timestamp: Date.now(),
    });
    schedulePush();
  };

  for (const type of USER_EVENTS) document.addEventListener(type, onUserEvent, true);
  addEventListener('unhandledrejection', onRejection);

  const originalError = console.error;
  const patchedError = function (this: unknown, ...args: unknown[]) {
    const setup = read(() => setupErrorOf(args), null);
    if (setup && !setupErrors.includes(setup)) {
      setupErrors.push(setup);
      if (setupErrors.length > MAX_SETUP_ERRORS) setupErrors.shift();
      schedulePush();
    }
    return originalError.apply(this, args as []);
  };
  console.error = patchedError;

  my.rpc.register({
    name: 'highlight-form-field',
    type: 'event',
    jsonSerializable: true,
    handler: (target: { formId: string; path: string } | null) => {
      highlight.clear();
      const ng = getNg();
      if (!isFieldTarget(target) || !ng?.getDirectives) return;
      const found = foundById.get(target.formId);
      if (!found) return;
      try {
        const el = findFieldElement(
          ng,
          document.querySelectorAll('*'),
          found,
          target.path,
          fieldElements,
        );
        if (el instanceof HTMLElement) highlight.show(el);
      } catch {
        return;
      }
    },
  });

  my.rpc.register({
    name: 'form-action',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: string; pageId?: string; request?: unknown }) => {
      if (!message || typeof message.requestId !== 'string') return;
      if (message.pageId && message.pageId !== pageId) return;
      const respond = (result: unknown) =>
        void my.rpc
          .call('form-action-result', { requestId: message.requestId, pageId, result })
          .catch(() => {});
      const ng = getNg();
      if (!ng?.getDirectives)
        return respond({
          ok: false,
          error: 'This page has no Angular debug API (production build?).',
        });
      if (!isFormAction(message.request))
        return respond({ ok: false, error: 'Unknown form action.' });
      const request = message.request;
      if (request.formId && !foundById.has(request.formId) && request.action !== 'locate') return;
      if (!request.formId && !foundById.size && request.action !== 'locate') return;
      if (request.action === 'locate') {
        let el: Element | null = null;
        try {
          el = request.selector ? document.querySelector(request.selector) : null;
        } catch {
          el = null;
        }
        if (!el) return;
      }
      const ctx: ActionContext = {
        ng,
        forms: foundById,
        elements: fieldElements,
        all: () => document.querySelectorAll('*'),
      };
      if (request.action === 'instrument') return respond(setInstrumented(request.value !== false));
      if (request.action === 'pick') {
        void pick(ctx).then(respond);
        return;
      }
      if (request.action === 'cancel-pick') {
        const active = cancelPick;
        active?.();
        return respond({ ok: true, message: active ? 'Picking cancelled.' : 'No pick to cancel.' });
      }
      devtoolsSincePush = true;
      runFormAction(ctx, request).then(
        (result) => {
          respond(result);
          void pushForms();
        },
        (error) => respond({ ok: false, error: String((error as Error)?.message ?? error) }),
      );
    },
  });

  return {
    push: () => void pushForms(),
    stop() {
      observer?.disconnect();
      webMcp.stop();
      probeEveryTime(false);
      clearTimeout(pushTimer);
      clearTimeout(userTimer);
      for (const type of USER_EVENTS) document.removeEventListener(type, onUserEvent, true);
      removeEventListener('unhandledrejection', onRejection);
      if (console.error === patchedError) console.error = originalError;
      for (const { stop } of watched.values()) stop();
      watched.clear();
      for (const root of [...signalRoots.keys()]) unwrapSignalRoot(root);
      cancelPick?.();
      instrumentation?.stop();
      renders?.stop();
      instrumentation = null;
      renders = null;
      forgetFormSecrets(lastForms.map((form) => form.id));
    },
  };
}
