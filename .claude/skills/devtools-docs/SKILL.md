---
name: devtools-docs
description: Writing guide for the Pangular Inspector documentation site in apps/docs (NgMd). Covers audience, voice, style rules, page types and structure, NgMd authoring components, code samples, checking claims against the code, and the build checks. You MUST use this skill any time you create, edit or review files in apps/docs/src/content, the docs home page, or README.md.
---

# Pangular Inspector docs writing guide

The human-readable version of this guide is `apps/docs/src/content/contributing/writing-docs.md`. Keep the two in sync when rules change.

The docs are an NgMd site (AnalogJS + Angular + Tailwind + marked). Pages are markdown files in `apps/docs/src/content`. The file path is the URL. The sidebar is `nav` in `apps/docs/src/ngmd.config.ts`.

## 1. Audience and voice

- Readers are Angular developers who have built at least one app. Don't explain TypeScript, the CLI, components, signals or DI basics. Do explain Devframe, MCP and how this project works.
- Orient each page around what the reader wants to do.
- Second person and imperative. Present tense. Active voice.
- One idea per sentence. Short, plain sentences.
- Condition first: "If X, do Y."
- Sentence case headings.
- UI labels in **bold**. Code, files, commands and options in `code`.
- Descriptive link text, never "here".

## 2. Hard rules

Reviewers reject changes that break these.

1. **No em dashes.** Use a period, comma or parentheses.
2. **No first person** ("we", "our").
3. **No future tense** ("will").
4. **No time-relative claims** ("new", "recently", "upcoming", "now supports"). Use a sidebar `status` badge in `ngmd.config.ts` and the changelog instead.
5. **No comparisons with other devtools products.** Describe this project on its own terms.
6. **No marketing words**: powerful, seamless, blazingly fast, simply, just, easy.
7. **No invented features.** Every name, label, option, default, tool and argument must exist in the code.
8. **Lists with more than one attribute per item are tables.**
9. **One subject per page.** Link to angular.dev or MDN for background.

## 3. Page types

| Section         | Job                                         | Shape                                                                          |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| getting-started | Get one setup running.                      | Intro, workflow of steps, code per setup, gotchas as callouts.                 |
| inspectors      | Explain one tab completely.                 | What it shows, where data comes from, how to use it, agent tools, limits, FAQ. |
| agents          | Reference for MCP server, tools, resources. | Tables of names, arguments, results, grouped by inspector.                     |
| guides          | One task end to end.                        | Workflow of steps with full working code.                                      |
| contributing    | Working on the repo.                        | Commands, tables, checklists.                                                  |

Don't mix explainer and tutorial content on one page.

## 4. Page skeleton

```md
---
title: Router
description: One sentence that summarizes the page.
---

<ngmd-hero title="Router" gradient>
  One or two sentences on what the page covers.
</ngmd-hero>

# Router

Short intro.

## Section

### Subsection

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
```

- One `#` heading, matching `title`. `##` sections with `###` subsections so the TOC has depth. Don't skip levels.
- Headings are unique within a page.
- Before renaming a heading, grep `apps/docs/src/content` for its anchor. Anchors are the slug of the heading text (lowercase, non-alphanumerics to `-`), badges excluded.
- Add new pages to `nav` in `ngmd.config.ts`.
- Link to other pages by the relative path of the `.md` file, in markdown links and `<a>` tags: `[Configuration](./configuration.md)`, `<a href="../inspectors/router.md#agent-tools">`. The site resolves them to routes and they also work on GitHub. Never write `/getting-started/...` routes in markdown links or `<a>`.
- `<ngmd-pill href>`, `<ngmd-card link>` and pages without a `.md` file (`/sponsors`) use the site route.
- `<ngmd-hero logo="...">` only on pages about one external tool (NgRx, Analog, Vite, Express, Chrome, MCP, Nx).

## 5. Components

Raw HTML in markdown. Always write explicit closing tags; never self-close custom elements.

