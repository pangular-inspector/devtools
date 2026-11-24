/**
 * `@defer` block notes. They live in an entry without imports, re-exported by
 * `config.ts`, so the defer-blocks agent tool and the panel's Defer blocks list
 * word them the same.
 */

/** How long a block may sit on its placeholder before the notes call it stuck. */
export const STUCK_PLACEHOLDER_MS = 10_000;

/** The fields of a `@defer` block the notes read (`DeferBlockInfo` in `types.ts`). */
export interface DeferNoteBlock {
  state: string;
  hydration: string;
  hydrateNever?: boolean;
  triggers: string[];
  /** Page clock, ms since epoch, when the state or hydration state last changed. */
  since: number;
  /** Page clock, ms since epoch, when the overlay saw the block hydrate. */
  hydratedAt?: number;
}

/**
 * The hydration state of a block as the panel and the defer-blocks tool word
 * it. A block that is `hydrated` without a `hydratedAt` hydrated before the
 * overlay attached, so no one saw it happen.
 */
export function deferHydrationLabel(
  block: Pick<DeferNoteBlock, 'hydration' | 'hydratedAt'>,
): string {
  if (block.hydration === 'hydrated' && block.hydratedAt === undefined) {
    return 'hydrated before inspection';
  }
  return block.hydration;
}

export interface DeferNote {
  kind: 'failed' | 'stuck' | 'waiting' | 'hydrate-never' | 'dehydrated';
  /** The words the agent tool prints. */
  text: string;
  /** The short badge the panel shows. */
  label: string;
  /** For `stuck` and `waiting`: the age in seconds that `label` ends with. */
  seconds?: number;
}

/** Triggers that wait for the user, so a long wait on the placeholder is normal. */
const USER_TRIGGER = /^on (viewport|interaction|hover)\b/;

/**
 * Whether a block waits only for the user: every main trigger (not `prefetch`
 * or `hydrate`) is `on viewport`, `on interaction` or `on hover`.
 */
function waitsForUser(triggers: string[]): boolean {
  const main = triggers.filter((trigger) => !/^(prefetch|hydrate) /.test(trigger));
  return main.length > 0 && main.every((trigger) => USER_TRIGGER.test(trigger));
}

/**
 * What stands out about a block: it failed, it sat on its placeholder for
 * {@link STUCK_PLACEHOLDER_MS} or more (`waiting` when only the user can
 * trigger it), or its server HTML is not hydrated. `pageNow` is the page's
 * clock, the one `since` is on.
 */
export function deferNotes(block: DeferNoteBlock, pageNow: number): DeferNote[] {
  const notes: DeferNote[] = [];
  // A page that sent no time (`since` 0) gets no age, so no stuck or waiting note.
  const age = block.since > 0 ? Math.max(0, Math.round((pageNow - block.since) / 1000)) : 0;
  if (block.state === 'error')
    notes.push({ kind: 'failed', text: 'failed to load', label: 'failed' });
  if (
    (block.state === 'placeholder' || block.state === 'initial') &&
    age * 1000 >= STUCK_PLACEHOLDER_MS
  ) {
    notes.push(
      waitsForUser(block.triggers)
        ? {
            kind: 'waiting',
            text: `waiting for its trigger for ${age}s`,
            label: `waiting ${age}s`,
            seconds: age,
          }
        : {
            kind: 'stuck',
            text: `on its placeholder for ${age}s`,
            label: `stuck ${age}s`,
            seconds: age,
          },
    );
  }
  if (block.hydrateNever) {
    notes.push({
      kind: 'hydrate-never',
      text: 'hydrate never: the server HTML stays static',
      label: 'hydrate never',
    });
  } else if (block.hydration === 'dehydrated') {
    notes.push({ kind: 'dehydrated', text: 'still dehydrated', label: 'dehydrated' });
  }
  return notes;
}
