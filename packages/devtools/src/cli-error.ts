// What the CLI prints for an error that ends a command.

/**
 * The line to print, or null when there is nothing to add: devframe's
 * diagnostics (`DF0052` for a port in use, and the like) print themselves,
 * with their cause and fix, as they are raised. An error that carries its own
 * fix gets no `--help` hint, which would only point away from it.
 */
export function cliErrorText(error: unknown): string | null {
  const record = (error && typeof error === 'object' ? error : {}) as {
    code?: unknown;
    fix?: unknown;
    message?: unknown;
  };
  if (typeof record.code === 'string' && /^DF\d{4}$/.test(record.code)) return null;
  const message = typeof record.message === 'string' ? record.message : String(error);
  if (message.startsWith('[pangular]')) return message;
  if (typeof record.fix === 'string' && record.fix) return `[pangular] ${message}. ${record.fix}`;
  return `[pangular] ${message}. Run pangular --help for the commands and flags.`;
}
