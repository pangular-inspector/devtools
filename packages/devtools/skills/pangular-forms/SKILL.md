---
name: pangular-forms
description: Find out why an Angular form (Signal Forms, reactive or template-driven) is invalid, won't submit or sends the wrong payload, using the Pangular Inspector forms tools, then fix it and prove the fix with a form diff.
---

# Debug Angular forms with Pangular Inspector

The forms tools read Signal Forms, reactive forms and template-driven forms on the live page. Two arguments come up everywhere: `form`, a form id such as `Checkout.form@ab12` or part of its label, and `path`, a dotted field path such as `address.city` or `items.0.qty`.

## Find the form

1. `pangular_inspect-forms` without arguments lists each form with its status and error count.
2. Copy the form id. The part after `@` is the page, so form tools need no `page` argument.

## Answer the question

| Question                                             | Tool                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Why is the form invalid?                             | `explain-form-invalid` (call this first)                       |
| Why does this one field show, or not show, an error? | `explain-field` with `path` or a CSS `selector`                |
| Why does submit do nothing?                          | `explain-submit`                                               |
| What does the form send to the server?               | `form-payload` (`value` against `getRawValue()`)               |
| Is the custom control bound right?                   | `explain-custom-control`                                       |
| Setup errors (NG01xxx) and accessibility gaps?       | `lint-forms`                                                   |
| What changed, and who changed it?                    | `form-history` (origins: user, code, devtools, binding, agent) |

Large forms are cut to keep answers small. Each cut says what was left out; pass `path` to read one group at a time, or `onlyInvalid: true` to `inspect-forms`.

## Fix and verify

1. Call `form-history` for the form and keep the marker it returns.
2. Fix the code, or reproduce the user's steps with `fill-form` (types through the inputs like a user) or `form-action` (`set-value`, `touch-all`, `revalidate`, `submit`). `submit`, `reset`, `restore` and `fill-form` with `submit` need `confirm: true`; ask the user before you submit.
3. `wait-for-form` with `until: "settled"` (or `valid`, `submitted`) waits for async validators.
4. `form-diff` with `since` set to the marker lists every field whose value or status ended up different. That is your proof.
5. `export-form` with `format: "fixture"` turns the state into a test fixture with the expected status.

## Notes

- Secret-looking values stay masked, and action tools don't write secret fields unless the project unmasks them.
- A native `<select>` only takes the value of one of its options; the answer says `has no option with the value ...` otherwise.
- A Signal Form that sets `experimentalWebMcpTool` also shows its WebMCP tool state in `inspect-forms`.
