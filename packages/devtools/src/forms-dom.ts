export interface DomFacts {
  ariaInvalid?: boolean;
  required?: boolean;
  labelled?: boolean;
  describedBy?: boolean;
  errorShown?: boolean;
  disabled?: boolean;
  drift?: string | true;
  classes?: string[];
}

export interface SubmitDom {
  tag: string;
  buttons: number;
  disabledButtons: number;
  novalidate: boolean;
  nativeInvalid: number;
  reasons: string[];
}

const ERROR_TEXT =
  'mat-error, [role="alert"], .invalid-feedback, .error, .errors, .field-error, .error-message, [data-error]';
const CONTAINER =
  'mat-form-field, .mat-mdc-form-field, .form-group, .form-field, .field, fieldset, label';
const STATUS_CLASS = /^ng-(valid|invalid|pending|dirty|pristine|touched|untouched|submitted)$/;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function isShown(el: Element): boolean {
  if (!el.textContent?.trim()) return false;
  if (el.closest('[hidden], [aria-hidden="true"]')) return false;
  const check = (
    el as Element & {
      checkVisibility?: (options?: {
        visibilityProperty?: boolean;
        checkVisibilityCSS?: boolean;
      }) => boolean;
    }
  ).checkVisibility;
  if (typeof check === 'function') {
    return safe(() => check.call(el, { visibilityProperty: true, checkVisibilityCSS: true }), true);
  }
  const view = el.ownerDocument?.defaultView;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = view ? safe(() => view.getComputedStyle(node!), null) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }
  return true;
}

function referenced(el: Element, attr: string): Element[] {
  const ids = (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean);
  return ids
    .map((id) => el.ownerDocument?.getElementById(id))
    .filter((target): target is HTMLElement => !!target);
}

function isLabelled(el: Element): boolean {
  if (el.getAttribute('aria-label')?.trim()) return true;
  if (referenced(el, 'aria-labelledby').some((l) => l.textContent?.trim())) return true;
  const labels = (el as HTMLInputElement).labels;
  if (labels && Array.from(labels).some((l) => l.textContent?.trim())) return true;
  if (el.closest('label')?.textContent?.trim()) return true;
  return !!el.getAttribute('title')?.trim();
}

const CONTROLS = 'input:not([type="hidden"]), select, textarea';

function controlCount(node: Element): number {
  const seen = new Set<unknown>();
  for (const control of safe(() => Array.from(node.querySelectorAll(CONTROLS)), [] as Element[])) {
    seen.add(control.getAttribute('name') || control);
  }
  return seen.size;
}

function ownContainer(el: Element): Element | null {
  const boundary = el.closest(CONTAINER) ?? el.parentElement;
  let best: Element | null = null;
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (controlCount(node) > 1) break;
    best = node;
    if (node === boundary) break;
  }
  return best;
}

function errorElements(el: Element): Element[] {
  const linked = [...referenced(el, 'aria-describedby'), ...referenced(el, 'aria-errormessage')];
  const container = ownContainer(el);
  const near = container
    ? Array.from(safe(() => container.querySelectorAll(ERROR_TEXT), [] as never)).filter(
        (candidate: Element) => candidate !== el && !candidate.contains(el),
      )
    : [];
  return [...new Set([...linked, ...near])];
}

const NG_VALUE_PREFIX = /^\d+: /;

function sameSelectValue(dom: string, model: unknown): boolean {
  if (sameValue(dom, model)) return true;
  if (!NG_VALUE_PREFIX.test(dom)) return false;
  const value = dom.replace(NG_VALUE_PREFIX, '');
  if (model === null || model === undefined) return value === 'null' || value === 'undefined';
  return sameValue(value, model);
}

function domValue(el: Element): string | boolean | undefined {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'file') return undefined;
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'radio') return undefined;
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value;
  return undefined;
}

function sameValue(dom: string | boolean, model: unknown): boolean {
  if (typeof dom === 'boolean') return dom === !!model;
  if (model === null || model === undefined) return dom === '';
  if (typeof model === 'number') return dom === '' ? Number.isNaN(model) : Number(dom) === model;
  if (typeof model === 'string' || typeof model === 'boolean') return dom === String(model);
  if (model instanceof Date) return true;
  return true;
}

