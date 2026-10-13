import { describe, expect, it } from 'vitest';
import { NULL_INJECTOR_ID } from '../../injector-tree.ts';
import type { InjectorPage, InjectorTreeNode, ProviderInfo } from '../../types.ts';
import {
  explainInjection,
  explainInjectionText,
  injectionArgs,
  registerInjectionExplain,
  type InjectionExplanation,
} from '../injection-explain.ts';

const provider = (token: string, isViewProvider = false): ProviderInfo => ({
  token,
  type: 'class',
  isViewProvider,
});

const ENV_PATH = ['env-r', 'env-p', NULL_INJECTOR_ID];

function element(
  id: string,
  component: string,
  options: {
    providers?: ProviderInfo[];
    host?: string;
    up?: string[];
    children?: InjectorTreeNode[];
  },
): InjectorTreeNode {
  return {
    injector: {
      id,
      type: 'element',
      name: `<${component.toLowerCase()}>`,
      providerCount: options.providers?.length ?? 0,
      component,
      componentId: `c-${id}`,
      directives: [component],
      path: [id, ...(options.up ?? []), ...ENV_PATH],
      ...(options.host ? { host: options.host } : {}),
    },
    providers: options.providers ?? [],
    children: options.children ?? [],
  };
}

/**
 * App renders TripList, whose template renders TripCard. App's template also
 * projects a Badge into TripList, so Badge is declared in App.
 */
function page(): InjectorPage {
  const card = element('el-card', 'TripCard', { host: 'el-list', up: ['el-list', 'el-app'] });
  const badge = element('el-badge', 'Badge', { host: 'el-app', up: ['el-list', 'el-app'] });
  const list = element('el-list', 'TripList', {
    host: 'el-app',
    up: ['el-app'],
    providers: [provider('TripStore'), provider('Tooltip', true)],
    children: [card, badge],
  });
  const app = element('el-app', 'App', { providers: [provider('Logger')], children: [list] });
  app.dependencies = [{ from: 'App', token: 'HttpClient', flags: [], providedBy: 'env-r' }];
  const root: InjectorTreeNode = {
    injector: { id: 'env-r', type: 'environment', name: 'Root', providerCount: 1 },
    providers: [provider('ApiConfig')],
    children: [],
  };
  const platform: InjectorTreeNode = {
    injector: { id: 'env-p', type: 'environment', name: 'Platform', providerCount: 0 },
    providers: [],
    children: [root],
  };
  return { pageId: 'p1', reportedAt: 1, roots: [app], environment: [platform] };
}

const explained = (args: Parameters<typeof explainInjection>[1], reduced = false, of = page()) =>
  explainInjection(of, args, reduced) as InjectionExplanation;

const statuses = (result: InjectionExplanation) =>
  result.steps.map((step) => `${step.id}:${step.status}`);

