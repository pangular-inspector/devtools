import config from './ngmd.config';
import {
  DOCS_PACKAGE_VERSION,
  activeBadge,
  compareVersions,
  isExpiringBadge,
  parseVersion,
} from './nav-badges';

describe('nav badges', () => {
  it('compares package versions by major, minor and patch', () => {
    expect(compareVersions('1.0.0', '1.2.0')).toBeLessThan(0);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.10.0', '1.2.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0-rc.1', '1.2.0')).toBeLessThan(0);
    expect(compareVersions('1.2.0-rc.2', '1.2.0-rc.10')).toBeLessThan(0);
    expect(compareVersions('1.2.0+build.5', '1.2.0')).toBe(0);
    expect(compareVersions('next', '1.2.0')).toBeNaN();
  });

  it('shows a badge while the package version is older than until', () => {
    expect(activeBadge({status: 'new', until: '1.2.0'}, '1.1.4')).toBe('new');
    expect(activeBadge({status: 'new', until: '1.2.0'}, '1.2.0-rc.1')).toBe('new');
    expect(activeBadge({status: 'new', until: '1.2.0'}, '1.2.0')).toBeNull();
    expect(activeBadge({status: 'updated', until: '1.2.0'}, '2.0.0')).toBeNull();
  });

  it('never shows new or updated without until, and keeps other badges', () => {
    expect(activeBadge({status: 'new'}, '1.0.0')).toBeNull();
    expect(activeBadge({status: 'updated'}, '1.0.0')).toBeNull();
    expect(activeBadge({status: 'beta'}, '1.0.0')).toBe('beta');
    expect(activeBadge({status: 'deprecated', until: '2.0.0'}, '2.0.0')).toBeNull();
    expect(activeBadge({}, '1.0.0')).toBeNull();
  });

  it('reads the package version', () => {
    expect(parseVersion(DOCS_PACKAGE_VERSION)).not.toBeNull();
  });

  it('gives every new or updated sidebar item a valid until version', () => {
    const items = config.nav.flatMap((section) => section.items);
    const missing = items
      .filter((item) => item.status && isExpiringBadge(item.status))
      .filter((item) => !item.until || !parseVersion(item.until))
      .map((item) => item.href);
    expect(missing).toEqual([]);
    const malformed = items
      .filter((item) => item.until !== undefined && !parseVersion(item.until))
      .map((item) => item.href);
    expect(malformed).toEqual([]);
  });
});
