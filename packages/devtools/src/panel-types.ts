/**
 * The report shapes the panel (`app/`) reads, for the panel's own imports.
 * Internal: a workspace-only `exports` entry (`./internal/types`) that
 * `publishConfig` leaves out, like `./internal/config`. Type-only
 * re-exports, so nothing from the package ends up in the panel bundle;
 * `panel-types.test.ts` keeps it that way.
 */
export type {
  DependencyInfo,
  InjectorInfo,
  InjectorTreeLimits,
  InjectorTreeNode,
  InjectorTreeReport,
  ProviderInfo,
  SignalChange,
  SignalGraphElement,
  SignalGraphNode,
  SignalWriteLocator,
} from './types.ts';