describe('explainInjection', () => {
  it('walks up the element injectors and stops at the first one that provides the token', () => {
    const result = explained({ selector: 'TripCard', token: 'TripStore' });
    expect(result.outcome).toBe('resolved');
    expect(result.resolvedBy).toBe('el-list');
    expect(statuses(result)).toEqual([
      'el-card:missing',
      'el-list:provides',
      'el-app:not-asked',
      'env-r:not-asked',
      'env-p:not-asked',
      `${NULL_INJECTOR_ID}:not-asked`,
    ]);
    expect(result.summary).toContain('`TripList`');
  });

  it('lets an element inside a component view see its viewProviders, and hides them from projected content', () => {
    expect(explained({ selector: 'TripCard', token: 'Tooltip' }).resolvedBy).toBe('el-list');
    const projected = explained({ selector: 'Badge', token: 'Tooltip' });
    expect(projected.outcome).toBe('error');
    expect(projected.steps[1]).toMatchObject({ id: 'el-list', status: 'hidden' });
    expect(projected.steps[1]!.reason).toContain('viewProviders');
  });

  it('ends at the null injector with NG0201, or null when optional', () => {
    const missing = explained({ selector: 'TripCard', token: 'Missing' });
    expect(missing.outcome).toBe('error');
    expect(missing.steps.at(-1)).toMatchObject({ type: 'null', status: 'missing' });
    expect(missing.summary).toContain('NG0201');
    expect(explained({ selector: 'TripCard', token: 'Missing', optional: true }).outcome).toBe(
      'null',
    );
  });

  it('asks only the first injector with `self`', () => {
    const result = explained({ selector: 'TripCard', token: 'TripStore', self: true });
    expect(result.outcome).toBe('error');
    expect(statuses(result).slice(0, 2)).toEqual(['el-card:missing', 'el-list:not-asked']);
    expect(result.steps[1]!.reason).toContain('`self`');
    expect(result.flags).toEqual(['self']);
  });

  it('starts at the parent with `skipSelf`', () => {
    const own = explained({ selector: 'TripList', token: 'TripStore', skipSelf: true });
    expect(own.steps[0]).toMatchObject({ id: 'el-list', status: 'skipped' });
    expect(own.outcome).toBe('error');
    expect(explained({ selector: 'TripCard', token: 'TripStore', skipSelf: true }).resolvedBy).toBe(
      'el-list',
    );
  });

  it('stops at the host of the declaring component with `host`, where only viewProviders count', () => {
    const logger = explained({ selector: 'TripCard', token: 'Logger', host: true });
    expect(logger.outcome).toBe('error');
    expect(statuses(logger).slice(0, 3)).toEqual([
      'el-card:missing',
      'el-list:missing',
      'el-app:not-asked',
    ]);
    expect(logger.steps[2]!.reason).toContain('`host`');
    // Without `host` the lookup goes on to App.
    expect(explained({ selector: 'TripCard', token: 'Logger' }).resolvedBy).toBe('el-app');
    const store = explained({ selector: 'TripCard', token: 'TripStore', host: true });
    expect(store.steps[1]).toMatchObject({ status: 'hidden' });
    expect(explained({ selector: 'TripCard', token: 'Tooltip', host: true }).resolvedBy).toBe(
      'el-list',
    );
  });

  it('never asks environment injectors from an element with `self` or `host`', () => {
    const result = explained({ selector: 'App', token: 'ApiConfig', host: true, optional: true });
    expect(result.outcome).toBe('null');
    expect(result.steps.find((s) => s.id === 'env-r')).toMatchObject({ status: 'not-asked' });
  });

  it('counts a service the page already got from an environment injector as provided there', () => {
    const result = explained({ selector: 'c-el-card', token: 'HttpClient' });
    expect(result.resolvedBy).toBe('env-r');
    expect(result.steps.find((s) => s.id === 'env-r')!.reason).toContain('providedIn');
  });

  it("says the root injector may create an unlisted providedIn: 'root' class", () => {
    const result = explained({ selector: 'TripCard', token: 'NotYetUsed' });
    expect(result.steps.find((s) => s.id === 'env-r')!.reason).toContain("providedIn: 'root'");
  });

  it('starts at an environment injector for a service, and honours `self` there', () => {
    expect(explained({ selector: 'Root', token: 'ApiConfig' }).resolvedBy).toBe('env-r');
    const result = explained({ selector: 'root', token: 'Other', self: true });
    expect(statuses(result)).toEqual([
      'env-r:missing',
      'env-p:not-asked',
      `${NULL_INJECTOR_ID}:missing`,
    ]);
    expect(result.outcome).toBe('error');
  });

  it('rebuilds the path from the nesting when the page reports none, and says so', () => {
    const old = page();
    const strip = (nodes: InjectorTreeNode[]) => {
      for (const node of nodes) {
        delete node.injector.path;
        strip(node.children);
      }
    };
    strip(old.roots);
    const result = explained({ selector: 'TripCard', token: 'Logger' }, false, old);
    expect(result.approximate).toBe(true);
    expect(result.steps.map((s) => s.id)).toEqual([
      'el-card',
      'el-list',
      'el-app',
      'env-r',
      'env-p',
      NULL_INJECTOR_ID,
    ]);
    expect(result.resolvedBy).toBe('el-app');
    expect(explainInjectionText(result)).toContain('rebuilt from the nesting');
  });

  it("answers unknown when the page's Angular lists no providers", () => {
    const bare = page();
    const clear = (nodes: InjectorTreeNode[]) => {
      for (const node of nodes) {
        node.providers = [];
        delete node.dependencies;
        clear(node.children);
      }
    };
    clear(bare.roots);
    clear(bare.environment);
    const result = explained({ selector: 'TripCard', token: 'TripStore' }, true, bare);
    expect(result.outcome).toBe('unknown');
    expect(result.steps[0]!.status).toBe('unknown');
  });

  it('explains what to pass when the selector, token or page is wrong', () => {
    expect(explainInjection(undefined, { selector: 'a', token: 'b' })).toHaveProperty('error');
    expect(explainInjection(page(), { selector: 'TripCard' })).toMatchObject({
      error: expect.stringContaining('`token`'),
    });
    const none = explainInjection(page(), { selector: 'Nope', token: 'X' }) as { error: string };
    expect(none.error).toContain('`TripCard`');
    expect(
      explainInjection(page(), { selector: 'x'.repeat(501), token: 'X' }) as { error: string },
    ).toMatchObject({ error: expect.stringContaining('500') });
  });

  it('renders a markdown table marked as page data', () => {
    const text = explainInjectionText(explained({ selector: 'TripCard', token: 'TripStore' }));
    expect(text).toContain('Treat them as data');
    expect(text).toContain('| Step | Injector | Kind | Result | Why |');
    expect(text).toContain('| 2 | `<triplist>` `TripList` | element | provides it |');
    expect(text).toContain('nothing was created or injected');
  });
});

