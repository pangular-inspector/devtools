---
title: Ship a plugin from a library
description: Package a Pangular tab and its agent tools with your library, so every app that uses the library gets them.
---

<ngmd-hero title="Ship a plugin from a library" gradient>
  Publish the tab with your package. An app adds one provider and one Vite option, and the panel shows your library's state.
</ngmd-hero>

# Ship a plugin from a library

[Write a plugin](./write-a-plugin.md) builds a plugin inside one app. This guide puts the same parts in a library package, so the apps that install the library get its tab without writing one.

The repository has a working example: `examples/pangular-plugin-example`, a small feature flag store with its own **Feature flags** tab and two agent tools. The Analog demo (`examples/analog`) uses it. The code on this page comes from those two folders.

## Lay out the package

Keep the devtools code out of the library's main entry point. An app that never loads Pangular Inspector then never loads the plugin either.

| Entry point         | File                     | What it holds                                                   |
| ------------------- | ------------------------ | --------------------------------------------------------------- |
| `.`                 | `src/index.ts`           | The library itself. It imports nothing from Pangular Inspector. |
| `./pangular`        | `src/pangular.ts`        | The page plugin and a `register…` helper. Runs in the browser.  |
| `./pangular-server` | `src/pangular-server.ts` | The server plugin with the agent tools. Runs in Node.           |

Both devtools entry points import `@pangular-inspector/devtools/plugin` only. That entry point is small and imports neither the overlay nor the server.

Declare the devtools as an optional peer dependency, so apps without them install the library without a warning. The example's `package.json`:

```json
{
  "name": "pangular-plugin-example",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./pangular": "./src/pangular.ts",
    "./pangular-server": "./src/pangular-server.ts"
  },
  "peerDependencies": {
    "@pangular-inspector/devtools": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "@pangular-inspector/devtools": {
      "optional": true
    }
  }
}
```

The example points `exports` at TypeScript sources because it lives in this workspace. A published library points them at its built JavaScript and type declarations.

<ngmd-callout type="info" title="One plugin registry per page">
  The registry lives on <code>globalThis</code>, and every copy of the <code>/plugin</code> entry point shares it. If your build bundles its own copy of the entry point, the overlay still finds your plugin.
</ngmd-callout>

## Write the page entry

<ngmd-workflow>
  <ngmd-step title="Describe the view">
    Turn your library's state into a <code>PluginView</code>: a summary, badges, sections and the actions the panel shows as buttons.
  </ngmd-step>
  <ngmd-step title="Define the plugin">
    Give it an id, a version, a <code>collect</code> function and the page actions. If your state changes outside Angular, push a view from <code>setup</code> on each change.
  </ngmd-step>
  <ngmd-step title="Export a register helper">
    Wrap <code>registerPangularPlugin()</code>, so apps don't build the plugin themselves.
  </ngmd-step>
</ngmd-workflow>

The flag store calls its listeners on each change, which Angular does not see. The plugin subscribes in `setup` and returns the unsubscribe function as its cleanup:

```ts
// examples/pangular-plugin-example/src/pangular.ts
import {registerPangularPlugin, type PangularPagePlugin} from '@pangular-inspector/devtools/plugin';
import {FLAGS_PLUGIN_ID, FLAGS_PLUGIN_VERSION} from './ids.ts';
import type {FlagStore} from './index.ts';

// flagsView(store) builds the PluginView; it is defined just above this in the same file.
export function flagsPangularPlugin(store: FlagStore): PangularPagePlugin {
  return {
    id: FLAGS_PLUGIN_ID,
    version: FLAGS_PLUGIN_VERSION,
    title: 'Feature flags',
    description: 'Flags from the example feature flag store, with their defaults and overrides.',
    setup: (ctx) => store.subscribe(() => ctx.push(flagsView(store))),
    collect: () => flagsView(store),
    actions: {
      set: (args) => {
        const {name, value} = (args ?? {}) as {name?: unknown; value?: unknown};
        if (typeof name !== 'string' || typeof value !== 'boolean') {
          throw new Error('Pass { name: string, value: boolean }.');
        }
        if (!store.set(name, value)) throw new Error(`There is no flag ${name}.`);
        return {name, value};
      },
      reset: () => ({reset: store.reset()}),
    },
  };
}

export function registerFlagsPangularPlugin(store: FlagStore): () => void {
  return registerPangularPlugin(flagsPangularPlugin(store));
}
```

