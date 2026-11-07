# pangular-plugin-example

An example library that ships its own Pangular Inspector tab. It is a small feature flag store, standing in for any library (a store add-on, a query cache, a UI kit) that wants to show its state in the panel and to agents.

| Entry point         | File                     | What it holds                                                                                   |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `.`                 | `src/index.ts`           | `createFlagStore()`, the library. It imports nothing from Pangular Inspector.                   |
| `./pangular`        | `src/pangular.ts`        | The page plugin (`flagsPangularPlugin`, `registerFlagsPangularPlugin`) for the **Plugins** tab. |
| `./pangular-server` | `src/pangular-server.ts` | `flagsServerPlugin`, with the `flags` (read) and `set` (action) agent tools.                    |

The Analog demo (`examples/analog`) uses it: `src/app/shared/feature-flags.ts` registers the tab and `vite.config.ts` passes `flagsServerPlugin` to the Vite plugin. `packages/devtools/src/__tests__/plugin-example.test.ts` loads both entry points and runs a tool call through to the page action.

The guide is [Ship a plugin from a library](../../apps/docs/src/content/guides/ship-a-plugin.md).
