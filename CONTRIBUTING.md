# Contributing to Angular DevTools

Thanks for your interest in contributing. This guide covers the rules a change follows and how to get it merged. For setup, the project structure, the commands and what CI runs, see [Development setup](./apps/docs/src/content/contributing/development.md) on the docs site.

By taking part you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md). Report security issues privately, as [SECURITY.md](./SECURITY.md) describes.

## Guidelines

| Guide                                                                       | What it covers                                                    |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Commit message guidelines](docs/contributing/commit-message-guidelines.md) | `type(scope): summary`, types, scopes, body and footer            |
| [Coding standards](docs/contributing/coding-standards.md)                   | TypeScript and Angular rules, how collectors read the page, tests |
| [UI guidelines](docs/contributing/ui-guidelines.md)                         | Theme tokens, the brand palette, page anatomy, accessibility      |
| [Writing guide](apps/docs/src/content/contributing/writing-docs.md)         | Voice, style and structure for the docs site and the README       |
| [`AGENTS.md`](AGENTS.md)                                                    | Angular best practices for people and AI agents                   |

## Set up the git hooks

`pnpm install` turns on the git hooks in `.githooks/` and sets [`.gitmessage`](.gitmessage) as your commit template, unless you already set `core.hooksPath` or `commit.template` yourself:

- `pre-commit` formats the staged files with Prettier. It skips a file that also has unstaged changes, so hunks you left out with `git add -p` stay out.
- `commit-msg` checks your message against the [commit message guidelines](docs/contributing/commit-message-guidelines.md) and warns when it doesn't follow them. It never blocks the commit.

## Make changes

- **A new inspector or a data fix:** follow [Reading data from the page](docs/contributing/coding-standards.md#reading-data-from-the-page-packagesng-devtools). Collection goes in its own module, reports carry a `pageId`, and the server expires and forgets pages.
- **A new tab, RPC function or agent tool:** follow the steps in [Development setup](./apps/docs/src/content/contributing/development.md). Describe what an agent tool returns and when it is empty, and add tests.
- **UI changes:** follow the [UI guidelines](docs/contributing/ui-guidelines.md). Use the theme variables, the SCSS mixins and the shared dropdown.
- **Docs changes:** follow the [writing guide](./apps/docs/src/content/contributing/writing-docs.md). Run the docs site with `pnpm docs:dev`.
- **Keep the docs in step with the code:** when a pull request changes behaviour, an option, a UI label or an agent tool, update the matching page in `apps/docs` in the same pull request. If no docs change is needed, add the `no-docs` label and say why in the description. The Docs check workflow warns when code changes without docs.

## Labels

The labels follow the Angular repository.

| Label                                                                             | Use                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bug`, `feature`, `breaking changes`                                              | What kind of change it is. Issue forms add `bug` or `feature` with `needs triage`.                                                                                       |
| `P0` to `P3`                                                                      | Priority, from broken for most users (`P0`) to not urgent (`P3`).                                                                                                        |
| `area: *`                                                                         | The part of the repository: panel, package, agents, extension, demo, docs, security, performance, accessibility, ci. Pull requests get these from the paths they change. |
| `needs triage`, `needs reproduction`, `needs: clarification`, `needs: discussion` | What an issue is waiting for.                                                                                                                                            |
| `state: confirmed`, `state: has PR`, `state: blocked`, `state: WIP`               | Where an issue stands.                                                                                                                                                   |
| `action: review`, `action: cleanup`, `action: merge`, `action: discuss`           | What a pull request needs next.                                                                                                                                          |
| `target: patch`, `target: minor`, `target: major`                                 | Which release a pull request goes into.                                                                                                                                  |
| `merge: preserve commits`, `merge: caretaker note`, `merge: fix commit message`   | Pull requests are squash merged. These mark the exceptions: keep each commit, read the note in the description first, or fix the commit message when merging.            |
| `good first issue`, `help wanted`                                                 | Issues open to new contributors.                                                                                                                                         |
| `no-docs`, `release: skip`                                                        | No docs change needed; leave out of the release notes.                                                                                                                   |

## Run the checks

Run the checks from [Development setup](./apps/docs/src/content/contributing/development.md), plus these:

```sh
pnpm commit:check                             # commit messages on your branch
pnpm skills:check                             # agent skills and roles
pnpm exec ngc -p app/tsconfig.json --noEmit   # panel template check
```

For UI changes, also check the pages in a browser with axe, in dark and light themes and at a narrow width. The [devtools-verify skill](.claude/skills/devtools-verify/SKILL.md) lists the exact steps.

## Submit a pull request

1. Search the open issues and pull requests first. For a bigger feature, open an issue to discuss it before you start.
2. Fork the repository and create a branch from `main`.
3. Keep one feature per pull request, with its tests (and agent tool tests when tools change).
4. If you changed `app/`, run `pnpm extension:build` and commit `extension/ui`. CI fails when it is stale.
5. Make sure all the checks above pass.
6. Open the pull request against `main` and fill in the template. **The title must follow the [commit message format](docs/contributing/commit-message-guidelines.md)**, for example `feat(router): show guard results for lazy routes`. It becomes the commit on `main` when the pull request is squash merged. CI checks the title and every commit message, and for now reports problems as warnings.
7. Address review feedback with [fixup commits](docs/contributing/using-fixup-commits.md). Don't force-push over a review in progress unless asked.

## Work with AI agents

The repository ships skills and roles for AI coding agents, so changes made with an agent follow the same rules as everyone else's. Claude Code picks them up automatically from `.claude/`. Other agents can read the same files.

### Skills (`.claude/skills/`)

| Skill                                                              | Use it when                                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`devtools-ui`](.claude/skills/devtools-ui/SKILL.md)               | Building or restyling anything in the panel                                |
| [`devtools-inspector`](.claude/skills/devtools-inspector/SKILL.md) | Adding an inspector or fixing the data it shows, including agent tools     |
| [`devtools-docs`](.claude/skills/devtools-docs/SKILL.md)           | Writing or reviewing the docs site and the README                          |
| [`devtools-verify`](.claude/skills/devtools-verify/SKILL.md)       | Checking a change like CI and a reviewer would, including axe in a browser |
| [`devtools-commit`](.claude/skills/devtools-commit/SKILL.md)       | Writing commits, pull request titles and descriptions                      |

### Roles (`.claude/agents/`)

| Role                                                         | Does                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| [`ui-engineer`](.claude/agents/ui-engineer.md)               | Builds and restyles panel pages to the design system    |
| [`inspector-engineer`](.claude/agents/inspector-engineer.md) | Owns data collection, the server side and agent tools   |
| [`a11y-reviewer`](.claude/agents/a11y-reviewer.md)           | Audits accessibility and visual consistency (read only) |
| [`devtools-reviewer`](.claude/agents/devtools-reviewer.md)   | Reviews a diff against these guidelines (read only)     |

When you add a new area or change a rule, update the matching guide, skill and role in the same pull request so they don't drift apart. `pnpm skills:check` (also run in CI) validates their frontmatter and checks that the files and links they mention exist.
