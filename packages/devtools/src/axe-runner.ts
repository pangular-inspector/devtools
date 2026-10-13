import { blockOwnerOf, type BlockOwnerDebugNg } from './block-owner.ts';
import { elementId } from './element-id.ts';
import { POPUP_ROOT_ID } from './panel-frame.ts';
import { redactUrl } from './router.ts';
import { REDACTED } from './forms-privacy.ts';
import { redactText } from './serialize.ts';
import { clip } from './text.ts';

/**
 * The elements the overlay adds to the page: the popup, the change detection
 * flash layer, the hydration outline and the highlight box. An axe pass skips
 * them, so it reports on the app only.
 */
export const OVERLAY_HOST_IDS = [
  POPUP_ROOT_ID,
  'pangular-cd-flash',
  'pangular-hydration-overlay',
  'pangular-highlight',
] as const;

/** Rules a report keeps, the ones with the most nodes first. */
export const MAX_AXE_RULES = 100;
/** Nodes a report keeps per rule. */
export const MAX_AXE_NODES = 20;
const MAX_TARGET = 200;
const MAX_SUMMARY = 400;
const MAX_HTML = 240;
const MAX_ATTRIBUTE = 60;
const MAX_TAGS = 8;

/** Attributes a node snippet keeps. The rest, `value` and text content included, never leave the page. */
const SNIPPET_ATTRIBUTES = [
  'id',
  'class',
  'role',
  'type',
  'name',
  'for',
  'alt',
  'href',
  'src',
  'title',
  'tabindex',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-hidden',
  'aria-expanded',
];

/**
 * Attributes that hold text people read, so they can hold personal data
 * (`aria-label="Ada Lovelace"`) that pattern masking misses. Their values are
 * always replaced; the rest identify the element and are masked by pattern.
 */
const FREE_TEXT_ATTRIBUTES = new Set(['alt', 'title', 'aria-label', 'name']);

export type AxeImpact = 'critical' | 'serious' | 'moderate' | 'minor';

/** One element that breaks a rule. */
export interface AxeNode {
  /** axe's CSS selector for the element, masked. */
  target: string;
  /** The element's opening tag with a few attributes, values masked, no text content. */
  html: string;
  /** axe's "Fix any of the following" summary, masked. */
  summary?: string;
  impact?: AxeImpact;
  /** The element id the Components tab and `highlight` use. */
  elementId?: string;
  /** The component whose template holds the element. */
  owner?: { id: string; name: string };
}

/** One axe rule the page breaks. */
export interface AxeViolation {
  /** The rule id, such as `image-alt`. */
  id: string;
  impact?: AxeImpact;
  /** axe's one-line description of the rule, such as "Images must have alternative text". */
  help: string;
  /** The rule's page on Deque University. */
  helpUrl?: string;
  /** WCAG and best-practice tags, such as `wcag2a` or `wcag111`. */
  tags: string[];
  /** All elements that break the rule, listed or not. */
  count: number;
  nodes: AxeNode[];
}

/** What one axe pass over the app found. */
export interface AxeReport {
  /** The page clock when the pass finished. */
  at: number;
  /** How long the pass took, in ms. */
  ms: number;
  /** The page's URL, masked. */
  url: string;
  /** The axe-core version that ran. */
  version?: string;
  violations: AxeViolation[];
  /** Rules left out past {@link MAX_AXE_RULES}. */
  droppedRules?: number;
}

/** The answer to one `axe-run` request. */
export type AxeRunResult = { ok: true; report: AxeReport } | { ok: false; error: string };

interface AxeNodeResult {
  target?: unknown;
  failureSummary?: unknown;
  impact?: unknown;
  element?: unknown;
}

interface AxeResult {
  id?: unknown;
  impact?: unknown;
  help?: unknown;
  helpUrl?: unknown;
  tags?: unknown;
  nodes?: unknown;
}

/** The parts of axe-core the runner calls. */
export interface AxeLike {
  version?: string;
  run(
    context: unknown,
    options: Record<string, unknown>,
  ): Promise<{ violations?: AxeResult[] } | undefined>;
}

