# Monorepo Doctor Report

**Workspace:** pnpm · nx · 3 packages

**Summary:** 0 critical · 0 high · 1 medium · 6 low

| Check         | Status | Findings | Note                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| boundaries    | ok     | 6        | knip reported 18 unused dependencies; 17 were false positives (used in Angular/Analog sources, CSS @plugin, Nx/Angular schematics or the root SSR server) and were dropped                                                                                                                                                                                                        |
| circular-deps | ok     | 0        | No package cycles in the Nx graph. 4 file cycles were reported in apps/docs/.analog/ssr (gitignored build output, .gitignore:6) and dropped as false positives.                                                                                                                                                                                                                   |
| caching       | ok     | 1        | Resolved targets (including plugin-inferred docs build/test) read from nx graph. All build outputs are declared or match Nx defaults; only env reads are import.meta.env.DEV and gitignored build output.                                                                                                                                                                         |
| ci-coverage   | ok     | 0        | ci.yml checks out with fetch-depth: 0 and runs nrwl/nx-set-shas before nx affected; test inputs include ^production; devtools tests run via test:devtools, docs via @nx/vitest. The 2 undeclared imports the scan reported were a self-reference (packages/devtools/bin.mjs) and a code sample inside a string (apps/docs/src/app/pages/index.page.ts:774), so both were dropped. |
| prod-leakage  | ok     | 0        | npm pack --dry-run of @pangular-inspector/devtools lists 43 files, none are tests; dist has no compiled tests; no test libraries in any dependencies; publint 0.3.25: All good.                                                                                                                                                                                                   |

## Medium

### No @nx/enforce-module-boundaries rule (no ESLint config in the workspace)

- **id:** `boundaries/nx-missing-module-boundaries-rule`
- **where:** `nx.json`

**Evidence**

```
Checked eslint.config.{js,mjs,cjs,ts}, .eslintrc{,.json,.js,.cjs} in the root and in packages/devtools, apps/docs, examples/analog: none exist.
```

**Fix:** With only 4 projects this is optional. If wanted, add an ESLint flat config with @nx/enforce-module-boundaries and depConstraints on scope/type tags (e.g. type:app may depend on type:lib; packages/devtools depends on nothing in the workspace).

## Low

### Nx project pangular-inspector-docs has no tags

- **id:** `boundaries/nx-untagged-project`
- **where:** `apps/docs/project.json` (pangular-inspector-docs)

**Evidence**

```
apps/docs/project.json has no "tags" field; no module-boundaries rule exists.
```

**Fix:** Add "tags": ["type:app"] if you adopt module boundaries.

### Nx project analog-demo has no tags

- **id:** `boundaries/nx-untagged-project`
- **where:** `examples/analog/package.json` (analog-demo)

**Evidence**

```
examples/analog/package.json has no nx.tags; no module-boundaries rule exists.
```

**Fix:** Add "nx": { "tags": ["type:example"] } if you adopt module boundaries.

### Nx project @pangular-inspector/devtools has no tags

- **id:** `boundaries/nx-untagged-project`
- **where:** `packages/devtools/package.json` (@pangular-inspector/devtools)

**Evidence**

```
package.json#nx has targets but no "tags"; no module-boundaries rule exists.
```

**Fix:** Add "nx": { "tags": ["type:lib"] } if you adopt module boundaries.

### Nx project pangular-inspector has no tags

- **id:** `boundaries/nx-untagged-project`
- **where:** `project.json` (pangular-inspector)

**Evidence**

```
project.json has no "tags" field and no module-boundaries rule exists.
```

**Fix:** Add "tags": ["type:app"] if you adopt module boundaries.

### h3 is an unused dependency of @pangular-inspector/devtools

- **id:** `boundaries/unused-dependency`
- **where:** `packages/devtools/package.json:84` (@pangular-inspector/devtools)

**Evidence**

```
knip: dependencies packages/devtools/package.json h3 (line 84)
No .ts/.mjs file in packages/devtools mentions h3. Its deps bring their own: @devframes/hub, @devframes/agentic and devframe each depend on h3 ^2.0.1, while this package declares h3 ^1.15.11, so users install an extra unused h3 v1.
```

**Fix:** Remove "h3" from packages/devtools/package.json dependencies (keep the h3 packageExtension for @analogjs/vite-plugin-nitro in pnpm-workspace.yaml, which is separate).

### Nx "production" named input does not exclude test files

- **id:** `caching/build-inputs-include-tests`
- **where:** `nx.json:10`

**Evidence**

```
"namedInputs": { "default": ["{projectRoot}/**/*", "sharedGlobals"], "production": ["default"] }
"targetDefaults": { "build": { "inputs": ["production", "^production"] } }
packages/devtools has 132 test files and apps/docs 22, so editing any spec invalidates their build cache (and dependants via ^production).
```

**Fix:** "production": ["default", "!{projectRoot}/**/\*.spec.ts", "!{projectRoot}/**/_.test.ts", "!{projectRoot}/**/**tests**/**", "!{projectRoot}/vitest_.config.ts"]
