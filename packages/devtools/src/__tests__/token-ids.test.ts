// @vitest-environment jsdom
// Two DI tokens with the same name (#367): the page gives every token object a
// stable id, so provider value reads, "injected" tracking and the agent tools
// keep them apart.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectInjectorTree, providerValue, type DebugNg } from '../injector-tree.ts';
import { toProviderValueRequest } from '../provider-values.ts';
import { explainInjection } from '../rpc/injection-explain.ts';
import { sanitizeInjectorTree } from '../rpc/injector-report.ts';
import { inspectProvidersText } from '../rpc/injector-tools.ts';
import { createProviderValues, findProvider } from '../rpc/provider-values.ts';
import { tokenId } from '../token-id.ts';
import type { InjectorPage, InjectorTreeNode, InjectorTreeReport } from '../types.ts';

const CONFIG_A = { _desc: 'config', toString: () => 'InjectionToken config' };
const CONFIG_B = { _desc: 'config', toString: () => 'InjectionToken config' };
const VALUES = new Map<unknown, unknown>([
  [CONFIG_A, { name: 'a' }],
  [CONFIG_B, { name: 'b' }],
]);

class Card {}

interface Setup {
  /** The tokens `<app-card>` provides, in order. */
  card: object[];
  /** The tokens the root environment injector provides (and holds a value for). */
  root?: object[];
  /** What `Card` injects; each resolves from the card when it provides it, else from Root. */
  injects: object[];
}

function page({ card: cardTokens, root: rootTokens = [], injects }: Setup) {
  document.body.innerHTML = '<app-root ng-version="22"><app-card></app-card></app-root>';
  const root = document.querySelector('app-root')!;
  const card = document.querySelector('app-card')!;
  const env = {
    scopes: new Set(['root']),
    records: new Map(rootTokens.map((token) => [token, { value: VALUES.get(token) }])),
    get: vi.fn(),
  };
  const rootInjector = { get: vi.fn() };
  const cardInjector = { get: vi.fn((token: unknown) => VALUES.get(token) ?? null) };
  const records = (tokens: object[]) =>
    tokens.map((token) => ({ token, provider: { provide: token, useValue: VALUES.get(token) } }));
  const ng: DebugNg = {
    getInjector: (el) => (el === card ? cardInjector : rootInjector),
    getComponent: (el) => (el === card ? new Card() : el === root ? {} : null),
    getDirectives: () => [],
    ɵgetInjectorMetadata: (inj) =>
      inj === env
        ? { type: 'environment', source: 'R3Injector' }
        : { type: 'element', source: inj === cardInjector ? card : root },
    ɵgetInjectorResolutionPath: (inj) =>
      inj === cardInjector ? [cardInjector, rootInjector, env] : [rootInjector, env],
    ɵgetInjectorProviders: (inj) =>
      inj === cardInjector ? records(cardTokens) : inj === env ? records(rootTokens) : [],
    ɵgetDependenciesFromInjectable: (_inj, owner) => ({
      dependencies:
        owner === Card
          ? injects.map((token) => ({
              token,
              flags: {},
              providedIn: cardTokens.includes(token) ? cardInjector : env,
            }))
          : [],
    }),
  };
  const report = collectInjectorTree(ng);
  const cardNode = report.roots[0].children[0];
  const rootNode = report.environment[0];
  return { ng, report, cardNode, rootNode, cardInjector };
}

function asPage(report: InjectorTreeReport): InjectorPage {
  const { roots, environment } = sanitizeInjectorTree(report.roots, report.environment);
  return { pageId: 'p1', reportedAt: 0, roots, environment };
}

