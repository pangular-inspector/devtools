import { UNTRUSTED, code } from './forms-tools.ts';
import { refusal } from './refusal.ts';

/**
 * Pangular's own `devframe_state_read`. Devframe's MCP adapter lists its
 * built-in shared-state reader only when no agent tool has that name, so this
 * one takes its place: same name and arguments, but each answer is capped and
 * can be read in parts, and the description does not invite calling it
 * freely. Shared state is what the panel gets, so a key can hold every page's
 * full report.
 */
export const STATE_READ_TOOL_ID = 'devframe:state:read';

/** Default and largest part of a value one call answers, in characters. */
export const STATE_READ_DEFAULT_CHARS = 20_000;
export const STATE_READ_MAX_CHARS = 50_000;

export interface StateReadHost {
  /** Every shared-state key. */
  keys(): string[];
  /** The value of a key. */
  value(key: string): Promise<unknown>;
  /** Whether agents may read the key (`sharedStateExposed`). */
  exposed(key: string): boolean;
  /** The tool or resource that reads the same data, when there is one. */
  readBy?(key: string): string | undefined;
}

/** The agent tool that reads each Pangular shared-state key in a shorter form. */
export const STATE_READ_BY: Readonly<Record<string, string>> = {
  'pangular:change-detection': 'pangular:change-detection',
  'pangular:leaks': 'pangular:find-leaks',
  'pangular:redux-stores': 'pangular:redux-inspect-stores',
  'pangular:tanstack-query': 'pangular:tanstack-list-queries',
  'pangular:pipe-usage': 'pangular:explain-pipe',
  'pangular:http': 'pangular:list-http-calls',
  'pangular:http-payloads': 'pangular:inspect-transfer-state',
  'pangular:capacitor': 'pangular:capacitor-list-calls',
  'pangular:analog': 'pangular:analog-list-server-calls',
  'pangular:errors': 'pangular:list-errors',
  'pangular:startup': 'pangular:startup-timing',
  'pangular:plugins': 'pangular:list-plugins',
  'pangular:audit': 'pangular:audit',
  'pangular:page-visibility': 'pangular:list-pages',
  'pangular:page-angular': 'pangular:list-pages',
};

function json(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return 'null';
  }
}

const count = (n: number) => n.toLocaleString('en-US');

export function stateReadTool(host: StateReadHost) {
  const keys = () => host.keys().filter(host.exposed).sort();
  return {
    id: STATE_READ_TOOL_ID,
    title: 'Read shared state',
    description: `Read a shared-state key as compact JSON, for data no other tool covers. Without \`key\`, lists the keys with their size. Answers at most \`maxChars\` (default ${count(STATE_READ_DEFAULT_CHARS)}) from \`offset\`; the answer says where the next part starts.`,
    safety: 'read' as const,
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'A key from the list. Omit to list the keys.' },
        offset: {
          type: 'integer',
          minimum: 0,
          description: 'Character to start from (default 0).',
        },
        maxChars: {
          type: 'integer',
          minimum: 1,
          description: `Characters to answer (default ${count(STATE_READ_DEFAULT_CHARS)}, max ${count(STATE_READ_MAX_CHARS)}).`,
        },
      },
    },
    handler: async (args: { key?: unknown; offset?: unknown; maxChars?: unknown }) => {
      const key = typeof args?.key === 'string' ? args.key : undefined;
      if (key === undefined) {
        const rows = await Promise.all(
          keys().map(async (name) => {
            const size = json(await host.value(name)).length;
            const via = host.readBy?.(name);
            return `| ${code(name)} | ${count(size)} | ${via ? via : ''} |`;
          }),
        );
        return {
          markdown: rows.length
            ? `${rows.length} shared-state key(s). Prefer the tool named next to a key: it answers in a shorter, readable form.\n\n| Key | Characters | Read it with |\n| --- | --- | --- |\n${rows.join('\n')}`
            : 'No shared-state key is open to agents.',
        };
      }
      if (!keys().includes(key)) {
        return {
          markdown: refusal(
            `No shared-state key ${code(key)}. Call this tool without \`key\` to list them.`,
          ),
        };
      }
      const text = json(await host.value(key));
      const offset = Math.max(0, Math.floor(Number(args.offset) || 0));
      const max = Math.min(
        Math.max(1, Math.floor(Number(args.maxChars) || STATE_READ_DEFAULT_CHARS)),
        STATE_READ_MAX_CHARS,
      );
      if (offset >= text.length && text.length > 0) {
        return {
          markdown: refusal(
            `\`offset\` ${count(offset)} is past the end of ${code(key)} (${count(text.length)} characters).`,
          ),
        };
      }
      const part = text.slice(offset, offset + max);
      const end = offset + part.length;
      const whole = offset === 0 && end === text.length;
      const where = whole
        ? `${code(key)}, ${count(text.length)} characters.`
        : `${code(key)}, characters ${count(offset)} to ${count(end)} of ${count(text.length)}. This part alone is not valid JSON.${end < text.length ? ` Pass \`offset: ${end}\` for the next part.` : ' This is the last part.'}`;
      return { markdown: `${UNTRUSTED}\n\n${where}\n\n\`\`\`json\n${part}\n\`\`\`` };
    },
  };
}
