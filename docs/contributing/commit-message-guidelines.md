# Commit message guidelines

Every commit follows one format, with scopes that match the areas of this repository. A consistent history makes the changelog easy to write and lets reviewers see what a change touches at a glance.

Every commit is checked twice:

- **Locally**, by a `commit-msg` git hook that `pnpm install` turns on (it sets `core.hooksPath` to `.githooks` and `commit.template` to [`.gitmessage`](../../.gitmessage)). It warns and lets the commit through; fix the message with `git commit --amend` before you push.
- **In CI**, on every pull request: each commit and the pull request title. Pull requests are squash merged, so **the title becomes the commit on `main`**. For now the CI check only warns: problems show up as annotations on the pull request, and the check stays green.

Run `pnpm commit:check` to check the commits on your branch before you push. To fix an older commit, reword it with `git rebase -i` and force-push your branch. While a review is in progress, prefer [fixup commits](./using-fixup-commits.md). `fixup!` and `squash!` commits and merge commits are skipped.

## Format

```
<type>(<scope>): <short summary>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The header is required. The body is required for `feat`, `fix`, `perf` and `refactor`, and optional for the other types. The footer is optional.

### Type

| Type       | Use it for                                                |
| ---------- | --------------------------------------------------------- |
| `feat`     | A new feature                                             |
| `fix`      | A bug fix                                                 |
| `perf`     | A change that improves performance                        |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `test`     | Adding missing tests or correcting existing ones          |
| `docs`     | Documentation only                                        |
| `style`    | Formatting only, no change in behavior                    |
| `build`    | Build system, packaging or dependencies                   |
| `ci`       | CI configuration and scripts                              |
| `chore`    | Releases and housekeeping that fit no other type          |
| `revert`   | Reverting an earlier commit                               |

### Scope

Use the area of the devtools the change is about. Leave the scope out when a change spans many areas.

| Scope        | Area                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| `hub`        | `@devframes/hub` integration, docks, `hub.ts`, `hub-docks.ts`                        |
| `ui`         | The panel shell, theme, shared UI (`app/src/app.ts`, `app/src/styles`, `app/src/ui`) |
| `popup`      | The in-page launcher and popup (`popup.ts`)                                          |
| `overlay`    | The page-side script and its collectors (`overlay.ts`)                               |
| `components` | Components inspector                                                                 |
| `signals`    | Signals inspector                                                                    |
| `injectors`  | Injectors (DI) inspector                                                             |
| `router`     | Router inspector                                                                     |
| `forms`      | Forms inspector                                                                      |
| `store`      | NgRx store inspector                                                                 |
| `pipes`      | Pipes inspector                                                                      |
| `http`       | SSR & HTTP inspector                                                                 |
| `analog`     | Analog support                                                                       |
| `mcp`        | Agent tools and MCP resources                                                        |
| `extension`  | The Chrome extension                                                                 |
| `vite`       | The Vite plugin                                                                      |
| `demo`       | The Angular Travel demo app (`src/`) and `examples/`                                 |
| `docs`       | The documentation site (`apps/docs`)                                                 |
| `release`    | Version bumps and publishing (with `chore`)                                          |
| `deps`       | Dependency updates (with `build`)                                                    |

### Summary

- Use the imperative, present tense: "add", not "added" or "adds".
- Don't capitalize the first letter, unless it starts a name (Analog, NgRx, SSR).
- No period at the end.
- Keep the whole header under 100 characters.

### Body

- Use the imperative, present tense.
- Explain why the change is needed. Compare the old behavior with the new one when that helps.
- At least 20 characters when the body is required.

### Footer

- Reference issues and pull requests: `Fixes #123`, `Closes #45`.
- Breaking changes start with `BREAKING CHANGE: ` followed by a summary, a blank line, and a description with migration steps.
- Deprecations start with `DEPRECATED: ` followed by the recommended replacement.

### Revert commits

Start the header with `revert: ` followed by the header of the reverted commit. The body must say `This reverts commit <SHA>` and why.

## Examples

```
feat(injectors): show which injector supplies each dependency

The Injectors page listed every DOM element and the same built-in
tokens on each row. Collect only elements that carry a component or
directive, and report what each one injected and where Angular found it.

Fixes #40
```

```
fix(router): pass match options to isActive when paths is set

The router inspector called isActive with the default options, so a
route with query parameters never showed as active.
```

```
chore(release): 0.0.7
```

```
docs: document the panel design tokens
```
