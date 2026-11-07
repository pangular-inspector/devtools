import { componentSource } from './component-source.ts';
import { componentHostOf, componentHosts, type ComponentDebugNg } from './component-tree.ts';
import { elementId } from './element-id.ts';
import { domTree, parentOf } from './host-tree.ts';
import { className } from './injector-tree.ts';
import { POPUP_ROOT_ID } from './panel-frame.ts';
import type { ComponentSource } from './types.ts';

export const COMPONENT_PICK_TIMEOUT_MS = 15_000;

export type ComponentPickResult =
  | {
      ok: true;
      id: string;
      name: string;
      tag: string;
      /** The class's file and line, when a dev build has them. */
      source?: ComponentSource;
      /** Alt+click (Option+click): open `source` in the editor too. */
      openInEditor?: true;
    }
  | { ok: false; error: string };

/**
 * The keys of a keyboard pick: the next or previous component in page order,
 * the component around the shown one, the first one inside it, or picking it.
 */
export const PICK_KEYS = ['next', 'previous', 'parent', 'child', 'pick'] as const;
export type PickKey = (typeof PICK_KEYS)[number];

/** What a keyboard move shows now, or why nothing moved. */
export type PickMoveResult =
  | { moved: true; id: string; name: string; tag: string; picked?: true }
  | { moved: false; error: string };

/** The keys a pick takes when focus is on the page itself. */
const PAGE_KEYS: Record<string, PickKey> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  ArrowLeft: 'parent',
  ArrowRight: 'child',
  Enter: 'pick',
};

const PRESS_EVENTS = ['pointerdown', 'mousedown'] as const;
const RELEASE_EVENTS = ['pointerup', 'mouseup'] as const;
/** How long after a pick on pointerup its click is still kept from the page. */
const TRAILING_CLICK_MS = 500;

