---
title: Configuration
description: Turn inspectors, agent tools and panel actions on or off, add secret names and change what the devtools keep.
---

<ngmd-hero title="Configuration" gradient>
  One set of options for the Express hub, the Vite plugin and a custom devframe host. Turn inspectors, agent tools and actions off, add secret names and change the limits.
</ngmd-hero>

# Configuration

Everything is on when you leave the options out. You set them once, on the server. The server enforces them, and the overlay and the panel read them from the connection info.

## Where to set them

These three functions take the same options:

| Function              | Import                                  | Setup                                                           |
| --------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `initNgDevtoolsHub()` | `@santoshyadavdev/ng-devtools/hub`      | [Angular CLI and Express](./express.md)                         |
| `ngDevtools()`        | `@santoshyadavdev/ng-devtools/vite`     | [Vite and Analog](./vite.md)                                    |
| `createNgDevtools()`  | `@santoshyadavdev/ng-devtools/devframe` | A custom devframe host, such as `initDevframe()` without a hub. |

The `ng-devtools` binary reads the same options from a JSON file, for `dev`, `build` and `mcp`. See [Config file](./cli.md#config-file).

### Express hub

Pass the options next to the [access options](../security.md#express-hub) `auth`, `allowedOrigins` and `mcp`:

```ts {8-10}
// src/server.ts
import express from 'express';
import {initNgDevtoolsHub} from '@santoshyadavdev/ng-devtools/hub';

const app = express();
const devtools = initNgDevtoolsHub({
  ws: false,
  inspectors: {pipes: false},
  agent: {readOnly: true},
  redaction: {secretNames: ['passport', 'taxId']},
});
app.use(devtools.nodeMiddleware);
```

### Vite plugin

Pass them to `ngDevtools()`, next to the [access options](../security.md#vite-plugin) `auth` and `allowedOrigins`:

```ts {9-12}
// vite.config.ts
import analog from '@analogjs/platform';
import ngDevtools from '@santoshyadavdev/ng-devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [
    analog(),
    ngDevtools({
      actions: {http: false, analog: false},
      limits: {refreshMs: 1000, navigations: 100},
    }),
  ],
});
```

### Custom devframe host

The default export of `@santoshyadavdev/ng-devtools/devframe` uses the defaults. Call `createNgDevtools()` to pass options:

```ts {7-9}
// src/server.ts
import express from 'express';
import {initDevframe} from 'devframe/initiate';
import {createNgDevtools} from '@santoshyadavdev/ng-devtools/devframe';

const app = express();
const devtools = initDevframe(createNgDevtools({agent: {readOnly: true}}), {
  base: '/__ng-devtools/',
});
app.use(devtools.nodeMiddleware);
```

## The options

### Type

`@santoshyadavdev/ng-devtools/config` exports the type. The hub and Vite entry points export it too.

```ts
// @santoshyadavdev/ng-devtools/config
type NgDevtoolsInspector =
  | 'components'
  | 'injectors'
  | 'signals'
  | 'ngrx'
  | 'forms'
  | 'router'
  | 'pipes'
  | 'http'
  | 'analog';

type NgDevtoolsAction = 'forms' | 'router' | 'ngrx' | 'http' | 'analog';

interface NgDevtoolsConfig {
  inspectors?: Partial<Record<NgDevtoolsInspector, boolean>>;
  agent?: {readOnly?: boolean; tools?: Partial<Record<NgDevtoolsInspector, boolean>>};
  actions?: boolean | Partial<Record<NgDevtoolsAction, boolean>>;
  redaction?: {secretNames?: string[]; unmask?: string[]};
  limits?: {
    refreshMs?: number;
    navigations?: number;
    formTimeline?: number;
    httpCalls?: number;
    changeLog?: number;
    cdCycles?: number;
  };
}
```

### Inspectors and agent tools

| Option               | Default | What it does                                                                                                                                                          |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inspectors.<name>`  | `true`  | `false` removes the inspector: no tab or dock, no page collector, no RPC functions, and no agent tools or resources. Its actions are blocked too.                     |
| `agent.readOnly`     | `false` | `true` drops every agent tool that acts on the page or the server: `highlight`, `form-action`, `fill-form`, `navigate`, `dispatch-ngrx-action` and `analog-call-api`. |
| `agent.tools.<name>` | `true`  | `false` hides one inspector's agent tools and resources. The tab stays.                                                                                               |

`agent.tools` has the same keys as `inspectors`. An inspector that is off has no agent tools, whatever `agent.tools` says.

If you open a tab that is turned off, the panel says so and names the `inspectors` option. With `inspectors.components` set to `false`, the [Chrome extension](./chrome-extension.md) does not follow the **Elements** panel.

### Actions

Actions are the writes that the panel and agents make to your app or the server.

| Option           | Default | What `false` blocks                                                                                                                                                               |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions.forms`  | `true`  | Form writes: set value, fill, mark touched, untouched, dirty or pristine, touch all, revalidate, reset, enable, disable, submit and restore. Drops `form-action` and `fill-form`. |
| `actions.router` | `true`  | Navigate, abort, replay and probe. Probe runs your app's `canMatch` guards. The `navigate` agent tool stays for `instrument` and `resolve-lazy` and refuses the other four.       |
| `actions.ngrx`   | `true`  | Restoring NgRx state from the change log and dispatching `@ngrx/store` actions. Drops the `dispatch-ngrx-action` agent tool.                                                      |
| `actions.http`   | `true`  | Editing fault injection rules and clearing the HTTP timeline.                                                                                                                     |
| `actions.analog` | `true`  | The Analog request playground. Drops the `analog-call-api` agent tool.                                                                                                            |
| `actions`        | `true`  | All of the above.                                                                                                                                                                 |

Pass `actions: false` to block every action, or an object to block some. Keys you leave out of the object stay on.

The server refuses a blocked action. The panel disables its controls and shows a note that names the option, for example: **Navigating is turned off in the devtools config (actions.router).**

### Redaction

| Option                  | Default | What it does                                                                                                                                                |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redaction.secretNames` | `[]`    | Extra field names to treat as secret, on top of the built-in list. They match by words, like the built-in list, so `passport` also covers `passportNumber`. |
| `redaction.unmask`      | `[]`    | Field names to show even when they look secret. They join the `unmask` list of `window.__NG_DEVTOOLS_FORMS__`.                                              |

Forms, the router, component inputs, signals, NgRx, pipes, Analog previews and SSR & HTTP URLs use the extra secret names. Each list keeps up to 100 names. See [Access and redaction](../security.md#what-is-redacted) for what is redacted and what unmasking allows.

### Limits

Values outside the bounds are clamped to the nearest one.

| Option                | Default | Bounds      | What it sets                                                   |
| --------------------- | ------- | ----------- | -------------------------------------------------------------- |
| `limits.refreshMs`    | `3000`  | 500 to 8000 | Fallback poll interval, in ms, used before the app bootstraps. |
| `limits.navigations`  | `50`    | 5 to 500    | Navigations kept per page.                                     |
| `limits.formTimeline` | `200`   | 10 to 2000  | Form timeline events kept.                                     |
| `limits.httpCalls`    | `200`   | 10 to 2000  | HTTP calls kept per page and on the server.                    |
| `limits.changeLog`    | `200`   | 10 to 2000  | NgRx change log entries kept per page.                         |
| `limits.cdCycles`     | `200`   | 10 to 2000  | Change detection cycles kept per page while recording.         |

When a timeline reaches its limit, the oldest entries are dropped. The timeline then shows a note above the list, such as "Showing the latest 200 HTTP calls. 12 older entries were dropped." with the limit to raise. This applies to the **SSR & HTTP** timeline, the router navigation timeline, the forms timeline, the NgRx change log and the change detection recording. The `explain-navigation`, `form-history` and `change-detection` agent tools add the same note, and the `ng-devtools:ngrx-store` resource reports a `dropped` count per page.

On Angular 20 and later, the page reports about 250 ms after Angular runs change detection, plus a heartbeat every 4 seconds. `refreshMs` doesn't change that. The page polls every `refreshMs` instead when it can't follow change detection, such as until the app bootstraps. The Analog inspector also reads the page every `refreshMs`. At any value, the page sends its data at least every 8 seconds, even when nothing changed, so the server never drops a page that is still open.

## Check the active configuration

The server checks the options when it starts. An unknown key, a value of the wrong type or a limit outside its bounds prints one `[ng-devtools]` warning in the terminal that lists each problem and the value used instead. An unknown key names the closest known key:

```text
[ng-devtools] The devtools config has 2 problems:
  - Unknown option `agent.readonly` was ignored. Did you mean `readOnly`?
  - `actions` should be true, false or an object, got the string "false". It was ignored, so every action is allowed.
```

A value that the server ignores falls back to its default, which is usually the open setting. Read the warning after you change the options, especially when they come from environment variables or a JavaScript file.

The [Dashboard](../inspectors/dashboard.md#configuration-block) has a **Configuration** block. It lists the options that differ from the defaults, or says **Defaults** when nothing is changed.

| Row                       | Lists                                          |
| ------------------------- | ---------------------------------------------- |
| **Inspectors off**        | Inspectors set to `false`.                     |
| **Agent**                 | **Read-only** when `agent.readOnly` is `true`. |
| **Hidden from the agent** | Inspectors whose agent tools are hidden.       |
| **Blocked actions**       | Actions set to `false`.                        |
| **Extra secret names**    | `redaction.secretNames`.                       |
| **Unmasked names**        | `redaction.unmask`.                            |
| **Limits**                | Limits that differ from the defaults.          |

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/getting-started/vite" title="Vite and Analog"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