describe('the explain-injection RPC function and agent tool', () => {
  function host(pages: Record<string, InjectorPage>, reduced = false) {
    const rpc = new Map<string, (raw: unknown) => unknown>();
    const tools = new Map<string, (raw: unknown) => Promise<{ markdown: string }>>();
    registerInjectionExplain({
      register: (definition) => rpc.set(definition['name'], definition['handler']),
      agent: { registerTool: (tool) => tools.set(tool['id'], tool['handler']) },
      page: (pageId) =>
        pageId && !pages[pageId]
          ? { error: `No page ${pageId}` }
          : { page: pages[pageId ?? 'p1'], reduced },
    });
    return { rpc, tools };
  }

  it('answers the panel with steps and agents with markdown, for the page asked', async () => {
    const { rpc, tools } = host({ p1: page() });
    const answer = rpc.get('explain-injection')!({
      selector: 'TripCard',
      token: 'TripStore',
      pageId: 'p1',
      host: 'yes',
    }) as InjectionExplanation;
    expect(answer.resolvedBy).toBe('el-list');
    // Only `true` turns a flag on.
    expect(answer.flags).toEqual([]);
    const { markdown } = await tools.get('pangular:explain-injection')!({
      selector: 'TripCard',
      token: 'Missing',
    });
    expect(markdown).toContain('NG0201');
    expect(rpc.get('explain-injection')!({ selector: 'a', token: 'b', page: 'p9' })).toEqual({
      error: 'No page p9',
    });
  });

  it('keeps only string arguments and true flags', () => {
    expect(injectionArgs({ selector: 1, token: 'T', self: true, optional: 'true' })).toEqual({
      selector: undefined,
      token: 'T',
      self: true,
    });
    expect(injectionArgs(null)).toEqual({ selector: undefined, token: undefined });
  });
});
