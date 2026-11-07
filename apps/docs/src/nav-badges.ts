import {version as packageVersion} from '../../../packages/devtools/package.json';
import type {BadgeVariant} from './types/badge.ts';

/** Badges that announce a change, so they stop meaning anything once the change is old. */
const EXPIRING: ReadonlySet<BadgeVariant> = new Set<BadgeVariant>(['new', 'updated']);

/** The published package version the docs describe, from `packages/devtools/package.json`. */
export const DOCS_PACKAGE_VERSION: string = packageVersion;

export interface BadgedItem {
  status?: BadgeVariant;
  until?: string;
}

/** `major.minor.patch` as numbers. A prerelease or build suffix is ignored. */
export function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Negative when `a` is older than `b`, 0 when equal, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return Number.NaN;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

/** Whether the badge is an announcement (`new`, `updated`) that needs an `until`. */
export function isExpiringBadge(status: BadgeVariant): boolean {
  return EXPIRING.has(status);
}

/**
 * The badge to show beside a sidebar item, or `null`. A badge with `until`
 * shows while the package version is older than `until`. A `new` or
 * `updated` badge without `until` never shows, so it can't stay forever.
 */
export function activeBadge(item: BadgedItem, version = DOCS_PACKAGE_VERSION): BadgeVariant | null {
  const {status, until} = item;
  if (!status) return null;
  if (until === undefined) return isExpiringBadge(status) ? null : status;
  return compareVersions(version, until) < 0 ? status : null;
}
