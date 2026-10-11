const ids = new WeakMap<object, string>();
const byId = new Map<string, WeakRef<object>>();
const load = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
let nextId = 0;
const FIRST_SWEEP = 512;
let sweepAt = FIRST_SWEEP;

type Connected = (host: object) => boolean;

const isConnected: Connected = (host) => (host as { isConnected?: unknown }).isConnected === true;

const notDisconnected: Connected = (host) =>
  (host as { isConnected?: unknown }).isConnected !== false;

export function elementId(el: object): string {
  if (byId.size >= sweepAt) sweep(notDisconnected);
  let id = ids.get(el);
  if (!id) {
    id = `c${load}-${++nextId}`;
    ids.set(el, id);
  }
  if (!byId.has(id)) byId.set(id, new WeakRef(el));
  return id;
}

export function elementById(id: string): Element | null;
export function elementById<H extends object>(id: string, connected: Connected): H | null;
export function elementById(id: string, connected: Connected = isConnected): object | null {
  const el = byId.get(id)?.deref();
  if (!el) {
    byId.delete(id);
    return null;
  }
  return connected(el) ? el : null;
}

export function pruneElementIds(connected: Connected = isConnected) {
  sweep(connected);
}

export function elementIdCount(): number {
  return byId.size;
}

function sweep(connected: Connected) {
  for (const [id, ref] of byId) {
    const el = ref.deref();
    if (!el || !connected(el)) byId.delete(id);
  }
  sweepAt = Math.max(FIRST_SWEEP, byId.size * 2);
}
