// What the devtools server lets in, for the panel's Dashboard: whether the
// one-time code is on, who may reach the server, how many clients hold a
// trusted token and until when. It never carries a token, a pairing token or
// the code itself.
import { getTempAuthCodeInfo } from 'devframe/node/auth';
import { codeGuardLocked } from './auth-guard.ts';
import { AUTH_TOKEN_TTL_MS, trustedTokenSummary, type TrustedTokenSummary } from './auth-store.ts';
import type { OneTimeCodeState, SecurityStatus } from './config.ts';
import { redactUrl } from './router.ts';

/**
 * How the host that runs the server (the Express hub, the Vite plugin or the
 * CLI) is set up to let clients in. The host fills it from its own options.
 */
export interface PangularSecurityHost {
  /** Whether clients need the one-time code, a trusted token or a pairing token. */
  auth: boolean;
  /** Whether the server checks the `Origin` of requests and WebSocket upgrades. */
  originCheck: boolean;
  /** Origins allowed beyond this machine and the Chrome extension. */
  allowedOrigins: readonly string[];
  /** Whether a custom origin registry decides beyond `allowedOrigins`. */
  customOrigins?: boolean;
  /** `Host` names allowed beyond loopback, or `true` for any. */
  allowedHosts?: readonly string[] | true;
  /** Whether the server answers other machines, not only this one. */
  network: boolean;
}

export type { OneTimeCodeState, SecurityStatus };

const MAX_LISTED = 20;

/** An origin or host name as the panel shows it: secrets masked, cut short, at most 20. */
function listed(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => redactUrl(String(value)).slice(0, 200)))].slice(
    0,
    MAX_LISTED,
  );
}

/**
 * Builds the status from the host's settings and the live auth state. Pure, so
 * it can be tested without a server.
 */
export function securityStatus(input: {
  host?: PangularSecurityHost;
  tokens: TrustedTokenSummary | null;
  pairingTokens: number;
  codeLocked: boolean;
  codeExpiresAt?: () => number | undefined;
}): SecurityStatus {
  const host = input.host;
  const auth = host?.auth ?? true;
  const state: OneTimeCodeState = !auth ? 'off' : input.codeLocked ? 'locked' : 'accepting';
  const expiresAt = state === 'accepting' ? input.codeExpiresAt?.() : undefined;
  return {
    reported: !!host,
    auth,
    originCheck: host?.originCheck ?? true,
    allowedOrigins: listed(host?.allowedOrigins),
    customOrigins: host?.customOrigins === true,
    allowedHosts: host?.allowedHosts === true ? 'any' : listed(host?.allowedHosts),
    network: host?.network ?? false,
    tokens: {
      ...(input.tokens ?? { count: 0, nextExpiresAt: null, lastExpiresAt: null }),
      ttlMs: AUTH_TOKEN_TTL_MS,
    },
    pairingTokens: auth ? input.pairingTokens : 0,
    oneTimeCode: expiresAt === undefined ? { state } : { state, expiresAt },
  };
}

interface StatusContext {
  mode?: string;
  rpc: {
    getCurrentRpcSession(): { meta?: { isTrusted?: boolean } } | undefined;
  };
}

/** Thrown to a client that is not trusted. */
export const NOT_TRUSTED = 'Only a trusted client can read the security status.';

/**
 * The `security-status` handler: the status for a trusted client, and an
 * error for any other. devframe already refuses untrusted clients for every
 * name without the `anonymous:` prefix; this checks again, so the answer
 * never reaches a client that is not trusted.
 */
export function securityStatusHandler(
  ctx: StatusContext,
  host: PangularSecurityHost | undefined,
  pairingTokens: number,
): () => SecurityStatus {
  return () => {
    // A call from the server itself has no session (or no transport yet): only clients are checked.
    let session: ReturnType<StatusContext['rpc']['getCurrentRpcSession']>;
    try {
      session = ctx.rpc.getCurrentRpcSession();
    } catch {
      session = undefined;
    }
    if (session && session.meta?.isTrusted !== true) throw new Error(NOT_TRUSTED);
    return securityStatus({
      host,
      tokens: trustedTokenSummary(ctx),
      pairingTokens,
      codeLocked: codeGuardLocked(ctx),
      codeExpiresAt: () => {
        try {
          return getTempAuthCodeInfo().expireAt;
        } catch {
          return undefined;
        }
      },
    });
  };
}
