---
title: '@pangular-inspector/devtools/devframe'
description: 'Every symbol the @pangular-inspector/devtools/devframe entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="devframe" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/devframe</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/devframe

Import from `@pangular-inspector/devtools/devframe`. This page is generated from [`packages/devtools/src/entries/devframe.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/entries/devframe.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## createPangular

Function. Source: [`packages/devtools/src/devframe.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/devframe.ts).

```ts
function createPangular(
  options: PangularConfig = {},
  host: PangularHostOptions = {},
): import('devframe').DevframeDefinition;
```

## default

Constant. Source: [`packages/devtools/src/devframe.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/devframe.ts).

```ts
const pangular: import('devframe').DevframeDefinition;
```

## DEFAULT_POPUP_HOTKEY

Constant. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

The popup shortcut when `popup.hotkey` is left out.

```ts
const DEFAULT_POPUP_HOTKEY: 'Alt+Shift+P';
```

## initDevframe

Function. Re-exported from the `devframe` package.

Serve a devframe through one framework-agnostic, web-standard handler:
the SPA, `__connection.json` discovery, the WebSocket RPC endpoint, the
auth gate, and the optional MCP route, all under a single mount base.
Mount `handler` on any framework's catch-all route (or `nodeMiddleware` on
a connect stack) and the devframe is live inside that app.

The factory is synchronous and kicks off initialization eagerly;
`handler`/`nodeMiddleware` await readiness internally. Nothing binds a port
on its own: the WebSocket resolves in precedence order: `ws.port` (pinned
side-car) > `server` (shared upgrade at `<base>__ws`) > `ws.sidecar`
(auto-port side-car) > the host driving upgrades itself through
`DevframeInstance.attach`. Meanwhile `ws.url`, when set, overrides the
advertised* endpoint (the tunnel pattern) and on its own hands the whole
transport to an external server. `__connection.json` reflects whichever
combination is active.

```ts
function initDevframe(def: DevframeDefinition, options: InitDevframeOptions): DevframeInstance;
```

## PANGULAR_ACTIONS

Constant. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

```ts
const PANGULAR_ACTIONS: readonly [
  'forms',
  'router',
  'ngrx',
  'http',
  'analog',
  'components',
  'tanstackQuery',
  'plugins',
];
```

## PANGULAR_INSPECTORS

Constant. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

```ts
const PANGULAR_INSPECTORS: readonly [
  'components',
  'injectors',
  'signals',
  'ngrx',
  'tanstackQuery',
  'forms',
  'router',
  'pipes',
  'http',
  'analog',
  'capacitor',
  'errors',
  'plugins',
];
```

## PANGULAR_LIMITS

Constant. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

Default, minimum and maximum of each `limits` option. Values outside are clamped.

```ts
const PANGULAR_LIMITS: {
  readonly refreshMs: {readonly default: 3000; readonly min: 500; readonly max: 8000};
  readonly navigations: {readonly default: 50; readonly min: 5; readonly max: 500};
  readonly formTimeline: {readonly default: 200; readonly min: 10; readonly max: 2000};
  readonly httpCalls: {readonly default: 200; readonly min: 10; readonly max: 2000};
  readonly changeLog: {readonly default: 200; readonly min: 10; readonly max: 2000};
  readonly cdCycles: {readonly default: 200; readonly min: 10; readonly max: 2000};
  readonly cdSlowMs: {readonly default: 16; readonly min: 1; readonly max: 1000};
  readonly capacitorCalls: {readonly default: 200; readonly min: 10; readonly max: 2000};
  readonly idleAfterMs: {readonly default: 60000; readonly min: 0; readonly max: 600000};
};
```

## PangularAction

Type. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

```ts
type PangularAction = (typeof PANGULAR_ACTIONS)[number];
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
    /**
     * Also mask high-entropy strings that no name or shape rule catches, such
     * as an opaque token in a harmless-looking field. Off by default. Hex
     * values (hashes, UUIDs), ULIDs and camelCase identifiers stay readable.
     * `true` uses runs of 24 characters or more and 4.5 bits per character;
     * an object sets `minLength` (16 to 512) and `threshold` (2 to 6 bits).
     */
    entropy?: boolean | {minLength?: number; threshold?: number};
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
    /**
     * A change detection cycle longer than this, in ms, counts as slow: the
     * recording flags it and the chart draws it over the line. Default 16
     * (about one frame at 60 frames per second), from 1 to 1000.
     */
    cdSlowMs?: number;
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
  analog?: {
    /**
     * A JSON Schema file, relative to the Analog project root, that the
     * frontmatter of every markdown file under `src/content` must match, such
     * as `content.schema.json`. The Content tab and `analog-lint` report the
     * files that don't. Left out, the frontmatter is only checked for syntax.
     */
    contentSchema?: string;
  };
  ngrx?: {
    /**
     * Record where each NgRx change log entry came from: the app frames of the
     * dispatch, method call or `patchState`, with origins and query strings
     * removed and secrets masked. Off by default, since taking a stack on every
     * write costs time.
     */
    trace?: boolean;
  };
}
```

## PangularHostOptions

Interface. Source: [`packages/devtools/src/devframe.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/devframe.ts).

```ts
interface PangularHostOptions {
  /**
   * Register the agent tools and resources that need a connected page. Off
   * for the stdio MCP server, which no page can reach.
   */
  pageTools?: boolean;
  /**
   * Pairing tokens a client may send to be trusted without the one-time code.
   * Server-only: they never go into the published config.
   */
  authTokens?: string[];
  /** Server plugins: agent tools and shared state of Pangular plugins (`plugin.ts`). */
  serverPlugins?: readonly PangularServerPlugin[];
  /** How the host lets clients in, for the Dashboard's security status (`security-status.ts`). */
  security?: PangularSecurityHost;
  /**
   * The folder the server scans, when it holds no Angular project (a wrong
   * `--root`). Source scan tools then refuse and name it, so the agent sees
   * why they would come back empty.
   */
  notAProject?: string;
}
```

## PangularInspector

Type. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

```ts
type PangularInspector = (typeof PANGULAR_INSPECTORS)[number];
```

## PangularLimit

Type. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

```ts
type PangularLimit = keyof typeof PANGULAR_LIMITS;
```

## PluginSwitchInput

Interface. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

What a `plugins` entry can turn off; each is on when left out.

```ts
interface PluginSwitchInput {
  enabled?: boolean;
  /** The plugin's agent tools. */
  tools?: boolean;
  /** The plugin's actions: page actions run from the panel and its action agent tools. */
  actions?: boolean;
}
```

## ResolvedPangularConfig

Interface. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

```ts
interface ResolvedPangularConfig {
  inspectors: Record<PangularInspector, boolean>;
  agent: {
    readOnly: boolean;
    tools: Record<PangularInspector, boolean>;
    browserTools: boolean;
  };
  actions: Record<PangularAction, boolean>;
  /** `entropy` is set only when it is on, so a default config keeps its two lists. */
  redaction: {secretNames: string[]; unmask: string[]; entropy?: EntropyOptions};
  limits: Record<PangularLimit, number>;
  popup: {hotkey: string | false};
  /** The `plugins` entries that were given, by plugin id. */
  plugins: Record<string, PluginSwitches>;
  lint: {
    rules: Record<string, boolean>;
  };
  /** `contentSchema` is left out when it is not set. */
  analog: {contentSchema?: string};
  ngrx: {trace: boolean};
}
```

## resolvePangularConfig

Function. Source: [`packages/devtools/src/config.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/config.ts).

```ts
function resolvePangularConfig(config?: unknown): ResolvedPangularConfig;
```
