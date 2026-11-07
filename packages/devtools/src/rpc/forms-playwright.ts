import type { CollectedForm, FormEvent, FormFieldNode } from '../forms.ts';
import { splitPath } from '../forms-path.ts';
import { REDACTED } from '../forms-privacy.ts';
import { pickForm, type FieldArgs } from './forms-explain.ts';
import { UNTRUSTED, code, type FormsState } from './forms-tools.ts';
import { FORM_TOOL_MAX_CHARS, capText } from './forms-cap.ts';

/** Origins whose changes a test replays: what a person, an agent or the panel did, not app code. */
const REPLAYED = new Set<FormEvent['origin']>(['user', 'agent', 'devtools']);
const MAX_STEPS = 200;

type Step =
  | { kind: 'value'; node: FormFieldNode; value: unknown; clipped: boolean }
  | { kind: 'submit' | 'reset' };

function leaves(root: FormFieldNode): Map<string, FormFieldNode> {
  const out = new Map<string, FormFieldNode>();
  const visit = (node: FormFieldNode) => {
    if (node.type === 'control' && node.materialized !== false) out.set(node.path, node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return out;
}

/** Each node on the way to a path, the root left out. */
function chain(root: FormFieldNode, path: string): FormFieldNode[] | null {
  const out: FormFieldNode[] = [];
  let node: FormFieldNode | undefined = root;
  let at = '';
  for (const key of splitPath(path)) {
    at = at ? `${at}.${escapeKey(key)}` : escapeKey(key);
    node = node?.children?.find((child) => child.path === at);
    if (!node) return null;
    out.push(node);
  }
  return out;
}

function escapeKey(key: string): string {
  if (key === '') return '\\e';
  return key.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
}

function attr(name: string, value: string): string {
  return `[${name}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

/**
 * A CSS selector for a field, from the attributes its binding puts in the template:
 * `formcontrolname` and its group names, `name` and `ngmodelgroup`, or the Signal Forms
 * field name. Null when the template has no such attribute to go by (an array index).
 */
export function fieldSelector(form: CollectedForm, node: FormFieldNode): string | null {
  if (form.kind === 'signal') return node.name ? attr('name', node.name) : null;
  const nodes = chain(form.root, node.path);
  if (!nodes?.length) return null;
  const parts: string[] = [];
  for (const [i, part] of nodes.entries()) {
    // An index is a property binding (`[formControlName]="i"`), which leaves no attribute.
    if (/^\d+$/.test(part.key)) return null;
    const last = i === nodes.length - 1;
    if (form.kind === 'reactive') {
      const name = last
        ? 'formcontrolname'
        : part.type === 'array'
          ? 'formarrayname'
          : 'formgroupname';
      parts.push(attr(name, part.key));
    } else parts.push(attr(last ? 'name' : 'ngmodelgroup', part.key));
  }
  return parts.join(' ');
}

function parseDetail(detail: string | undefined): { value: unknown; clipped: boolean } | null {
  if (detail === undefined) return null;
  try {
    return { value: JSON.parse(detail), clipped: false };
  } catch {
    return { value: detail, clipped: true };
  }
}

function hasSecret(value: unknown): boolean {
  if (value === REDACTED) return true;
  if (value && typeof value === 'object') return Object.values(value).some(hasSecret);
  return false;
}

/** The steps the history holds, oldest first, with typing in one field folded into its last value. */
export function historySteps(form: CollectedForm, events: FormEvent[]): Step[] {
  const fields = leaves(form.root);
  const steps: Step[] = [];
  const ordered = events
    .filter((event) => event.formId === form.id && REPLAYED.has(event.origin))
    .sort((a, b) => (a.seq ?? a.timestamp) - (b.seq ?? b.timestamp));
  for (const event of ordered) {
    if (event.type === 'submit' || event.type === 'reset') {
      // A submit the page blocked still came from a press of the submit button.
      steps.push({ kind: event.type });
      continue;
    }
    if (event.type !== 'value') continue;
    const node = fields.get(event.path);
    const parsed = parseDetail(event.detail);
    if (!node || !parsed) continue;
    const last = steps.at(-1);
    if (last?.kind === 'value' && last.node.path === node.path) steps.pop();
    steps.push({ kind: 'value', node, ...parsed });
  }
  return steps.slice(-MAX_STEPS);
}

function str(value: unknown): string {
  return JSON.stringify(value);
}

function kindOf(node: FormFieldNode, value: unknown): 'check' | 'select' | 'radio' | 'fill' {
  const accessor = `${node.accessor ?? ''} ${node.binding?.accessor ?? ''}`;
  if (/Radio/.test(accessor)) return 'radio';
  if (/Checkbox/.test(accessor) || typeof value === 'boolean') return 'check';
  if (/Select/.test(accessor) || node.binding?.element === 'select') return 'select';
  return 'fill';
}

function stepLines(form: CollectedForm, step: Step, formLocator: string | null): string[] {
  if (step.kind !== 'value') {
    if (!formLocator)
      return [`  // TODO: ${step.kind} the form (no field selector to find it by).`];
    return step.kind === 'submit'
      ? [
          `  await ${formLocator}.locator('button[type="submit"], input[type="submit"]').first().click();`,
        ]
      : [`  await ${formLocator}.evaluate((form) => (form as HTMLFormElement).reset());`];
  }
  const { node, value } = step;
  const label = node.path || '(form)';
  const selector = fieldSelector(form, node);
  if (!selector) return [`  // TODO: set ${label} to ${str(value)} (no selector found for it).`];
  const field = `page.locator(${str(selector)})`;
  if (node.redacted || hasSecret(value)) {
    return [
      `  // ${label} is a secret field, so its value was not recorded.`,
      `  await ${field}.fill(process.env[${str(`FORM_${label.replace(/\W+/g, '_').toUpperCase()}`)}] ?? '');`,
    ];
  }
  if (step.clipped) return [`  // TODO: ${label} held a value too long to record; fill it in.`];
  const kind = kindOf(node, value);
  if (kind === 'check') return [`  await ${field}.setChecked(${value === true});`];
  if (kind === 'radio') {
    return [`  await page.locator(${str(`${selector}${attr('value', String(value))}`)}).check();`];
  }
  if (kind === 'select') {
    const option = Array.isArray(value) ? value.map(String) : String(value ?? '');
    return [`  await ${field}.selectOption(${str(option)});`];
  }
  if (value !== null && typeof value === 'object') {
    return [`  // TODO: ${label} holds ${str(value)}; set it through its custom control.`];
  }
  return [
    `  await ${field}.fill(${str(value === null || value === undefined ? '' : String(value))});`,
  ];
}

function assertionLines(form: CollectedForm, steps: Step[], formLocator: string | null): string[] {
  const lines: string[] = [];
  const done = new Set<string>();
  const fields = leaves(form.root);
  for (const step of steps) {
    if (step.kind !== 'value' || done.has(step.node.path)) continue;
    done.add(step.node.path);
    const node = fields.get(step.node.path);
    const selector = node && fieldSelector(form, node);
    if (!node || !selector || node.redacted || hasSecret(node.value)) continue;
    const field = `page.locator(${str(selector)})`;
    const kind = kindOf(node, node.value);
    if (kind === 'check') {
      lines.push(
        `  await expect(${field}).${node.value === true ? 'toBeChecked' : 'not.toBeChecked'}();`,
      );
    } else if (
      kind === 'fill' &&
      (typeof node.value === 'string' || typeof node.value === 'number')
    ) {
      lines.push(`  await expect(${field}).toHaveValue(${str(String(node.value))});`);
    }
  }
  const status = form.root.status;
  if (formLocator && form.kind !== 'signal' && (status === 'VALID' || status === 'INVALID')) {
    lines.push(`  await expect(${formLocator}).toHaveClass(/ng-${status.toLowerCase()}/);`);
  }
  return lines;
}

/**
 * A Playwright test that replays a form's recorded history (values typed, submits and resets,
 * by a person, an agent or the panel) and checks the values and status the form ended with.
 */
export function playwrightTestText(state: FormsState, args: FieldArgs & { url?: string }): string {
  const form = pickForm(state, args);
  if (typeof form === 'string') return form;
  const steps = historySteps(form, state.events);
  if (!steps.some((step) => step.kind === 'value')) {
    return `No changes from a person, an agent or the panel are recorded for ${code(form.label)}. Fill in the form in the app, then export again.`;
  }
  const first = steps.find(
    (step): step is Extract<Step, { kind: 'value' }> =>
      step.kind === 'value' && fieldSelector(form, step.node) !== null,
  );
  const firstSelector = first && fieldSelector(form, first.node);
  const formLocator = firstSelector ? `page.locator(${str(`form:has(${firstSelector})`)})` : null;
  const body = [
    ...steps.flatMap((step) => stepLines(form, step, formLocator)),
    '',
    ...assertionLines(form, steps, formLocator),
  ];
  const label = form.label.replace(/\s+/g, ' ').slice(0, 120);
  const text = [
    `// ${label} (${form.kind}): replays ${steps.length} recorded step(s) from Pangular Inspector.`,
    '// Selectors come from the form bindings; check the TODO lines before you run it.',
    "import { test, expect } from '@playwright/test';",
    '',
    `test(${str(`${label} replays its recorded history`)}, async ({ page }) => {`,
    `  await page.goto(${str(args.url ?? '/')});`,
    ...body,
    '});',
  ].join('\n');
  const capped = capText(text, 'export a form with a shorter history', FORM_TOOL_MAX_CHARS - 200);
  return `${UNTRUSTED}\n\n\`\`\`ts\n${capped}\n\`\`\``;
}