`flagsView()`, in the same file, returns a stats section and a table of flags. Its full source is in [`examples/pangular-plugin-example/src/pangular.ts`](https://github.com/pangular-inspector/devtools/blob/main/examples/pangular-plugin-example/src/pangular.ts). It lists the `reset` action while a flag is overridden. An error a page action throws reaches the agent as the tool's answer. The [sections table](./write-a-plugin.md#sections) lists every section kind.

Keep the plugin id and version in a file both entry points import (`src/ids.ts` in the example), so the page plugin and the server plugin always match.

## Write the server entry

The server plugin adds agent tools over what the page reports. A tool that runs a page action declares `safety: 'action'`, so `agent.readOnly` and the action switches drop it:

```ts
// examples/pangular-plugin-example/src/pangular-server.ts
import {definePangularServerPlugin} from '@pangular-inspector/devtools/plugin';
import {FLAGS_PLUGIN_ID, FLAGS_PLUGIN_VERSION} from './ids.ts';

const PAGE = {
  type: 'string',
  description: 'Page id, when more than one tab reports (see pangular:list-pages).',
};
const pageArg = (args: Record<string, unknown>) =>
  typeof args['page'] === 'string' ? args['page'] : undefined;

export const flagsServerPlugin = definePangularServerPlugin({
  id: FLAGS_PLUGIN_ID,
  version: FLAGS_PLUGIN_VERSION,
  title: 'Feature flags',
  tools: [
    {
      name: 'flags',
      description: 'Every flag in the feature flag store on the running page.',
      inputSchema: {type: 'object', properties: {page: PAGE}},
      handler: (args, ctx) => {
        const page = ctx.page(pageArg(args));
        if (!page?.view) return 'No page runs the feature flag store. Open the app in a browser.';
        return ctx.markdown(page.view);
      },
    },
    {
      name: 'set',
      safety: 'action',
      description: 'Turn one flag on or off on the running page until it reloads.',
      inputSchema: {
        type: 'object',
        properties: {name: {type: 'string'}, value: {type: 'boolean'}, page: PAGE},
        required: ['name', 'value'],
      },
      handler: async (args, ctx) => {
        const result = await ctx.runPageAction(
          'set',
          {name: args['name'], value: args['value']},
          {page: pageArg(args)},
        );
        if (!result.ok) return result.error ?? 'The action failed.';
        return `Turned \`${String(args['name'])}\` ${args['value'] ? 'on' : 'off'} on page \`${result.pageId}\`.`;
      },
    },
  ],
});
```

The tools register as `pangular:plugin:feature-flags:flags` and `pangular:plugin:feature-flags:set`. See [Add agent tools](./write-a-plugin.md#add-agent-tools) for the naming and length rules.

## Use it in an app

Your library lists `@pangular-inspector/devtools` as an optional peer dependency, so an app that wants the tab installs it as its own development dependency first:

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add -D @pangular-inspector/devtools
```

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install -D @pangular-inspector/devtools
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add -D @pangular-inspector/devtools
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add -D @pangular-inspector/devtools
```

Then tell the apps that use your library to make two changes.

<ngmd-workflow>
  <ngmd-step title="Register the page plugin in development">
    Load the <code>./pangular</code> entry point with a dynamic <code>import()</code> in the browser, in development builds only.
  </ngmd-step>
  <ngmd-step title="Pass the server plugin to the devtools server">
    Add it to <code>serverPlugins</code> of the Vite plugin or of <code>initPangularHub()</code>.
  </ngmd-step>
</ngmd-workflow>

The Analog demo keeps its flags in a service and registers the tab from an app initializer. The dynamic import keeps the page entry out of the main bundle:

```ts
// examples/analog/src/app/shared/feature-flags.ts
import {isPlatformBrowser} from '@angular/common';
import {
  DestroyRef,
  PLATFORM_ID,
  Service,
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import {createFlagStore} from 'pangular-plugin-example';

/** The demo's flags, kept in the example library's store. */
@Service()
export class FeatureFlags {
  readonly store = createFlagStore({
    'promo-banner': {
      default: false,
      description: 'Shows the free shipping banner on the home page.',
    },
  });
}

export function provideFeatureFlagsPangularPlugin(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const flags = inject(FeatureFlags);
    const destroyRef = inject(DestroyRef);
    void import('pangular-plugin-example/pangular').then(({registerFlagsPangularPlugin}) => {
      if (destroyRef.destroyed) return;
      destroyRef.onDestroy(registerFlagsPangularPlugin(flags.store));
    });
  });
}
```

`FeatureFlags` is the demo's service that holds the store; the real one also turns store changes into a signal for templates. `@Service()` needs Angular 22 or later. On an older version, declare the service with `@Injectable({providedIn: 'root'})`. Add `provideFeatureFlagsPangularPlugin()` to the app's providers. Then pass the server plugin to the Vite plugin:

```ts {4,8}
// examples/analog/vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {flagsServerPlugin} from 'pangular-plugin-example/pangular-server';
import {defineConfig} from 'vite';

export default defineConfig(() => ({
  plugins: [analog(), pangular({serverPlugins: [flagsServerPlugin]})],
}));
```

An Express app passes the same array to `initPangularHub({serverPlugins})`, as [Add agent tools](./write-a-plugin.md#add-agent-tools) shows.

Run `pnpm analog:dev` and open the panel. The **Plugins** tab lists **Feature flags**. Ask an agent to turn `promo-banner` on, and the banner appears on the home page.

## Test the plugin

Test the plugin the way the repository tests the example: `packages/devtools/src/__tests__/plugin-example.test.ts` registers the page plugin, runs it with the overlay's plugins collector, boots a devframe with the server plugin, and wires the two together. An agent tool call then runs the page action and returns its answer, with no browser.

For a library outside this repository, test `flagsView()` and the actions against your own store, and the tool handlers against a stub context that returns a page from `page()`.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/guides/write-a-plugin" title="Write a plugin"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
