import { countRedactedText, redactionNote } from '../redaction-count.ts';
import { mcpContentOf } from './refusal.ts';
import { UNTRUSTED } from './forms-tools.ts';

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

/**
 * A markdown answer that holds masked values, with a last line that says how
 * many (`redactionNote`). Counting is one scan of the finished text for the
 * masks the redaction helpers write, so it costs little next to building the
 * answer. JSON answers stay JSON a client can parse, so they get no line,
 * and an answer that ends with a fenced file gets the line above the file.
 */
export function withRedactionNote(text: string): string {
  const body = text.startsWith(UNTRUSTED) ? text.slice(UNTRUSTED.length).trimStart() : text;
  if (body.startsWith('{') || body.startsWith('[')) return text;
  const count = countRedactedText(text);
  if (!count) return text;
  // An answer that ends with a file to copy (an export) keeps the file last.
  const trimmed = text.trimEnd();
  const closing = trimmed.endsWith('```') ? trimmed.lastIndexOf('\n```') : -1;
  const fence = closing > 0 ? trimmed.lastIndexOf('\n```', closing - 1) : -1;
  if (fence > 0) {
    return `${text.slice(0, fence).trimEnd()}\n\n${redactionNote(count)}\n${text.slice(fence)}`;
  }
  return `${text}\n\n${redactionNote(count)}`;
}

/** `handler`, answering with {@link answerText} of its result, noting the values redaction masked. */
export function answeringText<A, R>(handler: (args: A) => R): (args: A) => Promise<unknown> {
  return async (args: A) => {
    const answer = answerText(await handler(args));
    return typeof answer === 'string' ? withRedactionNote(answer) : answer;
  };
}
