import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const PANGULAR_MCP_TOKEN_ENV = 'PANGULAR_MCP_TOKEN';
export const PANGULAR_MCP_TOKEN_FILE_ENV = 'PANGULAR_MCP_TOKEN_FILE';

/** Where the hub keeps its MCP token: `PANGULAR_MCP_TOKEN_FILE`, or a file in the home folder. */
export function mcpTokenFile(env: Record<string, string | undefined> = process.env): string {
  return env[PANGULAR_MCP_TOKEN_FILE_ENV] || join(homedir(), '.pangular-inspector', 'mcp-token');
}

/** A token read back from the file: one line of at least 16 URL-safe characters. */
const TOKEN = /^[A-Za-z0-9_-]{16,}$/;

function readToken(file: string): string | undefined {
  try {
    const token = readFileSync(file, 'utf8').trim();
    if (!TOKEN.test(token)) return undefined;
    // Keep the file readable by its owner only, even if its mode was changed.
    chmodSync(file, 0o600);
    return token;
  } catch {
    return undefined;
  }
}

/**
 * Puts `token` in `file` unless another process created the file first, and
 * returns the token the file holds. The token goes to a temp file in the same
 * folder, which is then linked to `file`: the link fails when `file` exists,
 * so two servers starting at once end up with the same token.
 */
export function writeTokenOnce(file: string, token: string): string {
  const temp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(temp, `${token}\n`, { mode: 0o600, flag: 'wx' });
    chmodSync(temp, 0o600);
    try {
      linkSync(temp, file);
      return token;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const existing = readToken(file);
    if (existing) return existing;
    // The file holds no valid token: replace it in one step.
    renameSync(temp, file);
    return token;
  } finally {
    rmSync(temp, { force: true });
  }
}

/**
 * The MCP token: `PANGULAR_MCP_TOKEN` when set, else the token in the token
 * file, else a new one written to that file with mode 0600. The token itself
 * is never printed; `log` gets the file path.
 */
export function loadMcpToken(
  env: Record<string, string | undefined> = process.env,
  log: (message: string) => void = console.log,
): string {
  const fromEnv = env[PANGULAR_MCP_TOKEN_ENV];
  if (fromEnv) return fromEnv;
  const file = mcpTokenFile(env);
  const existing = readToken(file);
  let token = existing ?? randomBytes(24).toString('base64url');
  if (!existing) {
    try {
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      token = writeTokenOnce(file, token);
    } catch (error) {
      log(
        `\n  Pangular Inspector could not write its MCP token to ${file}: ${(error as Error).message}\n` +
          `  Set ${PANGULAR_MCP_TOKEN_ENV} to choose the token, or ${PANGULAR_MCP_TOKEN_FILE_ENV} to pick another file.\n`,
      );
      return token;
    }
  }
  log(
    `\n  Pangular Inspector MCP token: in ${file} (readable by you only).\n` +
      `  HTTP MCP clients send it as "Authorization: Bearer <token>".\n`,
  );
  return token;
}
