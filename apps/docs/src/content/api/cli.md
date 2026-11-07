---
title: '@pangular-inspector/devtools/cli'
description: 'Every symbol the @pangular-inspector/devtools/cli entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="cli" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/cli</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/cli

Import from `@pangular-inspector/devtools/cli`. This page is generated from [`packages/devtools/src/entries/cli.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/entries/cli.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## createPangularCli

Function. Source: [`packages/devtools/src/cli.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cli.ts).

The `pangular` command line: `dev` (the default), `build`, `mcp`, `skills`
and `lint`, with `--root`, `--config` and `--read-only` on each.

```ts
function createPangularCli(options: PangularCliOptions = {});
```

## PangularCliOptions

Interface. Source: [`packages/devtools/src/cli.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cli.ts).

```ts
interface PangularCliOptions {
  env?: Env;
  log?: (message: string) => void;
}
```
