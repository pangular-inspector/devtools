# Phase 1 — Detection

Goal: build an inventory at `$W/workspace.json`. Every later phase reads it.

Requires Node ≥ 22.5 because this phase uses `fs.globSync` and `path.matchesGlob`. The snippet below exits 2 with `monorepo-doctor requires Node >= 22.5` when either API is missing.
This phase resets the work directory. In every shell, start with `W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"`; all later phases reuse `$W`, and you should recompute it in each new shell. `os.tmpdir()` honors `TMPDIR`: if the default temp dir is not writable in your environment, `export TMPDIR=<writable dir outside the audited repo>` in every shell before computing `$W`, so the shell and the Node snippets agree.

Run from the workspace root (the directory the user pointed at; default: current directory):

```bash
W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
mkdir -p "$W"
cat > "$W/detect.mjs" <<'EOF'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
if (typeof fs.globSync !== 'function' || typeof path.matchesGlob !== 'function') {
  console.error('monorepo-doctor requires Node >= 22.5');
  process.exit(2);
}
const root = path.resolve(process.argv[2] ?? '.');
const work = path.join(os.tmpdir(), 'monorepo-doctor');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(path.join(work, 'findings'), { recursive: true });
const toPosix = (p) => p.split(path.sep).join('/');
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p) => fs.existsSync(path.join(root, p));

const pm = exists('pnpm-lock.yaml') || exists('pnpm-workspace.yaml') ? 'pnpm'
  : exists('bun.lockb') || exists('bun.lock') ? 'bun'
  : exists('yarn.lock') ? 'yarn'
  : exists('package-lock.json') ? 'npm' : 'unknown';

const rootPkg = readJson(path.join(root, 'package.json')) ?? {};
const stripYamlComment = (s) => {
  let out = '', quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { if (ch === quote && s[i - 1] !== '\\') quote = null; out += ch; }
    else if (ch === '"' || ch === "'") { quote = ch; out += ch; }
    else if (ch === '#') break;
    else out += ch;
  }
  return out.trim();
};
const unquote = (s) => stripYamlComment(s).trim().replace(/^['"]|['"]$/g, '').trim();
const splitFlow = (s) => {
  const out = [];
  let cur = '', quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { if (ch === quote && s[i - 1] !== '\\') quote = null; cur += ch; }
    else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === ',') { const v = unquote(cur); if (v) out.push(v); cur = ''; }
    else cur += ch;
  }
  const v = unquote(cur); if (v) out.push(v);
  return out;
};
function pnpmWorkspaceGlobs(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const globs = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^packages:\s*(.*)$/);
    if (!m) continue;
    const rest = stripYamlComment(m[1]);
    if (rest.startsWith('[') && rest.endsWith(']')) globs.push(...splitFlow(rest.slice(1, -1)));
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const item = line.match(/^\s*-\s*(.+)$/);
      if (item) { const v = unquote(item[1]); if (v) globs.push(v); continue; }
      if (/^\S/.test(line)) break;
    }
    break;
  }
  return globs;
}
let globs = [];
if (exists('pnpm-workspace.yaml')) {
  globs = pnpmWorkspaceGlobs(path.join(root, 'pnpm-workspace.yaml'));
  if (!globs.length) console.error('WARN: pnpm-workspace.yaml contains no package globs');
}
if (!globs.length) globs = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces?.packages ?? [];
const include = globs.filter((g) => !g.startsWith('!'));
const exclude = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1).replace(/\/$/, ''));
const isExcluded = (dir) => exclude.some((g) => path.matchesGlob(dir, g) || path.matchesGlob(`${dir}/package.json`, `${g}/package.json`));

const SKIP_NAMES = new Set(['node_modules', 'dist', 'build', '.git', '.nx', '.turbo', 'coverage']);
const hasSkippedPart = (p) => p.split('/').some((part) => SKIP_NAMES.has(part));
const prune = (p) => SKIP_NAMES.has(path.basename(String(p)));

const orchestrators = [];
if (exists('nx.json')) orchestrators.push({ name: 'nx', installed: exists('node_modules/.bin/nx') });
if (exists('turbo.json')) orchestrators.push({ name: 'turbo', installed: exists('node_modules/.bin/turbo') });

const dirs = new Map();
for (const g of include) {
  for (const raw of fs.globSync(`${g.replace(/\/$/, '')}/package.json`, { cwd: root, exclude: prune })) {
    const m = toPosix(raw);
    const d = path.posix.dirname(m);
    if (!hasSkippedPart(m) && !isExcluded(d)) dirs.set(d, 'package.json');
  }
}
if (orchestrators.some((o) => o.name === 'nx')) {
  for (const raw of fs.globSync('**/project.json', { cwd: root, exclude: prune })) {
    const m = toPosix(raw);
    if (hasSkippedPart(m)) continue;
    const d = path.posix.dirname(m);
    if (d !== '.' && !dirs.has(d)) dirs.set(d, 'project.json');
  }
}

const packages = [];
for (const [dir, source] of dirs) {
  const abs = path.join(root, dir);
  const pkg = readJson(path.join(abs, 'package.json')) ?? {};
  const proj = readJson(path.join(abs, 'project.json'));
  const name = pkg.name ?? proj?.name ?? dir;
  const exportKeys = typeof pkg.exports === 'string' ? ['.']
    : pkg.exports && typeof pkg.exports === 'object' ? Object.entries(pkg.exports).filter(([k, v]) => k.startsWith('.') && v !== null).map(([k]) => k) : [];
  const allDeps = { ...pkg.peerDependencies, ...pkg.optionalDependencies, ...pkg.devDependencies, ...pkg.dependencies };
  packages.push({
    name, dir: toPosix(dir), source,
    private: pkg.private === true, version: pkg.version ?? null,
    scripts: pkg.scripts ?? {}, files: pkg.files ?? null, main: pkg.main ?? null,
    exports: pkg.exports ?? null, exportKeys,
    dependencies: pkg.dependencies ?? {}, devDependencies: pkg.devDependencies ?? {}, allDeps,
    tags: proj?.tags ?? pkg.nx?.tags ?? [], nxTargets: { ...pkg.nx?.targets, ...proj?.targets }, nxName: proj?.name ?? null,
  });
}
const names = new Set(packages.map((p) => p.name));
for (const p of packages) {
  p.workspaceDeps = Object.keys(p.allDeps).filter((d) => names.has(d));
  p.hasTestScript = typeof p.scripts.test === 'string' && !/no test specified/.test(p.scripts.test);
}

const ci = [
  ...fs.globSync('.github/workflows/*.{yml,yaml}', { cwd: root, exclude: prune }).map(toPosix),
  ...fs.globSync('.buildkite/*.{yml,yaml}', { cwd: root, exclude: prune }).map(toPosix),
  ...['.gitlab-ci.yml', 'azure-pipelines.yml', '.circleci/config.yml', 'bitbucket-pipelines.yml', 'Jenkinsfile', '.travis.yml'].filter(exists),
];

const ws = {
  root, packageManager: pm, orchestrators, workspaceGlobs: globs,
  rootScripts: rootPkg.scripts ?? {},
  hasNodeModules: exists('node_modules'),
  ciFiles: ci.map(toPosix),
  packages,
};
fs.writeFileSync(path.join(work, 'workspace.json'), JSON.stringify(ws, null, 2));
if (!packages.length) { console.error('NO_WORKSPACE: no workspace packages found under ' + root); process.exit(2); }
console.log(JSON.stringify({ root, packageManager: pm, orchestrators, packages: packages.length, ciFiles: ws.ciFiles.length }));
EOF
node "$W/detect.mjs" "<workspace-root>"
```

## Interpreting the result

- Exit code 2 / `NO_WORKSPACE`: this is not a monorepo. Stop and tell the user; do not produce a report.
- `orchestrators[].installed: false`: never call `npx nx` / `npx turbo` (it would download a different version). Use static config analysis only, and mark dependent sub-steps `partial`.
- `hasNodeModules: false`: skip `knip` and any step that needs resolved dependencies; mark `partial`.
- `packages[].source === "project.json"`: an Nx project without its own package.json — package.json-based rules (missing test script, undeclared dependency, npm pack) do not apply to it.
- Print a one-line summary of the inventory to the user before continuing.
- `ciFiles` contains the top-level CI files for GitHub Actions, GitLab CI, Azure Pipelines, CircleCI, Bitbucket Pipelines, Jenkins, Buildkite, and Travis. The CI coverage check follows local GitLab `include:` entries and local GitHub reusable workflows referenced from these files.
