<!--
Title format (becomes the squash commit on main):
<type>(<scope>): <short summary>
See docs/contributing/commit-message-guidelines.md
-->

## What and why

<!-- What does this change, and why is it needed? Link the issue: Fixes #123 -->

## How it was verified

- [ ] `pnpm commit:check` (commit messages follow the guidelines)
- [ ] `pnpm format:check`
- [ ] `pnpm typecheck` (includes the `ngc` template checks)
- [ ] `pnpm test`, `pnpm test:devtools` and `pnpm test:panel`
- [ ] `pnpm skills:check` (when `.claude/` changed)
- [ ] Docs in `apps/docs` updated and `pnpm docs:build` passes (when behavior, options, UI labels or agent tools changed), or the `no-docs` label added with the reason below
- [ ] `pnpm extension:build` and `extension/ui` committed (when `app/` changed)
- [ ] Checked in the browser with axe (when the UI changed)

## Screenshots

<!-- For UI changes: before and after, dark theme, and a narrow width if layout changed. -->

## Notes for reviewers

<!-- Anything unusual: trade-offs, follow-ups, known limits. -->
