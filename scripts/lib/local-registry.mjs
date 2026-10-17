/**
 * Shared helpers for the scripts that check the published package: a throwaway Verdaccio that
 * serves `@pangular-inspector/*` itself, packing and publishing the tarball, and running commands
 * against that registry. `verify-publish.mjs` and `e2e-install.mjs` both build on it.
 *
 * Nothing reaches npmjs for the package under test: the registry has no uplink for the scope, so a
 * package that failed to publish cannot be quietly satisfied by the real one. Everything else is
 * proxied to npmjs.
 */
import { execFileSync, spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const packageDir = path.join(root, 'packages/devtools');
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const manifest = readJson(path.join(packageDir, 'package.json'));

/** The value of `--name=value` on the command line, or undefined. */
export const arg = (name) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

/** Whether `--name` was passed on its own. */
export const flag = (name) => process.argv.includes(`--${name}`);

export const tail = (file, size = 4000) =>
  existsSync(file) ? readFileSync(file, 'utf8').slice(-size) : '(no log)';

/** Replaces `from` with `to`, or fails naming the generated file that no longer has `from`. */
export function replaceIn(file, from, to) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(from)) {
    throw new Error(`${file} no longer contains ${JSON.stringify(from)}:\n${text}`);
  }
  writeFileSync(file, text.replace(from, to));
}

/** Compares two versions by major, minor and patch, with a prerelease sorting before its release. */
export function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = v.split('-', 2);
    return { parts: core.split('.').map(Number), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (x.parts[i] ?? 0) - (y.parts[i] ?? 0);
    if (diff) return diff;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre.localeCompare(y.pre, 'en', { numeric: true });
}

/** The page loads the overlay after bootstrap in development, as the setup guides show. */
export const OVERLAY_CLI = `bootstrapApplication(App, appConfig)
  .then(() => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      return import('@pangular-inspector/devtools/overlay');
    }
    return undefined;
  })
  .catch((err) => console.error(err));`;

/**
 * Loads the overlay in a generated `main.ts`. Angular 22.2 and later print the bootstrap call on one
 * line, earlier versions on two, so the call is matched either way.
 */
export function wireOverlayInMain(file) {
  const text = readFileSync(file, 'utf8');
  const call =
    /bootstrapApplication\(App, appConfig\)\s*\.catch\(\(err\) => console\.error\(err\)\);/;
  if (!call.test(text)) {
    throw new Error(`${file} no longer contains the bootstrapApplication call:\n${text}`);
  }
  writeFileSync(file, text.replace(call, OVERLAY_CLI));
}

/**
 * A local registry in `work`, listening on `registryPort`, and the commands that run against it.
 * Every long-running process it starts is stopped by `stopAll()` and when the process exits.
 */
