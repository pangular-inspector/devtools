---
title: '@pangular-inspector/devtools/vite'
description: 'Every symbol the @pangular-inspector/devtools/vite entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="vite" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/vite</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/vite

Import from `@pangular-inspector/devtools/vite`. This page is generated from [`packages/devtools/src/entries/vite.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/entries/vite.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## default

Function. Source: [`packages/devtools/src/vite.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/vite.ts).

```ts
function pangularVite(options: PangularViteOptions = {}): Plugin;
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

## PangularViteOptions

Interface. Source: [`packages/devtools/src/vite.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/vite.ts).

```ts
interface PangularViteOptions extends PangularConfig {
  base?: string;
  apiPrefix?: string;
  allowedOrigins?: string[];
  /**
   * The one-time code: on, off, or on with pairing tokens (`{tokens}`) that a
   * client may send instead. On by default, along with the MCP token.
   */
  auth?: boolean | PangularAuthTokens;
  /**
   * Also answer requests from other machines, such as a phone on Wi-Fi, when
   * their origin is in `allowedOrigins`. Needs the one-time code on: with
   * `auth: false` it is ignored. Off by default: only this machine.
   */
  allowLan?: boolean;
  /**
   * Add the overlay to the pages the dev server serves. On by default; pass
   * `false` to load it yourself, for example with `initOverlay` options.
   */
  overlay?: boolean;
  /**
   * Add a terminals dock that runs the project's own build and test commands
   * (its `build` and `test` scripts, or `ng build` and `ng test`). Off by
   * default. Ignored with `allowLan`.
   */
  terminals?: boolean;
  /**
   * Inject the dev server's LAN address into the app as `__PANGULAR_LAN_URL__`,
   * so a phone app (Capacitor, NativeScript) built in development mode finds
   * the devtools. `true` picks this machine's address; a string names one,
   * such as `'192.168.1.20'`. Off by default. Needs `allowLan` in effect and
   * `server.host` on the network; it changes nothing about who may connect.
   */
  lanAddress?: boolean | string;
  /** Pangular plugins' server sides: their agent tools and shared state. */
  serverPlugins?: readonly PangularServerPlugin[];
  /**
   * Other devframes to mount on the same hub, after Pangular Inspector: the
   * same input as `initHub({ devframes })`. Each gets its own dock and runs
   * behind the plugin's request gate and one-time code.
   */
  extraDevframes?: DevframesInput;
}
```
