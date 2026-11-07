// The page side of the feature flag store's Pangular tab. An app imports this
// entry in development only and calls `registerFlagsPangularPlugin(store)`.
// The overlay picks the plugin up whether it loads before or after, and the
// panel shows the view in its Plugins tab.
import {
  registerPangularPlugin,
  type PangularPagePlugin,
  type PluginView,
} from '@pangular-inspector/devtools/plugin';
import { FLAGS_PLUGIN_ID, FLAGS_PLUGIN_VERSION } from './ids.ts';
import type { FlagStore } from './index.ts';

export { FLAGS_PLUGIN_ID, FLAGS_PLUGIN_VERSION };

/** The view the panel renders and agents read. */
export function flagsView(store: FlagStore): PluginView {
  const flags = store.list();
  const on = flags.filter((flag) => flag.value).length;
  const overridden = flags.filter((flag) => flag.overridden).length;
  return {
    summary: `${flags.length} ${flags.length === 1 ? 'flag' : 'flags'}, ${on} on, ${overridden} overridden`,
    badges: overridden ? [{ label: `${overridden} overridden`, tone: 'warn' }] : [],
    sections: [
      {
        kind: 'stats',
        title: 'Totals',
        items: [
          { label: 'Flags', value: flags.length },
          { label: 'On', value: on, tone: on ? 'ok' : 'neutral' },
          { label: 'Overridden', value: overridden, tone: overridden ? 'warn' : 'neutral' },
        ],
      },
      {
        kind: 'table',
        title: 'Flags',
        columns: [
          { key: 'name', label: 'Flag' },
          { key: 'value', label: 'State' },
          { key: 'default', label: 'Default' },
          { key: 'description', label: 'Description' },
        ],
        rows: flags.map((flag) => ({
          name: flag.name,
          value: { text: flag.value ? 'on' : 'off', tone: flag.overridden ? 'warn' : 'neutral' },
          default: flag.default ? 'on' : 'off',
          description: flag.description,
        })),
        empty: 'The store defines no flags.',
      },
    ],
    actions: overridden
      ? [
          {
            name: 'reset',
            label: 'Reset every flag',
            confirm: 'Put every flag back to its default?',
          },
        ]
      : [],
  };
}

/** The page plugin for one store. */
export function flagsPangularPlugin(store: FlagStore): PangularPagePlugin {
  return {
    id: FLAGS_PLUGIN_ID,
    version: FLAGS_PLUGIN_VERSION,
    title: 'Feature flags',
    description: 'Flags from the example feature flag store, with their defaults and overrides.',
    // The store changes outside Angular's change detection, so report on each
    // change instead of waiting for the next collect.
    setup: (ctx) => store.subscribe(() => ctx.push(flagsView(store))),
    collect: () => flagsView(store),
    actions: {
      set: (args) => {
        const { name, value } = (args ?? {}) as { name?: unknown; value?: unknown };
        if (typeof name !== 'string' || typeof value !== 'boolean') {
          throw new Error('Pass { name: string, value: boolean }.');
        }
        if (!store.set(name, value)) throw new Error(`There is no flag ${name}.`);
        return { name, value };
      },
      reset: () => ({ reset: store.reset() }),
    },
  };
}

/** Registers the store's tab and returns a function that removes it. */
export function registerFlagsPangularPlugin(store: FlagStore): () => void {
  return registerPangularPlugin(flagsPangularPlugin(store));
}
