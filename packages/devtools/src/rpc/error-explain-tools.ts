// The explainers of the Errors inspector on the server: the shapes a page
// sends with an NG0100, a hydration mismatch or a missing provider, checked
// and masked again here, and the markdown `explain-error` adds for them.

import { diffDom, diffText, type DiffLine } from '../dom-diff.ts';
import { REDACTED, redactText } from '../serialize.ts';
import { clip } from '../text.ts';
import { code } from './forms-tools.ts';

/** A signal written just before Angular's check, with the value the binding now reads. */
export interface ExplainWrite {
  /** The signal's `debugName`. */
  signal: string;
  at: number;
  /** The first app frames of the code that wrote it, when write stacks were on. */
  stack?: string[];
}

/** NG0100: a binding read a different value when Angular checked it again. */
export interface ExpressionChangedExplain {
  kind: 'expression-changed';
  /** The property Angular names (`for 'title'`), missing for a text interpolation. */
  binding?: string;
  /** The compiled template function on the stack, such as `App_Template` or `App_Conditional_2_Template`. */
  template?: string;
  /** The value of the first check, as Angular prints it (masked, at most 200 characters). */
  previous: string;
  /** The value of the second check. */
  current: string;
  /** The values are hidden: the binding or a component field holding them has a secret-looking name. */
  masked?: boolean;
  /** Angular says the view was created after its parent was checked (created in a hook). */
  creation?: boolean;
  /** Fields of the component that hold the current value now, the likely sources of the binding. */
  members?: string[];
  /** Named signals written with the current value shortly before the error. */
  writes?: ExplainWrite[];
  /** Whether the page hears signal writes at all (Signals inspector on, Angular 20.0+). */
  writesKnown?: boolean;
}

/** NG0500 to NG0503: the DOM the client found did not match the server HTML. */
export interface HydrationMismatchExplain {
  kind: 'hydration-mismatch';
  /** Angular's first sentence, such as `During hydration Angular expected <div> but found <span>.` */
  summary?: string;
  /** The server DOM Angular expected around the node, as Angular describes it. */
  expected?: string;
  /** The client DOM Angular found there. */
  actual?: string;
  /** Angular suspects a browser extension or third-party script changed the DOM. */
  external?: boolean;
  /** Line diff of `expected` and `actual`, built by the server. */
  diff?: DiffLine[];
}

/** NG0201 and NullInjectorError: no injector on the lookup path provides a token. */
export interface MissingProviderExplain {
  kind: 'missing-provider';
  /** The token no injector provided, named like the Injectors tab names it. */
  token: string;
  /** Angular's dependency path, requester first (`App -> Api -> HttpClient`). */
  path?: string[];
  /** The injector Angular names as the source (`Standalone[App]`, `NodeInjector`). */
  source?: string;
}

export type ErrorExplain =
  ExpressionChangedExplain | HydrationMismatchExplain | MissingProviderExplain;

export const MAX_VALUE_TEXT = 200;
export const MAX_DOM_TEXT = 3000;
const MAX_NAME = 120;
const MAX_WRITES = 5;
const MAX_MEMBERS = 10;
const MAX_PATH = 20;
const MAX_FRAMES = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const str = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value ? clip(redactText(value), max) : undefined;

const names = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && !!item)
        .slice(0, max)
        .map((item) => clip(redactText(item), MAX_NAME))
    : [];

function toWrite(value: unknown): ExplainWrite | null {
  if (!isRecord(value) || typeof value['at'] !== 'number') return null;
  const signal = str(value['signal'], MAX_NAME);
  if (!signal) return null;
  const stack = names(value['stack'], MAX_FRAMES).map((frame) => clip(frame, 200));
  return { signal, at: value['at'], ...(stack.length ? { stack } : {}) };
}

