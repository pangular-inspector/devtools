import { Component, computed, input } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FORMS_STYLES, type CollectedForm, type FormFieldNode } from './forms-types';

interface SchemaRow {
  node: FormFieldNode;
  depth: number;
  rules: string[];
  constraints: string[];
  states: string[];
}

const RULE_LABELS: [keyof NonNullable<FormFieldNode['rules']>, string, string][] = [
  ['sync', 'validator', 'validators'],
  ['tree', 'cross-field rule', 'cross-field rules'],
  ['async', 'async validator', 'async validators'],
  ['hidden', 'hidden rule', 'hidden rules'],
  ['disabled', 'disabled rule', 'disabled rules'],
  ['readonly', 'readonly rule', 'readonly rules'],
  ['metadata', 'metadata entry', 'metadata entries'],
];

/** What the schema of a field adds: rule counts by kind, `required` included. */
export function ruleList(node: FormFieldNode): string[] {
  const out: string[] = node.required ? ['required'] : [];
  for (const [key, one, many] of RULE_LABELS) {
    const count = node.rules?.[key];
    if (count) out.push(`${count} ${count === 1 ? one : many}`);
  }
  return out;
}

function stateList(node: FormFieldNode): string[] {
  const out: string[] = [];
  if (node.hidden) out.push(node.hiddenBy === 'parent' ? 'hidden by a parent' : 'hidden');
  if (node.readonly) out.push(node.readonlyBy === 'parent' ? 'readonly by a parent' : 'readonly');
  for (const reason of node.disabledReasons ?? []) out.push(`disabled: ${reason}`);
  if (node.debouncing) out.push('debouncing');
  return out;
}

/** The Schema tab of a Signal Form: the rules its schema function sets on each field. */
@Component({
  selector: 'app-forms-schema',
  imports: [JsonPipe],
  template: `
    <p class="intro">
      The rules the schema function of <code>form()</code> sets on each field, read from Angular's
      logic tree, with the constraints and states they produce right now. Fields without rules are
      left out.
    </p>
    @if (rows().length) {
      <div class="table-scroll" role="region" aria-label="Schema rules" tabindex="0">
        <table class="schema">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Rules</th>
              <th scope="col">Constraints</th>
              <th scope="col">State now</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.node.path) {
              <tr>
                <th scope="row" [style.padding-left.px]="12 + row.depth * 16">
                  <code>{{ row.node.key || '(form)' }}</code>
                  <span class="type">{{ row.node.type }}</span>
                </th>
                <td>
                  @for (rule of row.rules; track rule) {
                    <span class="chip">{{ rule }}</span>
                  }
                </td>
                <td>
                  @for (constraint of row.constraints; track constraint) {
                    <span class="chip">{{ constraint }}</span>
                  }
                  @for (value of row.node.metadata ?? []; track $index) {
                    <span class="chip">metadata {{ value | json }}</span>
                  }
                </td>
                <td>
                  @for (state of row.states; track state) {
                    <span class="chip">{{ state }}</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="empty">
        No field of this form has a schema rule. Pass a schema function as the second argument of
        <code>form()</code> to add validators and rules.
      </p>
    }
  `,
  styles: `
    ${FORMS_STYLES}
    :host {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .intro,
    .empty {
      margin: 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.5;
    }
    .table-scroll {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .table-scroll:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .schema {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .schema th,
    .schema td {
      padding: 6px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    .schema tbody tr:last-child > * {
      border-bottom: 0;
    }
    .schema thead th {
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 12px;
      font-weight: 600;
    }
    .schema tbody th {
      color: var(--text);
      font-weight: 500;
      white-space: nowrap;
    }
    .type {
      margin-left: 6px;
      color: var(--text-2);
      font-size: 11px;
    }
    .chip {
      display: inline-block;
      margin: 2px 4px 2px 0;
      padding: 0 8px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text);
      font-size: 12px;
      line-height: 20px;
      overflow-wrap: anywhere;
    }
  `,
})
export class FormsSchema {
  readonly form = input.required<CollectedForm>();

  readonly rows = computed(() => {
    const rows: SchemaRow[] = [];
    const visit = (node: FormFieldNode, depth: number): boolean => {
      const at = rows.length;
      const row: SchemaRow = {
        node,
        depth,
        rules: ruleList(node),
        constraints: Object.entries(node.constraints ?? {}).map(([k, v]) => `${k} ${v}`),
        states: stateList(node),
      };
      let keep =
        row.rules.length > 0 ||
        row.constraints.length > 0 ||
        row.states.length > 0 ||
        !!node.metadata?.length;
      for (const child of node.children ?? []) keep = visit(child, depth + 1) || keep;
      if (keep) rows.splice(at, 0, row);
      return keep;
    };
    visit(this.form().root, 0);
    return rows;
  });
}
