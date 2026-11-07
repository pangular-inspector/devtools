// `pangular token`: how many browsers hold a trusted token for this project,
// and `--rotate` to drop them all and get a new one-time code (`auth-rotate.ts`).
import type { CAC } from 'cac';
import { authStoreDir } from './auth-store.ts';
import { rotateText, rotateTokens, tokenFileSummary } from './auth-rotate.ts';

interface TokenFlags {
  rotate?: boolean;
}

/** What `pangular token` prints without `--rotate`: counts and expiry, never a token. */
export function tokenStatusText(dir: string, now = Date.now()): string {
  const { count, nextExpiresAt } = tokenFileSummary(dir, now);
  const hint = 'Run pangular token --rotate to drop every token and get a new one-time code.';
  if (!count) return `No trusted tokens for this project.\n${hint}`;
  const days = Math.max(1, Math.ceil(((nextExpiresAt ?? now) - now) / 86_400_000));
  return `${count} trusted token(s) for this project. The first expires in ${days} day(s).\n${hint}`;
}

export function registerTokenCommand(
  cli: CAC,
  options: {
    cwd: (flags: Record<string, unknown>) => string;
    log: (message: string) => void;
    home?: string;
    waitMs?: number;
  },
) {
  cli
    .command('token', 'Show the trusted tokens of this project, or drop them all (--rotate)')
    .option(
      '--rotate',
      'Drop every trusted token of the project and print a new one-time code from the running server',
    )
    .action(async (flags: TokenFlags) => {
      const root = options.cwd(flags as Record<string, unknown>);
      if (!flags.rotate) {
        options.log(tokenStatusText(authStoreDir(root, options.home)));
        return;
      }
      const result = await rotateTokens(root, { home: options.home, waitMs: options.waitMs });
      options.log(rotateText(result));
    });
}
