---
title: Forms
description: Every form on the page with each field's state and errors, a change timeline, submit explanations and a lint.
---

<ngmd-hero title="Forms" gradient>
  Every Signal Form, reactive form and template-driven form on the page. Each field's value, state and errors, where each error comes from, a change timeline, submit explanations and a lint.
</ngmd-hero>

# Forms

The Forms tab reads the forms of the running page, in development builds only. It covers Signal Forms, reactive forms and template-driven forms. Actions you run from the tab go back to the page and run there.

## What it shows

### Forms list

The sidebar lists each form with its label, its kind (**Signal Forms**, **Reactive** or **Template-driven**) and its error count. When the panel runs inside a page and other tabs report forms, check **All pages** to include them.

Select a form to see its status, whether it is dirty or touched, whether it was submitted or is submitting, and an **Error summary**.

### Fields view

Each field shows its value, status, touched and dirty state, and errors. Extra facts depend on the kind:

- **Signal Forms**: constraints (`min`, `max`, `minLength`, `maxLength`, `pattern`), `required`, `readonly` and `hidden`, a pending `debounce`, and disabled reasons.
- **Reactive and template-driven**: whether validators and async validators are attached, the value `reset()` goes back to, `updateOn`, and the bound `ControlValueAccessor`.

Filter by path, or with the **Invalid**, **Dirty**, **Touched**, **Disabled** and **Error not shown** chips. Hover a field to highlight its input in the page.

### Error sources

Each error says where it comes from:

| Label              | Meaning                                                  |
| ------------------ | -------------------------------------------------------- |
| validator          | A validator on the control.                              |
| template attribute | A template attribute, such as `required` or `minlength`. |
| cross-field rule   | A rule on an ancestor, with the ancestor's path.         |
| async              | An async validator.                                      |
| parse              | The input could not parse the typed text.                |
| schema             | A Standard Schema, with the path it reported.            |
| server             | A server or submission error.                            |
| setErrors          | Code set the error with `setErrors()`.                   |

### Field details

Click a field to open its details. From there, set a value, or click **Focus**, **Touch**, **Revalidate** or **Store as global**. **Store as global** stores the form as `$form`, and the field as `$control`, in the page console.

### Timeline view

Recent changes, newest first, each tagged with its origin: user, code or devtools. Filter the list by origin. The timeline tracks array items by identity, so moves show as moves. Async validation times show as **pending** tags.

Check **Record details** to add the calling code of each change, validator changes, and component renders per keystroke. It is off by default and applies to the whole page.

### Submit view

What submit does, and why it might do nothing. It also shows what the form sends. **Copy test fixture** copies a fixture for your tests.

### Lint view

Form bugs and model-aware accessibility checks, each with a fix. For generic accessibility checks, run axe on the page.

### Actions bar

The actions bar works on the selected form:

- **Touch all**, **Revalidate** and **Focus first invalid**.
- **Pick field on page**: click a field in the app to select it. Esc cancels.
- **Snapshot** saves the form's values as `s1`, `s2` and so on. **Restore** puts back the latest one. The button shows its name, like **Restore s2**.
- **Reset** and **Submit**.

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay finds the forms through Angular's debug API and pushes their state.
  </ngmd-card>
  <ngmd-card icon="file" title="Source scan">
    The server adds the file and line of each form and its rules.
  </ngmd-card>
</ngmd-card-grid>

### When the page reports

The overlay reads the forms after change detection and pushes them when they change. It also pushes shortly after each `input`, `change`, `focusout`, `submit` or `reset` event. Reactive and template-driven forms also report each change through `control.events`.

### Validators run only when needed

To tell where each error comes from, the devtools run the sync validators of reactive and template-driven fields themselves. They do this only for enabled leaf fields. They reuse the result for up to 5 seconds while the value and the validators stay the same. With **Record details** on, they run on every report.

The devtools never run async validators. The probe emits no form events, so it does not show up in the timeline.

<ngmd-callout type="warning" title="Validators with side effects">
  The devtools call your sync validators. A validator that logs, counts or changes state sees extra calls while the Forms tab is open.
</ngmd-callout>

## How to use it

### Find why a form is invalid

<ngmd-workflow>
  <ngmd-step title="Select the form">
    The error count in the sidebar shows which forms fail.
  </ngmd-step>
  <ngmd-step title="Filter to Invalid">
    Click the <strong>Invalid</strong> chip.
  </ngmd-step>
  <ngmd-step title="Read the source">
    Each error says which validator, attribute or rule set it.
  </ngmd-step>
  <ngmd-step title="Check what the user sees">
    Click <strong>Error not shown</strong> to find errors that have no visible message.
  </ngmd-step>
