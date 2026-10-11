import { describe, expect, it } from 'vitest';
import type { CollectedForm, FormFieldNode } from '../forms.ts';
import {
  explainFormsText,
  FORMS_PAGE_TTL_MS,
  inspectFormsText,
  mergePageReport,
} from '../rpc/forms-tools.ts';
import { explainSubmitText } from '../rpc/forms-explain.ts';
import { createPageVisibility } from '../rpc/page-ttl.ts';

const STALE = 'The page may have closed';

function form(pageId: string): CollectedForm {
  const root: FormFieldNode = {
    key: '',
    path: '',
    type: 'group',
    status: 'INVALID',
    touched: false,
    dirty: false,
    bound: false,
    errors: [],
    children: [
      {
        key: 'email',
        path: 'email',
        type: 'control',
        status: 'INVALID',
        touched: true,
        dirty: true,
        bound: true,
        value: '',
        errors: [{ kind: 'required', message: 'required', source: 'own' }],
      },
    ],
  };
  return { id: `form-1@${pageId}`, kind: 'reactive', owner: 'Signup', label: 'Signup.form', root };
}

describe('forms staleness note with a background tab', () => {
  // A hidden tab stops reporting and never expires while it says it is hidden,
  // so its old `reportedAt` must not make answers about the live tab look stale.
  const visibility = createPageVisibility();
  const pages = new Map();
  const ttl = visibility.ttl(FORMS_PAGE_TTL_MS);
  visibility.set('bg', true, 0);
  mergePageReport(pages, { pageId: 'bg', forms: [form('bg')], events: [] }, 0, 200, ttl);
  const now = 120_000;
  const state = mergePageReport(
    pages,
    { pageId: 'live', forms: [form('live')], events: [] },
    now,
    200,
    ttl,
  );

  it('keeps the background tab', () => {
    expect(state.forms.map((f) => f.id)).toContain('form-1@bg');
  });

  it('does not call the live page stale', () => {
    expect(inspectFormsText(state, { page: 'live' }, now)).not.toContain(STALE);
    expect(inspectFormsText(state, { form: 'form-1@live' }, now)).not.toContain(STALE);
    expect(explainFormsText(state, { page: 'live' }, now)).not.toContain(STALE);
    expect(explainSubmitText(state, { form: 'form-1@live' }, now)).not.toContain(STALE);
  });

  it('still calls the background page stale', () => {
    expect(inspectFormsText(state, { page: 'bg' }, now)).toContain(STALE);
    expect(explainFormsText(state, { page: 'bg' }, now)).toContain(STALE);
  });
  it('reads the report time of a page id that contains @', () => {
    const atPages = new Map();
    mergePageReport(atPages, { pageId: 'old', forms: [form('old')], events: [] }, 0, 200, ttl);
    const fresh = mergePageReport(
      atPages,
      { pageId: 'a@old', forms: [form('a@old')], events: [] },
      now,
      200,
      ttl,
    );
    expect(inspectFormsText(fresh, { form: 'form-1@a@old' }, now)).not.toContain(STALE);
  });
});
