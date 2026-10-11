// Pre-shared pairing tokens: a client that sends one is trusted at once, so a
// phone needs no one-time code. Everything else keeps the code flow.
//
// devframe's interactive auth already trusts static tokens
// (`createInteractiveAuth(ctx, {clientAuthTokens})`), but the hub builds its
// handler itself and takes no tokens. The RPC core registers the auth
// handler's functions only when a function of that name is not registered
// yet, so the devframe's setup registers devframe's own handshake,
// `anonymous:devframe:auth`, with the tokens first. The code exchange, the
// banner and revoke stay the default ones, on the same token storage.
import { createHash } from 'node:crypto';
import { createInteractiveAuth } from 'devframe/recipes/interactive-auth';

export const PANGULAR_AUTH_TOKEN_ENV = 'PANGULAR_AUTH_TOKEN';
export const MIN_AUTH_TOKEN_LENGTH = 16;

const HANDSHAKE = 'anonymous:devframe:auth';

/** The `auth` option shape that adds pairing tokens and keeps the one-time code on. */
export interface PangularAuthTokens {
  /** Tokens a client may send to be trusted without the code. Dev secrets: keep them out of committed config. */
  tokens: string[];
}

export function isAuthTokens(value: unknown): value is PangularAuthTokens {
  return !!value && typeof value === 'object' && 'tokens' in value && !('rpcFunctions' in value);
}

/** Keeps tokens of at least 16 characters, and warns about the rest without printing them. */
export function authTokensFrom(
  values: unknown,
  warn: (message: string) => void = (message) => console.warn(message),
): string[] {
  const all = Array.isArray(values) ? values : [values];
  const list = all.filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  if (list.length < all.length) {
    warn(
      `[pangular] Ignoring ${all.length - list.length} pairing token(s) that are empty or not strings. If a token comes from an environment variable such as ${PANGULAR_AUTH_TOKEN_ENV}, check that it is set.`,
    );
  }
  const tokens = list
    .map((token) => token.trim())
    .filter((token) => token.length >= MIN_AUTH_TOKEN_LENGTH);
  if (tokens.length < list.length) {
    warn(
      `[pangular] Ignoring ${list.length - tokens.length} pairing token(s) shorter than ${MIN_AUTH_TOKEN_LENGTH} characters. Use a long random value, such as the output of \`openssl rand -hex 16\`.`,
    );
  }
  return [...new Set(tokens)];
}

/** Tokens from a comma-separated environment variable. */
export function authTokensFromEnv(
  env: Record<string, string | undefined>,
  warn?: (message: string) => void,
): string[] {
  const value = env[PANGULAR_AUTH_TOKEN_ENV];
  return value ? authTokensFrom(value.split(','), warn) : [];
}

/**
 * A short hash of a token, to tell two apart in a log. It reveals none of the
 * token's characters.
 */
export function maskToken(token: string): string {
  return `#${createHash('sha256').update(token).digest('hex').slice(0, 6)}`;
}

interface RpcHost {
  definitions: Map<string, unknown>;
  register(definition: unknown): void;
}

/**
 * Registers devframe's handshake with the tokens trusted. Returns false when a
 * handshake was registered already, so the tokens can't take effect.
 */
export function registerAuthTokens(ctx: unknown, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const rpc = (ctx as { rpc: RpcHost }).rpc;
  if (rpc.definitions.has(HANDSHAKE)) return false;
  const auth = createInteractiveAuth(ctx as Parameters<typeof createInteractiveAuth>[0], {
    clientAuthTokens: tokens,
  });
  const handshake = auth.rpcFunctions.find((fn) => fn.name === HANDSHAKE);
  if (!handshake) return false;
  rpc.register(handshake);
  return true;
}
