import type { CollectedForm, FormEvent, FormFieldNode } from '../forms.ts';

export type LintSeverity = 'error' | 'warning' | 'info';

export interface FormLintFinding {
  rule: string;
  severity: LintSeverity;
  form: string;
  label: string;
  path?: string;
  message: string;
  fix: string;
}

const STUCK_PENDING_MS = 5000;

function walk(node: FormFieldNode, visit: (node: FormFieldNode) => void) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function isLeaf(node: FormFieldNode): boolean {
  return node.type === 'control' && node.materialized !== false;
}

function requiredByModel(node: FormFieldNode): boolean {
  return (
    !!node.required ||
    !!node.validatorNames?.some((name) => name === 'required' || name.startsWith('required ')) ||
    node.errors.some((error) => error.kind === 'required')
  );
}

export function lintForm(
  form: CollectedForm,
  events: FormEvent[] = [],
  now = Date.now(),
): FormLintFinding[] {
  const out: FormLintFinding[] = [];
  const add = (
    rule: string,
    severity: LintSeverity,
    path: string | undefined,
    message: string,
    fix: string,
  ) => out.push({ rule, severity, form: form.id, label: form.label, path, message, fix });
  let bound = 0;
  walk(form.root, (node) => {
    if (node.bound) bound++;
  });

  for (const reason of form.submitDom?.reasons ?? []) {
    add(
      'submit-unreachable',
      'info',
      undefined,
      reason,
      'Add a type="submit" button inside the <form>, or link it with form="id".',
    );
  }
  if (form.kind === 'signal' && form.submitDom && form.submit && !form.submit.hasAction) {
    add(
      'formroot-no-submission',
      'error',
      undefined,
      'The [formRoot] form has no submission action, so submitting throws NG01915.',
      'Pass { submission: { action: async (form) => … } } as the third argument of form().',
    );
  }

  walk(form.root, (node) => {
    const at = node.path || undefined;
    if (node.stale?.length) {
      add(
        'stale-validity',
        'warning',
        at,
        `Validators now report ${node.stale.join(', ')} but the control's errors do not: validators changed without revalidating.`,
        'Call control.updateValueAndValidity() after setValidators, addValidators or removeValidators.',
      );
    }
    if (node.pendingSince && now - node.pendingSince > STUCK_PENDING_MS) {
      add(
        'stuck-pending',
        'warning',
        at,
        `Pending for ${Math.round((now - node.pendingSince) / 1000)}s. An async validator that never completes keeps the form PENDING forever.`,
        'Make the async validator observable complete (take(1), first()) or add a timeout.',
      );
    }
    if (form.kind === 'signal' && node.hidden && node.bound && node.hiddenBy !== 'parent') {
      add(
        'hidden-field-rendered',
        'warning',
        at,
        'The field is hidden() in the schema but still bound to an element, so users can edit a field that skips validation.',
        'Wrap the element in @if (!field().hidden()) { … }.',
      );
    }
    if (node.dom?.drift !== undefined) {
      add(
        'view-out-of-sync',
        'warning',
        at,
        'The element shows a different value than the model. Usually a change made outside change detection (FormArray.push without markForCheck) or a custom control that ignores writeValue.',
        "Trigger change detection after the change, or check the control's writeValue.",
      );
    }
    if (node.dom?.disabled !== undefined && form.kind === 'reactive') {
      add(
        'disabled-attr-reactive',
        'warning',
        at,
        `The element is ${node.dom.disabled ? '' : 'not '}disabled but the control is ${node.status === 'DISABLED' ? '' : 'not '}disabled. The [disabled] attribute does not work with reactive forms.`,
        'Use control.disable() / enable(), or { value, disabled } when creating the control.',
      );
    }
    if (node.modelDrift) {
      add(
        'ngmodel-drift',
        'info',
        at,
        'ngModel holds a different value than its [ngModel] input: the bound property changed and the view has not caught up yet.',
        'Run change detection, or check for a (ngModelChange) handler that rewrites the value.',
      );
    }
    for (const error of node.errors) {
      if (error.source === 'submission') {
        add(
          'submission-error',
          'info',
          at,
          `Server/submission error "${error.kind}" stays until this field's value changes.`,
          'Clear it on the next submit, or when a related field changes.',
        );
      }
    }
    if (!isLeaf(node) || !node.dom) return;
    if (node.dom.labelled === false) {
      add(
        'missing-label',
        'warning',
        at,
        'The input has no accessible name.',
        'Add a <label for>, aria-label or aria-labelledby.',
      );
    }
    const invalid = node.status === 'INVALID';
    const aria = node.dom.ariaInvalid;
    if ((aria === true && !invalid) || (aria === false && invalid && node.touched)) {
      add(
        'aria-invalid-desync',
        'warning',
        at,
        `aria-invalid is ${aria} but the field is ${node.status}${invalid ? ' and touched' : ''}.`,
        'Bind [attr.aria-invalid] to the field state (invalid && touched).',
      );
    }
    if (requiredByModel(node) && !node.dom.required && !node.hidden) {
      add(
        'required-not-exposed',
        'warning',
        at,
        'The model requires this field but the element has no required or aria-required, so screen readers do not announce it.',
        'Add the required attribute (template-driven) or [attr.aria-required]="true".',
      );
    }
    if (invalid && node.touched && node.errors.length) {
      if (node.dom.errorShown === false) {
        add(
          'error-not-shown',
          'info',
          at,
          'The field is invalid and touched, but no visible error text was found near it.',
          'Render the error (for example @if (field().touched() && field().invalid()) { … }).',
        );
      } else if (node.dom.describedBy === undefined && node.dom.errorShown) {
        add(
          'error-not-described',
          'info',
          at,
          'Error text is visible but not linked to the input, so screen readers skip it.',
          'Point aria-describedby (or aria-errormessage) at the error element.',
        );
      }
    }
  });

  if (form.kind === 'signal' && bound) {
    walk(form.root, (node) => {
      if (isLeaf(node) && node.required && !node.bound && !node.hidden && node.path) {
        add(
          'unbound-required',
          'warning',
          node.path,
          'Required, but no element binds this field, so users cannot fill it and the form stays invalid.',
          'Bind it with [formField], hide it with hidden(), or drop the rule.',
        );
      }
    });
  }

  const submits = events.filter(
    (event) =>
      event.formId === form.id && event.type === 'submit' && event.detail?.includes('INVALID'),
  );
  const last = submits[submits.length - 1];
  if (last && !/focus on (input|select|textarea)/.test(last.detail ?? '')) {
    add(
      'no-focus-on-invalid-submit',
      'info',
      undefined,
      'After an invalid submit, focus did not move to a field.',
      'Focus the first invalid field on submit (Signal Forms: field().focusBoundControl()).',
    );
  }
  return out;
}

export function lintSetupErrors(errors: string[]): FormLintFinding[] {
  return errors.map((message) => ({
    rule: 'setup-error',
    severity: 'error' as const,
    form: '',
    label: '',
    message,
    fix: 'See https://angular.dev/errors for this code.',
  }));
}
