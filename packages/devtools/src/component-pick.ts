import { componentSource } from './component-source.ts';
import { componentHostOf, type ComponentDebugNg } from './component-tree.ts';
import { elementId } from './element-id.ts';
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
  highlight: { show(el: Element): void; clear(): void };
  doc?: Document;
  timeoutMs?: number;
}

/**
 * Lets the user click or tap an element on the page and resolves with the
 * component that hosts it. Presses outside the popup do not reach the page. Escape, `cancel()` or the timeout end the pick. The floating
 * panel fades while picking so it does not cover the page. An Alt+click
 * marks the result `openInEditor` when the component's source is known.
 */
export function startComponentPick(options: PickOptions): {
  result: Promise<ComponentPickResult>;
  cancel: () => void;
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
  const result = new Promise<ComponentPickResult>((resolve) => {
    // Moving between elements inside one shadow root fires no mouseover at the
    // document, since both ends retarget to the host, so pointermove also updates
    // the box. It is only redrawn when the component under the pointer changes.
    let shown: Element | null | undefined;
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
    const picked = (event: Event): ComponentPickResult => {
      const host = hostOf(event);
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
            ...(source && (event as MouseEvent).altKey === true
              ? { openInEditor: true as const }
              : {}),
          }
        : { ok: false, error: 'That element is not inside an Angular component.' };
    };
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
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish({ ok: false, error: 'Picking cancelled.' });
    };
    const timer = setTimeout(
      () => finish({ ok: false, error: 'No component was picked.' }),
      options.timeoutMs ?? COMPONENT_PICK_TIMEOUT_MS,
    );
    finish = (outcome, fromRelease = false) => {
      finish = () => {};
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
  return { result, cancel: () => finish({ ok: false, error: 'Picking cancelled.' }) };
}
