// The travel plugin's server side: two agent tools over what its page side
// reports. `pangular:plugin:travel:bookings` reads; `clear-saved` runs the
// page action, so it declares `safety: 'action'`.
import { definePangularServerPlugin } from '@pangular-inspector/devtools/plugin';
import { TRAVEL_PLUGIN_ID, TRAVEL_PLUGIN_VERSION } from './travel-plugin';

const PAGE = {
  type: 'string',
  description: 'Page id, when more than one tab reports (see pangular:list-pages).',
};

export const travelServerPlugin = definePangularServerPlugin({
  id: TRAVEL_PLUGIN_ID,
  version: TRAVEL_PLUGIN_VERSION,
  title: 'Travel store',
  tools: [
    {
      name: 'bookings',
      description:
        "The demo TravelStore's bookings, saved destinations and recent searches on the running page.",
      inputSchema: { type: 'object', properties: { page: PAGE } },
      handler: (args, ctx) => {
        const page = ctx.page(typeof args['page'] === 'string' ? args['page'] : undefined);
        if (!page?.view) return 'No page runs the travel plugin. Open the demo app in a browser.';
        return ctx.markdown(page.view);
      },
    },
    {
      name: 'clear-saved',
      safety: 'action',
      description: 'Remove every saved destination from the TravelStore on the running page.',
      inputSchema: { type: 'object', properties: { page: PAGE } },
      handler: async (args, ctx) => {
        const result = await ctx.runPageAction('unsave-all', undefined, {
          page: typeof args['page'] === 'string' ? args['page'] : undefined,
        });
        if (!result.ok) return result.error ?? 'The action failed.';
        const removed = (result.result as { removed?: number } | undefined)?.removed ?? 0;
        return `Removed ${removed} saved ${removed === 1 ? 'destination' : 'destinations'} on page \`${result.pageId}\`.`;
      },
    },
  ],
});
