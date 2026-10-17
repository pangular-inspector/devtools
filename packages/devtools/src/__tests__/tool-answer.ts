import { ToolRefusal } from '../rpc/refusal.ts';

/** What an MCP client reads from a tool call: the answer, and whether it came with `isError`. */
export interface ToolAnswer {
  markdown: string;
  isError: boolean;
}

/**
 * Runs an agent tool call the way the MCP adapter does: a refusal (a thrown
 * {@link ToolRefusal}) becomes its text with `isError`, like the result a
 * client gets. Any other error is rethrown.
 */
export async function toolAnswer(call: Promise<unknown>): Promise<ToolAnswer> {
  try {
    const result = (await call) as { markdown?: unknown } | string;
    const markdown = typeof result === 'string' ? result : String(result?.markdown ?? '');
    return { markdown, isError: false };
  } catch (error) {
    if (error instanceof ToolRefusal) return { markdown: error.message, isError: true };
    throw error;
  }
}

/** The markdown of {@link toolAnswer}, refusal or not. */
export async function answerText(call: Promise<unknown>): Promise<string> {
  return (await toolAnswer(call)).markdown;
}
