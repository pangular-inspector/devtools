// What the Chrome extension's Elements sidebar shows for the selected element: the component
// that owns it, from the same masked detail the panel gets.

import { componentDetail, componentHostOf } from './component-tree.ts';
import type { ComponentDetail, ComponentProp } from './types.ts';

type DebugNg = Parameters<typeof componentDetail>[0];

function values(props: readonly ComponentProp[]): Record<string, unknown> {
  return Object.fromEntries(props.map((prop) => [prop.name, prop.value]));
}

/**
 * A short, plain view of a component detail for the sidebar. The values are
 * the ones `componentDetail` already serialized and masked.
 */
export function sidebarSummary(detail: ComponentDetail, selectedTag?: string) {
  const signals = [...detail.inputs, ...detail.properties].filter((prop) => prop.kind);
  return {
    component: detail.name,
    host: `<${detail.tag}>`,
    ...(selectedTag && selectedTag !== detail.tag ? { selected: `<${selectedTag}>` } : {}),
    ...(detail.source ? { file: `${detail.source.file}:${detail.source.line}` } : {}),
    inputs: values(detail.inputs),
    signals: values(signals),
    properties: values(detail.properties.filter((prop) => !prop.kind)),
    outputs: detail.outputs.map((output) => output.name),
    ...(detail.directives.length
      ? { directives: detail.directives.map((directive) => directive.name) }
      : {}),
  };
}

/**
 * The sidebar summary of the component that owns `el`, or null when no
 * component does or the debug API can't read it.
 */
export function selectedComponentSummary(ng: unknown, el: unknown) {
  if (!ng || typeof Element === 'undefined' || !(el instanceof Element)) return null;
  try {
    const host = componentHostOf(ng as DebugNg, el);
    const detail = host ? componentDetail(ng as DebugNg, host) : null;
    return detail ? sidebarSummary(detail, el.tagName.toLowerCase()) : null;
  } catch {
    return null;
  }
}
