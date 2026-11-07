// The server side of the feature flag store's Pangular tab: agent tools over
// what the page side reports. An app passes `flagsServerPlugin` to the hub or
// the Vite plugin as `serverPlugins`. It runs in Node.
import { definePangularServerPlugin } from '@pangular-inspector/devtools/plugin';
import { FLAGS_PLUGIN_ID, FLAGS_PLUGIN_VERSION } from './ids.ts';

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
  description: 'Reads and changes the example feature flag store on the running page.',
  tools: [
    {
      name: 'flags',
      description:
        'Every flag in the feature flag store on the running page, with its state, default and description. Says so when no page runs the store.',
      inputSchema: { type: 'object', properties: { page: PAGE } },
      handler: (args, ctx) => {
        const page = ctx.page(pageArg(args));
        if (!page?.view) return 'No page runs the feature flag store. Open the app in a browser.';
        return ctx.markdown(page.view);
      },
    },
    {
      name: 'set',
      safety: 'action',
      description:
        'Turn one flag on or off on the running page until it reloads. Use the `flags` tool first for the names.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The flag name.' },
          value: { type: 'boolean', description: 'true turns it on, false turns it off.' },
          page: PAGE,
        },
        required: ['name', 'value'],
      },
      handler: async (args, ctx) => {
        const result = await ctx.runPageAction(
          'set',
          { name: args['name'], value: args['value'] },
          { page: pageArg(args) },
        );
        if (!result.ok) return result.error ?? 'The action failed.';
        return `Turned \`${String(args['name'])}\` ${args['value'] ? 'on' : 'off'} on page \`${result.pageId}\`.`;
      },
    },
  ],
});
