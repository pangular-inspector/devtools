Follow the Angular, TypeScript and accessibility rules in `.claude/rules/angular.md` (Claude Code loads it on its own).

## This repository

Angular DevTools inspects a running Angular app and serves what it finds to a panel and to AI agents over MCP. It is an Nx and pnpm workspace:

| Path                        | What it is                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ng-devtools`      | The published package: the page overlay and collectors, the devframe server (`src/devframe.ts`), the Express hub, the Vite plugin, the CLI and the agent tools |
| `app`                       | The panel UI, an Angular app served by the hub and bundled into the Chrome extension                                                                           |
| `extension`                 | The Chrome extension; `extension/ui` is a committed build of `app`                                                                                             |
| `apps/docs`                 | The documentation site                                                                                                                                         |
| `src` and `examples/analog` | The demo apps used for manual checks and docs samples                                                                                                          |

### Commands

| Command                | What it runs                                            |
| ---------------------- | ------------------------------------------------------- |
| `pnpm test:devtools`   | Package tests                                           |
| `pnpm test:panel`      | Panel tests                                             |
| `pnpm test:axe`        | Builds a static report and runs axe on every panel view |
| `pnpm typecheck`       | TypeScript and template checks for every project        |
| `pnpm format:check`    | Prettier, including the docs markdown                   |
| `pnpm skills:check`    | Checks the skills and roles in `.claude`                |
| `pnpm docs:build`      | Builds the docs site with its link guards               |
| `pnpm extension:build` | Rebuilds `extension/ui` from `app`                      |
| `pnpm commit:check`    | Checks the commit messages on the branch                |

The words this project uses for its own concepts (overlay, collector, hub, devframe, agent tool and so on) are defined in `docs/CONTEXT.md`. Use them the same way in code, docs and issues.

### Rules that fail quietly

- After any change in `app`, run `pnpm extension:build` and commit `extension/ui`. CI fails when the committed bundle is stale.
- Commit messages and pull request titles use `type(scope): summary` with the scopes in `docs/contributing/commit-message-guidelines.md`. Pull requests are squash merged.
- A new agent tool or RPC must be listed in `packages/ng-devtools/src/config.ts` (`AGENT_INSPECTOR`, `RPC_INSPECTOR`, and `ACTION_TOOLS` for anything that writes), or turning its inspector off won't hide it.
- Values sent to the panel or to agents go through `serialize` or the redaction helpers, so `redaction.secretNames`, JWTs and bearer tokens are masked everywhere.
- Data from the page carries a `pageId` and expires, so one tab never overwrites another.
- Docs links are relative `.md` links, which the build checks. `*Angular` style words are keyword links on purpose.
- Behaviour, option, label or tool changes update the matching docs page in the same pull request.

## Project guidelines, skills and roles

Follow the repository guides in `docs/contributing/`:

- `commit-message-guidelines.md`: `type(scope): summary` commits and pull request titles (types and this repo's scopes).
- `coding-standards.md`: TypeScript and Angular rules, and how collectors read the inspected page (debug APIs, stable `WeakMap` ids, no DOM writes, `pageId` with expiry, cheap pushes).
- `ui-guidelines.md`: theme tokens, brand palette, page anatomy and accessibility for the panel.

Use the matching skill for the task:

- `.claude/skills/devtools-ui` for panel UI work.
- `.claude/skills/devtools-inspector` for data collection, the server side and agent tools.
- `.claude/skills/devtools-docs` for the docs site (`apps/docs`) and `README.md`.
- `.claude/skills/devtools-verify` before calling a change done.
- `.claude/skills/devtools-commit` for commits and pull requests.
- `.claude/skills/devtools-fix-issue` to take one issue to a pull request.
- `.claude/skills/devtools-work-issues` to work through a batch of issues with parallel agents.
- `.claude/skills/grilling` to settle an open decision one question at a time before any work starts.

Roles for delegating work live in `.claude/agents/`: `ui-engineer`, `inspector-engineer`, `a11y-reviewer` and `devtools-reviewer`.

## Serving Locally

- **Demo app (SSR):** `pnpm build --configuration development && node dist/angular-devtools/server/server.mjs` → http://localhost:4000
- **Devtools SPA (hot reload):** `pnpm devtools:dev` → http://localhost:5173 (serves its own RPC, so source-scan data works; live tabs need an app page connected, so use the SSR server on 4000 for those)
- **Demo app (SPA, no SSR):** `pnpm start` → http://localhost:4200 (runs `ng serve` with SSR and hot reload; devtools popup + RPC work without a separate server)
- The devtools popup appears on the demo app page; click it to open the inspector panel
- Changes to `app/src/` (devtools SPA) are visible live via `pnpm devtools:dev`; the SSR server serves the SPA built into `packages/ng-devtools/dist/public` (or the npm-published copy when it has not been built), so run `pnpm devtools:build-pkg` to refresh it
- To publish: update the version in `packages/ng-devtools/package.json`, then run `pnpm devtools:publish` (the package build bundles the SPA)

## Documentation

- Use the `devtools-docs` skill (`.claude/skills/devtools-docs`) for any change in `apps/docs/src/content`, the docs home page or `README.md`.
- The human-readable version is `apps/docs/src/content/contributing/writing-docs.md`.
