import type { CollectedForm } from '../forms.ts';
import type { WebMcpPage, WebMcpTool } from '../forms-webmcp.ts';

const MAX_TOOLS = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function code(text: string): string {
  return `\`${text.replace(/`/g, "'").replace(/\s+/g, ' ')}\``;
}

const MAX_ENTRIES = 200;

function listOf(value: unknown, item: (entry: unknown) => boolean): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.length <= MAX_ENTRIES && value.every(item))
  );
}

const isString = (entry: unknown) => typeof entry === 'string';

function isCall(entry: unknown): boolean {
  return (
    isRecord(entry) &&
    typeof entry['at'] === 'number' &&
    typeof entry['outcome'] === 'string' &&
    (entry['ms'] === undefined || typeof entry['ms'] === 'number') &&
    (entry['detail'] === undefined || typeof entry['detail'] === 'string') &&
    listOf(entry['fields'], isString)
  );
}

function isBlocking(entry: unknown): boolean {
  return (
    isRecord(entry) && typeof entry['path'] === 'string' && typeof entry['reason'] === 'string'
  );
}

function isRequiredChange(entry: unknown): boolean {
  return isRecord(entry) && typeof entry['path'] === 'string' && typeof entry['now'] === 'boolean';
}

export function isWebMcpTool(value: unknown): value is WebMcpTool {
  if (!isRecord(value)) return false;
  return (
    typeof value['name'] === 'string' &&
    typeof value['description'] === 'string' &&
    typeof value['status'] === 'string' &&
    typeof value['seen'] === 'string' &&
    (value['error'] === undefined || typeof value['error'] === 'string') &&
    listOf(value['calls'], isCall) &&
    listOf(value['inputs'], isString) &&
    listOf(value['required'], isString) &&
    listOf(value['blocking'], isBlocking) &&
    listOf(value['requiredChanged'], isRequiredChange)
  );
}

export function isWebMcpPage(value: unknown): value is WebMcpPage {
  return (
    isRecord(value) &&
    typeof value['modelContext'] === 'boolean' &&
    Array.isArray(value['tools']) &&
    value['tools'].length <= MAX_TOOLS &&
    value['tools'].every(isWebMcpTool)
  );
}

export function toolStatus(tool: WebMcpTool): string {
  if (tool.status !== 'failed') return tool.status;
  if (tool.error === 'schema') {
    const fields = tool.blocking?.map((b) => `${code(b.path)} is ${b.reason}`).join(', ');
    return `failed: schema could not be inferred${fields ? ` (${fields})` : ''}`;
  }
  return `failed: ${tool.error ?? 'unknown error'}`;
}

export function webMcpLine(form: CollectedForm): string {
  const tool = form.webMcp;
  if (!tool) return '';
  const notes = [toolStatus(tool)];
  if (tool.duplicate) notes.push('another tool has the same name');
  if (tool.requiredChanged?.length) notes.push('required changed since registration');
  if (tool.calls?.length) notes.push(`${tool.calls.length} recent call(s)`);
  return `; WebMCP tool ${code(tool.name)}: ${notes.join('; ')}`;
}

export function webMcpNotes(
  state: { webMcp?: (WebMcpPage & { pageId: string })[] },
  page?: string,
): string {
  const lines: string[] = [];
  for (const entry of state.webMcp ?? []) {
    if (page && entry.pageId !== page) continue;
    if (!entry.modelContext && entry.provided) {
      lines.push(
        `- Page ${entry.pageId}: provideExperimentalWebMcpForms() is set, but the browser has no modelContext, so Angular registers no WebMCP tool.`,
      );
    }
    for (const tool of entry.tools) {
      lines.push(
        `- Page ${entry.pageId}: WebMCP tool ${code(tool.name)} (${toolStatus(tool)}${tool.duplicate ? '; duplicate name' : ''}) is not linked to a form on the page.`,
      );
    }
  }
  return lines.length ? `\n\nWebMCP:\n${lines.join('\n')}` : '';
}
