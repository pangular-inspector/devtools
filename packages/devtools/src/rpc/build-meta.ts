import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { analogConfig, analogVersion, servedAnalogRoot } from './analog-scan.ts';

const BuildMetaSchema = v.object({
  angularVersion: v.string(),
  projectName: v.string(),
  typescript: v.string(),
  ssr: v.boolean(),
  analog: v.optional(v.string()),
  builtAt: v.number(),
});

export const getBuildMeta = defineRpcFunction({
  name: 'build-meta',
  type: 'static',
  jsonSerializable: true,
  snapshot: true,
  args: [],
  returns: describable(BuildMetaSchema),
  agent: {
    description:
      'Angular project metadata: framework version, TypeScript version, SSR status. Baked into static builds. Call this before suggesting dependency or config changes.',
    title: 'Angular build metadata',
  },
  setup: (ctx) => ({
    handler: async () => {
      const pkg = readJson(join(ctx.cwd, 'package.json'));
      const deps = { ...record(pkg['dependencies']), ...record(pkg['devDependencies']) };
      const angularVersion =
        installedVersion(ctx.cwd, '@angular/core') ?? versionFromRange(deps['@angular/core']);
      const typescript =
        installedVersion(ctx.cwd, 'typescript') ?? versionFromRange(deps['typescript']);

      const app = servedAnalogRoot(ctx.cwd);
      const project = mainProject(app) ?? mainProject(ctx.cwd);
      const analog = analogVersion(app);
      return {
        angularVersion,
        projectName: project?.name ?? (typeof pkg['name'] === 'string' ? pkg['name'] : 'unknown'),
        typescript,
        ssr: analog ? analogConfig(app).ssr !== false : hasSsr(project?.config),
        ...(analog
          ? {
              analog:
                installedVersion(ctx.cwd, '@analogjs/platform') ??
                installedVersion(ctx.cwd, '@analogjs/router') ??
                versionFromRange(analog),
            }
          : {}),
        builtAt: Date.now(),
      };
    },
  }),
});

type Json = Record<string, unknown>;

interface WorkspaceProject {
  name?: string;
  config: Json;
}

function record(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : undefined;
}

export function mainProject(cwd: string): WorkspaceProject | undefined {
  const angularJson = readJson(join(cwd, 'angular.json'));
  const projects = record(angularJson['projects']);
  if (projects) {
    const entries = Object.entries(projects).flatMap(([name, value]) => {
      const config = record(value);
      return config ? [[name, config] as const] : [];
    });
    const [name, config] =
      entries.find(([name]) => name === angularJson['defaultProject']) ??
      entries.find(([, config]) => !config['root'] || config['root'] === '.') ??
      entries.find(([, config]) => config['projectType'] === 'application') ??
      entries[0] ??
      [];
    return name && config ? { name, config } : undefined;
  }
  const projectJson = readJson(join(cwd, 'project.json'));
  if (!Object.keys(projectJson).length) return undefined;
  const name = projectJson['name'];
  return { name: typeof name === 'string' ? name : undefined, config: projectJson };
}

export function hasSsr(config: Json | undefined): boolean {
  const targets = record(config?.['architect']) ?? record(config?.['targets']);
  const build = record(record(targets?.['build'])?.['options']);
  return !!(build?.['ssr'] || build?.['server'] || targets?.['server']);
}

function readJson(path: string): Json {
  try {
    if (!existsSync(path)) return {};
    return record(JSON.parse(readFileSync(path, 'utf-8'))) ?? {};
  } catch {
    return {};
  }
}

export function installedVersion(cwd: string, name: string): string | undefined {
  const resolved = resolvePackageJson(cwd, name);
  const version = resolved ? readJson(resolved)['version'] : undefined;
  if (typeof version === 'string') return version;
  for (let dir = cwd; ; dir = dirname(dir)) {
    const found = readJson(join(dir, 'node_modules', name, 'package.json'))['version'];
    if (typeof found === 'string') return found;
    if (dirname(dir) === dir) return undefined;
  }
}

function resolvePackageJson(cwd: string, name: string): string | undefined {
  try {
    return createRequire(join(cwd, 'package.json')).resolve(`${name}/package.json`);
  } catch {
    return undefined;
  }
}

export function versionFromRange(range: unknown): string {
  if (typeof range !== 'string' || !range.trim()) return 'unknown';
  const version = /\d+(?:\.(?:\d+|x|\*)){0,2}(?:-[\w.]+)?/.exec(range);
  return version ? version[0] : range.trim();
}
