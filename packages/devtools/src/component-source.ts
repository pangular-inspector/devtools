import type { ComponentDebugNg } from './component-tree.ts';
import { elementById } from './element-id.ts';
import type { ComponentSource } from './types.ts';

declare global {
  interface Window {
    __pangularHostOf?: (pageId: unknown, id: unknown) => Element | null;
    __pangularClassOf?: (pageId: unknown, id: unknown) => unknown;
  }
}

type AnyRecord = Record<string, unknown>;

export function componentSource(instance: unknown): ComponentSource | undefined {
  try {
    const ctor = (instance as AnyRecord | null)?.['constructor'] as AnyRecord | undefined;
    const info = (ctor?.['ɵcmp'] as AnyRecord | undefined)?.['debugInfo'] as AnyRecord | undefined;
    const file = info?.['filePath'];
    const line = info?.['lineNumber'];
    if (typeof file !== 'string' || !file) return undefined;
    if (typeof line !== 'number' || !Number.isInteger(line) || line < 1) return undefined;
    return { file, line };
  } catch {
    return undefined;
  }
}

export function installSourceHelpers(
  pageId: string,
  getNg: () => ComponentDebugNg | undefined,
): () => void {
  const hostOf = (page: unknown, id: unknown): Element | null => {
    if (page !== pageId || typeof id !== 'string') return null;
    const el = elementById(id);
    return el instanceof Element ? el : null;
  };
  const classOf = (page: unknown, id: unknown): unknown => {
    const el = hostOf(page, id);
    if (!el) return null;
    try {
      const ctor = (getNg()?.getComponent?.(el) as AnyRecord | null)?.['constructor'];
      return typeof ctor === 'function' ? ctor : null;
    } catch {
      return null;
    }
  };
  window.__pangularHostOf = hostOf;
  window.__pangularClassOf = classOf;
  return () => {
    if (window.__pangularHostOf === hostOf) delete window.__pangularHostOf;
    if (window.__pangularClassOf === classOf) delete window.__pangularClassOf;
  };
}
