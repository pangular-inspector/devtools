// The runtime config of an Analog app: the `import.meta.env` keys Vite
// exposes, Nitro's `runtimeConfig` from vite.config with the `NITRO_` env
// overrides, and the resolved `analog()` options. Every value goes through the
// redaction rules, so `redaction.secretNames` and tokens are masked.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blockAt, entriesOf, readConfigSource, type ConfigEntry } from './analog-config-blocks.ts';
import type { AnalogProject } from './analog-scan.ts';
import { REDACTED, isSecretName, redactText } from '../serialize.ts';

export interface RuntimeValue {
  key: string;
  value: string;
  /** Where it comes from: a .env file, the server process, Vite, or vite.config. */
  from: string;
  masked?: true;
  /** Set when vite.config computes the value, so only the code is known. */
  expression?: true;
}

export interface RuntimeConfigView {
  /** `import.meta.env` keys: Vite's resolved env, or the .env files when Vite is not running. */
  env: RuntimeValue[];
  /** `nitro.runtimeConfig` entries, nested keys joined with dots, and `NITRO_` overrides. */
  runtimeConfig: RuntimeValue[];
  /** The analog() options the scan resolved. */
  options: RuntimeValue[];
  configFile?: string;
}

const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local'];
const PUBLIC_PREFIX = /^(VITE_|ANALOG_)/;
const MAX_VALUE = 300;

let viteEnv: Record<string, unknown> | undefined;
let viteEnvOwner: unknown;

/**
 * Set by the Vite plugin: `server.config.env`, what `import.meta.env` holds.
 * `owner` is the dev server, so `clearViteEnv` leaves a newer server's env alone.
 */
export function setViteEnv(env: Record<string, unknown> | undefined, owner?: unknown): void {
  viteEnv = env;
  viteEnvOwner = owner;
}

/** Forgets the env when `owner` still set it; a restart sets the new server's first. */
export function clearViteEnv(owner?: unknown): void {
  if (owner !== undefined && owner !== viteEnvOwner) return;
  viteEnv = undefined;
  viteEnvOwner = undefined;
}

function mask(key: string, raw: unknown, from: string, expression?: true): RuntimeValue {
  const text = typeof raw === 'string' ? raw : (JSON.stringify(raw) ?? String(raw));
  const leaf = key.split('.').pop() ?? key;
  if (isSecretName(leaf) || isSecretName(key.replace(/^(VITE_|ANALOG_|NITRO_)/, ''))) {
    return { key, value: REDACTED, from, masked: true };
  }
  const value = redactText(text.slice(0, MAX_VALUE));
  return {
    key,
    value,
    from,
    ...(value !== text.slice(0, MAX_VALUE) ? { masked: true as const } : {}),
    ...(expression ? { expression } : {}),
  };
}

/** `KEY=value` lines of a .env file, without comments or `export`. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(['"`]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    out[match[1]] = value;
  }
  return out;
}

function envFiles(root: string): { file: string; values: Record<string, string> }[] {
  return ENV_FILES.flatMap((file) => {
    try {
      return [{ file, values: parseEnv(readFileSync(join(root, file), 'utf-8')) }];
    } catch {
      return [];
    }
  });
}

function flatten(entries: ConfigEntry[], prefix = ''): { key: string; entry: ConfigEntry }[] {
  return entries.flatMap((entry) => {
    const key = prefix ? `${prefix}.${entry.key}` : entry.key;
    return entry.children ? flatten(entry.children, key) : [{ key, entry }];
  });
}

/** The NITRO_ env name Nitro reads to override a runtimeConfig key (`public.apiBase` gives NITRO_PUBLIC_API_BASE). */
export function nitroEnvName(key: string): string {
  return `NITRO_${key
    .split('.')
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))
    .join('_')
    .toUpperCase()}`;
}

export function runtimeConfigView(
  project: Pick<AnalogProject, 'root' | 'config' | 'contentSchema'>,
  processEnv: Record<string, string | undefined> = process.env,
): RuntimeConfigView {
  const root = project.root;
  const files = envFiles(root);
  const env: RuntimeValue[] = [];
  if (viteEnv) {
    for (const [key, value] of Object.entries(viteEnv).sort(([a], [b]) => a.localeCompare(b))) {
      env.push(mask(key, value, 'Vite'));
    }
  } else {
    const seen = new Map<string, RuntimeValue>();
    for (const { file, values } of files) {
      for (const [key, value] of Object.entries(values)) {
        if (PUBLIC_PREFIX.test(key)) seen.set(key, mask(key, value, file));
      }
    }
    env.push(...[...seen.values()].sort((a, b) => a.key.localeCompare(b.key)));
  }

  const config = readConfigSource(root);
  const runtimeConfig: RuntimeValue[] = [];
  const range = config.source ? blockAt(config, ['nitro', 'runtimeConfig']) : undefined;
  const fromFiles = Object.assign({}, ...files.map((f) => f.values)) as Record<string, string>;
  for (const { key, entry } of range ? flatten(entriesOf(config, range)) : []) {
    const override = nitroEnvName(key);
    const fromEnv = processEnv[override] ?? fromFiles[override];
    runtimeConfig.push(
      fromEnv !== undefined
        ? mask(key, fromEnv, override)
        : mask(key, entry.value ?? '', 'vite.config', entry.expression),
    );
  }

  const c = project.config;
  const options: RuntimeValue[] = [
    {
      key: 'ssr',
      value: String(c.ssr ?? true),
      from: c.ssr === undefined ? 'default' : 'analog()',
    },
    {
      key: 'static',
      value: String(c.static ?? false),
      from: c.static === undefined ? 'default' : 'analog()',
    },
    {
      key: 'apiPrefix',
      value: c.apiPrefix,
      from: c.apiPrefix === 'api' ? 'default' : 'analog()',
    },
    {
      key: 'prerender.routes',
      value: c.prerenderDynamic ? '(function)' : (c.prerender ?? ['/']).join(', '),
      from: c.prerender || c.prerenderDynamic ? 'analog()' : 'default',
    },
    {
      key: 'nitro.routeRules',
      value: `${c.routeRules.length} rule${c.routeRules.length === 1 ? '' : 's'}`,
      from: 'analog()',
    },
  ];
  if (project.contentSchema) {
    options.push({
      key: 'contentSchema',
      value: project.contentSchema.file,
      from: 'pangular config',
    });
  }
  return {
    env,
    runtimeConfig,
    options: options.map((o) => mask(o.key, o.value, o.from)),
    ...(config.file ? { configFile: config.file } : {}),
  };
}

/** Markdown for the `analog-runtime-config` agent tool. */
export function runtimeConfigText(view: RuntimeConfigView): string {
  const rows = (values: RuntimeValue[], empty: string) =>
    values.length
      ? [
          '| Key | Value | From |',
          '| --- | --- | --- |',
          ...values.map(
            (v) => `| ${v.key} | ${v.expression ? `(code) ${v.value}` : v.value} | ${v.from} |`,
          ),
        ].join('\n')
      : empty;
  return [
    '## Analog runtime config',
    '',
    'Secret-looking names and values are masked.',
    '',
    '### import.meta.env',
    rows(view.env, 'No VITE_ or ANALOG_ keys found.'),
    '',
    '### Nitro runtimeConfig',
    rows(view.runtimeConfig, `No nitro.runtimeConfig in ${view.configFile ?? 'vite.config'}.`),
    '',
    '### analog() options',
    rows(view.options, ''),
  ].join('\n');
}
