---
title: Write documentation
description: How to write and review pages for this site. Audience, voice, page structure, NgMd components, code samples and the checks every change must pass.
---

<ngmd-hero title="Write documentation" gradient>
  How to write pages for this site: who they are for, how they read, how they are built, and how to check them against the code.
</ngmd-hero>

# Write documentation

These docs live in `apps/docs` and are built with [NgMd](https://github.com/erkamyaman/ngmd). Every page is a markdown file under `apps/docs/src/content`. The path is the URL: `inspectors/router.md` is served at `/inspectors/router`.

The rules below follow the Angular documentation guidelines and Google's technical writing courses, with a few additions for this project. Read [Tech Writing One](https://developers.google.com/tech-writing/one) and [Tech Writing Two](https://developers.google.com/tech-writing/two) if you haven't.

<ngmd-callout type="tip" title="Using a coding agent?">
  The repository ships a <code>devtools-docs</code> skill in <code>.claude/skills</code> with the same rules, so agents follow this page when they edit docs.
</ngmd-callout>

## Audience and voice

### Who you write for

Write for Angular developers who have built at least one app. Assume they know TypeScript, HTML, the Angular CLI and the basics of components, signals and DI. Don't assume they know Devframe, MCP or how this project works inside.

Orient every page around what the reader is trying to do. Ask: _what does the developer want to find out or get working?_

### How pages read

- Use second person and the imperative: "Open the Router tab", not "We can open the Router tab".
- Use present tense: "The tab shows", not "The tab will show".
- Use active voice: "On Angular 20 and later, the overlay reads the page after change detection", not "The page is read after change detection".
- One idea per sentence. Keep sentences short and plain.
- Put the condition first: "If the tab is empty, check that the app runs in development mode."
- Use sentence case for headings. Capitalize only the first word and proper nouns.
- Put UI labels in **bold**, and code, file names, commands and option names in `code`.
- Use descriptive link text. Never "click here".

## Style rules

These are the mistakes reviewers flag most often.

| Rule                                   | Why                                                                                                   | Avoid                                                              | Prefer                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| **No first person**                    | The reader is the subject.                                                                            | "We use the hub to mount the panel."                               | "Mount the panel with the hub."                                |
| **No future tense**                    | Docs describe what the code does now.                                                                 | "The tool will return the tree."                                   | "The tool returns the tree."                                   |
| **No time-relative claims**            | "New" and "recent" go stale. Release notes belong in the changelog, status belongs in sidebar badges. | "The recently added Pipes tab..."                                  | "The Pipes tab..."                                             |
| **No em dashes**                       | Project style. Use a period, comma or parentheses.                                                    | "The hub — mounted once — serves every tool."                      | "The hub is mounted once and serves every tool."               |
| **No comparisons with other products** | Describe this project on its own terms.                                                               | "Unlike other devtools, ..."                                       | Describe the feature directly.                                 |
| **No marketing words**                 | They carry no information.                                                                            | "powerful", "seamless", "blazingly fast", "simply", "just", "easy" | Say what it does.                                              |
| **No invented features**               | Every claim must match the code.                                                                      | A button, option or tool that doesn't exist.                       | Check the source before you write it.                          |
| **Lists that should be tables**        | Items with more than one attribute read better as rows.                                               | A bullet list of tools, each with arguments and a purpose.         | A table with name, purpose and arguments columns.              |
| **Scope creep**                        | Each page covers one subject. Link out for the rest.                                                  | Explaining how Angular DI works on the Injectors page.             | One sentence and a link to [angular.dev](https://angular.dev). |

## Page types

Each section of the site has one job. Keep a page to its type.

| Section             | Purpose                                                         | Shape                                                                              |
| ------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Getting started** | Get the devtools running in one setup.                          | Short intro, a workflow of steps, code for each setup, gotchas as callouts.        |
| **Inspectors**      | Explain one tab completely. Readers jump to the part they need. | What it shows, where the data comes from, how to use it, agent tools, limits, FAQ. |
| **Agents**          | Reference for the MCP server, every tool and every resource.    | Tables of names, arguments and results, grouped by inspector.                      |
| **Guides**          | Walk through one task end to end.                               | A workflow of steps with full, working code samples.                               |
| **Contributing**    | How to work on the repository.                                  | Commands, tables of scripts and ports, checklists.                                 |

Don't mix an explainer and a tutorial on one page. If a reference page needs a walkthrough, write a guide and link to it.

## Page structure

Every page follows the same skeleton.

```md
---
title: Router
description: One sentence that summarizes the page.
---

<ngmd-hero title="Router" gradient>
  One or two sentences on what the page covers.
</ngmd-hero>

# Router

A short intro: what the tab is and when you open it.

## What it shows

### Navigations

...

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
```

### Frontmatter

`title` is the page title in search results. The sidebar and the browser tab use the page's `label` in `nav`. Keep `description` to one sentence that summarizes the page.

### Headings

- One `#` heading per page, matching the title.
- Use `##` for sections and `###` for subsections. The "On this page" list shows both, so a page with only `##` headings gets a flat, short table of contents.
- Don't skip levels.
- Keep heading text unique within a page. Repeated headings get `-1`, `-2` anchors, which are hard to link to.
- Other pages link to headings by anchor. Before you rename a heading, search `apps/docs/src/content` for `#old-anchor`. The build fails on broken anchors.

### Add a page to the sidebar

Add an entry to `nav` in `apps/docs/src/ngmd.config.ts`. Pages that aren't listed still build, but readers can't find them. Use `status: 'new'` or `status: 'updated'` for a sidebar badge instead of saying "new" in the text.

### Link to other pages

Link to another page by the relative path of its `.md` file, in markdown links and in `<a>` tags: `[Configuration](./configuration.md)`, `<a href="../inspectors/router.md#agent-tools">`. The site turns these into routes, and the same links work when the page is read on GitHub.

- The build fails if the file doesn't exist or the anchor doesn't match a heading.
- `<ngmd-pill href>` and `<ngmd-card link>` take the site route, such as `/agents/tools`. They only render on the site.
- Pages without a `.md` file, such as `/sponsors`, use the site route.

## Components

The site uses NgMd's authoring components. Write them as raw HTML inside the markdown. The full reference is the components page of the [NgMd documentation](https://ngmd.netlify.app/concepts/components).

| Component                                    | Use it for                                                        | Attributes                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `<ngmd-hero>`                                | The page opener. Once per page, before the `#` heading.           | `title`, `gradient`, `logo` (only on pages about one external tool, such as NgRx, Analog, Vite, Express, Chrome, MCP or Nx) |
| `<ngmd-callout>`                             | A short aside with context the reader may need.                   | `type` (`info`, `tip`, `success`, `warning`, `danger`), `title`                                                             |
| `<ngmd-alert>`                               | One short point the reader must not miss.                         | `severity` (`info`, `helpful`, `important`, `warning`, `critical`), `label`                                                 |
| `<ngmd-card-grid>` + `<ngmd-card>`           | Links to related pages, requirements, feature overviews.          | grid: `columns`. card: `title`, `link`, `cta`, `icon`, `image`, `avatar`                                                    |
| `<ngmd-workflow>` + `<ngmd-step>`            | Ordered steps.                                                    | step: `title`                                                                                                               |
| `<ngmd-accordion>` + `<ngmd-accordion-item>` | FAQ sections.                                                     | item: `title`, `open`                                                                                                       |
| `<ngmd-pill-row>` + `<ngmd-pill>`            | A row of related links at the end of a page.                      | pill: `href`, `title`                                                                                                       |
| `<ngmd-badge>`                               | A status chip next to a heading.                                  | `variant` (`new`, `updated`, `alpha`, `beta`, `stable`, `deprecated`)                                                       |
| `<ngmd-tabs>` + `<ngmd-tab>`                 | The same content in several forms, when a code group doesn't fit. | tab: `title`, `icon`, `image`                                                                                               |
| `<ngmd-image>`, `<ngmd-video>`               | Screenshots and YouTube or Vimeo videos.                          | image: `src`, `alt`, `caption`, `width`. video: `src`, `title`                                                              |

Card icons come from a fixed set: `book`, `box`, `code`, `compass`, `file`, `layers`, `lightbulb`, `palette`, `rocket`, `search`, `settings`, `shield`, `sparkles`, `terminal`, `wrench`, `zap`.

### When to use which

- Use callouts and alerts sparingly. Never put two next to each other, and never put one inside a card, table cell or another component.
- Don't nest components, except for the parent and child pairs in the table.
- A callout is an aside. If the page doesn't make sense without it, it belongs in the text.
- End a page with a pill row or a card grid that points to the next pages, not both.
- Always write a closing tag, such as `<ngmd-pill ...></ngmd-pill>`. HTML doesn't honour self-closing custom elements, so the next element ends up nested inside.
- Write external links in raw HTML with `target="_blank" rel="noopener noreferrer"`, or the build fails. Markdown links get both automatically.
- Components that contain HTML use HTML for inline formatting: `<code>`, `<strong>` and `<a>`. Markdown doesn't render inside them. Write `@` as `&#64;` inside components.

### Keyword links

Write `*Angular`, `*Analog`, `*Devframe`, `*NgRx`, `*MCP` or `*Vite` in prose to link the word to its site. The list is `keywords` in `ngmd.config.ts`. The asterisk is not a typo, so don't remove it.

## Code samples

### Fences

Always set the language. When the code belongs in a specific file, put the path in a comment on the first line. Highlight the lines that matter with `{...}` after the language.

````md
```ts {6}
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideNgDevtoolsHttp} from '@santoshyadavdev/ng-devtools/http';

export const appConfig: ApplicationConfig = {
  providers: [provideNgDevtoolsHttp()],
};
```
````

To show a real file from the repository, import it with `file="..."` instead of pasting it. Add `#L5-L20` for a line range. The path is relative to `apps/docs`, and files outside it can't be imported.

For install commands, use a code group so readers pick their package manager. List pnpm, npm, yarn and bun, in that order:

````md
```bash group="install" name="pnpm" active
pnpm add @santoshyadavdev/ng-devtools devframe
```

```bash group="install" name="npm"
npm install @santoshyadavdev/ng-devtools devframe
```
````

### Rules for samples

- Samples must run. Include every import, and match the real exports and option names in `packages/ng-devtools`.
- Prefer the demo apps as the source. The Angular Travel demo is in `src/` and the Analog demo is in `examples/analog`.
- Use realistic names: `TripSearch`, `authGuard`, `bookingForm`. Avoid `Foo`, `Example` or `prop1`.
- Load the overlay only in development builds, with the `ngDevMode` check the installation page uses.
- Keep examples secure by default. Don't show `auth: false` or `allowedOrigins: false` in code readers copy, unless the page explains why.
- Comments explain why, not what. Most samples need none.
- UI code in samples follows accessibility basics: labels on controls, alt text on images.

## Check every claim against the code

The docs describe what the code does today. Before you write a claim, find it in the source.

| Page                      | Source of truth                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Inspector pages           | The tab in `app/src/pages/` and its collector in `packages/ng-devtools/src/`                                          |
| Agent tools and resources | `packages/ng-devtools/src/devframe.ts`, `rpc/*.ts` and `rpc/analog-register.ts`                                       |
| Setup pages               | `packages/ng-devtools/package.json` exports, `hub.ts`, `vite.ts`, `config.ts`, `overlay.ts`, `popup.ts` and the demos |
| Security                  | `hub.ts`, `vite.ts` and the redaction code, such as `forms-privacy.ts`                                                |
| Contributing              | Root `package.json` scripts, `nx.json`, `project.json` files and `.github/workflows`                                  |

Check names exactly: labels, buttons, tool names, arguments, option names and defaults. When the code changes, update the page in the same pull request.

## Before you open a pull request

<ngmd-workflow>
  <ngmd-step title="Run the dev server">
    Run <code>pnpm docs:dev</code> and open every page you changed. Check the "On this page" list, the links and dark mode.
  </ngmd-step>
  <ngmd-step title="Build with the link guards">
    Run <code>pnpm docs:build</code>. The build fails on a broken internal link or anchor, and on an external raw HTML link without <code>target="_blank"</code>.
  </ngmd-step>
  <ngmd-step title="Format">
    Run <code>pnpm format:check</code> from the repo root. It checks content markdown too, so run <code>pnpm exec prettier --write</code> on the pages you changed.
  </ngmd-step>
  <ngmd-step title="Reread against the rules">
    Check the style rules above, and that every claim you added matches the code. Search your changes for em dashes, "will", "we", "new", "recently", "simply" and "just".
  </ngmd-step>
</ngmd-workflow>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/contributing/development" title="Development setup"></ngmd-pill>
  <ngmd-pill href="/contributing/kitchen-sink" title="Kitchen sink"></ngmd-pill>
  <ngmd-pill href="/contributing/demo-apps" title="Demo apps"></ngmd-pill>
  <ngmd-pill href="https://github.com/erkamyaman/ngmd" title="NgMd on GitHub"></ngmd-pill>
</ngmd-pill-row>
