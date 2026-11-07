# Phase 2 — Source scan

Reads `workspace.json`, walks every package's source files, and writes `$W/scan.json`:

| key               | content                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages[name]`  | `{ sourceFiles, testFiles: [file], loc }`                                                                                             |
| `imports`         | every import that crosses a package boundary: `{ from, fromSource, target, kind, spec, subpath, file, line, isTest, declared, deep }` |
| `fileEdges[name]` | intra-package `[fromFile, toFile]` edges from value imports (type-only imports excluded)                                              |
| `env`             | `{ package, file, line, name, isTest }` for `process.env.X`, `process.env['X']`, `import.meta.env.X`                                  |

`kind`: `relative` (`../../other-pkg/src/x`), `package` (`@scope/pkg/sub`), `alias` (tsconfig `paths`).
`fromSource`: the importing package's `source` from `workspace.json` (`package.json` or `project.json`).
`declared`: the importing package lists the target in any dependency field.
`deep`: the import bypasses the target's public API — any `relative` cross-package import, a package subpath starting with `src/`, `lib/` or `internal/`, or a `src`/`lib`/`internal` package subpath when the target has no `exports`, or any subpath not covered by the target's `exports` keys. Alias imports are resolved to the target package first; aliases to the target entry point stay non-deep, while aliases to any non-entry file are deep.

```bash
W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
cat > "$W/scan.mjs" <<'EOF'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const work = path.join(os.tmpdir(), 'monorepo-doctor');
const ws = JSON.parse(fs.readFileSync(path.join(work, 'workspace.json'), 'utf8'));
const root = ws.root;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.turbo', '.next', '.nx', '.git', 'lib-cov', '.svelte-kit', '.docusaurus', '.output', 'storybook-static', '.vercel', '.cache']);
const SRC = /\.(?:[cm]?[jt]sx?)$/;
const TEST = /\.(spec|test)\.[cm]?[jt]sx?$|(^|\/)(__tests__|__mocks__|test|tests|e2e|cypress)(\/|$)/;
const EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const toPosix = (p) => p.split(path.sep).join('/');
const byDir = [...ws.packages].sort((a, b) => b.dir.length - a.dir.length);
const owner = (relFile) => byDir.find((p) => relFile === p.dir || relFile.startsWith(p.dir + '/'));
const byName = new Map(ws.packages.map((p) => [p.name, p]));

const stripJsonc = (s) => s
  .replace(/"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => m[0] === '"' ? m : '')
  .replace(/"(?:[^"\\]|\\.)*"|,(\s*[}\]])/g, (m, g) => g !== undefined ? g : m);
const readJsonc = (p) => {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(stripJsonc(fs.readFileSync(p, 'utf8'))); }
  catch (e) { console.error(`WARN: failed to parse ${toPosix(path.relative(root, p))}: ${e.message}`); return null; }
};
const tsBasePath = path.join(root, 'tsconfig.base.json');
const tsConfigPath = path.join(root, 'tsconfig.json');
const tsBaseJson = readJsonc(tsBasePath);
const tsConfigJson = readJsonc(tsConfigPath);
const tsBase = tsBaseJson?.compilerOptions?.paths ? tsBaseJson : (tsConfigJson?.compilerOptions?.paths ? tsConfigJson : (tsBaseJson ?? tsConfigJson ?? {}));
const baseUrl = path.join(root, tsBase.compilerOptions?.baseUrl ?? '.');
const aliases = Object.entries(tsBase.compilerOptions?.paths ?? {})
  .map(([k, v]) => ({ key: k, target: Array.isArray(v) ? v[0] : v }))
  .filter((a) => typeof a.target === 'string')
  .sort((a, b) => (a.key.includes('*') - b.key.includes('*')) || b.key.replace('*', '').length - a.key.replace('*', '').length);
