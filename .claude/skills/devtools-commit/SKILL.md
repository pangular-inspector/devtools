---
name: devtools-commit
description: Write commit messages and pull request titles and descriptions for this repository, following this project's commit format and scopes. Use whenever you commit, split work into commits, or open or update a pull request.
---

# Commits and pull requests

The rules are in `docs/contributing/commit-message-guidelines.md`. Summary:

```
<type>(<scope>): <short summary>

<body: why the change is needed, old vs new behavior, imperative tense, 20+ characters; required for feat, fix, perf, refactor>

<footer: Fixes #123 | BREAKING CHANGE: ... | DEPRECATED: ...>
```

- Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `style`, `build`, `ci`, `chore`, `revert`.
- Scopes: `hub`, `ui`, `popup`, `overlay`, `components`, `signals`, `injectors`, `router`, `forms`, `store`, `pipes`, `http`, `analog`, `mcp`, `extension`, `vite`, `demo`, `docs` (the docs site in `apps/docs`), `release`, `deps`. Leave the scope out for cross-cutting changes.
- Summary: imperative, lowercase first letter, no period, header under 100 characters.

## Pull requests

- Pull requests are squash merged; the title becomes the commit on `main`, so it must follow the header format.
- A `commit-msg` hook (`scripts/commit-message.mjs`, enabled by `pnpm install`) warns about a bad message as you commit; CI checks the title and every commit in the pull request and, for now, reports problems as warnings. Run `pnpm commit:check` before pushing, and fix flagged messages with `git commit --amend` or a reword rebase.
- Address review feedback with fixup commits (`docs/contributing/using-fixup-commits.md`).
- One feature per pull request, with its tests (including agent tool tests when tools change).
- Rebuild and commit `extension/ui` when `app/` changed.
- Fill in `.github/PULL_REQUEST_TEMPLATE.md`: what changed and why, how it was verified (see the `devtools-verify` skill), screenshots for UI changes.
- Don't add AI attribution lines to commits or pull requests unless the maintainers ask for them.

## Splitting work

Group commits by area (the scope), keep each one building and passing tests where practical, and put generated output (`extension/ui`, lockfile) in the commit that needs it.
