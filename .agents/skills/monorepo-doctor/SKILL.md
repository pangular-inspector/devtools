---
name: monorepo-doctor
description: Use when a user asks for a JS/TS monorepo audit, monorepo health check, Nx/Turborepo cache issues, affected tests not running, circular dependencies, package boundary drift, or test code shipped to production. Read-only; writes Markdown and JSON reports.
---

# Monorepo Doctor

Audit a JS/TS monorepo for five classes of problems that teams routinely miss, and produce an evidence-backed report.

Prerequisites: Node ≥ 22.5. The work dir is `$W` = `$(node -p 'require("os").tmpdir()')/monorepo-doctor` (see detection.md).

## Rules

- **Read-only.** Never install dependencies, build, run tests, or edit project files. Allowed writes: `monorepo-doctor-report.md`, `monorepo-doctor-report.json` (workspace root or a user-given dir) and `$W`.
- Allowed commands: the snippets in the reference files, `npx --yes knip@6.41.0`, `npm_config_ignore_scripts=true npx --yes publint@0.3.25` (exact pinned versions — never unpinned or `@latest`; bump only after review), `npm pack --dry-run --json --ignore-scripts`, and `npx nx` / `npx turbo` **only if** detection reports them `installed` (graph / `--dry=json` / `boundaries` only — never real task runs, with read-only env vars from the references).
- **Never abort a check.** If a tool fails, mark the check `partial` or `skipped` with a reason and continue.
- **Every finding needs evidence** (config snippet, file:line, or command output). No evidence → no finding.
- Use only the finding ids defined in the reference files.

## Workflow

1. **Detect** — follow [references/detection.md](references/detection.md). Stop if `NO_WORKSPACE`.
2. **Scan** — follow [references/scan.md](references/scan.md).
3. **Check** — run all five unless the user asked for a subset (write `{"status":"not-run","reason":"not requested","findings":[]}` to `$W/findings/<check>.json` for the others):
   - [references/boundaries.md](references/boundaries.md) — package split & public API
   - [references/circular-deps.md](references/circular-deps.md) — package and file cycles
   - [references/caching.md](references/caching.md) — Nx / Turborepo cache correctness
   - [references/ci-coverage.md](references/ci-coverage.md) — tests that silently don't run in CI
   - [references/prod-leakage.md](references/prod-leakage.md) — test code shipped to production
     The checks are independent; if you can run sub-agents, run them in parallel.
4. **Report** — follow [references/report-format.md](references/report-format.md): validate each `findings/<check>.json`, render, then show the user the summary line and the top 5 findings.
5. **CI mode** (only if asked, or when invoked non-interactively with a threshold) — run the exit-code snippet from report-format.md.

## Tracking

Create a todo per phase/check and mark each done as its findings file is written.
