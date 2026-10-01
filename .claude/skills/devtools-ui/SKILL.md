---
name: devtools-ui
description: Build or change any page, component or style in the devtools panel (app/). Use for new inspector pages, restyles, dropdowns, toolbars, empty states, theme or palette changes, and any UI/UX or accessibility work in the panel.
---

# Devtools panel UI

Read `docs/contributing/ui-guidelines.md` first; it is the source of truth for the theme, tokens and page anatomy. This skill is the working checklist.

## Before you write code

1. Open two recently built pages as references: `app/src/pages/di-inspector.ts` (tree + detail, keyboard, highlight) and `app/src/pages/network-inspector.ts` (toolbar, tables, forms, `app-select`).
2. Check which data the page gets and from where (`client.scope('ng-devtools').rpc.call(...)` or `rpc.sharedState(...)`). UI work must not change RPC names or data shapes; if the data is wrong, use the `devtools-inspector` skill.

## Rules

- Styles are SCSS in the component `styles` field, starting with `@use 'mixins' as m;`.
- Colors only through CSS variables (`--surface`, `--text-2`, `--accent`, ...). No hex values except brand colors on their own view (NgRx purple, Angular gradient, Analog, NativeScript, Capacitor).
- Controls are `var(--control-h)` tall. Use `app/src/ui/select.ts` for every dropdown; never a native `<select>`.
- Page structure: intro line, sticky toolbar (search with icon and `Escape` to clear, filters, count, actions), content (list or tree plus sticky detail on wide screens), and loading, error with Retry, empty and no-match states.
- Headings start at `h2` and never skip a level. Section labels use `m.label`.
- Rows are keyboard reachable (buttons or ARIA tree items with arrow keys). Selection is keyed by stable ids from the page.
- Rows that map to an element in the app call `request-page-highlight` on hover and focus, and clear it on leave and blur.
- Focus: `m.focus-ring` (use `-2px` inside scroll containers). Inputs use `m.field-focus`.
- Motion 150 to 350ms, disabled under `prefers-reduced-motion`.
- Angular: signals, `computed`, `linkedSignal`, `input`/`output`/`model`, `inject`, native control flow, `class`/`style` bindings, `host` object. No `any` in new code.
- Copy: short and plain, no em dashes, never compare with other tools.
- A new tab also needs: the `Tab` union in `app/src/types/tab.types.ts`, `allTabs` and the template switch in `app/src/app.ts`, an icon case in `tab-icon.ts`, and usually a Dashboard card.

## Changing the brand

Edit `app/src/styles/main.scss` (`$accent`) or the maps in `_palette.scss`. Never override tokens inside a page.

## Verify

Add component tests in `app/src/__tests__` as `*.test.ts` (see `app/src/__tests__/forms-panels.test.ts`); `pnpm test:panel` runs them. Then use the `devtools-verify` skill: template check with `ngc`, rebuild `extension/ui`, then the axe and 360px overflow audit on every page you touched, in the popup and at `/__devframes/`.