| Component                                | Use for                                  | Attributes                                                             |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `ngmd-hero`                              | Page opener, once, before `#`.           | `title`, `gradient`, `logo`                                            |
| `ngmd-callout`                           | Short aside.                             | `type`: info, tip, success, warning, danger. `title`                   |
| `ngmd-alert`                             | One point the reader must not miss.      | `severity`: info, helpful, important, warning, critical. `label`       |
| `ngmd-card-grid` > `ngmd-card`           | Related pages, requirements, overviews.  | grid `columns`. card `title`, `link`, `cta`, `icon`, `image`, `avatar` |
| `ngmd-workflow` > `ngmd-step`            | Ordered steps.                           | step `title`                                                           |
| `ngmd-accordion` > `ngmd-accordion-item` | FAQ.                                     | item `title`, `open`                                                   |
| `ngmd-pill-row` > `ngmd-pill`            | Related links at the end of a page.      | pill `href`, `title`                                                   |
| `ngmd-badge`                             | Status chip next to a heading.           | `variant`: new, updated, alpha, beta, stable, deprecated               |
| `ngmd-tabs` > `ngmd-tab`                 | Alternatives a code group can't express. | tab `title`, `icon`, `image`                                           |
| `ngmd-image`, `ngmd-video`               | Screenshots, YouTube or Vimeo.           | image `src`, `alt`, `caption`, `width`. video `src`, `title`           |

Card icons: book, box, code, compass, file, layers, lightbulb, palette, rocket, search, settings, shield, sparkles, terminal, wrench, zap.

Rules:

- Callouts and alerts are rare. Never adjacent, never inside a card, table cell or other component.
- Only nest the parent > child pairs above.
- If the page doesn't make sense without it, it's not a callout.
- End with a pill row or a card grid, not both.
- Inside components use HTML (`<code>`, `<strong>`, `<a>`); markdown doesn't render there. Write `@` as `&#64;`.
- Raw HTML external links need `target="_blank" rel="noopener noreferrer"` or the build fails. Markdown links get it automatically.
- `*Angular`, `*Analog`, `*Devframe`, `*NgRx`, `*MCP`, `*Vite` are keyword links (`keywords` in `ngmd.config.ts`). The asterisk is intentional. Never "fix" it.

## 6. Code samples

- Always set the language. Put the file path in a comment on the first line: `// src/app/app.config.ts`.
- Highlight lines with `{3}` or `{2,5-7}` after the language. Count the path comment as line 1.
- Install commands use a code group: ` ```bash group="install" name="pnpm" active ` then npm, yarn, bun.
- `file="path#L5-L20"` imports a real file (relative to `apps/docs`, nothing outside it). It is not a title.
- Samples must run: every import, real export names from `packages/devtools/package.json`, real option names and defaults.
- Source samples from the demos: `src/` (Angular Travel) and `examples/analog`.
- Load the overlay only in dev, with the `ngDevMode` dynamic import used on the installation page.
- Secure by default: no `auth: false` or `allowedOrigins: false` in copyable code unless the page explains it.
- UI code in samples follows accessibility basics: labels on controls, alt text on images.
- Realistic names (`TripSearch`, `authGuard`), no `Foo` or `prop1`. Comments explain why, and most samples need none.

## 7. Check claims against the code

| Page               | Source of truth                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| inspectors/\*      | `app/src/pages/*.ts` (the tab) and `packages/devtools/src/*` (collectors, actions)                          |
| agents/\*          | `packages/devtools/src/devframe.ts`, `rpc/*.ts`, `rpc/analog-register.ts`, Devframe built-ins               |
| getting-started/\* | `packages/devtools/package.json` exports, `hub.ts`, `vite.ts`, `config.ts`, `overlay.ts`, `popup.ts`, demos |
| security           | `hub.ts`, `vite.ts`, `forms-privacy.ts`, `forms-actions.ts`, router and Analog redaction                    |
| contributing/\*    | root `package.json`, `nx.json`, `project.json` files, `.github/workflows`, `extension/`                     |

Check names exactly. When code changes, update the docs in the same PR. When unsure, say less rather than guess.

## 8. Verify

From the repo root:

1. `pnpm docs:dev` and open every changed page (TOC, links, dark mode).
2. `pnpm docs:build` (link and anchor guards).
3. `pnpm format:check` from the repo root. It checks content markdown too, so run `pnpm exec prettier --write` on the pages you changed.
4. Grep changed files for `—`, "will ", "we ", "new ", "recently", "simply", "just ".