function matchAlias(spec) {
  return aliases.find((a) => a.key === spec || (a.key.endsWith('*') && spec.startsWith(a.key.slice(0, -1))));
}

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (SRC.test(e.name) && !e.name.endsWith('.d.ts')) out.push(path.join(dir, e.name));
  }
  return out;
}
function resolveFile(abs) {
  const cands = [abs, ...EXTS.map((e) => abs + e), ...EXTS.map((e) => path.join(abs, 'index' + e))];
  if (/\.[cm]?js$/.test(abs)) cands.push(...['.ts', '.tsx', '.mts', '.cts'].map((e) => abs.replace(/\.[cm]?js$/, e)));
  if (/\.jsx$/.test(abs)) cands.push(abs.replace(/\.jsx$/, '.tsx'));
  return cands.find((c) => { try { return fs.statSync(c).isFile(); } catch { return false; } }) ?? null;
}
function exportEntries(pkg) {
  if (typeof pkg.exports === 'string') return [['.', pkg.exports]];
  if (pkg.exports && typeof pkg.exports === 'object') return Object.entries(pkg.exports).filter(([k, v]) => k.startsWith('.') && v !== null);
  return (pkg.exportKeys ?? []).map((k) => [k, true]);
}
function covered(pkg, subpath) {
  const entries = exportEntries(pkg);
  if (!entries.length) return true;
  const want = './' + subpath;
  return entries.some(([k]) => k === want || (k.endsWith('/') && want.startsWith(k)) || (k.includes('*') && new RegExp('^' + k.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(want)));
}
const entryValues = (value) => {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(entryValues);
  return [];
};
function isEntrySubpath(pkg, subpath) {
  const norm = (s) => s.replace(/^\.\//, '').replace(/\.[cm]?[jt]sx?$/, '').replace(/\/(?:index)$/, '/index');
  const bare = norm(subpath);
  const entries = new Set(['index', 'src/index']);
  if (pkg.main) entries.add(norm(pkg.main));
  if (typeof pkg.exports === 'string') entries.add(norm(pkg.exports));
  else if (pkg.exports && typeof pkg.exports === 'object' && pkg.exports['.'] !== undefined && pkg.exports['.'] !== null) {
    for (const v of entryValues(pkg.exports['.'])) entries.add(norm(v));
  }
  return entries.has(bare);
}
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}
function lineAt(starts, idx) {
  let lo = 0, hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= idx) lo = mid + 1; else hi = mid - 1;
  }
  return hi + 1;
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
function allNamedSpecifiersAreTypeOnly(clause = '') {
  const m = clause.match(/\{([\s\S]*?)\}/);
  if (!m) return false;
  const specs = stripComments(m[1]).split(',').map((s) => s.trim()).filter(Boolean);
  return specs.length > 0 && specs.every((s) => /^type\s+[$\w]+(?:\s+as\s+[$\w]+)?$/.test(s));
}

