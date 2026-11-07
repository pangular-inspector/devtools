# Check 1 — Package boundaries

Question: are packages split along real seams, and is each package's public API respected?
Inputs: `workspace.json`, `scan.json`. Output: `findings/boundaries.json`.

## Rules

| id                                             | severity | detect                                                                                                                                                         | evidence                                               |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `boundaries/oversized-package`                 | low      | `scan.packages[p].sourceFiles > 500` or `loc > 50000`                                                                                                          | counts                                                 |
| `boundaries/deep-import`                       | medium   | each `scan.imports` entry with `deep && (declared \|\| fromSource === "project.json")` (undeclared package.json importers are reported by ci-coverage instead) | file:line + import specifier + target's `exports` keys |
| `boundaries/unlisted-dependency`               | medium   | knip `unlisted` entries                                                                                                                                        | knip output line                                       |
| `boundaries/unused-dependency`                 | low      | knip `dependencies` / `devDependencies` entries                                                                                                                | knip output line                                       |
| `boundaries/nx-missing-module-boundaries-rule` | medium   | Nx detected and no ESLint config in the root mentions `@nx/enforce-module-boundaries`                                                                          | list of ESLint config files checked                    |
| `boundaries/nx-permissive-module-boundaries`   | low      | the rule exists but `depConstraints` contains `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }`                                                            | the config snippet                                     |
| `boundaries/nx-untagged-project`               | low      | Nx detected, rule absent or permissive, and a project has empty `tags`                                                                                         | project.json path                                      |
| `boundaries/turbo-boundaries-violation`        | medium   | each violation printed by `turbo boundaries`                                                                                                                   | output line                                            |

Group `deep-import` findings: one finding per (from, target) pair, listing up to 5 locations in `evidence`; `location` is the first occurrence.

## Steps

1. Load `workspace.json` and `scan.json`. Apply the size and deep-import rules directly.
2. **knip** — only if `hasNodeModules`:
   ```bash
   W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
   npx --yes knip@6.41.0 --reporter json --include dependencies,unlisted --no-progress --no-exit-code
   ```
   Parse stdout as JSON. Its shape varies by version; look for per-file `dependencies`, `devDependencies` and `unlisted` arrays of `{ name }`. Map the file to its package via `workspace.json`. If knip fails or the output can't be parsed, mark the check `partial` with reason `knip unavailable: <first line of error>`. Do **not** report `unused-dependency` for `@types/*` packages or for tools only referenced in scripts.
3. **Nx** — only if Nx is an orchestrator: read ESLint configs in the root (`eslint.config.{js,mjs,cjs,ts}`, `.eslintrc{,.json,.js,.cjs}`) and every package dir. Apply the three `nx-*` rules. A config that contains `@nx/enforce-module-boundaries` or legacy `@nrwl/nx/enforce-module-boundaries` anywhere counts as present. Group `nx-untagged-project` consistently as one finding per untagged project found from the root and package-dir project configs.
4. **Turborepo** — only if turbo is an orchestrator **and installed**:
   ```bash
   W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
   TURBO_TELEMETRY_DISABLED=1 npx turbo boundaries
   ```
   One finding per reported violation. If the command errors with an unknown-command message (turbo < 2.4), skip this sub-step and note it in `reason`.
5. Write `findings/boundaries.json`.

## Fix guidance

- deep-import: add the subpath to the target's `exports`, or re-export from its entry point, then import from the package root.
- oversized-package: identify clusters by directory and by which consumers import which files (`scan.imports` subpaths); propose 2–3 candidate splits.
- nx-missing-module-boundaries-rule: add `@nx/enforce-module-boundaries` with `depConstraints` based on `scope:*`/`type:*` tags.
