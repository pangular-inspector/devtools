import type { InitHubOptions } from '@devframes/hub/initiate';
import createMessagesDevframe, { PLUGIN_ID } from '@devframes/plugin-messages';

/**
 * Adds the Messages devframe to the hub before the app's own `configure` runs,
 * mounted under the hub `base` like the Pangular devframe, so the same request
 * gate covers it. The hub UI lists the feed and raises its toasts through the
 * RPCs this devframe registers (`devframes:plugin:messages:list` and the rest),
 * which read and write the hub's own `ctx.messages`: no second store is kept.
 * Its panel is served from the installed `@devframes/plugin-messages--assets`.
 */
export function withMessagesPanel<T extends Pick<InitHubOptions, 'configure'>>(
  options: T,
  hubBase: string,
): T {
  const { configure } = options;
  return {
    ...options,
    configure: async (ctx) => {
      await ctx.install(createMessagesDevframe(), { base: `${hubBase}${PLUGIN_ID}/` });
      await configure?.(ctx);
    },
  };
}
