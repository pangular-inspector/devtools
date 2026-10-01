# Coding standards

These rules go together with the Angular rules in [`AGENTS.md`](../../AGENTS.md). Prettier formats everything; run `pnpm format` before you commit.

## TypeScript

- Strict mode everywhere. Avoid `any`; use `unknown` and narrow it, or a small local interface.
- Prefer `const`. Use `readonly` for members that never change.
- Names describe what a thing is or does. Spell words out. Booleans start with `is`, `has` or `should`.
- No `I` prefix on interfaces and no `$` suffix on observables.
- Prefer `for...of` over `forEach` when the loop has side effects.
- Only catch errors you expect, and say what happens instead (fall back, skip, report).
- Comment the why, not the what. Public functions and exported types in `packages/ng-devtools` get a short doc comment when the name alone doesn't explain them.

## Angular (panel UI and demo app)

- Standalone components, `input()`, `output()`, `model()`, `computed()`, `linkedSignal()` and `inject()`.
- Don't set `standalone: true` or `changeDetection: OnPush`; both are defaults.
- Native control flow (`@if`, `@for`, `@switch`); `class` and `style` bindings instead of `ngClass` and `ngStyle`.
- Host bindings go in the `host` object, never `@HostBinding` or `@HostListener`.
- Derived state is a `computed()`. Don't write signals from an `effect()` when a `computed()` or `linkedSignal()` would do.
- Clean up subscriptions and listeners with `DestroyRef`.

The panel's visual rules are in the [UI guidelines](./ui-guidelines.md).

## Reading data from the page (`packages/ng-devtools`)

The overlay runs inside the user's app, so it must be correct, cheap and invisible.

- **Use Angular's debug APIs**, not guesses: `ng.getComponent`, `ng.getDirectives`, `ng.getDirectiveMetadata`, `ng.getListeners`, `ng.getInjector`, `ng.ɵgetInjectorProviders`, `ng.ɵgetInjectorResolutionPath`, `ng.ɵgetDependenciesFromInjectable`, `ng.ɵgetSignalGraph`. Check the shapes in `node_modules/@angular/core/fesm2022` before relying on a field.
- **Never write to the app's DOM.** Give elements and objects ids through a `WeakMap` (`element-id.ts`, `idFor` in `injector-tree.ts`), so ids stay stable between pushes and selection survives a refresh.
- **Strip bundler prefixes** from class names (`className()` in `injector-tree.ts`), so `_App` shows as `App`.
- **Don't match `_nghost-*` or `_ngcontent-*` attributes** with exact selectors; their names carry a suffix. Start from `[ng-version]` roots and the debug APIs.
- **Keep pushes cheap.** Skip unchanged reports (compare with the last JSON sent), re-send now and then so the server doesn't expire the page, and avoid `querySelectorAll('*')` on a timer; cache and rescan on a `MutationObserver` signal.
- **Serialize safely** with `serialize()` from `serialize.ts`: it limits depth and size and handles `Map`, `Set`, `Date`, class instances, cycles and Angular's signal sentinels.
- **Every report carries a `pageId`.** The server keeps one entry per page, expires it after 15 seconds without a push, and forgets it on `pagehide` (`forget-<area>-page`). Two open tabs must never overwrite each other.
- **Don't change app behavior.** Don't run the app's validators, guards or effects to learn something unless the user asked for it (recording, instrumenting), and say so in the UI.

## Server side and agent tools

- Register RPC functions with `defineRpcFunction` and valibot schemas; give them an `agent` description when an agent should call them.
- Agent tools (`ctx.agent.registerTool`) answer in markdown, say where the data came from (live page or source scan), and say what to do when there is no data.
- Source scans (`rpc/source-scan.ts` and friends) are a fallback and an enrichment for live data, not a replacement.

## Tests

- Every behavior change comes with a test in `packages/ng-devtools/src/__tests__` or `packages/ng-devtools/src/rpc/__tests__`.
- Page-side collectors are tested in jsdom with a fake `ng` object; see `injector-tree.test.ts` and `component-tree.test.ts`.
- Test names read as sentences: `it('keeps ids stable between collections')`.
- Run `pnpm test:devtools`, `pnpm test:panel` and `pnpm test` before you push.
