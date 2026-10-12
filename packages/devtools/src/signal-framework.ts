import type { SignalGraphEdge, SignalGraphNode } from './types.ts';

/**
 * The debug names Angular's own packages give the signals they create in dev
 * mode (`@angular/router`, `@angular/forms` and `@angular/common/http`).
 * Resource internals are left out: `groupResources` already folds them.
 * `signal-framework.test.ts` checks every name against the installed builds.
 */
export const FRAMEWORK_SIGNAL_NAMES: ReadonlySet<string> = new Set([
  // @angular/router
  '_fragment',
  '_info',
  '_preserveFragment',
  '_queryParams',
  '_queryParamsHandling',
  '_relativeTo',
  '_replaceUrl',
  '_skipLocationChange',
  '_state',
  '_target',
  '_urlTree',
  'blockingEffect',
  'browserUrl',
  'currentNavigation',
  'dataSignal',
  'effectRef',
  'fragment',
  'fragmentSignal',
  'frozenSnapshot',
  'isRollbackRecoveryPending',
  'lastSuccessfulNavigation',
  'paramMapSignal',
  'paramsSignal',
  'path',
  'pendingSignal',
  'queryParamMapSignal',
  'queryParams',
  'queryParamsSignal',
  'reactiveHref',
  'routerLinkInput',
  'routerOutletData',
  // @angular/forms (Signal Forms and the reactive forms signals)
  'EMPTY',
  'EMPTY_ARRAY_SIGNAL',
  'FALSE',
  'FALSE_SIGNAL',
  'ROOT_KEY_IN_PARENT',
  'ROOT_PATH_KEYS',
  '_hasRequired',
  '_pristine',
  '_status',
  '_submitted',
  '_submittedReactive',
  '_touched',
  'asyncErrors',
  'children',
  'childrenMap',
  'convertedParseErrors',
  'debouncer',
  'dirty',
  'disabled',
  'disabledReasons',
  'errorSummary',
  'errors',
  'field',
  'fieldTree',
  'formFieldBindings',
  'hidden',
  'index',
  'invalid',
  'isNonInteractive',
  'isOrphaned',
  'keyInParent',
  'keyOrOrphan',
  'name',
  'parseErrors',
  'parseErrorsSource',
  'pathKeys',
  'pending',
  'pendingSync',
  'pristineReactive',
  'rawAsyncErrors',
  'rawSyncTreeErrors',
  'rawValue',
  'readonly',
  'resolver',
  'selfDirty',
  'selfSubmitting',
  'selfTouched',
  'shouldSkipValidation',
  'signalOfControlSignal',
  'state',
  'status',
  'statusReactive',
  'submissionErrors',
  'submittedReactive',
  'submitting',
  'syncErrors',
  'syncTreeErrors',
  'syncValid',
  'touched',
  'touchedReactive',
  'valid',
  'wrappedParams',
]);

/** Kinds Angular creates with a name and that never hold app state on their own. */
const DERIVED_KINDS = new Set(['computed', 'linkedSignal', 'effect', 'afterRenderEffectPhase']);

/** A signal field of the inspected component, which always counts as app code. */
export interface OwnSignal {
  label?: string;
  kind?: string;
  epoch?: number;
}

function isOwn(node: SignalGraphNode, own: readonly OwnSignal[]): boolean {
  return own.some(
    (field) =>
      field.kind === node.kind &&
      field.epoch === node.epoch &&
      (field.label ?? undefined) === (node.label ?? undefined),
  );
}

/**
 * The indices of the nodes Angular's own code created rather than the app.
 * A node counts as framework-internal when it is not a template, not a signal
 * field of the inspected component, not part of a folded resource, and:
 * - its debug name is one of `FRAMEWORK_SIGNAL_NAMES` and it is a computed,
 *   linkedSignal or effect, or a signal that only framework nodes read; or
 * - it has no debug name, it is not an effect, and only framework nodes read it
 *   (the unnamed inputs behind a framework computed).
 * A writable signal that an app template, effect or computed reads stays app
 * code even with a framework-like name such as `status`.
 */
export function frameworkNodes(
  nodes: readonly SignalGraphNode[],
  edges: readonly SignalGraphEdge[],
  own: readonly OwnSignal[] = [],
  resourceIds: ReadonlySet<string> = new Set(),
): Set<number> {
  const consumersOf = nodes.map(() => [] as number[]);
  for (const edge of edges) consumersOf[edge.producer]?.push(edge.consumer);
  const candidate = nodes.map(
    (node) =>
      node.kind !== 'template' &&
      !resourceIds.has(node.id) &&
      !isOwn(node, own) &&
      (!node.label || FRAMEWORK_SIGNAL_NAMES.has(node.label)),
  );
  const framework = new Set<number>();
  for (const [i, node] of nodes.entries()) {
    if (candidate[i] && node.label && DERIVED_KINDS.has(node.kind)) framework.add(i);
  }
  // Signals and unnamed nodes join once every reader is framework code; repeat
  // until nothing changes, since a chain can be several nodes deep.
  let changed = framework.size > 0;
  while (changed) {
    changed = false;
    for (const [i, node] of nodes.entries()) {
      if (framework.has(i) || !candidate[i]) continue;
      if (!node.label && (node.kind === 'effect' || node.kind === 'afterRenderEffectPhase')) {
        continue;
      }
      const readers = consumersOf[i]!;
      if (readers.length && readers.every((reader) => framework.has(reader))) {
        framework.add(i);
        changed = true;
      }
    }
  }
  return framework;
}
