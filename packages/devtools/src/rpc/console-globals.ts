import type { PangularInspector, ResolvedPangularConfig } from '../config.ts';
import {
  isConsoleTarget,
  type ConsoleGlobalResult,
  type ConsoleTarget,
} from '../console-handles.ts';

/**
 * The inspector behind each kind of "Store as global". Like the forms
 * inspector's Store as global, it changes nothing in the app, so no `actions`
 * key blocks it; turning the inspector off does.
 */
export const CONSOLE_TARGET_INSPECTOR: Record<ConsoleTarget['kind'], PangularInspector> = {
  component: 'components',
  provider: 'injectors',
  ngrx: 'ngrx',
};

const TIMEOUT_MS = 10_000;

interface Definition {
  name: string;
  type: 'action';
  jsonSerializable: true;
  handler: (message: never) => unknown;
}

export interface ConsoleGlobalsDeps {
  config: ResolvedPangularConfig;
  register: (definition: Definition) => void;
  broadcast: (message: { method: string; args: unknown[]; optional: true }) => void;
  /** Whether `pageId` may answer a request sent to `target` (see `answersFor` in devframe.ts). */
  answersFor: (target: string | undefined, pageId: unknown) => boolean;
  timeoutMs?: number;
}

/** Why the config blocks a target, or `null` when it may be stored. */
export function consoleTargetBlocked(
  target: ConsoleTarget,
  config: ResolvedPangularConfig,
): string | null {
  const inspector = CONSOLE_TARGET_INSPECTOR[target.kind];
  return config.inspectors[inspector]
    ? null
    : `The ${inspector} inspector is turned off in the devtools config.`;
}

/**
 * Panel -> `request-console-global` -> `console-global` on the one page that
 * owns `pageId` -> `console-global-result`. The page stores the value as
 * `tempN` and answers with the name; nothing else comes back.
 */
export function registerConsoleGlobals(deps: ConsoleGlobalsDeps) {
  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  deps.register({
    name: 'console-global-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
      if (typeof message?.requestId !== 'string') return;
      const entry = pending.get(message.requestId);
      if (entry && deps.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
    },
  });

  deps.register({
    name: 'request-console-global',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; target?: unknown } | null) =>
      new Promise<ConsoleGlobalResult>((resolve) => {
        const pageId = message?.pageId;
        const target = message?.target;
        if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) {
          return resolve({ ok: false, message: 'Pick the page to store the value in.' });
        }
        if (!isConsoleTarget(target)) {
          return resolve({ ok: false, message: 'Nothing to store.' });
        }
        const blocked = consoleTargetBlocked(target, deps.config);
        if (blocked) return resolve({ ok: false, message: blocked });
        const requestId = `g${++seq}`;
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve({
            ok: false,
            message: 'The page did not answer. Is the app still open in a browser?',
          });
        }, deps.timeoutMs ?? TIMEOUT_MS);
        timer.unref?.();
        pending.set(requestId, {
          pageId,
          settle: (result) => {
            clearTimeout(timer);
            pending.delete(requestId);
            const answer = (result ?? {}) as Partial<ConsoleGlobalResult>;
            resolve({
              ok: answer.ok === true,
              message: typeof answer.message === 'string' ? answer.message.slice(0, 500) : '',
              ...(typeof answer.name === 'string' && /^temp\d+$/.test(answer.name)
                ? { name: answer.name }
                : {}),
              ...(answer.masked === true ? { masked: true } : {}),
            });
          },
        });
        deps.broadcast({
          method: 'console-global',
          args: [{ requestId, pageId, target }],
          optional: true,
        });
      }),
  });
}
