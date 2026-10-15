import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

/** What a markdown agent tool answers: the text an agent reads. */
export interface MarkdownAnswer {
  markdown: string;
}

/** The valibot schema of {@link MarkdownAnswer}, the source of {@link MARKDOWN_OUTPUT_SCHEMA}. */
export const MarkdownAnswerSchema = v.object({
  markdown: v.pipe(v.string(), v.description('The answer as markdown.')),
});

/**
 * The MCP `outputSchema` of a tool whose every answer is `{ markdown }`.
 *
 * Devframe sends a tool's result as the text content (its JSON) and, when the
 * tool has an output schema, the same object as `structuredContent`. So the
 * text a client reads stays exactly what it was, and a client that reads
 * `structuredContent` gets the markdown without parsing the text.
 *
 * Give it only to tools that always answer `{ markdown: string }` and nothing
 * else: MCP clients check `structuredContent` against it. A tool that returns
 * an array or a string, or sends its own `mcpContent` blocks, must not have one.
 */
export const MARKDOWN_OUTPUT_SCHEMA = toJsonSchema(MarkdownAnswerSchema, {
  target: 'draft-2020-12',
});
