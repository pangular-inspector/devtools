/**
 * Refusals: the answers an agent tool gives when it cannot do what it was
 * asked (a missing or wrong argument, a page that is not reporting, an action
 * the config turns off). MCP marks them with `isError: true`, so a client can
 * tell a refusal from an answer without reading the text.
 *
 * Tool handlers and their helpers build refusals as text with
 * {@link refusal}, so a handler called directly (in tests, or by the panel)
 * still gets its usual `{ markdown }` answer. The registration wrapper then
 * checks the answer with {@link refusalOf} and turns a refusal into a thrown
 * {@link ToolRefusal}, which devframe sends as a tool result with `isError`.
 */

/** The refusal texts handed out lately. Bounded, since a helper may build one that is never sent. */
const refused = new Set<string>();
const MAX_REMEMBERED = 256;

/** Marks `text` as a refusal and returns it unchanged. */
export function refusal(text: string): string {
  refused.delete(text);
  refused.add(text);
  if (refused.size > MAX_REMEMBERED) refused.delete(refused.values().next().value as string);
  return text;
}

/**
 * A refusal answer whose text other answers share, such as "no page
 * reports". {@link refusal} marks the text itself, so a read tool that
 * answers the same text would turn into a refusal too; this marks only
 * this answer.
 */
export function refusedAnswer(text: string): { markdown: string; refused: true } {
  return { markdown: text, refused: true };
}

/** Whether `text` was built with {@link refusal}. */
export function isRefusal(text: unknown): text is string {
  return typeof text === 'string' && refused.has(text);
}

/** The key devframe's `withMcpContent` stores a result's MCP content blocks under. */
const MCP_CONTENT = Symbol.for('devframe:mcp-content');

/** The MCP content blocks attached with devframe's `withMcpContent`, or undefined. */
export function mcpContentOf(result: unknown): unknown {
  if (!result || typeof result !== 'object') return undefined;
  return (result as Record<symbol, unknown>)[MCP_CONTENT];
}

/**
 * The refusal text of a tool answer (a string, `{ markdown }`, or one text
 * block in its MCP content), or undefined for an ordinary answer.
 */
export function refusalOf(result: unknown): string | undefined {
  if (isRefusal(result)) return result;
  if (!result || typeof result !== 'object') return undefined;
  const record = result as { markdown?: unknown; refused?: unknown };
  if (isRefusal(record.markdown)) return record.markdown;
  if (record.refused === true && typeof record.markdown === 'string') return record.markdown;
  const blocks = mcpContentOf(result);
  if (Array.isArray(blocks) && blocks.length === 1) {
    const text = (blocks[0] as { text?: unknown } | null)?.text;
    if (isRefusal(text)) return text;
  }
  return undefined;
}

/**
 * A tool call that was refused. Devframe answers a thrown error with
 * `isError: true` and `<name>: <message>`, so the name says what went wrong.
 */
export class ToolRefusal extends Error {
  constructor(message: string, name: 'Refused' | 'Invalid arguments' = 'Refused') {
    // A message that already opens with "Refused:" keeps one.
    super(name === 'Refused' ? message.replace(/^Refused:\s*/, '') : message);
    this.name = name;
  }
}
