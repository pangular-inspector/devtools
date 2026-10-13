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

| Function            | Import                                  | Setup                                                           |
| ------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `initPangularHub()` | `@pangular-inspector/devtools/hub`      | [Angular CLI and Express](./express.md)                         |
| `pangular()`        | `@pangular-inspector/devtools/vite`     | [Vite and Analog](./vite.md)                                    |
| `createPangular()`  | `@pangular-inspector/devtools/devframe` | A custom devframe host, such as `initDevframe()` without a hub. |

The `pangular` binary reads the same options from a JSON file, for `dev`, `build` and `mcp`. See [Config file](./cli.md#config-file).

The access options stay with the server. The Express hub and the Vite plugin trust the [Chrome extension](./chrome-extension.md#server-origin) by its fixed ID, with no setting. A build of the extension with another ID needs its `chrome-extension://<id>` origin in `allowedOrigins`.

### Express hub

Pass the options next to the [access options](../security.md#express-hub) `auth`, `allowedOrigins` and `mcp`:

```ts {8-10}
// src/server.ts
import express from 'express';
import {initPangularHub} from '@pangular-inspector/devtools/hub';

const app = express();
const devtools = initPangularHub({
  ws: false,
  inspectors: {pipes: false},
  agent: {readOnly: true},
  redaction: {secretNames: ['passport', 'taxId']},
});
app.use(devtools.nodeMiddleware);
```

### Vite plugin

Pass them to `pangular()`, next to the [access options](../security.md#vite-plugin) `auth` and `allowedOrigins`:

```ts {9-12}
// vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [
    analog(),
    pangular({
      actions: {http: false, analog: false},
      limits: {refreshMs: 1000, navigations: 100},
    }),
  ],
});
```

### Custom devframe host

The default export of `@pangular-inspector/devtools/devframe` uses the defaults. Call `createPangular()` to pass options:

```ts {6-8}
// src/server.ts
import express from 'express';
import {createPangular, initDevframe} from '@pangular-inspector/devtools/devframe';

const app = express();
const devtools = initDevframe(createPangular({agent: {readOnly: true}}), {
  base: '/__pangular/',
});
app.use(devtools.nodeMiddleware);
```

## The options

### Type

`@pangular-inspector/devtools/config` exports the type. The hub and Vite entry points export it too.

```ts
// @pangular-inspector/devtools/config
type PangularInspector =
  | 'components'
  | 'injectors'
  | 'signals'
  | 'ngrx'
  | 'forms'
  | 'router'
  | 'pipes'
  | 'http'
  | 'analog'
  | 'capacitor'
  | 'errors';

type PangularAction = 'forms' | 'router' | 'ngrx' | 'http' | 'analog' | 'components';

interface PangularConfig {
  inspectors?: Partial<Record<PangularInspector, boolean>>;
  agent?: {readOnly?: boolean; tools?: Partial<Record<PangularInspector, boolean>>};
  actions?: boolean | Partial<Record<PangularAction, boolean>>;
  redaction?: {secretNames?: string[]; unmask?: string[]};
  limits?: {
    refreshMs?: number;
    navigations?: number;
    formTimeline?: number;
    httpCalls?: number;
    changeLog?: number;
    cdCycles?: number;
    capacitorCalls?: number;
    idleAfterMs?: number;
  };
  popup?: {hotkey?: string | false};
}
```

### Inspectors and agent tools

| Option               | Default | What it does                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inspectors.<name>`  | `true`  | `false` removes the inspector: no tab or dock, no page collector, no RPC functions, and no agent tools or resources. Its actions are blocked too.                                                                                                                                                                                                                       |
| `agent.readOnly`     | `false` | `true` keeps only the agent tools in the `read` [safety tier](../agents/tools.md#action-tools). It drops `form-action`, `fill-form`, `navigate`, `dispatch-ngrx-action`, `set-http-rule`, `remove-http-rule`, `set-component-property`, `set-signal`, `record-pipes`, `analog-call-api` and `clear-recordings`. `change-detection` stays without its `record` argument. |
| `agent.tools.<name>` | `true`  | `false` hides one inspector's agent tools and resources, and its [shared-state keys](../agents/resources.md#shared-state) over HTTP MCP. The tab stays.                                                                                                                                                                                                                 |

`agent.tools` has the same keys as `inspectors`. An inspector that is off has no agent tools, whatever `agent.tools` says.

If you open a tab that is turned off, the panel says so, shows the option that turns it back on, such as `inspectors: {ngrx: true}`, and links to this section. With `inspectors.components` set to `false`, the [Chrome extension](./chrome-extension.md) does not follow the **Elements** panel.

### Actions

Actions are the writes that the panel and agents make to your app or the server.

| Option               | Default | What `false` blocks                                                                                                                                                                                                |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `actions.forms`      | `true`  | Form writes: set value, fill, mark touched, untouched, dirty or pristine, touch all, revalidate, reset, enable, disable, submit and restore. Drops `form-action` and `fill-form`.                                  |
| `actions.router`     | `true`  | Navigate, abort, replay and probe, and clearing the navigations list. Drops router clearing in `clear-recordings`. The `navigate` agent tool stays for `instrument` and `resolve-lazy` and refuses the other four. |
| `actions.ngrx`       | `true`  | Restoring NgRx state from the change log and dispatching `@ngrx/store` actions. Drops the `dispatch-ngrx-action` agent tool.                                                                                       |
| `actions.http`       | `true`  | Editing fault injection rules and SSR overrides, and clearing the HTTP timeline. Drops the `set-http-rule` and `remove-http-rule` agent tools and HTTP clearing in `clear-recordings`.                             |
| `actions.analog`     | `true`  | The Analog request playground and clearing server calls. Drops the `analog-call-api` agent tool and Analog clearing in `clear-recordings`.                                                                         |
| `actions.components` | `true`  | Editing component inputs, properties and writable signals from the **Components** tab. Drops the `set-component-property` and `set-signal` agent tools.                                                            |
| `actions`            | `true`  | All of the above.                                                                                                                                                                                                  |

Pass `actions: false` to block every action, or an object to block some. Keys you leave out of the object stay on.

`actions.forms` leaves the panel's **Record details** and **Store as global** on. They don't change the form: **Record details** wraps form methods to record who called them, and **Store as global** sets `$form` and `$control` in the page console only when the page has not defined them itself.

The server refuses a blocked action, and with `actions.components` the page refuses it too. The panel disables its controls (the **Components** tab hides **Edit**) and shows a note that names the option, for example: **Navigating and clearing navigations is turned off in the devtools config (actions.router).**

### Redaction

| Option                  | Default | What it does                                                                                                                                                |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redaction.secretNames` | `[]`    | Extra field names to treat as secret, on top of the built-in list. They match by words, like the built-in list, so `passport` also covers `passportNumber`. |
| `redaction.unmask`      | `[]`    | Field names to show even when they look secret. They join the `unmask` list of `window.__PANGULAR_FORMS__`.                                                 |

Forms, the router, component inputs, signals, NgRx, pipes, Analog previews, SSR & HTTP URLs and Capacitor plugin calls use the extra secret names. Each list keeps up to 100 names. See [Access and redaction](../security.md#what-is-redacted) for what is redacted and what unmasking allows.

### Limits

Values outside the bounds are clamped to the nearest one.

| Option                  | Default | Bounds      | What it sets                                                                                           |
| ----------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `limits.refreshMs`      | `3000`  | 500 to 8000 | Fallback poll interval, in ms, used before the app bootstraps.                                         |
| `limits.navigations`    | `50`    | 5 to 500    | Navigations kept per page.                                                                             |
| `limits.formTimeline`   | `200`   | 10 to 2000  | Form timeline events kept.                                                                             |
| `limits.httpCalls`      | `200`   | 10 to 2000  | HTTP calls kept per page and on the server.                                                            |
| `limits.changeLog`      | `200`   | 10 to 2000  | NgRx change log entries kept per page.                                                                 |
| `limits.cdCycles`       | `200`   | 10 to 2000  | Change detection cycles kept per page while recording.                                                 |
| `limits.capacitorCalls` | `200`   | 10 to 2000  | [Capacitor](../inspectors/capacitor.md) plugin calls kept per page and on the server.                  |
| `limits.idleAfterMs`    | `60000` | 0 to 600000 | How long pages keep sending after an agent's last call while no panel is open. `0` keeps them sending. |

When a timeline reaches its limit, the oldest entries are dropped. The timeline then shows a note above the list, such as "Showing the latest 200 HTTP calls. 12 older entries were dropped." with the limit to raise. This applies to the **SSR & HTTP** timeline, the router navigation timeline, the forms timeline, the NgRx change log, the change detection recording and the Capacitor plugin calls. The `explain-navigation`, `form-history` and `change-detection` agent tools add the same note, and the `pangular:ngrx-store` resource reports a `dropped` count per page.

On Angular 20 and later, the page reports about 250 ms after Angular runs change detection, plus a heartbeat every 4 seconds. `refreshMs` doesn't change that. The page polls every `refreshMs` instead when it can't follow change detection, such as until the app bootstraps. The Analog inspector also reads the page every `refreshMs`. At any value, the page sends its data at least every 8 seconds, even when nothing changed, so the server never drops a page that is still open.

### Performance

The component tree, injectors, change detection recording and forms cost the most to read and send on a large app, so the page keeps them cheap:

- After one full report, the page sends only what changed. If the server lost track (a restart, a lost message), it asks for the whole report again.
- The page sends each of them at most once a second, also while you type in a form. Changes in between go out together in the next report, so the forms timeline keeps every event. A form action from the panel or an agent is sent at once.
- The component tree is read again only when elements were added or removed, or every 4 seconds.
- The page sends them only while someone watches: a panel is open (the popup, the hub or the Chrome extension), or an agent called a tool in the last `limits.idleAfterMs`. An idle page only says it is still open. The forms timeline keeps recording meanwhile. When a panel opens or an agent calls a tool, the page sends what changed meanwhile, and the agent's call waits up to 1.5 seconds for it. An agent call made during that wait waits for the same reports. A tab that closed or stopped reporting is not waited for.

In the panel, the component tree, the HTTP call table, and the NgRx change log and events render only the rows near view when they have more than 300. Rows out of view are not in the page, so the browser's find doesn't see them. Use the tab's search field to search every row.

### Popup

| Option         | Default       | What it does                                                                                                                    |
| -------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `popup.hotkey` | `Alt+Shift+P` | The shortcut that opens and closes the [popup](./popup-and-hub.md#keyboard-and-mouse) on your app's page. `false` turns it off. |

Write the shortcut as modifiers and one key joined with `+`, such as `Mod+Shift+K` or `Ctrl+Alt+D`:

| Part      | Values                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Modifiers | `Mod` (<kbd>Cmd</kbd> on macOS, <kbd>Ctrl</kbd> elsewhere), `Ctrl`, `Meta` or `Cmd`, `Alt` or `Option`, `Shift` |
| Key       | One letter, one digit, or `F1` to `F12`                                                                         |

It needs at least one modifier other than `Shift`, so typing in your app never sets it off. Letters and digits match by key position, so an <kbd>Option</kbd> combination that types another character on macOS still works. A value that is not a shortcut prints a warning and keeps `Alt+Shift+P`.

```ts {6}
// src/server.ts
import {initPangularHub} from '@pangular-inspector/devtools/hub';

const devtools = initPangularHub({
  ws: false,
  popup: {hotkey: 'Mod+Shift+K'},
});
```

The overlay reads the option from the server when it connects, so the default works until then. With `false`, [passive mode](./settings.md#passive-mode) has no effect and the floating button always shows.

### Terminals

`terminals` is an option of the Express hub and the Vite plugin only, next to the access options. It is not part of `PangularConfig`, so `createPangular()` and the CLI config file don't take it.

| Option      | Default | What it does                                                                                                                                                                                                |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terminals` | `false` | `true` adds a **Terminals** dock to the hub that runs the project's build and test commands. It stays off in production, with `allowedOrigins: false` and with `allowLan`. See [Terminals](./terminals.md). |

It is off by default because it starts processes on your machine. A value other than `true` or `false` prints a warning and keeps it off.

## Check the active configuration

The server checks the options when it starts. An unknown key, a value of the wrong type or a limit outside its bounds prints one `[pangular]` warning in the terminal that lists each problem and the value used instead. An unknown key names the closest known key:

```text
[pangular] The devtools config has 2 problems:
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
| **Popup shortcut**        | `popup.hotkey`, or **Off** when it is `false`. |

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/getting-started/vite" title="Vite and Analog"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
