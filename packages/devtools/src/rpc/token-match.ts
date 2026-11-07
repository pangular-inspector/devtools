// Matching DI tokens in an injector report. Agents name a token (`CartStore`,
// `API_URL`), but two tokens can share a name (two `new InjectionToken('config')`),
// so the page gives each token object an id (`tokenId`, `token-id.ts`). A name
// that fits one token resolves to its id; a name that fits several answers
// with the candidates, and the agent passes `tokenId` to pick one. Reports from
// older overlays carry no ids and match by name, as before.

import type { InjectorPage, InjectorTreeNode } from '../types.ts';
import { code } from './forms-tools.ts';

/** A provider or dependency entry, as far as token matching goes. */
export interface TokenEntry {
  token: string;
  tokenId?: string;
  /** A signal store's class name, when the server renamed `token`. */
  tokenClass?: string;
}

/** The token a tool call means: its name, and its id when the report has one. */
export interface TokenPick {
  name: string;
  id?: string;
}

export interface TokenCandidate {
  tokenId: string;
  token: string;
  /** Up to five injectors that provide it, as `Name (id)`. */
  providedBy: string[];
  /** How many injections on the page ask for it. */
  injections: number;
}

/** Longest `tokenId` taken. */
export const MAX_TOKEN_ID_CHARS = 100;

/** The JSON schema of the `tokenId` argument, shared by the injector tools. */
export const TOKEN_ID_ARGUMENT = {
  type: 'string',
  description:
    'Optional. The `tokenId` of the token (`tok-3`), from the injector tree or from an answer that lists several tokens with the same name. Pass it when two tokens share a name, such as two `InjectionToken` with the description `config`.',
} as const;

function flatten(nodes: InjectorTreeNode[], out: InjectorTreeNode[] = []): InjectorTreeNode[] {
  for (const node of nodes) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

const lower = (text: string) => text.trim().toLowerCase();

/** Whether the entry carries `name`, as its token or, for a signal store, its class name. */
export function hasTokenName(entry: TokenEntry, name: string): boolean {
  const want = lower(name);
  return lower(entry.token) === want || (!!entry.tokenClass && lower(entry.tokenClass) === want);
}

/** Whether the entry is the token `pick` means: by id when both have one, else by name. */
export function matchesToken(entry: TokenEntry, pick: TokenPick): boolean {
  if (pick.id && entry.tokenId) return entry.tokenId === pick.id;
  return hasTokenName(entry, pick.name);
}

/** The distinct tokens named `name` among `nodes`, by id. Entries without an id are left out. */
export function tokenCandidates(nodes: InjectorTreeNode[], name: string): TokenCandidate[] {
  const found = new Map<string, TokenCandidate>();
  const note = (entry: TokenEntry) => {
    if (!entry.tokenId || !hasTokenName(entry, name)) return undefined;
    let candidate = found.get(entry.tokenId);
    if (!candidate) {
      candidate = { tokenId: entry.tokenId, token: entry.token, providedBy: [], injections: 0 };
      found.set(entry.tokenId, candidate);
    }
    return candidate;
  };
  for (const node of nodes) {
    for (const provider of node.providers) {
      const candidate = note(provider);
      const where = `${node.injector.name} (${node.injector.id})`;
      if (candidate && candidate.providedBy.length < 5 && !candidate.providedBy.includes(where)) {
        candidate.providedBy.push(where);
      }
    }
    for (const dep of node.dependencies ?? []) {
      const candidate = note(dep);
      if (candidate) candidate.injections++;
    }
  }
  return [...found.values()];
}

/**
 * The token a tool call means. With `tokenId`, the token with that id (an
 * error when the page has none). With a name only, the one token that has it,
 * or `ambiguous` with every candidate when several do. A report without ids
 * gives the name alone, which then matches by name.
 */
export function pickToken(
  page: InjectorPage,
  name: string,
  tokenId?: string,
  nodes: InjectorTreeNode[] = [...flatten(page.environment), ...flatten(page.roots)],
): TokenPick | { error: string } | { ambiguous: TokenCandidate[] } {
  const id = tokenId?.trim();
  if (id) {
    if (id.length > MAX_TOKEN_ID_CHARS) {
      return { error: `\`tokenId\` takes at most ${MAX_TOKEN_ID_CHARS} characters.` };
    }
    for (const node of nodes) {
      const entry = [...node.providers, ...(node.dependencies ?? [])].find(
        (item) => item.tokenId === id,
      );
      if (entry) return { name: entry.token, id };
    }
    const others = name ? tokenCandidates(nodes, name) : [];
    return {
      error: `No token on page ${code(page.pageId)} has the id ${code(id)}. Token ids change when the page reloads.${
        others.length
          ? ` Tokens named ${code(name)}: ${others.map((c) => code(c.tokenId)).join(', ')}.`
          : ''
      }`,
    };
  }
  const candidates = tokenCandidates(nodes, name);
  if (candidates.length > 1) return { ambiguous: candidates };
  return candidates.length ? { name: candidates[0]!.token, id: candidates[0]!.tokenId } : { name };
}

/** The candidates of an ambiguous name, as a markdown list. */
export function candidatesList(candidates: TokenCandidate[]): string {
  return candidates
    .map((c) => {
      const where = c.providedBy.length
        ? `provided by ${c.providedBy.map(code).join(', ')}`
        : 'provided by no listed injector';
      const used = c.injections ? `, injected ${c.injections} times` : '';
      return `- ${code(c.tokenId)}: ${code(c.token)}, ${where}${used}`;
    })
    .join('\n');
}

/** The answer when a token name fits several tokens on the page. */
export function ambiguousTokenText(
  name: string,
  candidates: TokenCandidate[],
  pageId: string,
): string {
  return `${candidates.length} different tokens on page ${code(pageId)} are named ${code(name)}. Pass \`tokenId\` with one of them:\n\n${candidatesList(candidates)}`;
}
