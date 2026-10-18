import { AGENT_ENTRIES } from '../config.ts';
import { code } from './forms-tools.ts';
import { refusedAnswer } from './refusal.ts';

/**
 * The answer of a source scan tool when the server scans a folder with no
 * Angular project in it, such as an MCP client that starts the stdio server
 * in `/`. The warning on stderr never reaches the agent, so every source scan
 * says it instead of answering an empty list.
 */
export function notAProjectText(root: string): string {
  return `The server scans ${code(root)}, which has no angular.json and no package.json that depends on @angular/core, so this source scan has nothing to read. An empty answer here would not mean the app has none. Restart the server with \`--root <project folder>\` or set \`PANGULAR_ROOT\`.`;
}

/** NgRx session tools read an imported session, not the source, so they keep working. */
const SESSION_TOOLS = new Set(['ngrx-inspect-entry', 'ngrx-import-session', 'ngrx-generate-test']);

/** Whether an agent tool answers from the project's source (not from a page or a session). */
export function readsSource(id: string): boolean {
  const name = id.replace(/^pangular:/, '');
  const entry = AGENT_ENTRIES[name];
  return !!entry && !entry.page && !SESSION_TOOLS.has(name);
}

/** `tool` with a handler that always refuses with `text`. */
export function refusingTool<T extends { handler: unknown }>(tool: T, text: string): T {
  return { ...tool, handler: async () => refusedAnswer(text) };
}
