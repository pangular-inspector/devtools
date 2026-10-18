// The published `@pangular-inspector/devtools` and `/devframe` entries: the devframe definition
// (the default export), `createPangular()` and `initDevframe()` for custom hosts, plus the public
// config types and defaults.
export * from './config.ts';
export { createPangular, initDevframe, type PangularHostOptions } from '../devframe.ts';
export { default } from '../devframe.ts';
