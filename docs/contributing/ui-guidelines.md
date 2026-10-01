# UI guidelines

The devtools panel (`app/`) is a dark-only, dense tool that people keep open next to their app. Every page should look like it belongs to the same product, work with the keyboard, and pass axe with WCAG AA contrast.

## Theme

The panel is dark only. A light theme is tracked in [#192](https://github.com/santoshyadavdev/angular-devtools/issues/192).

The palette lives in `app/src/styles/_palette.scss` and becomes CSS variables in `_theme.scss`. Change the brand in one place, `app/src/styles/main.scss`:

```scss
@use 'theme' with (
  $accent: amber
);
```

Accents available: `amber` (default), `ember`, `gold`. Add one by extending `$accents` in `_palette.scss`.

Always use the variables, never hex values:

| Variable                                          | Use                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `--bg`                                            | Page background, input fields                                           |
| `--surface`, `--surface-2`, `--surface-3`         | Cards and panels, hover, pressed or nested                              |
| `--border`, `--border-strong`                     | Dividers, control borders                                               |
| `--text-strong`, `--text`, `--text-2`, `--text-3` | Headings, body, secondary, hints                                        |
| `--accent`, `--accent-hover`, `--accent-ink`      | Primary actions and selection; `--accent-ink` is text on an accent fill |
| `--accent-soft`, `--accent-line`                  | Selected backgrounds, focus glow, accent borders                        |
| `--ok`, `--warn`, `--danger`                      | Status                                                                  |
| `--radius`, `--radius-sm`                         | Cards, controls                                                         |
| `--control-h`                                     | 34px, the height of every input, select and button                      |
| `--ease`, `--font-mono`                           | Motion curve, code and tokens                                           |

Brand colors belong only to the brand they represent: NgRx keeps its purple on the NgRx view, the Angular view uses the Angular gradient for its logo and title, and Analog, NativeScript and Capacitor use their own colors on their pages. Everything else is amber.

## Shared building blocks

- **SCSS mixins** in `app/src/styles/_mixins.scss`, used with `@use 'mixins' as m;` in component styles: `m.focus-ring($offset)`, `m.field-focus`, `m.panel($level)`, `m.label`, `m.soft($color)`, `m.truncate`, `m.enter($duration)`.
- **Dropdown**: `app/src/ui/select.ts` (`<app-select [options] [(value)] ariaLabel|labelledBy>`). Never use a native `<select>`; the system popup ignores the theme.
- **Tab icons**: `app/src/pages/tab-icon.ts`, Lucide-style 24px strokes. Add a case when you add a tab.
- **Global baselines** in `_base.scss`: tabular numbers, textarea sizing, focus fallback, reduced motion.

## Anatomy of an inspector page

1. **Intro**: one or two sentences saying what the page shows and where the data comes from (live page or source scan).
2. **Toolbar**: sticky, with a search field (icon, `Escape` clears), filters as chips or `app-select`, a count ("12 of 40"), and actions. Controls are `var(--control-h)` tall.
3. **Content**: a list or tree on the left, a detail panel on the right on wide screens (sticky), stacked below 880px.
4. **States**: every page has loading, error (with Retry), empty (explains how to get data) and no-match (with Clear filters) states. Never leave a blank area.

Headings start at `h2` inside a page (the shell owns the `h1`) and never skip a level. Use `m.label` for small uppercase section labels.

## Interaction

- Rows are buttons or ARIA tree items; arrow keys move, `Home` and `End` jump, `Enter` selects, left and right collapse and expand.
- Hovering or focusing a row that maps to an element in the app highlights it there through the `request-page-highlight` RPC.
- Selection is keyed by a stable id from the page, so it survives refreshes.
- Motion is short (150 to 350ms) and respects `prefers-reduced-motion`.

## Accessibility checklist

- Text contrast at least 4.5:1 (3:1 for large text and UI outlines). Check gradients at their darkest stop.
- Every control has a label (`<label>`, `aria-label` or `aria-labelledby`).
- Visible focus on everything; use `m.focus-ring(-2px)` inside scroll containers so the ring isn't clipped.
- Landmarks have unique names; don't nest interactive elements.
- Run the axe check described in the [devtools-verify skill](../../.claude/skills/devtools-verify/SKILL.md) before you open a pull request.

## Writing in the UI

- Short, plain sentences. Say what to do next in empty and error states.
- No em dashes; use a period, comma or parentheses.
- Don't compare the project with other tools.
