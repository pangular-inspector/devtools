import type { DevframeRpcClient } from 'devframe/client';
import { rpcTry } from '../rpc';

export type FieldStatus = 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED';

export interface FormFieldError {
  kind: string;
  message: string;
  params?: Record<string, unknown>;
  source?: string;
  from?: string;
}

export interface FormFieldNode {
  key: string;
  path: string;
  type: 'group' | 'array' | 'control';
  status: FieldStatus;
  touched: boolean;
  dirty: boolean;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  disabledReasons?: string[];
  updateOn?: 'blur' | 'submit';
  materialized?: false;
  bound: boolean;
  constraints?: Record<string, number | string>;
  submitting?: boolean;
  debouncing?: boolean;
  validators?: { sync: boolean; async: boolean };
  defaultValue?: unknown;
  accessor?: string;
  value?: unknown;
  errors: FormFieldError[];
  children?: FormFieldNode[];
  truncated?: number;
  skipped?: string;
  stale?: string[];
  uncommitted?: unknown;
  changed?: boolean;
  redacted?: string;
  pendingSince?: number;
  name?: string;
  metadata?: unknown[];
  dom?: { errorShown?: boolean; drift?: string | true; labelled?: boolean };
}

export interface CollectedForm {
  id: string;
  kind: 'signal' | 'reactive' | 'template';
  owner: string;
  property?: string;
  label: string;
  submitted?: boolean;
  submit?: { hasAction: boolean; willRun: boolean; submitting: boolean };
  submitDom?: { reasons: string[] };
  errorSummary?: { path: string; kind: string; message: string }[];
  root: FormFieldNode;
}

export function pageOf(formId: string): string {
  return formId.split('@')[1] ?? '';
}

export interface FormEvent {
  formId: string;
  path: string;
  type: string;
  detail?: string;
  timestamp: number;
  seq?: number;
  origin?: string;
  prev?: string;
  count?: number;
  outcome?: string;
  caller?: string;
  ms?: number;
  renders?: number;
  rendered?: string[];
}

export interface FormLintFinding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  form: string;
  label: string;
  path?: string;
  message: string;
  fix: string;
}

export interface FormActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  skipped?: { path: string; reason: string }[];
  status?: string;
  snapshot?: string;
  expression?: string;
}

export const KIND_LABELS: Record<CollectedForm['kind'], string> = {
  signal: 'Signal Forms',
  reactive: 'Reactive',
  template: 'Template-driven',
};

export const SOURCE_LABELS: Record<string, string> = {
  own: 'validator',
  directive: 'template attribute',
  tree: 'cross-field rule',
  async: 'async',
  parse: 'parse',
  submission: 'server',
  schema: 'schema',
  manual: 'setErrors',
};

export const formsCall = rpcTry;

export async function formAction(
  client: DevframeRpcClient | null,
  request: Record<string, unknown>,
): Promise<FormActionResult> {
  const result = await formsCall<FormActionResult>(client, 'request-form-action', request);
  return result ?? { ok: false, error: 'The devtools server did not answer.' };
}

export function actionMessage(result: FormActionResult): string {
  const text = result.ok ? (result.message ?? 'Done.') : (result.error ?? 'Failed.');
  const skipped = result.skipped?.length
    ? ` Skipped: ${result.skipped.map((s) => `${s.path} (${s.reason})`).join(', ')}.`
    : '';
  return `${text}${skipped}${result.status ? ` Status: ${result.status}.` : ''}`;
}

export function plain(text: string | null): string {
  return (text ?? '')
    .replace(/^_Labels, paths.*_\n\n/, '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '');
}

export const FORMS_STYLES = `
  .muted {
    color: var(--text-2);
  }
  code {
    font-family: var(--font-mono);
    font-size: 12.5px;
  }
  .small {
    display: inline-block;
    max-width: 100%;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    line-height: 32px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition:
      background-color 150ms var(--ease),
      border-color 150ms var(--ease),
      color 150ms var(--ease),
      box-shadow 150ms var(--ease);
  }
  .small:hover {
    background: var(--surface-3);
    border-color: color-mix(in srgb, var(--text-3) 55%, var(--border-strong));
  }
  .small:active {
    background: var(--border-strong);
  }
  .small:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .small.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .small.primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .small.danger {
    border-color: color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger);
  }
  .small.danger:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border-color: color-mix(in srgb, var(--danger) 55%, transparent);
  }
  .small.armed {
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .small.danger.armed {
    background: var(--danger);
    border-color: var(--danger);
    color: #1f0707;
    font-weight: 600;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
  }
  .field-input {
    min-width: 0;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 13px;
    transition:
      border-color 150ms var(--ease),
      box-shadow 150ms var(--ease);
  }
  .field-input::placeholder {
    color: var(--text-3);
    font-family: var(--font-sans);
  }
  .field-input:hover {
    border-color: color-mix(in srgb, var(--text-3) 55%, var(--border-strong));
  }
  .field-input:focus,
  .field-input:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .explain {
    margin: 0;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    tab-size: 2;
  }
  .explain[aria-busy='true'] {
    color: var(--text-3);
  }
  .section-label {
    margin: 0;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tag {
    display: inline-block;
    margin: 0;
    padding: 1px 8px;
    border: 1px solid var(--border);
    border-radius: 99px;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 11px;
    font-weight: 500;
    line-height: 18px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .tag[data-tone='ok'] {
    border-color: color-mix(in srgb, var(--ok) 30%, transparent);
    background: color-mix(in srgb, var(--ok) 12%, transparent);
    color: var(--ok);
  }
  .tag[data-tone='warn'] {
    border-color: color-mix(in srgb, var(--warn) 30%, transparent);
    background: color-mix(in srgb, var(--warn) 12%, transparent);
    color: var(--warn);
  }
  .tag[data-tone='bad'] {
    border-color: color-mix(in srgb, var(--danger) 30%, transparent);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }
  .status {
    margin: 0;
    color: var(--text-2);
    font-size: 12.5px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .empty-state {
    display: grid;
    justify-items: center;
    gap: 6px;
    margin: 0;
    padding: 40px 24px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
  }
  .empty-state p {
    max-width: 52ch;
    margin: 0;
  }
  .empty-state .empty-title {
    color: var(--text-strong);
    font-size: 14px;
    font-weight: 600;
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
`;