/** The same report as an older overlay sends it, without token ids. */
function withoutIds(nodes: InjectorTreeNode[]): InjectorTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    providers: node.providers.map(({ tokenId: _id, ...provider }) => provider),
    dependencies: node.dependencies?.map(({ tokenId: _id, ...dep }) => dep),
    children: withoutIds(node.children),
  }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('token ids on the page', () => {
  it('gives two tokens with the same name different ids, stable between collections', () => {
    const first = page({ card: [CONFIG_A, CONFIG_B], injects: [CONFIG_A] });
    const [a, b] = first.cardNode.providers;
    expect(a.token).toBe('config');
    expect(b.token).toBe('config');
    expect(a.tokenId).toMatch(/^tok-\d+$/);
    expect(b.tokenId).toMatch(/^tok-\d+$/);
    expect(a.tokenId).not.toBe(b.tokenId);
    expect(first.cardNode.dependencies).toEqual([
      expect.objectContaining({ token: 'config', tokenId: a.tokenId }),
    ]);
    // A new collection (here on a re-rendered page) keeps the ids, and nothing is written on the token.
    const second = page({ card: [CONFIG_B, CONFIG_A], injects: [] });
    expect(second.cardNode.providers.map((p) => p.tokenId)).toEqual([b.tokenId, a.tokenId]);
    expect(tokenId(CONFIG_A)).toBe(a.tokenId);
    expect(Object.keys(CONFIG_A)).toEqual(['_desc', 'toString']);
  });

  it('reads only the same-named token that something injected from an element', () => {
    const { ng, cardNode, cardInjector } = page({
      card: [CONFIG_A, CONFIG_B],
      injects: [CONFIG_A],
    });
    const id = cardNode.injector.id;
    expect(providerValue(ng, id, 'config', 0, 'read')).toEqual({ value: { name: 'a' } });
    // Before #367 the injected pair was `injector|config`, so CONFIG_B counted as injected too.
    expect(providerValue(ng, id, 'config', 1, 'read')).toEqual({
      error: expect.stringContaining('Nothing on the page has injected config from this element'),
    });
    expect(cardInjector.get).not.toHaveBeenCalledWith(CONFIG_B, null, expect.anything());
  });

  it('matches the token id at the index, so a reordered provider list is not misread', () => {
    const before = page({ card: [CONFIG_A, CONFIG_B], injects: [CONFIG_A, CONFIG_B] });
    const [a, b] = before.cardNode.providers;
    const after = page({ card: [CONFIG_B, CONFIG_A], injects: [CONFIG_A, CONFIG_B] });
    const id = after.cardNode.injector.id;
    // The panel asks for CONFIG_A at the index it had; CONFIG_B sits there now.
    expect(providerValue(after.ng, id, 'config', 0, 'read', a.tokenId)).toEqual({
      error: 'config is no longer provided there. Refresh and try again.',
    });
    expect(providerValue(after.ng, id, 'config', 0, 'read', b.tokenId)).toEqual({
      value: { name: 'b' },
    });
    // A caller without the id (an older panel) still matches by name.
    expect(providerValue(after.ng, id, 'config', 1, 'read')).toEqual({ value: { name: 'a' } });
  });

  it('records which injector supplied each same-named token', () => {
    const { cardNode, rootNode } = page({
      card: [CONFIG_B],
      root: [CONFIG_A],
      injects: [CONFIG_A, CONFIG_B],
    });
    expect(cardNode.dependencies).toEqual([
      expect.objectContaining({ tokenId: tokenId(CONFIG_A), providedBy: rootNode.injector.id }),
      expect.objectContaining({ tokenId: tokenId(CONFIG_B), providedBy: cardNode.injector.id }),
    ]);
  });

  it('passes the token id through a provider value request, and checks it', () => {
    const base = { injectorId: 'inj-1', token: 'config', index: 0 };
    expect(toProviderValueRequest({ ...base, tokenId: 'tok-3' })).toMatchObject({
      tokenId: 'tok-3',
    });
    expect(toProviderValueRequest(base)).not.toHaveProperty('tokenId');
    expect(toProviderValueRequest({ ...base, tokenId: 3 })).toBe(
      'Pass the token id from the injector tree, or leave it out.',
    );
  });
});

