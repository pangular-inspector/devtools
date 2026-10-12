import type { ComponentDetail, ComponentProp } from '../types.ts';
import { clip } from '../text.ts';
import { MAX_TOOL_CHARS, capped } from './router-tools.ts';

/** Longest JSON one input or property value keeps once the answer is over {@link MAX_TOOL_CHARS}. */
export const DETAIL_VALUE_MAX = 1_000;

/** Entries kept per list, tried in order until the answer fits. */
const LIST_STEPS = [40, 20, 10, 5, 1];

const FULL_DETAIL = 'The `detail` of the pangular:component-tree resource has every value in full.';
const NARROW = 'read the `detail` of the pangular:component-tree resource for every value in full';

type ListKey = 'inputs' | 'outputs' | 'properties' | 'listeners' | 'directives' | 'dependencies';

const LISTS: ListKey[] = [
  'inputs',
  'outputs',
  'properties',
  'listeners',
  'directives',
  'dependencies',
];

function clipValues(props: ComponentProp[], prefix: string, cut: string[]): ComponentProp[] {
  return props.map((prop) => {
    if (!('value' in prop)) return prop;
    const json = JSON.stringify(prop.value) ?? 'undefined';
    if (json.length <= DETAIL_VALUE_MAX) return prop;
    cut.push(`${prefix}${prop.name}`);
    return { ...prop, value: clip(json, DETAIL_VALUE_MAX) };
  });
}

/** The detail with every long value replaced by the start of its JSON, and the names of those values. */
function withClippedValues(detail: ComponentDetail) {
  const cut: string[] = [];
  const clipped: ComponentDetail = {
    ...detail,
    inputs: clipValues(detail.inputs, '', cut),
    properties: clipValues(detail.properties, '', cut),
    directives: detail.directives.map((directive) => ({
      ...directive,
      inputs: clipValues(directive.inputs, `${directive.name}.`, cut),
    })),
  };
  return { clipped, cut };
}

/**
 * The detail with each list, and the inputs and outputs of each directive it
 * keeps, cut to their first `keep` entries, and how many each list lost.
 */
function withShortLists(detail: ComponentDetail, keep: number) {
  const hidden: string[] = [];
  const short = { ...detail };
  for (const key of LISTS) {
    const list = detail[key] as unknown[];
    if (list.length <= keep) continue;
    hidden.push(`${list.length - keep} more ${key}`);
    (short as Record<ListKey, unknown[]>)[key] = list.slice(0, keep);
  }
  short.directives = short.directives.map((directive) => {
    const cut = { ...directive };
    for (const key of ['inputs', 'outputs'] as const) {
      if (directive[key].length <= keep) continue;
      hidden.push(`${directive[key].length - keep} more ${directive.name} ${key}`);
      cut[key] = directive[key].slice(0, keep);
    }
    return cut;
  });
  return { short, hidden };
}

function quoted(names: string[]): string {
  const shown = names.slice(0, 10).map((name) => `\`${name}\``);
  return `${shown.join(', ')}${names.length > 10 ? ` and ${names.length - 10} more` : ''}`;
}

/**
 * The inspect-component answer: a heading line and the detail as JSON. Past
 * {@link MAX_TOOL_CHARS} it cuts long values to {@link DETAIL_VALUE_MAX}
 * characters, then keeps fewer entries per list, and says what it left out.
 * Values arrive serialized and redacted by the page; this only shortens them.
 */
export function inspectComponentText(withLevels: ComponentDetail, heading: string): string {
  // The levels the panel opened; an agent reads its own with `path`.
  const { expanded: _expanded, ...detail } = withLevels;
  const answer = (value: ComponentDetail, notes: string[]) =>
    `${heading}${notes.length ? `\n\n${notes.join(' ')}` : ''}\n\n${JSON.stringify(value, null, 2)}`;
  const full = answer(detail, []);
  if (full.length <= MAX_TOOL_CHARS) return full;

  const { clipped, cut } = withClippedValues(detail);
  const notes = cut.length
    ? [
        `${cut.length} ${cut.length === 1 ? 'value is' : 'values are'} longer than ${DETAIL_VALUE_MAX.toLocaleString('en-US')} characters and ${cut.length === 1 ? 'shows' : 'show'} only the start of ${cut.length === 1 ? 'its' : 'their'} JSON: ${quoted(cut)}.`,
      ]
    : [];
  let text = answer(clipped, [...notes, FULL_DETAIL]);
  if (text.length <= MAX_TOOL_CHARS) return text;

  for (const keep of LIST_STEPS) {
    const { short, hidden } = withShortLists(clipped, keep);
    if (!hidden.length) continue;
    text = answer(short, [
      ...notes,
      `Each list shows its first ${keep} ${keep === 1 ? 'entry' : 'entries'}: ${hidden.join(', ')} not shown.`,
      FULL_DETAIL,
    ]);
    if (text.length <= MAX_TOOL_CHARS) return text;
  }
  return capped(text, NARROW);
}