/** Checks and masks the explainer a page sent with an error group; `undefined` when there is none. */
export function toErrorExplain(value: unknown): ErrorExplain | undefined {
  if (!isRecord(value)) return undefined;
  switch (value['kind']) {
    case 'expression-changed': {
      const masked = value['masked'] === true;
      const previous = masked ? REDACTED : (str(value['previous'], MAX_VALUE_TEXT) ?? '');
      const current = masked ? REDACTED : (str(value['current'], MAX_VALUE_TEXT) ?? '');
      const binding = str(value['binding'], MAX_NAME);
      const template = str(value['template'], MAX_NAME);
      const members = names(value['members'], MAX_MEMBERS);
      const writes = Array.isArray(value['writes'])
        ? value['writes']
            .slice(0, MAX_WRITES)
            .map(toWrite)
            .filter((w): w is ExplainWrite => !!w)
        : [];
      return {
        kind: 'expression-changed',
        previous,
        current,
        ...(binding ? { binding } : {}),
        ...(template ? { template } : {}),
        ...(masked ? { masked } : {}),
        ...(value['creation'] === true ? { creation: true } : {}),
        ...(members.length ? { members } : {}),
        ...(writes.length ? { writes } : {}),
        ...(typeof value['writesKnown'] === 'boolean' ? { writesKnown: value['writesKnown'] } : {}),
      };
    }
    case 'hydration-mismatch': {
      const summary = str(value['summary'], 500);
      const expected = str(value['expected'], MAX_DOM_TEXT);
      const actual = str(value['actual'], MAX_DOM_TEXT);
      // The diff is built here from the masked sides, never taken from the page.
      const diff = expected || actual ? diffDom(expected, actual) : [];
      return {
        kind: 'hydration-mismatch',
        ...(summary ? { summary } : {}),
        ...(expected ? { expected } : {}),
        ...(actual ? { actual } : {}),
        ...(value['external'] === true ? { external: true } : {}),
        ...(diff.length ? { diff } : {}),
      };
    }
    case 'missing-provider': {
      const token = str(value['token'], MAX_NAME);
      if (!token) return undefined;
      const path = names(value['path'], MAX_PATH);
      const source = str(value['source'], MAX_NAME);
      return {
        kind: 'missing-provider',
        token,
        ...(path.length ? { path } : {}),
        ...(source ? { source } : {}),
      };
    }
    default:
      return undefined;
  }
}

function fence(text: string): string {
  return ['```text', text.replace(/```/g, "'''"), '```'].join('\n');
}

/** The markdown section `explain-error` adds for a group with an explainer. */
export function explainSection(
  explain: ErrorExplain,
  owner: { id: string; name: string } | undefined,
): string {
  const component = owner
    ? `${code(owner.name)} (instance ${code(owner.id)})`
    : 'the component Angular names';
  switch (explain.kind) {
    case 'expression-changed': {
      const lines = [
        '**What changed** (NG0100 explainer):',
        '',
        `- Component: ${component}.`,
        `- Binding: ${explain.binding ? `the ${code(explain.binding)} property` : 'a text interpolation or a binding Angular does not name'}${explain.template ? `, in the template function ${code(explain.template)}` : ''}.`,
        `- Previous value: ${code(explain.previous)}. Current value: ${code(explain.current)}.${explain.masked ? ' Both are hidden because the binding or the field that holds them has a secret-looking name.' : ''}`,
      ];
      if (explain.members?.length) {
        lines.push(
          `- Fields of the component that hold the current value now: ${explain.members.map(code).join(', ')}.`,
        );
      }
      if (explain.creation) {
        lines.push(
          '- Angular says the view was created after its parent and children were checked, so a change detection hook (such as ngAfterViewInit) created it.',
        );
      }
      if (explain.writes?.length) {
        for (const write of explain.writes) {
          lines.push(
            `- Signal ${code(write.signal)} was written with this value just before the check${
              write.stack?.length
                ? `, from ${write.stack.map(code).join(' < ')}.`
                : '. Turn on write stacks (the Signals tab, or pangular:watch-signal with `stacks: true`) and reproduce to see the code that wrote it.'
            }`,
          );
        }
      } else if (explain.writesKnown) {
        lines.push(
          '- No named signal was written with this value just before the check. Look for code that sets a field the template reads during change detection: a lifecycle hook such as ngAfterViewInit or ngAfterViewChecked, a getter that returns a new value on each call, or a child that changes its parent state.',
        );
      } else {
        lines.push(
          '- Where it was written is unknown: the page does not report signal writes (the Signals inspector is off, or Angular is older than 20.0).',
        );
      }
      return lines.join('\n');
    }
    case 'hydration-mismatch': {
      const lines = ['**Server vs client DOM** (hydration mismatch explainer):', ''];
      if (explain.summary) lines.push(explain.summary, '');
      lines.push(`Component: ${component}.`);
      if (explain.diff?.length) {
        lines.push(
          '',
          'Diff of the server HTML Angular expected (`-`) and the client DOM it found (`+`); `<-- AT THIS LOCATION` marks the node Angular means:',
          '',
          fence(diffText(explain.diff)),
        );
      } else {
        lines.push('', 'Angular described neither side of the mismatch.');
      }
      if (explain.external) {
        lines.push(
          '',
          'Angular thinks a browser extension or third-party script may have changed the DOM before hydration. Try a clean browser profile, or add `ngSkipHydration` to the host.',
        );
      }
      return lines.join('\n');
    }
    case 'missing-provider':
      return [
        '**Missing provider** explainer:',
        '',
        `- Token: ${code(explain.token)}.`,
        explain.path?.length
          ? `- Dependency path, requester first: ${explain.path.map(code).join(' -> ')}.`
          : '',
        explain.source ? `- Source injector: ${code(explain.source)}.` : '',
        `- Walk the lookup: pangular:explain-injection with \`selector\` ${owner ? code(owner.id) : '(the component)'} and \`token\` ${code(explain.token)} lists each injector Angular asks and why the lookup stops.`,
      ]
        .filter(Boolean)
        .join('\n');
  }
}