export function createRegistry({ work, registryPort }) {
  const REGISTRY = `http://localhost:${registryPort}`;
  const children = new Set();

  function stopAll() {
    for (const child of children) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    }
    children.clear();
  }

  /** Stops one process group started with `start`, and waits up to 10 seconds for it to exit. */
  async function stop(child) {
    children.delete(child);
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise((done) => {
      child.once('exit', done);
      setTimeout(done, 10_000);
    });
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      return;
    }
    await exited;
  }

  /**
   * Every command after the publish runs against the local registry, with its own caches: each run
   * publishes the same version, and a cache keyed by name and version would hand back an older
   * build, or the real one from npmjs.
   */
  const registryEnv = () => ({
    // Dropped in any case: setup-node exports NPM_CONFIG_USERCONFIG, which would compete with ours.
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !/^npm_config_(registry|userconfig|cache)$/i.test(key),
      ),
    ),
    npm_config_registry: REGISTRY,
    npm_config_userconfig: path.join(work, '.npmrc'),
    npm_config_cache: path.join(work, 'npm-cache'),
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
    NG_CLI_ANALYTICS: 'false',
  });

  function run(cmd, args, cwd, env = registryEnv(), timeout = 15 * 60_000) {
    try {
      return execFileSync(cmd, args, {
        cwd,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
        timeout,
      });
    } catch (error) {
      const why = error.signal ? ` (stopped with ${error.signal} after ${timeout / 1000}s)` : '';
      throw new Error(
        `${cmd} ${args.join(' ')} failed in ${cwd}${why}:\n${error.stdout ?? ''}${error.stderr ?? ''}`,
      );
    }
  }

  /** A long-running process in its own group, so stopping it also stops what it started. */
  function start(cmd, args, cwd, env, logFile) {
    const child = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    const log = (chunk) => appendFileSync(logFile, chunk);
    child.stdout.on('data', log);
    child.stderr.on('data', log);
    child.logFile = logFile;
    return child;
  }

  async function waitFor(url, child, logFile, seconds) {
    for (let tries = 0; tries < seconds; tries++) {
      const response = await fetch(url).catch(() => undefined);
      if (response?.ok) return response;
      if (child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`${url} did not answer:\n${tail(logFile)}`);
  }

  async function startRegistry() {
    const storage = path.join(work, 'registry');
    mkdirSync(storage);
    const config = path.join(storage, 'config.yaml');
    writeFileSync(
      config,
      `storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: 10
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    timeout: 120s
max_body_size: 200mb
packages:
  '@pangular-inspector/*':
    access: $all
    publish: $authenticated
    # No proxy: the package under test must come from this registry or not at all.
  '**':
    access: $all
    proxy: npmjs
log: { type: stdout, format: pretty, level: warn }
`,
    );
    const logFile = path.join(work, 'registry.log');
    console.log(`starting Verdaccio on ${REGISTRY}`);
    const child = start(
      'pnpm',
      ['dlx', 'verdaccio@6', '--config', config, '--listen', `localhost:${registryPort}`],
      storage,
      process.env,
      logFile,
    );
    await waitFor(`${REGISTRY}/-/ping`, child, logFile, 180);

    // Publishing needs a user. Verdaccio creates one on this request and returns its token.
    const response = await fetch(`${REGISTRY}/-/user/org.couchdb.user:verify`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'verify', password: 'verify-password' }),
    });
    const { token } = await response.json();
    if (!token) throw new Error(`Verdaccio returned no token (${response.status})`);
    writeFileSync(
      path.join(work, '.npmrc'),
      `registry=${REGISTRY}\n//localhost:${registryPort}/:_authToken=${token}\n`,
    );
    return child;
  }

  /** `pnpm pack` applies `publishConfig.exports`, and its `prepack` builds the library and panel. */
  function pack() {
    const out = path.join(work, 'pack');
    mkdirSync(out);
    console.log('packing the package (builds the library and the panel)');
    run('pnpm', ['pack', '--pack-destination', out], packageDir, process.env);
    const [file] = readdirSync(out).filter((name) => name.endsWith('.tgz'));
    if (!file) throw new Error(`pnpm pack wrote no tarball to ${out}`);
    return path.join(out, file);
  }

  /** The file list and the published manifest of a tarball. */
  function readTarball(tarball) {
    const files = new Set(run('tar', ['-tzf', tarball], work, process.env).split('\n'));
    const published = JSON.parse(
      run('tar', ['-xOzf', tarball, 'package/package.json'], work, process.env),
    );
    return { files, published };
  }

  /** Every entry point the published manifest exports has to be in the tarball. */
  function checkTarball(tarball) {
    const { files, published } = readTarball(tarball);
    const missing = Object.values(published.exports ?? {})
      .map((target) => path.posix.join('package', target))
      .filter((file) => !files.has(file));
    if (!files.has('package/dist/public/index.html'))
      missing.push('package/dist/public/index.html');
    if (missing.length) throw new Error(`the tarball is missing:\n  ${missing.join('\n  ')}`);
    return published.version;
  }

  function publish(tarball) {
    const version = checkTarball(tarball);
    console.log(`publishing ${manifest.name}@${version} to ${REGISTRY}`);
    run('npm', ['publish', tarball, '--registry', REGISTRY, '--access', 'public'], work);
    return version;
  }

  /** The newest version of `name` inside `range`, from npmjs through the registry's proxy. */
  function newest(name, range) {
    const found = JSON.parse(run('npm', ['view', `${name}@${range}`, 'version', '--json'], work));
    return Array.isArray(found) ? [...found].sort(compareVersions).at(-1) : found;
  }

  process.on('exit', stopAll);

  return {
    REGISTRY,
    registryEnv,
    run,
    start,
    stop,
    stopAll,
    waitFor,
    startRegistry,
    pack,
    readTarball,
    checkTarball,
    publish,
    newest,
  };
}

/**
 * The hub answers its connection file and serves the panel the package bundles. `paths` names
 * where both live under `base`: the hub by default, or the CLI and its proxy.
 */
export async function checkHub(
  base,
  child,
  logFile,
  waitFor,
  { connection = '/__devframes/__connection.json', panel = '/__devframes/pangular/' } = {},
) {
  const answer = await waitFor(`${base}${connection}`, child, logFile, 240);
  const text = await answer.text();
  try {
    JSON.parse(text);
  } catch {
    throw new Error(`${base}${connection} is not JSON:\n${text.slice(0, 500)}`);
  }
  return checkPanelHtml(`${base}${panel}`);
}

/** The panel page has its title and names a script that loads. */
export async function checkPanelHtml(panelUrl) {
  const panel = await fetch(panelUrl);
  const html = await panel.text();
  if (!panel.ok || !html.includes('<title>Pangular Inspector</title>')) {
    throw new Error(
      `the panel at ${panelUrl} did not load (${panel.status}):\n${html.slice(0, 500)}`,
    );
  }
  const script = /<script[^>]+src="([^"]+\.js)"/.exec(html)?.[1];
  if (!script) throw new Error(`the panel page names no script:\n${html.slice(0, 500)}`);
  const asset = await fetch(new URL(script, panelUrl));
  if (!asset.ok) throw new Error(`the panel script ${script} did not load (${asset.status})`);
  return 'the hub answers __connection.json and serves the panel and its script';
}
