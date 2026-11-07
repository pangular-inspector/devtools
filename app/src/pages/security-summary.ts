import type { SecurityStatus } from '@pangular-inspector/devtools/internal/config';

export interface SecurityItem {
  label: string;
  value: string;
}

/** A time ahead of `now` in words: "in 6 days", "in 3 hours", "in 4 min". */
export function inTime(at: number, now: number): string {
  const ms = Math.max(0, at - now);
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `in ${Math.round(hours / 24)} days`;
}

function list(values: readonly string[], none: string): string {
  return values.length ? values.join(', ') : none;
}

/**
 * The Dashboard's security rows, from the `security-status` answer. Never a
 * token or the code: the server leaves them out.
 */
export function securityItems(status: SecurityStatus, now: number): SecurityItem[] {
  const items: SecurityItem[] = [];
  items.push({
    label: 'One-time code',
    value: !status.auth
      ? 'Off: every client is trusted'
      : status.oneTimeCode.state === 'locked'
        ? 'Locked after too many wrong codes: restart the server for a new one'
        : status.oneTimeCode.expiresAt
          ? `On, current code expires ${inTime(status.oneTimeCode.expiresAt, now)}`
          : 'On',
  });
  if (status.auth) {
    const { count, nextExpiresAt, lastExpiresAt } = status.tokens;
    items.push({
      label: 'Trusted clients',
      value: !count
        ? 'None'
        : count === 1 || nextExpiresAt === lastExpiresAt
          ? `${count} ${count === 1 ? 'token' : 'tokens'}, expires ${inTime(nextExpiresAt ?? now, now)}`
          : `${count} tokens, the first expires ${inTime(nextExpiresAt ?? now, now)}, the last ${inTime(lastExpiresAt ?? now, now)}`,
    });
    if (status.pairingTokens) {
      items.push({
        label: 'Pairing tokens',
        value: `${status.pairingTokens} accepted instead of the code`,
      });
    }
  }
  if (!status.reported) return items;
  items.push({
    label: 'Reach',
    value: status.network ? 'This machine and other machines' : 'This machine only',
  });
  items.push({
    label: 'Allowed origins',
    value: !status.originCheck
      ? 'Any: the origin check is off'
      : `${list(status.allowedOrigins, 'This machine and the Chrome extension')}${
          status.customOrigins ? ', plus a custom origin check' : ''
        }`,
  });
  if (status.allowedHosts === 'any' || status.allowedHosts.length) {
    items.push({
      label: 'Allowed hosts',
      value: status.allowedHosts === 'any' ? 'Any' : status.allowedHosts.join(', '),
    });
  }
  return items;
}
