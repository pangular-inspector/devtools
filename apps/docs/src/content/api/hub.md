---
title: '@pangular-inspector/devtools/hub'
description: 'Every symbol the @pangular-inspector/devtools/hub entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="hub" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/hub</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/hub

Import from `@pangular-inspector/devtools/hub`. This page is generated from [`packages/devtools/src/entries/hub-source.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/entries/hub-source.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## hubEnabled

Function. Source: [`packages/devtools/src/hub-off.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/hub-off.ts).

`enabled`, or on unless this is production: `NODE_ENV` is `production`, or
the server is a production Angular build (`ngDevMode` is `false`), which
the Angular CLI's SSR server is even without `NODE_ENV`.

```ts
function hubEnabled(
  enabled: boolean | undefined,
  env: Record<string, string | undefined> = processEnv(),
  warn: (message: string) => void = console.warn,
  devMode: boolean = angularDevMode(),
): boolean;
```

## initPangularHub

Function. Source: [`packages/devtools/src/hub.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/hub.ts).

Mounts the devtools hub in an Express or Connect server, behind the request
gate: loopback requests only (unless `allowLan`), a loopback or allowed
`Host`, and the origin check. Off in production unless `enabled` is `true`.

```ts
function initPangularHub(options: PangularHubOptions = {}): PangularHub;
```

## PANGULAR_HUB_BASE

Constant. Source: [`packages/devtools/src/hub.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/hub.ts).

```ts
const PANGULAR_HUB_BASE: '/__devframes/';
```

## PangularConfig

Interface. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

Options shared by `initPangularHub()`, the Vite plugin and
`createPangular()`. Everything is on when left out.

```ts
interface PangularConfig {
  /** Turn an inspector off: no tab or dock, no page collector, no RPC and no agent tools. */
  inspectors?: Partial<Record<PangularInspector, boolean>>;
  agent?: {
    /** Drop every agent tool that is not a `read` tool (see `AgentSafety`). */
    readOnly?: boolean;
    /** Hide one inspector's agent tools and resources while keeping its tab. */
    tools?: Partial<Record<PangularInspector, boolean>>;
    /**
     * Register the `read` agent tools on the page for browser agents, through
     * WebMCP (`document.modelContext`) and Chrome DevTools for agents
     * (`devtoolstooldiscovery`). Off by default, since any script on the page could
     * then call them; `true` turns them on. This is where the switch starts:
     * **Browser agent tools** in the panel's Settings changes it for every
     * page until the server restarts.
     */
    browserTools?: boolean;
  };
  /** Allow or block writes from the panel and the agent. `false` blocks them all. */
  actions?: boolean | Partial<Record<PangularAction, boolean>>;
  redaction?: {
    /**
     * Field names to treat as secret on top of the built-in list, matched by
     * words like it: `passport` also covers `passportNumber`.
     */
    secretNames?: string[];
    /** Field names to show even when they look secret, like `window.__PANGULAR_FORMS__.unmask`. */
    unmask?: string[];
  };
  limits?: {
    /**
     * How often the page polls for changes, in ms, when it can't follow change
     * detection, such as before the app bootstraps. Also sets the
     * Analog runtime refresh. Default 3000, from 500 to 8000.
     */
    refreshMs?: number;
    /** Navigations kept per page. Default 50. */
    navigations?: number;
    /** Form timeline events kept. Default 200. */
    formTimeline?: number;
    /** HTTP calls kept per page and on the server. Default 200. */
    httpCalls?: number;
    /** NgRx change log entries kept per page. Default 200. */
    changeLog?: number;
    /** Change detection cycles kept per page while recording. Default 200. */
    cdCycles?: number;
    /** Capacitor plugin calls kept per page and on the server. Default 200. */
    capacitorCalls?: number;
    /**
     * How long, in ms, pages keep sending the component tree, injectors,
     * change detection and forms after an agent's last call when no panel is
     * open. Idle pages only say they are still there, and send everything
     * again when a panel opens or an agent asks. `0` keeps them sending all
     * the time. Default 60000, up to 600000.
     */
    idleAfterMs?: number;
  };
  popup?: {
    /**
     * The keyboard shortcut that opens and closes the floating panel on the
     * page, such as `Alt+Shift+P` (the default) or `Mod+Shift+I`. `Mod` is
     * Cmd on macOS and Ctrl elsewhere. `false` turns the shortcut off.
     */
    hotkey?: string | false;
  };
  /**
   * Turn one Pangular plugin off, by its id, or only its agent tools or its
   * actions: `{ travel: false }` or `{ travel: { actions: false } }`.
   * `inspectors.plugins: false` turns every plugin off.
   */
  plugins?: Record<string, boolean | PluginSwitchInput>;
  /** Turn individual lint rules off: `{ 'img-missing-alt': false }`. */
  lint?: {
    /** Rule status by rule name. `false` turns the rule off; `true` or omitted keeps it on. */
    rules?: Record<string, boolean>;
  };
}
```

## PangularHubOptions

Type. Source: [`packages/devtools/src/hub.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/hub.ts).

```ts
type PangularHubOptions = Partial<Omit<InitHubOptions, 'devframes' | 'ui' | 'auth'>> &
  PangularConfig & {
    /**
     * The one-time code. `false` turns it off. `{tokens}` keeps it on and also
     * trusts clients that send one of the tokens, such as an app on a phone.
     */
    auth?: InitHubOptions['auth'] | PangularAuthTokens;
    /** The app's browser build folder, so a forced Client render can serve `index.csr.html`. */
    browserDistFolder?: string;
    /**
     * Mount the hub. Defaults to `process.env['NODE_ENV'] !== 'production'`. When
     * off, the middlewares only call `next()`. Passing `true` in production
     * mounts it anyway, with a warning.
     */
    enabled?: boolean;
    /**
     * Also answer other machines, such as a phone on Wi-Fi, under the same
     * origin check. Needs the one-time code on: with `auth: false` it is
     * ignored. Off by default: only this machine.
     */
    allowLan?: boolean;
    /**
     * Add a terminals dock that runs the project's own build and test
     * commands (its `build` and `test` scripts, or `ng build` and `ng test`).
     * Off by default. Only on in development, with the origin check on and
     * without `allowLan`.
     */
    terminals?: boolean;
    /** Pangular plugins' server sides: their agent tools and shared state. */
    serverPlugins?: readonly PangularServerPlugin[];
  };
```