const scan = { packages: {}, imports: [], fileEdges: {}, env: [] };
for (const pkg of ws.packages) {
  const files = walk(path.join(root, pkg.dir), []).filter((f) => owner(toPosix(path.relative(root, f)))?.name === pkg.name);
  const info = { sourceFiles: 0, testFiles: [], loc: 0 };
  const edges = [];
  for (const abs of files) {
    const file = toPosix(path.relative(root, abs));
    const packageRel = pkg.dir === '.' ? file : file.slice(pkg.dir.length + 1);
    const isTest = TEST.test(packageRel);
    const text = fs.readFileSync(abs, 'utf8');
    const starts = lineStarts(text);
    if (isTest) info.testFiles.push(file); else { info.sourceFiles++; info.loc += text.split('\n').length; }
    const specs = [];
    const importRe = /^[ \t]*(import|export)\s+(type\s+)?((?:(?!\n[ \t]*(?:import|export)\b)[\w$*{},\s]|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*?\bfrom\s*)?['"]([^'"\n]+)['"]/gm;
    for (const m of text.matchAll(importRe)) {
      if (m[2]) continue;
      if (m[1] === 'export' && !m[3]) continue;
      if (allNamedSpecifiersAreTypeOnly(m[3])) continue;
      specs.push({ spec: m[4], line: lineAt(starts, m.index + m[0].search(/\S/)) });
    }
    for (const m of text.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g)) {
      const line = lineAt(starts, m.index);
      if (/\bimport\s+type\s+[\w$]+\s*=\s*$/.test(text.slice(Math.max(0, m.index - 200), m.index))) continue;
      specs.push({ spec: m[1], line });
    }
    for (const m of text.matchAll(/\bprocess\.env\.([A-Za-z_][\w]*)|\bprocess\.env\[\s*['"]([^'"]+)['"]\s*\]|\bimport\.meta\.env\.([A-Za-z_][\w]*)/g)) {
      scan.env.push({ package: pkg.name, file, line: lineAt(starts, m.index), name: m[1] ?? m[2] ?? m[3], isTest });
    }
    for (const { spec, line } of specs) {
      let kind, target, subpath = '', resolved = null;
      if (spec.startsWith('.')) {
        resolved = resolveFile(path.resolve(path.dirname(abs), spec));
        const relTarget = toPosix(path.relative(root, resolved ?? path.resolve(path.dirname(abs), spec)));
        const t = owner(relTarget);
        if (!t) continue;
        if (t.name === pkg.name) { if (resolved) edges.push([file, toPosix(path.relative(root, resolved))]); continue; }
        kind = 'relative'; target = t.name; subpath = relTarget.slice(t.dir.length + 1);
      } else {
        const parts = spec.split('/');
        const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
        if (byName.has(name)) { kind = 'package'; target = name; subpath = parts.slice(spec.startsWith('@') ? 2 : 1).join('/'); }
        else {
          const a = matchAlias(spec);
          if (!a) continue;
          const mapped = a.key.endsWith('*') ? a.target.replace('*', spec.slice(a.key.length - 1)) : a.target;
          resolved = resolveFile(path.resolve(baseUrl, mapped)) ?? path.resolve(baseUrl, mapped);
          const relResolved = toPosix(path.relative(root, resolved));
          const t = owner(relResolved);
          if (!t || t.name === pkg.name) continue;
          kind = 'alias'; target = t.name; subpath = relResolved.slice(t.dir.length + 1);
        }
      }
      const tp = byName.get(target);
      const entry = isEntrySubpath(tp, subpath);
      const hasExports = exportEntries(tp).length > 0;
      const deep = kind === 'relative'
        || (kind === 'alias' ? !entry
          : (subpath !== '' && (hasExports ? !covered(tp, subpath) : /^(src|lib|internal)(\/|$)/.test(subpath))));
      scan.imports.push({ from: pkg.name, fromSource: pkg.source, target, kind, spec, subpath, file, line, isTest, declared: pkg.workspaceDeps.includes(target), deep });
    }
  }
  scan.packages[pkg.name] = info;
  scan.fileEdges[pkg.name] = edges;
}
fs.writeFileSync(path.join(work, 'scan.json'), JSON.stringify(scan, null, 2));
console.log(JSON.stringify({
  packages: Object.keys(scan.packages).length,
  crossPackageImports: scan.imports.length,
  undeclared: scan.imports.filter((i) => !i.declared).length,
  deep: scan.imports.filter((i) => i.deep).length,
  envReads: scan.env.length,
}));
EOF
node "$W/scan.mjs"
```

Notes for the agent:

- The scan is regex-based. Commented-out imports can produce false positives — open the file at `line` to confirm before reporting.
- Type-only imports (`import type …`, `export type … from`, imports whose named specifiers are all `type X`, and `import type X = require(…)`) are excluded because they are erased at compile time.
- `.vue`, `.svelte`, and `.astro` files are not scanned.
- Same-package aliases such as `@/x` produce no file edges; package-boundary checks are unaffected.
- Environment reads using destructuring, such as `const { API_URL } = process.env`, are not detected.
- Huge repos: the scan is linear in file count and import/env match count, with line numbers resolved by precomputed offsets; if it takes > 2 minutes, tell the user and proceed.
