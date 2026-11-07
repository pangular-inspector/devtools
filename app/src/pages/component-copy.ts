/** The fields of a component detail the copy actions read. */
export interface CopyProp {
  name: string;
  value?: unknown;
  listened?: boolean;
  kind?: string;
}

export interface CopyDetail {
  name: string;
  tag: string;
  path: string;
  selector?: string;
  source?: { file: string; line: number };
  changeDetection?: string;
  encapsulation?: string;
  inputs: CopyProp[];
  outputs: CopyProp[];
  properties?: CopyProp[];
  listeners: string[];
  directives: { name: string; inputs: CopyProp[]; outputs: CopyProp[] }[];
  dependencies: { token: string; providedByName?: string; providedBy: string | null }[];
}

function valuesOf(props: readonly CopyProp[]): Record<string, unknown> {
  return Object.fromEntries(props.map((p) => [p.name, p.value ?? null]));
}

function outputsOf(props: readonly CopyProp[]): { name: string; listened: boolean }[] {
  return props.map((p) => ({ name: p.name, listened: !!p.listened }));
}

/**
 * The selected component as JSON for "Copy as JSON". It holds only what the
 * panel already has: the page serialized and masked every value before it
 * sent it (`serialize` and the redaction settings), so the copy carries the
 * same `[redacted]` markers and cut levels as the detail on screen.
 */
export function componentJson(detail: CopyDetail): string {
  const out: Record<string, unknown> = {
    component: detail.name,
    tag: detail.tag,
    hostPath: detail.path,
  };
  if (detail.selector) out['selector'] = detail.selector;
  if (detail.source) out['source'] = detail.source;
  if (detail.changeDetection) out['changeDetection'] = detail.changeDetection;
  if (detail.encapsulation) out['encapsulation'] = detail.encapsulation;
  out['inputs'] = valuesOf(detail.inputs);
  out['outputs'] = outputsOf(detail.outputs);
  out['properties'] = valuesOf(detail.properties ?? []);
  if (detail.listeners.length) out['listeners'] = detail.listeners;
  if (detail.directives.length) {
    out['directives'] = detail.directives.map((dir) => ({
      name: dir.name,
      inputs: valuesOf(dir.inputs),
      outputs: outputsOf(dir.outputs),
    }));
  }
  out['injected'] = detail.dependencies.map((dep) => ({
    token: dep.token,
    providedBy: dep.providedBy ? (dep.providedByName ?? 'an injector') : null,
  }));
  try {
    return JSON.stringify(out, null, 2);
  } catch {
    return JSON.stringify({ component: detail.name, tag: detail.tag, hostPath: detail.path });
  }
}

/**
 * The text "Copy host path" copies: a CSS selector that finds the host with
 * `document.querySelector`, or the component path (`app-root > app-list`)
 * from a page that sends no selector, such as an app on a device.
 */
export function hostPathText(detail: Pick<CopyDetail, 'path' | 'selector'>): string {
  return detail.selector || detail.path;
}
