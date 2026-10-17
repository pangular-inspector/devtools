import { describe, expect, it } from 'vitest';
import { analogConfig, lintAnalog, scanAnalog } from '../rpc/analog-scan.ts';
import { analogPrerenderText, analogRenderModesText, prerenderPlan } from '../rpc/analog-tools.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const config = (body: string) =>
  analogConfig(
    makeProject(BASE_FILES, {
      'vite.config.ts': `import analog from '@analogjs/platform';
import { shared, rules, isProd, list } from './shared';
export default {
  plugins: [${body}],
};
`,
    }),
  );

const state = { pages: [], calls: [], duplicates: [], reportedAt: 0 };

describe('Analog config read in part', () => {
  it('stays complete for a fully literal config', () => {
    const result = config(`analog({
      ssr: true,
      apiPrefix: 'v2',
      prerender: { routes: ['/', '/about'] },
      routeRules: { '/admin/**': { ssr: false } },
      nitro: { routeRules: { '/old': { redirect: '/new' } } },
    })`);
    expect(result.partial).toBeUndefined();
    expect(result.partialReasons).toBeUndefined();
    expect(result.prerender).toEqual(['/', '/about']);
  });

  it('flags options that come from a variable', () => {
    const result = config('analog(shared)');
    expect(result.partial).toBe(true);
    expect(result.partialReasons?.[0]).toMatch(/options from shared, not an object literal/);
  });

  it('flags spreads, non-literal flags and routeRules from a variable', () => {
    const result = config(`analog({
      ...shared,
      ssr: isProd,
      apiPrefix: shared.prefix,
      routeRules: rules,
    })`);
    expect(result.partial).toBe(true);
    const text = result.partialReasons!.join('\n');
    expect(text).toMatch(/spread/);
    expect(text).toMatch(/ssr is not a plain true or false/);
    expect(text).toMatch(/apiPrefix is not a string literal/);
    expect(text).toMatch(/routeRules is not an object literal/);
    expect(result.ssr).toBeUndefined();
  });

  it('flags a flag that only starts with true or false', () => {
    const text = config('analog({ ssr: true && isProd, static: false || x })').partialReasons!.join(
      '\n',
    );
    expect(text).toMatch(/ssr is not a plain true or false/);
    expect(text).toMatch(/static is not a plain true or false/);
    expect(config('analog({ ssr: true , static: false })').partial).toBeUndefined();
  });

  it('flags a spread inside routeRules and computed rule keys', () => {
    expect(
      config(`analog({ routeRules: { ...rules, '/a': { ssr: false } } })`).partialReasons,
    ).toEqual([expect.stringMatching(/routeRules uses a spread/)]);
    expect(config('analog({ routeRules: { [isProd]: { ssr: false } } })').partialReasons).toEqual([
      expect.stringMatching(/computed keys/),
    ]);
  });

  it('flags prerender.routes with non-string entries or from a variable', () => {
    const mixed = config(`analog({ prerender: { routes: ['/a', ...list, \`/b/\${isProd}\`] } })`);
    expect(mixed.partial).toBe(true);
    expect(mixed.prerender).toContain('/a');
    expect(mixed.partialReasons).toEqual([expect.stringMatching(/not plain strings/)]);
    expect(config('analog({ prerender: { routes: list } })').partialReasons).toEqual([
      expect.stringMatching(/not an array literal/),
    ]);
    // A function is known to be dynamic, which the plan already says.
    expect(config('analog({ prerender: { routes: async () => [] } })').partial).toBeUndefined();
  });

  it('ignores keys nested under other blocks', () => {
    const result = config(`analog({
      nitro: { ssr: isProd, apiPrefix: shared.x, prerender: { routes: list } },
      vite: { ...shared },
    })`);
    expect(result.partial).toBeUndefined();
  });

  it('flags a missing or unclosed analog() call', () => {
    expect(config('somethingElse()').partialReasons).toEqual([
      expect.stringMatching(/has no analog\(\) call/),
    ]);
    expect(config('analog({ ssr: true ').partialReasons).toEqual([
      expect.stringMatching(/never closes/),
    ]);
  });

  it('surfaces the gap in lint, the prerender plan and the agent text', () => {
    const project = scanAnalog(
      makeProject(BASE_FILES, {
        'vite.config.ts': `import analog from '@analogjs/platform';
export default { plugins: [analog({ ssr: true, routeRules: rules })] };
`,
      }),
    );
    expect(project.config.partial).toBe(true);
    const finding = lintAnalog(project).find((f) => f.rule === 'config-partial');
    expect(finding).toMatchObject({ severity: 'warning', file: 'vite.config.ts' });
    expect(prerenderPlan(project).configPartial).toEqual(project.config.partialReasons);
    expect(analogPrerenderText(project)).toContain('**Config read in part.**');
    expect(analogRenderModesText(project, state)).toContain('routeRules is not an object literal');
  });

  it('leaves the plan and texts alone when the config is complete', () => {
    const project = scanAnalog(makeProject(BASE_FILES));
    expect(project.config.partial).toBeUndefined();
    expect(prerenderPlan(project).configPartial).toBeUndefined();
    expect(analogPrerenderText(project)).not.toContain('Config read in part');
    expect(lintAnalog(project).some((f) => f.rule === 'config-partial')).toBe(false);
  });
});