/** Keeps the click that follows a pick on pointerup from reaching the page. */
function swallowTrailingClick(doc: Document, ownElement: (target: EventTarget | null) => boolean) {
  const onClick = (event: Event) => {
    done();
    if (ownElement(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const timer = setTimeout(() => done(), TRAILING_CLICK_MS);
  const done = () => {
    clearTimeout(timer);
    doc.removeEventListener('click', onClick, true);
  };
  doc.addEventListener('click', onClick, true);
}

interface PickOptions {
  getNg: () => ComponentDebugNg | undefined;
  /** `reveal` scrolls the box into view, for a keyboard move rather than a hover. */
  highlight: { show(el: Element, reveal?: boolean): void; clear(): void };
  doc?: Document;
  timeoutMs?: number;
}

/**
 * Lets the user click or tap an element on the page and resolves with the
 * component that hosts it. Presses outside the popup do not reach the page. Escape, `cancel()` or the timeout end the pick. The floating
 * panel fades while picking so it does not cover the page. An Alt+click
 * marks the result `openInEditor` when the component's source is known.
 *
 * The keyboard picks too, from the panel through `move` or with the arrow
 * keys on the page: down and up go to the next and previous component in
 * page order, left to the component around the shown one, right to the
 * first one inside it, and Enter picks the shown one.
 */
export function startComponentPick(options: PickOptions): {
  result: Promise<ComponentPickResult>;
  cancel: () => void;
  move: (key: PickKey) => PickMoveResult;
} {
  const doc = options.doc ?? document;
  const popup = doc.getElementById(POPUP_ROOT_ID);
  const ownElement = (target: EventTarget | null) =>
    target instanceof Element && !!popup && popup.contains(target);
  // At the document, an event from inside a shadow root targets its host, so
  // the element under the pointer is the first entry of the composed path.
  const hostOf = (event: Event) => {
    if (ownElement(event.target)) return null;
    const target = event.composedPath()[0] ?? event.target;
    return target instanceof Element ? componentHostOf(options.getNg(), target) : null;
  };

  let finish: (result: ComponentPickResult, fromRelease?: boolean) => void = () => {};
  // Moving between elements inside one shadow root fires no mouseover at the
  // document, since both ends retarget to the host, so pointermove also updates
  // the box. It is only redrawn when the component under the pointer changes.
  let shown: Element | null | undefined;
  let done = false;

  const resultFor = (host: Element | null, altKey = false): ComponentPickResult => {
    const instance = host ? options.getNg()?.getComponent?.(host) : null;
    const ctor = (instance as { constructor?: unknown } | null)?.constructor;
    const source = componentSource(instance);
    return host
      ? {
          ok: true,
          id: elementId(host),
          name: typeof ctor === 'function' ? className(ctor) : 'Anonymous',
          tag: host.tagName.toLowerCase(),
          ...(source ? { source } : {}),
          ...(source && altKey ? { openInEditor: true as const } : {}),
        }
      : { ok: false, error: 'That element is not inside an Angular component.' };
  };

  const move = (key: PickKey): PickMoveResult => {
    if (done) return { moved: false, error: 'No pick is running.' };
    const ng = options.getNg();
    if (!ng?.getComponent) return { moved: false, error: 'This page has no Angular debug API.' };
    const current = shown ?? null;
    if (key === 'pick') {
      if (!current) return { moved: false, error: 'Move to a component first.' };
      const picked = resultFor(current);
      finish(picked);
      return picked.ok
        ? { moved: true, id: picked.id, name: picked.name, tag: picked.tag, picked: true }
        : { moved: false, error: picked.error };
    }
    const hosts = componentHosts(ng, domTree(doc));
    const index = current ? hosts.indexOf(current) : -1;
    const around = (host: Element) => {
      const parent = parentOf(host);
      return parent ? componentHostOf(ng, parent) : null;
    };
    let next: Element | null = null;
    if (index === -1) next = hosts[0] ?? null;
    else if (key === 'next') next = hosts[index + 1] ?? null;
    else if (key === 'previous') next = hosts[index - 1] ?? null;
    else if (key === 'parent') next = around(hosts[index]!);
    else next = hosts.slice(index + 1).find((host) => around(host) === current) ?? null;
    if (!next) {
      const why = {
        next: 'This is the last component.',
        previous: 'This is the first component.',
        parent: 'This component has no component around it.',
        child: 'This component has no component inside it.',
      };
      return index === -1
        ? { moved: false, error: 'The page shows no component.' }
        : { moved: false, error: why[key] };
    }
    shown = next;
    options.highlight.show(next, true);
    const picked = resultFor(next);
    return picked.ok
      ? { moved: true, id: picked.id, name: picked.name, tag: picked.tag }
      : { moved: false, error: picked.error };
  };

  const result = new Promise<ComponentPickResult>((resolve) => {
    const onHover = (event: Event) => {
      // An `svg:g` component host is an Element, not an HTMLElement.
      const next = hostOf(event);
      if (next === shown) return;
      shown = next;
      if (next) options.highlight.show(next);
      else options.highlight.clear();
    };
    const onLeave = (event: MouseEvent) => {
      if (event.relatedTarget) return;
      shown = undefined;
      options.highlight.clear();
    };
    const picked = (event: Event): ComponentPickResult =>
      resultFor(hostOf(event), (event as MouseEvent).altKey === true);
    // Menus, drag handles and overlays open on pointerdown or mousedown, so every
    // press outside the popup is kept from the page, not only the click.
    const swallow = (event: Event) => {
      if (ownElement(event.target)) return false;
      event.preventDefault();
      event.stopPropagation();
      return true;
    };
    let pressed = false;
    const onPress = (event: Event) => {
      if (swallow(event) && event.type === 'pointerdown') pressed = true;
    };
    // The pick resolves on pointerup, which touch screens fire too. The click
    // that follows is swallowed by `swallowTrailingClick`.
    const onRelease = (event: Event) => {
      if (!swallow(event) || !pressed) return;
      if ((event as MouseEvent).button > 0) return;
      finish(picked(event), true);
    };
    const onClick = (event: Event) => {
      if (swallow(event)) finish(picked(event));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish({ ok: false, error: 'Picking cancelled.' });
        return;
      }
      const key = PAGE_KEYS[event.key];
      if (!key || ownElement(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      // The arrows would scroll the page, and Enter would press what has focus.
      event.preventDefault();
      event.stopPropagation();
      move(key);
    };
    const timer = setTimeout(
      () => finish({ ok: false, error: 'No component was picked.' }),
      options.timeoutMs ?? COMPONENT_PICK_TIMEOUT_MS,
    );
    finish = (outcome, fromRelease = false) => {
      finish = () => {};
      done = true;
      doc.removeEventListener('click', onClick, true);
      for (const type of PRESS_EVENTS) doc.removeEventListener(type, onPress, true);
      for (const type of RELEASE_EVENTS) doc.removeEventListener(type, onRelease, true);
      if (fromRelease) swallowTrailingClick(doc, ownElement);
      doc.removeEventListener('mouseover', onHover, true);
      doc.removeEventListener('pointermove', onHover, true);
      doc.removeEventListener('mouseout', onLeave, true);
      doc.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
      options.highlight.clear();
      popup?.removeAttribute('data-picking');
      resolve(outcome);
    };
    popup?.setAttribute('data-picking', '');
    doc.addEventListener('click', onClick, true);
    for (const type of PRESS_EVENTS) doc.addEventListener(type, onPress, true);
    for (const type of RELEASE_EVENTS) doc.addEventListener(type, onRelease, true);
    doc.addEventListener('mouseover', onHover, true);
    doc.addEventListener('pointermove', onHover, true);
    doc.addEventListener('mouseout', onLeave, true);
    doc.addEventListener('keydown', onKey, true);
  });
  return { result, cancel: () => finish({ ok: false, error: 'Picking cancelled.' }), move };
}
