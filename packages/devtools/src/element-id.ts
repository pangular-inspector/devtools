const ids = new WeakMap<object, string>();
const byId = new Map<string, WeakRef<object>>();
const load = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
let nextId = 0;

type Connected = (host: object) => boolean;

const isConnected: Connected = (host) => (host as { isConnected?: unknown }).isConnected === true;

export function elementId(el: object): string {
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
  for (const [id, ref] of byId) {
    const el = ref.deref();
    if (!el || !connected(el)) byId.delete(id);
  }
}