interface AxeRpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register?(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      handler: (message: never) => unknown;
    }): void;
  };
}

export interface AxeRunnerOptions {
  /** Loads axe-core. Defaults to a dynamic import, so the overlay bundle does not carry it. */
  loadAxe?: () => Promise<unknown>;
  doc?: Document;
  now?: () => number;
}

export interface AxeRunner {
  /** Runs one pass now. One pass at a time; a second call waits for the first. */
  run(): Promise<AxeRunResult>;
  stop(): void;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const IMPACTS: readonly AxeImpact[] = ['critical', 'serious', 'moderate', 'minor'];
const impactOf = (value: unknown): AxeImpact | undefined =>
  IMPACTS.includes(value as AxeImpact) ? (value as AxeImpact) : undefined;

/** axe's target: a selector list, with nested lists for shadow DOM. */
function targetText(value: unknown): string {
  const flat = (part: unknown): string =>
    Array.isArray(part) ? part.map(flat).join(' >>> ') : typeof part === 'string' ? part : '';
  return clip(
    redactText(Array.isArray(value) ? value.map(flat).join(', ') : flat(value)),
    MAX_TARGET,
  );
}

/** The element's opening tag with the attributes in {@link SNIPPET_ATTRIBUTES}, values masked. */
export function nodeSnippet(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const attributes: string[] = [];
  for (const name of SNIPPET_ATTRIBUTES) {
    const value = el.getAttribute(name);
    if (value === null) continue;
    const masked = FREE_TEXT_ATTRIBUTES.has(name)
      ? REDACTED
      : name === 'href' || name === 'src'
        ? redactUrl(value)
        : redactText(value);
    attributes.push(value === '' ? name : `${name}="${clip(masked, MAX_ATTRIBUTE)}"`);
  }
  return clip(`<${tag}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`, MAX_HTML);
}

function axeOf(module: unknown): AxeLike | null {
  const candidates = [(module as { default?: unknown } | null)?.default, module];
  for (const candidate of candidates) {
    if (candidate && typeof (candidate as AxeLike).run === 'function') return candidate as AxeLike;
  }
  return null;
}

/**
 * The debug API the axe pass names element owners with: `getNg` with the
 * Components inspector on, nothing otherwise, since the owner (class name
 * and instance id) is component data that inspector gates.
 */
export function axeOwnerNg(
  componentsOn: boolean,
  getNg: () => BlockOwnerDebugNg | undefined,
): () => BlockOwnerDebugNg | undefined {
  return componentsOn ? getNg : () => undefined;
}

/**
 * Runs axe-core over the app when the server asks (`axe-run`), never on its
 * own, and answers with `axe-result`. axe-core is loaded on the first request
 * through a dynamic import, so pages that never run a pass don't download it.
 * The pass leaves out the overlay's own elements ({@link OVERLAY_HOST_IDS}) and
 * frames, and reports violations only. Text leaves the page masked: selectors
 * and summaries go through `redactText`, node snippets keep the opening tag
 * with a few attributes and no text content, and each node names the
 * component whose template holds it.
 */
export function attachAxe(
  my: AxeRpc,
  pageId: string,
  getNg: () => BlockOwnerDebugNg | undefined,
  options: AxeRunnerOptions = {},
): AxeRunner {
  const now = options.now ?? Date.now;
  const loadAxe = options.loadAxe ?? (() => import('axe-core'));
  let stopped = false;
  let running: Promise<AxeRunResult> | null = null;

  const nodeOf = (result: AxeNodeResult, ng: BlockOwnerDebugNg | undefined): AxeNode => {
    const el = result.element;
    const isElement = typeof Element !== 'undefined' && el instanceof Element;
    const summary =
      typeof result.failureSummary === 'string'
        ? clip(redactText(result.failureSummary), MAX_SUMMARY)
        : '';
    const owner =
      isElement && ng ? read(() => blockOwnerOf(ng, el as Element), undefined) : undefined;
    const impact = impactOf(result.impact);
    return {
      target: targetText(result.target),
      html: isElement ? nodeSnippet(el as Element) : '',
      ...(summary ? { summary } : {}),
      ...(impact ? { impact } : {}),
      ...(isElement ? { elementId: elementId(el as Element) } : {}),
      ...(owner ? { owner: { id: owner.id, name: owner.name } } : {}),
    };
  };

  const violationOf = (
    result: AxeResult,
    ng: BlockOwnerDebugNg | undefined,
  ): AxeViolation | null => {
    if (typeof result.id !== 'string' || !result.id) return null;
    const nodes = Array.isArray(result.nodes) ? (result.nodes as AxeNodeResult[]) : [];
    const impact = impactOf(result.impact);
    const tags = Array.isArray(result.tags)
      ? result.tags
          .filter(
            (tag): tag is string =>
              typeof tag === 'string' && /^(wcag|best-practice|section508)/.test(tag),
          )
          .slice(0, MAX_TAGS)
      : [];
    return {
      id: clip(result.id, 80),
      ...(impact ? { impact } : {}),
      help: typeof result.help === 'string' ? clip(result.help, 200) : result.id,
      ...(typeof result.helpUrl === 'string' ? { helpUrl: clip(result.helpUrl, 300) } : {}),
      tags,
      count: nodes.length,
      nodes: nodes.slice(0, MAX_AXE_NODES).map((node) => nodeOf(node, ng)),
    };
  };

  const pass = async (): Promise<AxeRunResult> => {
    const doc = options.doc ?? (typeof document === 'undefined' ? undefined : document);
    if (!doc) return { ok: false, error: 'This page has no DOM to check.' };
    let axe: AxeLike | null;
    try {
      axe = axeOf(await loadAxe());
    } catch (error) {
      return {
        ok: false,
        error: `axe-core could not be loaded: ${clip(redactText(String((error as Error)?.message ?? error)), 300)}`,
      };
    }
    if (!axe) return { ok: false, error: 'axe-core loaded without a run() function.' };
    const exclude = OVERLAY_HOST_IDS.filter((id) => doc.getElementById(id)).map((id) => [`#${id}`]);
    const started = now();
    let results: Awaited<ReturnType<AxeLike['run']>>;
    try {
      results = await axe.run(exclude.length ? { include: [doc], exclude } : doc, {
        resultTypes: ['violations'],
        elementRef: true,
        iframes: false,
        performanceTimer: false,
      });
    } catch (error) {
      return {
        ok: false,
        error: `axe-core failed: ${clip(redactText(String((error as Error)?.message ?? error)), 300)}`,
      };
    }
    const ng = getNg();
    const violations = (results?.violations ?? [])
      .map((result) => violationOf(result, ng))
      .filter((item): item is AxeViolation => item !== null)
      .sort((a, b) => b.count - a.count);
    const report: AxeReport = {
      at: now(),
      ms: Math.max(0, Math.round(now() - started)),
      url: read(() => redactUrl(doc.location?.href ?? ''), ''),
      ...(typeof axe.version === 'string' ? { version: clip(axe.version, 20) } : {}),
      violations: violations.slice(0, MAX_AXE_RULES),
      ...(violations.length > MAX_AXE_RULES
        ? { droppedRules: violations.length - MAX_AXE_RULES }
        : {}),
    };
    return { ok: true, report };
  };

  const run = () => {
    // axe refuses a second run while one is going, so callers share it.
    running ??= pass().finally(() => {
      running = null;
    });
    return running;
  };

  my.rpc.register?.({
    name: 'axe-run',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown } | null) => {
      if (stopped || !message || message.pageId !== pageId) return;
      if (typeof message.requestId !== 'string') return;
      const requestId = message.requestId;
      void run().then((result) =>
        my.rpc.call('axe-result', { requestId, pageId, result }).catch(() => {}),
      );
    },
  });

  return {
    run,
    stop() {
      stopped = true;
    },
  };
}
