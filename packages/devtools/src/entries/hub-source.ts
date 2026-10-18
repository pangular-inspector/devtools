// `@pangular-inspector/devtools/hub` inside this workspace: the same names as the published
// entry (`hub.ts` in this folder), from the hub's sources rather than through the loader, which
// needs the built package.
export {
  PANGULAR_HUB_BASE,
  hubEnabled,
  initPangularHub,
  type PangularConfig,
  type PangularHubOptions,
} from '../hub.ts';
