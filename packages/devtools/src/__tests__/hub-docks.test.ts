import { describe, expect, it, vi } from 'vitest';
import { resolvePangularConfig } from '../config.ts';
import { angularNativeReporting, capacitorReporting, trackHubDocks } from '../hub-dock-status.ts';
import { registerHubDocks } from '../hub-docks.ts';

interface Entry {
  id: string;
  type?: string;
  title: string;
  groupId?: string;
  defaultChildId?: string;
  url?: string;
  badge?: string;
  badgeVariant?: string;
  defaultOrder?: number;
}

function fakeHub() {
  const views = new Map<string, Entry>();
  const docks = {
    views,
    register: vi.fn((entry: Entry) => {
      views.set(entry.id, entry);
      return { update: () => {} };
    }),
    update: vi.fn((entry: Entry) => views.set(entry.id, entry)),
  };
  return { docks, frames: [{ id: 'pangular', base: '/__devframes/pangular/' }] };
}

function fakeState(initial: unknown) {
  let value = initial;
  const listeners = new Set<(state: unknown) => void>();
  return {
    value: () => value,
    on: (_event: 'updated', listener: (state: unknown) => void) => listeners.add(listener),
    set: (next: unknown) => {
      value = next;
      for (const listener of listeners) listener(next);
    },
  };
}

const capacitorPage = { pageId: 'cap1', info: { platform: 'ios' } };

describe('hub docks', () => {
  it('registers nothing outside a hub', () => {
    expect(registerHubDocks({}, 'pangular')).toBeUndefined();
  });

  it('keeps the All tools dock when every inspector is off, and drops the docks of the inspectors that are', () => {
    const hub = fakeHub();
    const config = resolvePangularConfig({
      inspectors: { capacitor: false, ngrx: false, analog: false, components: false },
    });
    const docks = registerHubDocks(hub, 'pangular', config, { capacitor: false });
    expect(docks?.ids).toEqual(['pangular:all', 'pangular:angular', 'pangular:nativescript']);

    docks?.setAvailable('capacitor', true);
    docks?.setAvailable('capacitor', false);
    expect(hub.docks.update).not.toHaveBeenCalled();
    expect(hub.docks.views.has('pangular:capacitor')).toBe(false);
  });

  it('puts every dock in one Pangular group, registered first, that opens All tools', () => {
    const hub = fakeHub();
    const docks = registerHubDocks(hub, 'pangular');
    const [first, ...members] = hub.docks.register.mock.calls.map(([entry]) => entry);
    expect(first).toMatchObject({
      type: 'group',
      id: 'pangular:group',
      title: 'Pangular',
      defaultChildId: 'pangular:all',
    });
    expect(first?.groupId).toBeUndefined();
    expect(docks?.groupId).toBe('pangular:group');
    expect(members.map((entry) => entry.id)).toEqual(docks?.ids);
    expect(members.every((entry) => entry.groupId === 'pangular:group')).toBe(true);
  });

  it('keeps the explaining title when a badge is set, and drops only the badge when cleared', () => {
    const hub = fakeHub();
    const docks = registerHubDocks(hub, 'pangular', undefined, { capacitor: false });
    docks?.setBadge('pangular:capacitor', { text: '2', variant: 'danger', severity: 'error' });
    expect(hub.docks.views.get('pangular:capacitor')).toMatchObject({
      title: 'Capacitor: no app connected (2 new, with errors)',
      badge: '2',
      badgeVariant: 'danger',
    });
    docks?.setAvailable('capacitor', true);
    expect(hub.docks.views.get('pangular:capacitor')).toMatchObject({
      title: 'Capacitor (2 new, with errors)',
      badge: '2',
    });
    docks?.setBadge('pangular:capacitor', undefined);
    expect(hub.docks.views.get('pangular:capacitor')?.badge).toBeUndefined();
    expect(hub.docks.views.get('pangular:capacitor')?.title).toBe('Capacitor');
    const updates = hub.docks.update.mock.calls.length;
    docks?.setBadge('pangular:capacitor', undefined);
    docks?.setBadge('pangular:unknown', { text: '1', variant: 'info' });
    expect(hub.docks.update.mock.calls.length).toBe(updates);
  });

  it('puts the badge count into the title that labels the dock button', () => {
    const hub = fakeHub();
    const docks = registerHubDocks(hub, 'pangular');
    docks?.setBadge('pangular:ngrx', { text: '3', variant: 'info' });
    expect(hub.docks.views.get('pangular:ngrx')?.title).toBe('NgRx (3 new)');
    docks?.setBadge('pangular:group', { text: '99+', variant: 'danger', severity: 'error' });
    expect(hub.docks.views.get('pangular:group')?.title).toBe('Pangular (99+ new, with errors)');
    docks?.setBadge('pangular:group', { text: '1', variant: 'danger', severity: 'warning' });
    expect(hub.docks.views.get('pangular:group')?.title).toBe('Pangular (1 new, with warnings)');
    docks?.setBadge('pangular:ngrx', undefined);
    expect(hub.docks.views.get('pangular:ngrx')?.title).toBe('NgRx');
  });

  it('puts the All tools dock before the others, opening the panel without a view', () => {
    const hub = fakeHub();
    registerHubDocks(hub, 'pangular');
    const all = hub.docks.views.get('pangular:all')!;
    const orders = [...hub.docks.views.values()].map((entry) => entry.defaultOrder ?? 0);
    expect(all.url).toBe('/__devframes/pangular/');
    expect(all.defaultOrder).toBe(Math.min(...orders));
    expect(orders.filter((order) => order === all.defaultOrder)).toHaveLength(1);
  });

  it('updates a dock only when its tool starts or stops having data', () => {
    const hub = fakeHub();
    const capacitor = fakeState({ pages: {} });
    const components = fakeState({ pages: {} });
    trackHubDocks(hub, 'pangular', resolvePangularConfig({ inspectors: { analog: false } }), {
      cwd: process.cwd(),
      capacitor,
      components,
    });
    const capacitorDock = () => hub.docks.views.get('pangular:capacitor')!;
    expect(capacitorDock().title).toBe('Capacitor: no app connected');
    expect('badge' in capacitorDock()).toBe(false);

    capacitor.set({ pages: { cap1: capacitorPage } });
    capacitor.set({ pages: { cap1: capacitorPage, cap2: { ...capacitorPage, pageId: 'cap2' } } });
    expect(hub.docks.update).toHaveBeenCalledTimes(1);
    expect(capacitorDock().title).toBe('Capacitor');

    components.set({ pages: { web1: { pageId: 'web1' } } });
    expect(hub.docks.update).toHaveBeenCalledTimes(1);

    capacitor.set({ pages: {} });
    expect(capacitorDock().title).toBe('Capacitor: no app connected');
    expect(hub.docks.update).toHaveBeenCalledTimes(2);
  });
});

describe('dock availability', () => {
  it('counts a Capacitor page once it has sent its info', () => {
    expect(capacitorReporting(undefined)).toBe(false);
    expect(capacitorReporting({ pages: {} })).toBe(false);
    expect(capacitorReporting({ pages: { cap1: { pageId: 'cap1' } } })).toBe(false);
    expect(capacitorReporting({ pages: { cap1: capacitorPage } })).toBe(true);
  });

  it('counts only component pages from Angular Native', () => {
    expect(angularNativeReporting({ pages: { web1: { pageId: 'web1' } } })).toBe(false);
    expect(
      angularNativeReporting({ pages: { an42: { pageId: 'an42', platform: 'angular-native' } } }),
    ).toBe(true);
  });
});