export function domFacts(
  el: Element,
  model: { value?: unknown; disabled?: boolean; secret?: boolean; hasErrors?: boolean },
): DomFacts {
  const facts: DomFacts = {};
  const aria = el.getAttribute('aria-invalid');
  if (aria !== null) facts.ariaInvalid = aria === 'true';
  facts.required =
    el.hasAttribute('required') || el.getAttribute('aria-required') === 'true' ? true : undefined;
  if (facts.required === undefined) delete facts.required;
  const unlabelled =
    (el instanceof HTMLInputElement && el.type === 'hidden') ||
    el.getAttribute('aria-hidden') === 'true';
  if (!unlabelled) facts.labelled = isLabelled(el);
  const describedBy = [
    ...referenced(el, 'aria-describedby'),
    ...referenced(el, 'aria-errormessage'),
  ];
  if (describedBy.length) facts.describedBy = describedBy.some((d) => !!d.textContent?.trim());
  if (model.hasErrors) facts.errorShown = errorElements(el).some(isShown);
  const disabled = (el as HTMLInputElement).disabled;
  if (typeof disabled === 'boolean' && disabled !== !!model.disabled) facts.disabled = disabled;
  const dom = domValue(el);
  const same =
    el instanceof HTMLSelectElement && typeof dom === 'string'
      ? sameSelectValue(dom, model.value)
      : dom === undefined || sameValue(dom, model.value);
  if (dom !== undefined && 'value' in model && !same) {
    facts.drift = model.secret ? true : String(dom).slice(0, 200);
  }
  const classes = Array.from(el.classList).filter((c) => STATUS_CLASS.test(c));
  if (classes.length) facts.classes = classes;
  return facts;
}

function isSubmitter(el: Element): boolean {
  if (el instanceof HTMLButtonElement) return (el.getAttribute('type') ?? 'submit') === 'submit';
  if (el instanceof HTMLInputElement) return el.type === 'submit' || el.type === 'image';
  return false;
}

export interface SubmitContext {
  valid?: boolean;
  submitListener?: boolean;
}

export function submitDom(el: Element, context: SubmitContext = {}): SubmitDom {
  const tag = el.tagName.toLowerCase();
  const reasons: string[] = [];
  if (!(el instanceof HTMLFormElement)) {
    if (context.submitListener) {
      reasons.push(
        `The form directive sits on a <${tag}>, not a <form>, so the browser never fires submit or ngSubmit.`,
      );
    }
    return { tag, buttons: 0, disabledButtons: 0, novalidate: false, nativeInvalid: 0, reasons };
  }
  const inside = Array.from(el.querySelectorAll('button, input'));
  const outside = el.id
    ? Array.from(el.ownerDocument.querySelectorAll(`[form="${el.id.replace(/["\\]/g, '\\$&')}"]`))
    : [];
  const candidates = [...inside, ...outside].filter((b) => {
    const owner = (b as HTMLButtonElement).form;
    return owner === el || (owner === undefined && inside.includes(b));
  });
  const submitters = candidates.filter(isSubmitter);
  const disabledButtons = submitters.filter((b) => (b as HTMLButtonElement).disabled).length;
  const typed = candidates.filter((b) => b instanceof HTMLButtonElement && !isSubmitter(b));
  if (!submitters.length) {
    reasons.push(
      typed.length
        ? 'No submit button: the buttons in this form are type="button", so clicking them does not submit.'
        : 'No submit button in the form (or linked with form="id"). Enter submits only with a single text input or a submit button.',
    );
  } else if (disabledButtons === submitters.length && context.valid) {
    reasons.push(
      'The form is valid but every submit button is disabled, so it cannot be submitted by clicking.',
    );
  }
  const nativeInvalid = el.noValidate
    ? 0
    : safe(() => el.querySelectorAll('input:invalid, select:invalid, textarea:invalid').length, 0);
  if (nativeInvalid) {
    reasons.push(
      `The form has no novalidate and ${nativeInvalid} input(s) fail native validation, so the browser blocks submit before Angular sees it (ngNativeValidate or ngNoForm?).`,
    );
  }
  return {
    tag,
    buttons: submitters.length,
    disabledButtons,
    novalidate: el.noValidate,
    nativeInvalid,
    reasons,
  };
}
