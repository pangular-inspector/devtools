// The published `@pangular-inspector/devtools` and `/devframe` entries: the public config types
// and defaults, which import nothing, and the devframe definition, `createPangular()` and
// `initDevframe()`, loaded from `node_modules` when the entry is imported (`devframe-entry.ts`).
// Inside this workspace the same names come from `devframe.ts` in this folder.
import { loadDevframeServer } from '../devframe-entry.ts';

export * from './config.ts';
export type { PangularHostOptions } from './devframe.ts';

const server = loadDevframeServer();

/** The devframe definition with options. */
export const createPangular: typeof server.createPangular = server.createPangular;

/** devframe's `initDevframe()`, from the copy this package depends on. */
export const initDevframe: typeof server.initDevframe = server.initDevframe;

/** The devframe definition with the default options. */
const pangular: typeof server.default = server.default;
export default pangular;
