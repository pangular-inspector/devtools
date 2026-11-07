import { Component, input, model, output } from '@angular/core';
import { KIND_LABELS, type CollectedForm } from './forms-types';

/** The list of forms on the shown pages, with the "All pages" toggle. */
@Component({
  selector: 'app-forms-list',
  template: `
    <div class="sidebar">
      <h2 class="list-heading" id="forms-list-heading">
        Forms <span class="list-count">{{ forms().length }}</span>
      </h2>
      @if (showToggle()) {
        <label class="page-toggle">
          <input
            type="checkbox"
            [checked]="allPages()"
            (change)="allPages.set($any($event.target).checked)"
          />
          All pages
        </label>
      }
      <ul class="form-list" aria-labelledby="forms-list-heading">
        @for (form of forms(); track form.id) {
          <li>
            <button
              type="button"
              class="form-item"
              [class.active]="form.id === selectedId()"
              [attr.aria-current]="form.id === selectedId() ? 'true' : null"
              (click)="selectForm.emit(form.id)"
            >
              <span class="dot" [attr.data-status]="form.root.status" aria-hidden="true"></span>
              <span class="label" [attr.title]="form.label">{{ form.label }}</span>
              <span class="kind"
                >{{ kindLabel(form.kind) }} · <span class="id">{{ form.id }}</span>
                <span class="sr-only">, {{ form.root.status }}</span></span
              >
              @if (counts().get(form.id)?.errors; as count) {
                <span class="count"
                  >{{ count
                  }}<span class="sr-only"> {{ count === 1 ? 'error' : 'errors' }}</span></span
                >
              }
            </button>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .sidebar {
      min-width: 0;
      padding: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      animation: enter 0.35s var(--ease) both;
    }
    .list-heading {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 4px 8px 8px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .list-count {
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      letter-spacing: 0;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    .form-list {
      display: grid;
      gap: 2px;
      align-content: start;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .form-list > li {
      /* A page with many forms skips layout and paint for the entries out of view. */
      content-visibility: auto;
      contain-intrinsic-size: auto 52px;
    }
    .form-item {
      width: 100%;
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr) auto;
      grid-template-areas: 'dot label count' '. kind kind';
      gap: 2px 10px;
      align-items: center;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        color 150ms var(--ease),
        box-shadow 150ms var(--ease);
    }
    .form-item:hover {
      background: var(--surface-2);
    }
    .form-item:active {
      background: var(--surface-3);
    }
    .form-item.active {
      background: var(--accent-soft);
      box-shadow: inset 2px 0 0 var(--accent);
      color: var(--text-strong);
    }
    .form-item:focus-visible {
      /* Inside the entry: its paint containment would clip a ring drawn outside. */
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .form-item .dot {
      grid-area: dot;
    }
    .form-item .label {
      grid-area: label;
      min-width: 0;
      overflow: hidden;
      font-size: 13px;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .form-item .kind {
      grid-area: kind;
      min-width: 0;
      overflow: hidden;
      color: var(--text-3);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .form-item .id {
      font-family: var(--font-mono);
      font-size: 11.5px;
    }
    .form-item.active .kind {
      color: var(--text-2);
    }
    .form-item .count {
      grid-area: count;
      min-width: 20px;
      padding: 0 7px;
      border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
      border-radius: 99px;
      background: color-mix(in srgb, var(--danger) 12%, var(--surface));
      color: var(--danger-text);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 15%, transparent);
    }
    .dot[data-status='INVALID'] {
      background: var(--danger);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 15%, transparent);
    }
    .dot[data-status='PENDING'] {
      background: var(--warn);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 15%, transparent);
    }
    .dot[data-status='DISABLED'] {
      background: var(--text-3);
      box-shadow: none;
    }
    .page-toggle {
      display: flex;
      gap: 8px;
      align-items: center;
      min-height: 32px;
      margin: 0 8px 8px;
      color: var(--text-2);
      font-size: 13px;
      cursor: pointer;
    }
    .page-toggle input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--accent);
    }
    .page-toggle input:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @media (max-width: 720px) {
      .form-list {
        max-height: 240px;
        overflow-y: auto;
      }
    }
  `,
})
export class FormsList {
  readonly forms = input.required<CollectedForm[]>();
  readonly selectedId = input<string | null | undefined>(null);
  readonly counts = input.required<Map<string, { fields: number; errors: number }>>();
  /** Offer the "All pages" checkbox (the panel runs in one tab and other tabs report forms). */
  readonly showToggle = input(false);
  readonly allPages = model(false);
  readonly selectForm = output<string>();

  kindLabel(kind: CollectedForm['kind']) {
    return KIND_LABELS[kind];
  }
}
