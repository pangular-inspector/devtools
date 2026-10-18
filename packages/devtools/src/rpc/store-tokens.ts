import type { NgrxDeclaration } from './ngrx-tools.ts';
import type { InjectorPage, InjectorTreeNode, ProviderInfo } from '../types.ts';
import { nameStore } from './ngrx-tools.ts';

/**
 * Names @ngrx/signals store providers in an injector report the way the NgRx
 * tools name the stores. Every `signalStore()` call returns a class named
 * `SignalStore`, so the DI tools would list `TravelStore` and `PackingStore`
 * both as `SignalStore` and never find `TravelStore`. The page reports each
 * store instance's state keys (`stateKeys`), and the source declaration with
 * the same keys gives the name (`nameStore`). The provider keeps the class
 * name in `tokenClass`, which the page matches when a tool reads the value.
 *
 * A dependency on `SignalStore` takes the store's name when the injector that
 * supplied it provides exactly one signal store. Stores the page did not
 * create yet (no state keys) or with no matching declaration keep `SignalStore`.
 */
export function nameStoreTokens(page: InjectorPage, declarations: NgrxDeclaration[]): InjectorPage {
  if (!declarations.length) return page;
  /** Injector id to the one signal store name it provides, or null when it provides several. */
  const byInjector = new Map<string, string | null>();
  const nameOf = (provider: ProviderInfo): ProviderInfo => {
    if (!provider.stateKeys?.length) return provider;
    const { name } = nameStore(
      { kind: 'signal-store', stateKeys: provider.stateKeys, methods: [] } as never,
      declarations,
    );
    if (!name) return provider;
    const { stateKeys: _keys, ...rest } = provider;
    return { ...rest, token: name, tokenClass: provider.tokenClass ?? provider.token };
  };
  const renameProviders = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
    nodes.map((node) => {
      const providers = node.providers.map(nameOf);
      const stores = providers.filter((p) => p.tokenClass);
      if (stores.length) {
        byInjector.set(node.injector.id, stores.length === 1 ? stores[0]!.token : null);
      }
      return { ...node, providers, children: renameProviders(node.children) };
    });
  const renameDependencies = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
    nodes.map((node) => ({
      ...node,
      ...(node.dependencies
        ? {
            dependencies: node.dependencies.map((dep) => {
              const name = dep.providedBy ? byInjector.get(dep.providedBy) : undefined;
              return name && /^SignalStore\d*$/.test(dep.token) ? { ...dep, token: name } : dep;
            }),
          }
        : {}),
      children: renameDependencies(node.children),
    }));
  const roots = renameProviders(page.roots);
  const environment = renameProviders(page.environment);
  if (!byInjector.size) return page;
  return {
    ...page,
    roots: renameDependencies(roots),
    environment: renameDependencies(environment),
  };
}