describe('token ids in the agent tools', () => {
  const sameInjector = () =>
    page({ card: [CONFIG_A, CONFIG_B], root: [], injects: [CONFIG_A, CONFIG_B] });
  const split = () => page({ card: [CONFIG_B], root: [CONFIG_A], injects: [CONFIG_A, CONFIG_B] });

  it('keeps token ids when the server checks a report', () => {
    const { report, cardNode } = sameInjector();
    const checked = asPage(report).roots[0].children[0];
    expect(checked.providers.map((p) => p.tokenId)).toEqual(
      cardNode.providers.map((p) => p.tokenId),
    );
    expect(checked.dependencies?.map((d) => d.tokenId)).toEqual(
      cardNode.dependencies?.map((d) => d.tokenId),
    );
  });

  it('answers an ambiguous name in read-provider-value with the candidates, and takes tokenId', async () => {
    const { report } = sameInjector();
    const injectors = asPage(report);
    const [idA, idB] = [tokenId(CONFIG_A), tokenId(CONFIG_B)];
    const ambiguous = findProvider(injectors, 'config');
    expect(ambiguous).toEqual({ error: expect.stringContaining('Pass `tokenId`') });
    const text = (ambiguous as { error: string }).error;
    expect(text).toContain('2 different tokens');
    expect(text).toContain(`\`${idA}\``);
    expect(text).toContain(`\`${idB}\``);
    expect(findProvider(injectors, 'config', undefined, idB)).toMatchObject({
      index: 1,
      tokenId: idB,
    });
    expect(findProvider(injectors, 'config', undefined, 'tok-999999')).toEqual({
      error: expect.stringContaining('has the id `tok-999999`'),
    });

    const broadcast = vi.fn();
    const values = createProviderValues({
      pages: () => [injectors],
      latest: () => injectors,
      broadcast,
      answersFor: () => true,
    });
    broadcast.mockImplementation((_name: string, message: { requestId: string }) =>
      values.answer({
        requestId: message.requestId,
        pageId: 'p1',
        result: { ok: true, token: 'config', type: 'Object', path: [], members: [] },
      }),
    );
    const refused = await values.tool.handler({ token: 'config' });
    expect(refused.markdown).toContain(idA);
    expect(refused.markdown).toContain(idB);
    expect(broadcast).not.toHaveBeenCalled();
    await values.tool.handler({ token: 'config', tokenId: idB });
    expect(broadcast).toHaveBeenCalledWith(
      'provider-value',
      expect.objectContaining({ request: expect.objectContaining({ tokenId: idB, index: 1 }) }),
    );
  });

  it('resolves a name that only one token has among the injectors `injector` names', () => {
    const { report, rootNode } = split();
    expect(findProvider(asPage(report), 'config', 'Root')).toMatchObject({
      injectorId: rootNode.injector.id,
      tokenId: tokenId(CONFIG_A),
    });
  });

  it('lists every token with the name in inspect-providers, and narrows to one with tokenId', () => {
    const { report, rootNode, cardNode } = split();
    const injectors = asPage(report);
    const all = inspectProvidersText(injectors, { token: 'config' });
    expect(all).toContain('2 different tokens are named `config`');
    expect(all).toContain(rootNode.injector.id);
    expect(all).toContain(cardNode.injector.id);
    const one = inspectProvidersText(injectors, { token: 'config', tokenId: tokenId(CONFIG_B) });
    const json = JSON.parse(one.slice(one.lastIndexOf('\n\n') + 2)) as {
      providedBy: { id: string }[];
      injectedBy: { tokenId: string; providedBy: string }[];
    };
    expect(json.providedBy.map((hit) => hit.id)).toEqual([cardNode.injector.id]);
    expect(json.injectedBy).toEqual([
      expect.objectContaining({ tokenId: tokenId(CONFIG_B), providedBy: cardNode.injector.id }),
    ]);
  });

  it('explains the lookup of the token the id names, and lists candidates for a bare name', () => {
    const { report, rootNode, cardNode } = split();
    const injectors = asPage(report);
    expect(explainInjection(injectors, { selector: 'app-card', token: 'config' })).toEqual({
      error: expect.stringContaining('Pass `tokenId`'),
    });
    expect(
      explainInjection(injectors, {
        selector: 'app-card',
        token: 'config',
        tokenId: tokenId(CONFIG_A),
      }),
    ).toMatchObject({ outcome: 'resolved', resolvedBy: rootNode.injector.id });
    expect(
      explainInjection(injectors, {
        selector: 'app-card',
        token: 'config',
        tokenId: tokenId(CONFIG_B),
      }),
    ).toMatchObject({ outcome: 'resolved', resolvedBy: cardNode.injector.id });
  });

  it('falls back to names for a report without token ids', () => {
    const { report, cardNode } = split();
    const old = asPage({
      roots: withoutIds(report.roots),
      environment: withoutIds(report.environment),
    });
    expect(old.roots[0].children[0].providers[0]).not.toHaveProperty('tokenId');
    expect(findProvider(old, 'config')).not.toHaveProperty('error');
    expect(explainInjection(old, { selector: 'app-card', token: 'config' })).toMatchObject({
      outcome: 'resolved',
      resolvedBy: cardNode.injector.id,
    });
    expect(inspectProvidersText(old, { token: 'config' })).not.toContain('different tokens');
  });
});
