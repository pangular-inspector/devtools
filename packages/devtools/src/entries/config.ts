// The published `@pangular-inspector/devtools/config` entry: the `PangularConfig` type, its
// defaults and the function that fills them in. The rest of `config.ts` is shared between the
// server, the overlay and the panel, and stays internal so it can change between minor releases.
export {
  DEFAULT_POPUP_HOTKEY,
  PANGULAR_ACTIONS,
  PANGULAR_INSPECTORS,
  PANGULAR_LIMITS,
  resolvePangularConfig,
  type PangularAction,
  type PangularConfig,
  type PangularInspector,
  type PangularLimit,
  type PluginSwitchInput,
  type ResolvedPangularConfig,
} from '../config.ts';
