import { componentHostOf, type ComponentDebugNg } from './component-tree.ts';
import { elementId } from './element-id.ts';
import { className } from './injector-tree.ts';
import { POPUP_ROOT_ID } from './panel-frame.ts';

export const COMPONENT_PICK_TIMEOUT_MS = 15_000;

export type ComponentPickResult =
  { ok: true; id: string; name: string; tag: string } | { ok: false; error: string };

interface PickOptions {
  getNg: () => ComponentDebugNg | undefined;
  highlight: { show(el: HTMLElement): void; clear(): void };
  doc?: Document;
  timeoutMs?: number;
}

/**
 * Lets the user click an element on the page and resolves with the component
 * that hosts it. Escape, `cancel()` or the timeout end the pick. The floating
 * panel fades while picking so it does not cover the page.
 */
export function startComponentPick(options: PickOptions): {
  result: Promise<ComponentPickResult>;
  cancel: () => void;
} {
  const doc = options.doc ?? document;
  const popup = doc.getElementById(POPUP_ROOT_ID);
  const ownElement = (target: EventTarget | null) =>
    target instanceof Element && !!popup && popup.contains(target);
  const hostOf = (target: EventTarget | null) =>
    target instanceof Element && !ownElement(target)
      ? componentHostOf(options.getNg(), target)
      : null;

  let finish: (result: ComponentPickResult) => void = () => {};
  const result = new Promise<ComponentPickResult>((resolve) => {
    const onHover = (event: Event) => {
      const host = hostOf(event.target);
      if (host instanceof HTMLElement) options.highlight.show(host);
      else options.highlight.clear();
    };
    const onLeave = (event: MouseEvent) => {
      if (!event.relatedTarget) options.highlight.clear();
    };
    const onClick = (event: Event) => {
      if (ownElement(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      const host = hostOf(event.target);
      const instance = host ? options.getNg()?.getComponent?.(host) : null;
      const ctor = (instance as { constructor?: unknown } | null)?.constructor;
      finish(
        host
          ? {
              ok: true,
              id: elementId(host),
              name: typeof ctor === 'function' ? className(ctor) : 'Anonymous',
              tag: host.tagName.toLowerCase(),
            }
          : { ok: false, error: 'That element is not inside an Angular component.' },
      );
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
    finish = (outcome) => {
      finish = () => {};
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('mouseover', onHover, true);
      doc.removeEventListener('mouseout', onLeave, true);
      doc.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
      options.highlight.clear();
      popup?.removeAttribute('data-picking');
      resolve(outcome);
    };
    popup?.setAttribute('data-picking', '');
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('mouseover', onHover, true);
    doc.addEventListener('mouseout', onLeave, true);
    doc.addEventListener('keydown', onKey, true);
  });
  return { result, cancel: () => finish({ ok: false, error: 'Picking cancelled.' }) };
}
