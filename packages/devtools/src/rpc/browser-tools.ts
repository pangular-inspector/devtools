import { argsToJsonSchema, stringifyForMcp } from 'devframe/internal';
import { toAgentToolName } from 'devframe/utils/agent-tool-name';
import { redactJsonText } from '../json-text-redact.ts';
import { isSecretName, redactText } from '../serialize.ts';

/**
 * The `read` agent tools a page registers for browser agents (WebMCP and
 * Chrome DevTools for agents). The page lists them with `list-browser-tools`
 * and runs them with `call-browser-tool`, so each call goes through the same
 * handler, config checks and redaction as an MCP call.
 */

export const LIST_BROWSER_TOOLS = 'list-browser-tools';
export const CALL_BROWSER_TOOL = 'call-browser-tool';

/** What the page registers: the MCP name, so a tool has one name everywhere. */
export interface BrowserTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface BrowserToolAnswer {
  text: string;
  isError?: boolean;
}

interface ListedTool {
  id: string;
  kind: 'rpc' | 'tool';
  title?: string;
  description: string;
  safety: 'read' | 'action' | 'destructive';
  rpcName?: string;
  args?: readonly unknown[];
  inputSchema?: unknown;
}

/** The parts of the devframe context the browser tools use. */
export interface BrowserToolHost {
  agent: {
    list(): { tools: readonly ListedTool[] };
    invoke(id: string, args: unknown): Promise<unknown>;
  };
  rpc: { definitions: { get(name: string): { args?: readonly unknown[] } | undefined } };
}

const MAX_TEXT = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function schemaOf(tool: ListedTool, host: BrowserToolHost): Record<string, unknown> {
  let schema: unknown = tool.inputSchema;
  if (schema === undefined) {
    const args =
      tool.kind === 'rpc' && tool.rpcName
        ? host.rpc.definitions.get(tool.rpcName)?.args
        : tool.args;
    try {
      schema = argsToJsonSchema(args as Parameters<typeof argsToJsonSchema>[0]);
    } catch {
      schema = undefined;
    }
  }
  return isRecord(schema) ? schema : { type: 'object', properties: {} };
}

/**
 * The Pangular tools that only read, as the server registered them under the
 * config: `inspectors`, `agent.tools` and `agent.readOnly` already decided
 * which exist, and `action` and `destructive` tools never reach the page.
 */
export function browserTools(host: BrowserToolHost): BrowserTool[] {
  const out: BrowserTool[] = [];
  const seen = new Set<string>();
  for (const tool of host.agent.list().tools) {
    if (!tool.id.startsWith('pangular:') || tool.safety !== 'read') continue;
    const name = toAgentToolName(tool.id);
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      ...(tool.title && tool.title !== tool.id ? { title: tool.title } : {}),
      description: tool.description,
      inputSchema: schemaOf(tool, host),
    });
  }
  return out;
}

/** Masks secrets in a tool's answer: secret JSON keys, credentials, JWTs and bearer tokens. */
export function redactAnswer(text: string): string {
  return redactText(redactJsonText(text, isSecretName));
}

function textOf(result: unknown): string {
  const markdown = isRecord(result) ? result['markdown'] : undefined;
  const text = typeof markdown === 'string' ? markdown : stringifyForMcp(result);
  return text.length > MAX_TEXT
    ? `${text.slice(0, MAX_TEXT)}\n\n… cut at ${MAX_TEXT} characters. Narrow the call with its arguments.`
    : text;
}

/**
 * The arguments for a call from a page: a tool that takes `page` (or
 * `pageId`) answers for the calling page unless the agent named another one.
 */
export function scopedArgs(
  tool: BrowserTool,
  args: unknown,
  pageId: string,
): Record<string, unknown> {
  const out = isRecord(args) ? { ...args } : {};
  const properties = isRecord(tool.inputSchema['properties']) ? tool.inputSchema['properties'] : {};
  if ('page' in properties) {
    if (out['page'] === undefined && out['pageId'] === undefined) out['page'] = pageId;
  } else if ('pageId' in properties && out['pageId'] === undefined) {
    out['pageId'] = pageId;
  }
  return out;
}

export interface BrowserToolOptions {
  /** `agent.browserTools`: off answers no tools and refuses calls. */
  enabled: boolean;
  /** Whether the calling connection owns `pageId` (the shared owner check). */
  owns: (pageId: unknown) => pageId is string;
}

export async function callBrowserTool(
  host: BrowserToolHost,
  message: unknown,
  options: BrowserToolOptions,
): Promise<BrowserToolAnswer> {
  if (!options.enabled) {
    return { text: 'Browser tools are turned off (agent.browserTools).', isError: true };
  }
  const request = isRecord(message) ? message : {};
  const pageId = request['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50 || !options.owns(pageId)) {
    return { text: 'This page is not connected to the devtools server.', isError: true };
  }
  const name = request['name'];
  const tool = browserTools(host).find((entry) => entry.name === name);
  if (!tool) {
    return {
      text: `No read-only devtools tool named ${JSON.stringify(String(name)).slice(0, 140)}.`,
      isError: true,
    };
  }
  const id = host.agent.list().tools.find((entry) => toAgentToolName(entry.id) === tool.name)!.id;
  try {
    const result = await host.agent.invoke(id, scopedArgs(tool, request['args'], pageId));
    return { text: redactAnswer(textOf(result)) };
  } catch (error) {
    const reason = (error as Error)?.message ?? String(error);
    return { text: redactAnswer(`${tool.name} failed: ${reason}`.slice(0, 2000)), isError: true };
  }
}

type Register = (definition: {
  name: string;
  type: 'query' | 'action';
  jsonSerializable: true;
  handler: (...args: any[]) => unknown;
}) => void;

/** Registers `list-browser-tools` and `call-browser-tool` (shared RPC functions, not agent tools). */
export function registerBrowserTools(
  register: Register,
  host: BrowserToolHost,
  options: BrowserToolOptions,
) {
  register({
    name: LIST_BROWSER_TOOLS,
    type: 'query',
    jsonSerializable: true,
    handler: () => (options.enabled ? browserTools(host) : []),
  });
  register({
    name: CALL_BROWSER_TOOL,
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => callBrowserTool(host, message, options),
  });
}
