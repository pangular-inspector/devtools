/**
 * Shared helpers for the scripts that check the published package: a throwaway Verdaccio that
 * serves `@pangular-inspector/*` itself, packing and publishing the tarball, and running commands
 * against that registry. `verify-publish.mjs` and `e2e-install.mjs` both build on it.
 *
 * Nothing reaches npmjs for the package under test: the registry has no uplink for the scope, so a
 * package that failed to publish cannot be quietly satisfied by the real one. Everything else is
 * proxied to npmjs.
 *
 * The registry listens on 127.0.0.1, and another local account could hold that port first. So the
 * port has to be free before Verdaccio starts, Verdaccio has to stay up, and it has to answer with a
 * per-run secret seeded into its storage (the work folder is private to this account) before any
 * package command trusts it. The package under test is then checked byte for byte against the
 * tarball, both as the registry serves it and as each package manager installs it.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
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
  // 127.0.0.1 rather than localhost, so every client reaches the one socket Verdaccio holds and not
  // a listener on ::1.
  const REGISTRY = `http://127.0.0.1:${registryPort}`;
  const IDENTITY_PACKAGE = '@pangular-inspector/registry-identity';
  const children = new Set();
  let registryChild;
  let publishedTarball;

  /** Fails when the registry was started and has stopped, as nothing else may answer its port. */
  function assertRegistryRunning() {
    if (registryChild && (registryChild.exitCode !== null || registryChild.signalCode !== null)) {
      throw new Error(`the local registry exited:\n${tail(registryChild.logFile)}`);
    }
  }

  const usesRegistry = (env) => env?.npm_config_registry === REGISTRY;

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
    if (usesRegistry(env)) assertRegistryRunning();
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
    if (usesRegistry(env)) assertRegistryRunning();
    const child = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    const log = (chunk) => appendFileSync(logFile, chunk);
    child.stdout.on('data', log);
    child.stderr.on('data', log);
    child.logFile = logFile;
    return child;
  }

  /**
   * Waits for `url` to answer while `child` is running. An answer after `child` exited comes from
   * something else on the port, so it fails rather than counting as ready.
   */
  async function waitFor(url, child, logFile, seconds) {
    const exited = () => child.exitCode !== null || child.signalCode !== null;
    for (let tries = 0; tries < seconds && !exited(); tries++) {
      const response = await fetch(url).catch(() => undefined);
      if (response?.ok && !exited()) return response;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const why = exited() ? 'its process exited' : `it did not answer in ${seconds}s`;
    throw new Error(`${url} is not ready, ${why}:\n${tail(logFile)}`);
  }

  /** Fails when something already listens on 127.0.0.1:`port`. */
  function assertPortFree(port) {
    return new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', (error) =>
        reject(
          new Error(`127.0.0.1:${port} is taken (${error.code}); set VERIFY_PORT to a free port`),
        ),
      );
      probe.listen({ port, host: '127.0.0.1', exclusive: true }, () => probe.close(resolve));
    });
  }

  /**
   * Seeds Verdaccio's storage with a package whose readme is a random secret. Only the Verdaccio
   * this run started reads that storage, so an answer with the secret proves who holds the port.
   */
  function seedIdentity(storageDir) {
    const secret = randomBytes(32).toString('hex');
    const dir = path.join(storageDir, IDENTITY_PACKAGE);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: IDENTITY_PACKAGE,
        versions: {},
        'dist-tags': {},
        time: {},
        _rev: '0-0',
        _uplinks: {},
        _distfiles: {},
        _attachments: {},
        readme: secret,
      }),
    );
    return secret;
  }

  async function checkIdentity(secret) {
    const url = `${REGISTRY}/${IDENTITY_PACKAGE.replace('/', '%2f')}`;
    const response = await fetch(url).catch(() => undefined);
    const body = await response?.json().catch(() => undefined);
    if (body?.readme !== secret) {
      throw new Error(
        `${REGISTRY} answered without this run's secret (${response?.status ?? 'no answer'}): another process may hold the port`,
      );
    }
  }

  async function startRegistry() {
    const storage = path.join(work, 'registry');
    mkdirSync(storage);
    const secret = seedIdentity(path.join(storage, 'storage'));
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
    await assertPortFree(registryPort);
    console.log(`starting Verdaccio on ${REGISTRY}`);
    const child = start(
      'pnpm',
      ['dlx', 'verdaccio@6', '--config', config, '--listen', `127.0.0.1:${registryPort}`],
      storage,
      process.env,
      logFile,
    );
    registryChild = child;
    await waitFor(`${REGISTRY}/-/ping`, child, logFile, 180);
    await checkIdentity(secret);
    assertRegistryRunning();

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
      `registry=${REGISTRY}\n//127.0.0.1:${registryPort}/:_authToken=${token}\n`,
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

  /** Publishes `tarball`, then checks the registry serves exactly that file for the version. */
  async function publish(tarball) {
    const version = checkTarball(tarball);
    console.log(`publishing ${manifest.name}@${version} to ${REGISTRY}`);
    run('npm', ['publish', tarball, '--registry', REGISTRY, '--access', 'public'], work);
    const bytes = readFileSync(tarball);
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    const packument = await (
      await fetch(`${REGISTRY}/${manifest.name.replace('/', '%2f')}`)
    ).json();
    const dist = packument.versions?.[version]?.dist;
    if (dist?.integrity !== integrity) {
      throw new Error(
        `${REGISTRY} lists ${manifest.name}@${version} as ${dist?.integrity}, not the tarball's ${integrity}`,
      );
    }
    const served = Buffer.from(await (await fetch(dist.tarball)).arrayBuffer());
    if (!served.equals(bytes)) {
      throw new Error(`${dist.tarball} is not the tarball that was published`);
    }
    assertRegistryRunning();
    publishedTarball = tarball;
    return version;
  }

  const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

  /**
   * Checks every file of the published tarball is in `dir/node_modules/<package>` with the same
   * content, so a package manager installed the archive this run selected and nothing else.
   */
  function verifyInstalled(dir) {
    if (!publishedTarball) throw new Error('verifyInstalled runs after publish');
    const expected = path.join(work, 'published');
    if (!existsSync(expected)) {
      mkdirSync(expected);
      run('tar', ['-xzf', publishedTarball, '-C', expected], work, process.env);
    }
    const installed = path.join(dir, 'node_modules', manifest.name);
    if (!existsSync(installed)) throw new Error(`${manifest.name} is not in ${dir}/node_modules`);
    const installedRoot = realpathSync(installed);
    const packageRoot = path.join(expected, 'package');
    const differ = [];
    const walk = (from) => {
      for (const entry of readdirSync(from, { withFileTypes: true })) {
        const file = path.join(from, entry.name);
        if (entry.isDirectory()) {
          walk(file);
          continue;
        }
        const relative = path.relative(packageRoot, file);
        const target = path.join(installedRoot, relative);
        if (!existsSync(target) || sha256(target) !== sha256(file)) differ.push(relative);
      }
    };
    walk(packageRoot);
    if (differ.length) {
      throw new Error(
        `${installedRoot} does not match the published tarball:\n  ${differ.slice(0, 20).join('\n  ')}`,
      );
    }
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
    verifyInstalled,
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

/**
 * One JSON-RPC request to a streamable HTTP MCP endpoint, which answers with JSON or with one SSE
 * `data:` event. Returns the `result`, or throws with the `error`.
 */
async function mcpRequest(url, session, id, method, params = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      origin: new URL(url).origin,
      ...(session.token ? { authorization: `Bearer ${session.token}` } : {}),
      ...(session.id ? { 'mcp-session-id': session.id } : {}),
      ...(session.version ? { 'mcp-protocol-version': session.version } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, params }),
  });
  session.id ??= response.headers.get('mcp-session-id') ?? undefined;
  const text = await response.text();
  if (id === undefined) return undefined;
  const body = response.headers.get('content-type')?.includes('text/event-stream')
    ? /^data: ?(.*)$/m.exec(text)?.[1]
    : text;
  let message;
  try {
    message = JSON.parse(body ?? '');
  } catch {
    throw new Error(`${method} at ${url} answered ${response.status}:\n${text.slice(0, 500)}`);
  }
  if (message.error) throw new Error(`${method}: ${message.error.message}`);
  return message.result;
}

/**
 * The installed package's MCP endpoint lists resource templates (devframe 1.3.0 and later) and
 * prompts (devframe 1.3.1 and later). `token` is the bearer token the server asks for, if any.
 */
export async function checkMcpLists(url, token) {
  const session = { token };
  const init = await mcpRequest(url, session, 1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'e2e-install', version: '0.0.0' },
  });
  session.version = init.protocolVersion;
  await mcpRequest(url, session, undefined, 'notifications/initialized');
  const { resourceTemplates } = await mcpRequest(url, session, 2, 'resources/templates/list');
  if (!resourceTemplates?.length) throw new Error(`resources/templates/list at ${url} is empty`);
  if (!init.capabilities?.prompts) throw new Error(`${url} declares no prompts capability`);
  const { prompts } = await mcpRequest(url, session, 3, 'prompts/list');
  if (!prompts?.length) throw new Error(`prompts/list at ${url} is empty`);
  return `${resourceTemplates.length} resource templates and ${prompts.length} prompts over MCP`;
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