</ngmd-workflow>

### Find why submit does nothing

<ngmd-workflow>
  <ngmd-step title="Open Submit">
    It explains what submit does.
  </ngmd-step>
  <ngmd-step title="Read the payload">
    Compare the value with what your API expects.
  </ngmd-step>
  <ngmd-step title="Copy a fixture">
    Click <strong>Copy test fixture</strong> to reproduce it in a test.
  </ngmd-step>
</ngmd-workflow>

### Test a form by hand

<ngmd-workflow>
  <ngmd-step title="Snapshot">
    Save the current values.
  </ngmd-step>
  <ngmd-step title="Change things">
    Type in the app, or set values from the field details.
  </ngmd-step>
  <ngmd-step title="Restore">
    Click <strong>Restore s1</strong>, then click again to confirm.
  </ngmd-step>
</ngmd-workflow>

You can also open a form from its component in the [Components tab](./components.md).

## Agent tools

`form` is a form id like `Checkout.form@ab12`, or part of its label. `path` is a dotted field path, like `address.city`.

### Read tools

| Tool                                 | What it does                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `ng-devtools:explain-form-invalid`   | Start here. Every invalid or pending form, with each failing field's value, validator, message and touched state. |
| `ng-devtools:inspect-forms`          | The forms with status and error counts. With `form`, the field tree. Narrow with `path` or `onlyInvalid`.         |
| `ng-devtools:explain-field`          | One field: error sources, skip reasons, pending values, binding, visible errors, and source lines.                |
| `ng-devtools:explain-submit`         | What submit does, and why it might do nothing.                                                                    |
| `ng-devtools:form-payload`           | What the form sends: value against raw value, and unvalidated fields.                                             |
| `ng-devtools:form-history`           | The change timeline with origins. Returns a marker.                                                               |
| `ng-devtools:form-diff`              | The net change since a marker.                                                                                    |
| `ng-devtools:lint-forms`             | Form bugs and accessibility checks.                                                                               |
| `ng-devtools:explain-custom-control` | How a field binds to its element, and what is wrong with the binding.                                             |
| `ng-devtools:export-form`            | A JSON snapshot or a test fixture.                                                                                |
| `ng-devtools:wait-for-form`          | Waits until the form is settled, valid, not pending or submitted.                                                 |

### Write tools

| Tool                      | What it does                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `ng-devtools:form-action` | Set, touch, revalidate, reset, submit, focus, snapshot, restore and more.          |
| `ng-devtools:fill-form`   | Fills several fields through the inputs, like a user would. Can submit afterwards. |

Agents can loop: inspect, act, `wait-for-form`, then `form-diff` from the marker they had. The `ng-devtools:forms` resource holds every form and recent changes. See [Tools](../agents/tools.md).

## Limits and gotchas

<ngmd-callout type="danger" title="Form values leave the page">
  The devtools send values to the devtools server, show them in the tab and return them to agents. They replace password fields and fields with secret-looking names with <code>[redacted]</code>. To mask or unmask a field, see <a href="../security.md">Security</a>.
</ngmd-callout>

### Reset, submit and restore ask first

In the tab, the button turns into **Confirm reset**, **Confirm submit** or **Confirm restore**. Click again to run it. Agents pass `confirm: true` for the same actions, and for `fill-form` with `submit`.

### Fields that are not written

The actions don't write secret fields unless you unmask them. See [Access and redaction](../security.md#opt-fields-in-or-out). For Signal Forms, they skip hidden, readonly and rule-disabled fields too. They write disabled reactive fields only with `force`.

### Snapshot limits

The page keeps up to 20 snapshots, and a reload clears them. Restore fails when the form's shape has changed, and it keeps the current value of secret fields.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why does the tab say no forms on this page?">
    The current tab has no form yet. Click <strong>Show forms from all pages</strong> to see forms from other tabs.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why are there no callers in the timeline?">
    The timeline records callers only with <strong>Record details</strong> checked.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does the tab change my form when I only look at it?">
    No. It reads state and runs sync validators without emitting events. Only the actions write.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Open">
    Open a form from the component that owns it.
  </ngmd-card>
  <ngmd-card icon="shield" title="Security" link="/security" cta="Read">
    What is redacted, and how to mask a field.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
  <ngmd-card icon="compass" title="Browser overlay" link="/getting-started/overlay" cta="Set up">
    The script that reports the live page.
  </ngmd-card>
</ngmd-card-grid>
