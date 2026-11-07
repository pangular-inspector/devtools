# Check 2 — Circular dependencies

Output: `findings/circular-deps.json`.

| id                            | severity | detect                                                                                       |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `circular-deps/package-cycle` | high     | a cycle in the package graph (`workspaceDeps`, or the Nx project graph when Nx is installed) |
| `circular-deps/file-cycle`    | medium   | a cycle among a package's own files (`scan.fileEdges`)                                       |

Package cycles break topological builds (`^build` order is undefined), cause stale caches and make packages unpublishable independently.
File cycles cause `undefined` at import time in ESM/CJS and block tree-shaking.

## Steps

1. If Nx is installed, refresh the graph and use it as the package graph:
   ```bash
   W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
   rm -f "$W/nx-graph.json" "$W/nx-graph.failed"
   NX_DAEMON=false NX_NO_CLOUD=true NX_WORKSPACE_DATA_DIRECTORY="$W/nx-data" npx nx graph --file="$W/nx-graph.json" \
     || touch "$W/nx-graph.failed"
   ```
   The file has `graph.dependencies[project] = [{ target }]`. Otherwise use `workspace.json` `workspaceDeps`.
   If Turborepo is installed, `TURBO_TELEMETRY_DISABLED=1 npx turbo run build --dry=json` failing with a message containing `cyclic` is also evidence. Turbo dry-run JSON writes no project files beyond Turborepo's own cache directory.
   Status: the `workspaceDeps` graph is complete for package.json-based workspaces, so missing turbo does **not** make this check partial. Under Nx without a local install, mark `partial` with reason `nx not installed; project graph inferred from package.json only`; if Nx is installed but `nx graph` fails, mark `partial` with reason `nx graph failed; project graph inferred from package.json only` (Nx also infers edges from imports and `implicitDependencies`).
2. Run the cycle snippet:

```bash
W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
cat > "$W/cycles.mjs" <<'EOF'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const work = path.join(os.tmpdir(), 'monorepo-doctor');
const ws = JSON.parse(fs.readFileSync(path.join(work, 'workspace.json'), 'utf8'));
const scan = JSON.parse(fs.readFileSync(path.join(work, 'scan.json'), 'utf8'));
const nxGraphPath = path.join(work, 'nx-graph.json');

function cycles(graph) {
  const found = new Map();
  const state = new Map();
  const stack = [];
  const visit = (n) => {
    state.set(n, 1); stack.push(n);
    for (const m of graph.get(n) ?? []) {
      if (state.get(m) === 1) {
        const cyc = stack.slice(stack.indexOf(m));
        const i = cyc.indexOf([...cyc].sort()[0]);
        const norm = [...cyc.slice(i), ...cyc.slice(0, i)];
        found.set(norm.join('\u0000'), norm);
      } else if (!state.has(m)) visit(m);
    }
    stack.pop(); state.set(n, 2);
  };
  for (const n of graph.keys()) if (!state.has(n)) visit(n);
  return [...found.values()];
}

const nx = ws.orchestrators.find((o) => o.name === 'nx');
const graphFailed = Boolean(nx?.installed) && (fs.existsSync(path.join(work, 'nx-graph.failed')) || !fs.existsSync(nxGraphPath));
const useNxGraph = Boolean(nx?.installed) && !graphFailed;
let pkgGraph;
if (useNxGraph) {
  const g = JSON.parse(fs.readFileSync(nxGraphPath, 'utf8')).graph;
  pkgGraph = new Map(Object.entries(g.dependencies).map(([k, v]) => [k, v.map((d) => d.target).filter((t) => g.nodes[t])]));
} else {
  pkgGraph = new Map(ws.packages.map((p) => [p.name, p.workspaceDeps]));
}
const byName = new Map(ws.packages.map((p) => [p.name, p]));
const findings = [];
for (const c of cycles(pkgGraph)) {
  const first = byName.get(c[0]);
  findings.push({
    id: 'circular-deps/package-cycle', severity: 'high',
    title: `Package cycle: ${[...c, c[0]].join(' → ')}`,
    location: { file: first ? `${first.dir}/package.json` : 'package.json', package: c[0] },
    evidence: c.map((n, i) => `${n} depends on ${c[(i + 1) % c.length]}`).join('\n'),
    fix: 'Extract the shared code into a new package both can depend on, or invert one edge (dependency injection / events). Remove the back-edge from package.json.',
  });
}
for (const [pkg, edges] of Object.entries(scan.fileEdges)) {
  const g = new Map();
  for (const [a, b] of edges) { if (!g.has(a)) g.set(a, []); g.get(a).push(b); }
  for (const c of cycles(g)) {
    findings.push({
      id: 'circular-deps/file-cycle', severity: 'medium',
      title: `File cycle in ${pkg} (${c.length} files)`,
      location: { file: c[0], package: pkg },
      evidence: [...c, c[0]].join('\n → '),
      fix: 'Move the shared symbols into a third module that both import, or merge the files.',
    });
  }
}
const status = nx && !useNxGraph ? 'partial' : 'ok';
const result = { status, findings };
if (status === 'partial') result.reason = graphFailed
  ? 'nx graph failed; project graph inferred from package.json only'
  : 'nx not installed; project graph inferred from package.json only';
fs.writeFileSync(path.join(work, 'findings', 'circular-deps.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ packageCycles: findings.filter((f) => f.id.endsWith('package-cycle')).length, fileCycles: findings.filter((f) => f.id.endsWith('file-cycle')).length }));
EOF
node "$W/cycles.mjs"
```

3. Review: for each cycle, open the import lines to confirm they are value imports. Drop false positives (e.g., an import inside a comment) before rendering.
4. If more than 20 file cycles exist in one package, keep the 20 shortest and add `"reason": "N file cycles; showing 20 shortest"` with status `partial`.
