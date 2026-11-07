/**
 * Stable ids for DI tokens, so two tokens with the same name (two
 * `new InjectionToken('config')`, or two classes both called `Store`) stay
 * apart in the injector tree, in "injected" tracking and in provider value
 * reads. Class and `InjectionToken` tokens are objects and get their id
 * through a `WeakMap`, like `element-id.ts` does for elements: the same token
 * keeps its id between pushes, and nothing is written onto the token.
 */
const ids = new WeakMap<object, string>();
/** Tokens that are not objects (a string token from older code) are few and compare by value. */
const primitiveIds = new Map<unknown, string>();
const MAX_PRIMITIVE_IDS = 1000;
let nextId = 0;

export function tokenId(token: unknown): string {
  if ((token && typeof token === 'object') || typeof token === 'function') {
    let id = ids.get(token);
    if (!id) {
      id = `tok-${++nextId}`;
      ids.set(token, id);
    }
    return id;
  }
  let id = primitiveIds.get(token);
  if (!id) {
    id = `tok-${++nextId}`;
    if (primitiveIds.size >= MAX_PRIMITIVE_IDS) primitiveIds.clear();
    primitiveIds.set(token, id);
  }
  return id;
}
