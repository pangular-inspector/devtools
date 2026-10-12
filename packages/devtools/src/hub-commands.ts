import { panelCommands, type PanelCommand, type ResolvedPangularConfig } from './config.ts';
import { ALL_TOOLS_DOCK_ID } from './hub-docks.ts';

/** The broadcast that tells connected panels to run a command, without the `pangular:` prefix. */
export const PANEL_COMMAND_EVENT = 'panel-command';

/** What `PANEL_COMMAND_EVENT` carries. */
export interface PanelCommandMessage {
  command: string;
}

interface HubCommandInput {
  id: string;
  title: string;
  category?: string;
  description?: string;
  handler?: () => void;
  showInPalette?: boolean | 'without-children';
  children?: HubCommandInput[];
}

interface HubCommandsContext {
  commands: { register: (command: HubCommandInput) => unknown };
  docks?: { activate?: (dockId: string) => void };
}

function hasCommands(ctx: unknown): ctx is HubCommandsContext {
  const commands = (ctx as { commands?: { register?: unknown } } | null)?.commands;
  return typeof commands?.register === 'function';
}

const CATEGORY = 'Pangular Inspector';

/** Commands that need the panel on screen, so the hub opens All tools first. */
function showsPanel(command: PanelCommand): boolean {
  return command.group === 'Go to' || command.group === 'Actions';
}

/**
 * Registers the panel's commands in the hub's command palette through
 * `ctx.commands`, under `pangular:`. Running one asks the connected panels
 * to run it (`run`), after opening the **All tools** dock when the command
 * shows something. Popup dock modes stay out: the hub has its own. Returns
 * the registered ids, or `undefined` outside a hub.
 */
export function registerHubCommands(
  ctx: unknown,
  config: ResolvedPangularConfig,
  run: (message: PanelCommandMessage) => void,
): string[] | undefined {
  if (!hasCommands(ctx)) return undefined;
  const commands = panelCommands(config).filter((command) => !command.popupOnly);
  const toInput = (command: PanelCommand): HubCommandInput => ({
    id: `pangular:${command.id}`,
    title: command.title,
    category: CATEGORY,
    handler: () => {
      if (showsPanel(command)) ctx.docks?.activate?.(ALL_TOOLS_DOCK_ID);
      run({ command: command.id });
    },
  });
  const tabs = commands.filter((command) => command.id.startsWith('tab:'));
  const rest = commands.filter((command) => !command.id.startsWith('tab:'));
  // One parent for the tabs, so the palette can also be browsed tab by tab.
  ctx.commands.register({
    id: 'pangular:tabs',
    title: 'Pangular: open a tab',
    category: CATEGORY,
    children: tabs.map(toInput),
  });
  for (const command of rest) ctx.commands.register(toInput(command));
  return ['pangular:tabs', ...commands.map((command) => `pangular:${command.id}`)];
}
