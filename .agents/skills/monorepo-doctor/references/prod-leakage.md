# Check 5 — Test code in production

Question: do test files, fixtures or test libraries end up in a published package or a deployable build?
Output: `findings/prod-leakage.json`.

Test files are `scan.packages[p].testFiles` (the scan classifies `*.spec.*`, `*.test.*`, and files under `__tests__/`, `__mocks__/`, `test/`, `tests/`, `e2e/`, or `cypress/`) plus fixture directories (`fixtures?/`) when checking package tarballs and build outputs.
Test libraries: `vitest`, `jest`, `@jest/*`, `mocha`, `chai`, `sinon`, `@testing-library/*`, `cypress`, `playwright`, `@playwright/test`, `msw`, `nock`, `supertest`, `ts-jest`, `@vitest/*`.

## Rules

| id                                           | severity                                   | detect                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prod-leakage/test-files-in-package`         | critical                                   | publishable package (`private !== true`) whose tarball contains test files.                                                                                                                                                                                                                                                                                                                       |
| `prod-leakage/test-files-in-build-output`    | critical                                   | a package's existing output dir contains compiled test files (`*.spec.js`, `*.test.js`, `*.spec.d.ts`, …). Only treat a dir as build output when it is the tsconfig `outDir`, referenced by `main`/`exports`/`files`, or gitignored, **and** the package has a build script or Nx build target. Only check dirs that exist — never build. Evidence should note the output may be stale.           |
| `prod-leakage/build-tsconfig-includes-tests` | high                                       | the build tsconfig `include`s the test files' location and its `exclude` doesn't match them. Build tsconfig = file passed via `-p`/`--project` in the `build` script, else Nx build target `options.tsConfig`, else `tsconfig.build.json`, else `tsconfig.lib.json`, else `tsconfig.json` when the build script is plain `tsc`. Skip packages with neither a build script nor an Nx build target. |
| `prod-leakage/test-lib-in-dependencies`      | high (medium if `private`)                 | a test library appears in `dependencies` (not `devDependencies`). Consumers install it in production.                                                                                                                                                                                                                                                                                             |
| `prod-leakage/publint-issue`                 | error→high, warning→medium, suggestion→low | `publint` messages for publishable packages.                                                                                                                                                                                                                                                                                                                                                      |

## Steps

1. For each publishable package (non-private, `source: package.json`):
   ```bash
   W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
   (cd "<pkg-dir>" && npm pack --dry-run --json --ignore-scripts 2>&1)
   ```
   Parse `[0].files[].path`; any match of the test pattern → `test-files-in-package` (list up to 10 in `evidence`).
   Parse stdout as JSON. If `npm pack` fails (e.g. `workspace:` protocol under npm), capture the first stderr/stdout line, then fall back to reasoning: if the package has no `files` field and no `.npmignore`, every file not in `.gitignore` ships — compare against `scan.packages[p].testFiles`. If `.npmignore` exists without `files`, honor its simple ignore/negation patterns where possible and state that this is a fallback. If `files` is present, test files ship only if a `files` entry matches them. If `publishConfig.directory` is set, evaluate that directory as the publish root. State in `evidence` that the fallback was used and include the first failure line.
2. Check existing build output dirs for compiled test files.
3. Resolve each package's build tsconfig and check `include`/`exclude` against `scan.packages[p].testFiles`. Treat `include: ["src"]` as `src/**/*`. Follow `extends` one level for `include`/`exclude` when the file itself has none.
4. Check `dependencies` against the test-library list.
5. If `hasNodeModules`, for each publishable package that has its build output present:
   ```bash
   W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
   npm_config_ignore_scripts=true npx --yes publint@0.3.25 "<pkg-dir>" 2>&1
   ```
   publint prints sections `Errors:`, `Warnings:`, `Suggestions:` followed by numbered messages. One finding per message. Skip when `node_modules` is missing. Skip unbuilt packages and set status `partial` with reason `publint skipped for unbuilt packages: …`.
6. Write `findings/prod-leakage.json`.

## Fix guidance

- test-files-in-package: add `"files": ["dist"]` to package.json (preferred over `.npmignore`).
- build-tsconfig-includes-tests: `"exclude": ["**/*.spec.ts", "**/*.test.ts", "**/__tests__/**"]`.
- test-lib-in-dependencies: move it to `devDependencies`.
