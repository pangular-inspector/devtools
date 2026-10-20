import { mcpContentOf } from './refusal.ts';

/** What a markdown agent tool handler answers: the text an agent reads. */
export interface MarkdownAnswer {
  markdown: string;
}

/**
 * The answer an MCP client gets for a tool result: one plain text block.
 *
 * Handlers keep answering `{ markdown }` (the panel, the tests and the
 * refusal checks read that), and the registration wrapper turns it into the
 * markdown itself, which devframe sends as the text content as is. No tool
 * declares an `outputSchema`, so no `structuredContent` copy goes with it.
 *
 * A result with its own MCP content blocks (a screenshot next to its text,
 * attached with devframe's `withMcpContent`) keeps them, and anything else (a
 * source scan's compact JSON, a string) is sent as it is.
 */
export function answerText(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  if (mcpContentOf(result) !== undefined) return result;
  const record = result as { markdown?: unknown };
  return typeof record.markdown === 'string' ? record.markdown : result;
}

/** `handler`, answering with {@link answerText} of its result. */
export function answeringText<A, R>(handler: (args: A) => R): (args: A) => Promise<unknown> {
  return async (args: A) => answerText(await handler(args));
}
