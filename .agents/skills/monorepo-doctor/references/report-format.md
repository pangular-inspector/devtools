# Report format

Every check writes one file: `$W/findings/<check>.json`
where `<check>` is one of `boundaries`, `circular-deps`, `caching`, `ci-coverage`, `prod-leakage`.

```json
{
  "status": "ok | partial | skipped | not-run",
  "reason": "required unless status is ok",
  "findings": [
    {
      "id": "caching/missing-outputs",
      "severity": "critical | high | medium | low",
      "title": "One line, specific: name the package/task",
      "location": { "file": "turbo.json", "line": 4, "package": "@acme/ui" },
      "evidence": "The exact config/code/command output that proves it",
      "fix": "Concrete change, ideally a snippet"
    }
  ]
}
```

- `ok`: check ran fully. `partial`: some sub-steps skipped (say which in `reason`).
  `skipped`: check could not run at all. `not-run`: user scoped it out. A missing findings file is rendered as `skipped` with reason `no findings file`; for user-scoped-out checks, write an explicit `not-run` file at `$W/findings/<check>.json`.
- `location.file` is relative to the workspace root. Include `package` whenever the finding belongs to one package.
- Never emit a finding without `evidence`. If you are unsure, lower severity and say so in `evidence`; do not guess.
- Use only the ids defined in the check reference files.

## Severity rubric

| Severity | Meaning                                                            |
| -------- | ------------------------------------------------------------------ |
| critical | Wrong code can ship or tests are silently skipped for real changes |
| high     | Likely incorrect builds/caching or broken CI signal                |
| medium   | Correctness risk under specific conditions, or a boundary erosion  |
| low      | Hygiene, performance, or maintainability                           |

Severity may be lowered one level with a stated reason (e.g., package is private). Never raise it.

## Render

After all checks, run this snippet. It validates every findings file and fails loudly (`stderr`, exit 1) if a status is outside the enum, `reason` is missing for a non-`ok` status, a finding id does not start with `<check>/`, or evidence is missing/empty. Arguments: output directory (default: workspace root).

```bash
W="$(node -p 'require("os").tmpdir()')/monorepo-doctor"
cat > "$W/render.mjs" <<'EOF'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const work = path.join(os.tmpdir(), 'monorepo-doctor');
const ws = JSON.parse(fs.readFileSync(path.join(work, 'workspace.json'), 'utf8'));
const outDir = path.resolve(process.argv[2] ?? ws.root);
fs.mkdirSync(outDir, { recursive: true });
const CHECKS = ['boundaries', 'circular-deps', 'caching', 'ci-coverage', 'prod-leakage'];
const STATUS = ['ok', 'partial', 'skipped', 'not-run'];
const SEV = ['critical', 'high', 'medium', 'low'];
const checks = [], findings = [], problems = [];
for (const check of CHECKS) {
  const p = path.join(work, 'findings', `${check}.json`);
  let r;
  if (fs.existsSync(p)) {
    try { r = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { problems.push(`${check}: invalid JSON: ${e.message}`); r = { status: 'skipped', reason: 'invalid findings file', findings: [] }; }
  } else {
    r = { status: 'skipped', reason: 'no findings file', findings: [] };
  }
  if (!STATUS.includes(r.status)) problems.push(`${check}: invalid status ${JSON.stringify(r.status)}`);
  if (r.status !== 'ok' && !String(r.reason ?? '').trim()) problems.push(`${check}: reason is required when status is ${r.status}`);
  const list = Array.isArray(r.findings) ? r.findings : (problems.push(`${check}: findings must be an array`), []);
  checks.push({ check, status: r.status, reason: r.reason, findingCount: list.length });
  for (const f of list) {
    if (!SEV.includes(f.severity)) problems.push(`${check}: unknown severity ${JSON.stringify(f.severity)}${f.id ? ` (${f.id})` : ''}`);
    if (typeof f.id !== 'string' || !f.id.startsWith(`${check}/`)) problems.push(`${check}: finding id must start with ${check}/ (${f.id ?? 'missing'})`);
    if (!String(f.evidence ?? '').trim()) problems.push(`${check}: finding ${f.id ?? '?'} missing evidence`);
    findings.push({ ...f, check });
  }
}
if (problems.length) {
  for (const problem of problems) console.error(`ERROR: ${problem}`);
  process.exit(1);
}
const safe = (s) => String(s ?? '');
findings.sort((a, b) => SEV.indexOf(a.severity) - SEV.indexOf(b.severity)
  || safe(a.id).localeCompare(safe(b.id))
  || safe(a.location?.file).localeCompare(safe(b.location?.file))
  || ((a.location?.line ?? 0) - (b.location?.line ?? 0)));
const summary = Object.fromEntries(SEV.map((s) => [s, findings.filter((f) => f.severity === s).length]));
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  workspace: { root: ws.root, packageManager: ws.packageManager, orchestrators: ws.orchestrators, packageCount: ws.packages.length },
  summary, checks, findings,
};
fs.writeFileSync(path.join(outDir, 'monorepo-doctor-report.json'), JSON.stringify(report, null, 2) + '\n');
const cell = (v) => safe(v).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const loc = (l) => l?.file ? `\`${l.file}${l.line ? `:${l.line}` : ''}\`${l.package ? ` (${l.package})` : ''}` : '—';
const fenceFor = (s) => '`'.repeat(Math.max(3, ...[...safe(s).matchAll(/`+/g)].map((m) => m[0].length + 1)));
const md = [
  '# Monorepo Doctor Report', '',
  `**Workspace:** ${ws.packageManager} · ${ws.orchestrators.map((o) => o.name).join(', ') || 'no orchestrator'} · ${ws.packages.length} packages`, '',
  `**Summary:** ${SEV.map((s) => `${summary[s]} ${s}`).join(' · ')}`, '',
  '| Check | Status | Findings | Note |', '|---|---|---|---|',
  ...checks.map((c) => `| ${cell(c.check)} | ${cell(c.status)} | ${c.findingCount} | ${cell(c.reason ?? '')} |`), '',
];
for (const s of SEV) {
  const fs_ = findings.filter((f) => f.severity === s);
  if (!fs_.length) continue;
  md.push(`## ${s[0].toUpperCase() + s.slice(1)}`, '');
  for (const f of fs_) {
    const fence = fenceFor(f.evidence);
    md.push(`### ${cell(f.title)}`, '', `- **id:** ${f.id ? `\`${f.id}\`` : '—'}`, `- **where:** ${loc(f.location)}`, '', '**Evidence**', '', fence, safe(f.evidence), fence, '', `**Fix:** ${safe(f.fix) || '—'}`, '');
  }
}
if (!findings.length) md.push('No findings. 🎉', '');
fs.writeFileSync(path.join(outDir, 'monorepo-doctor-report.md'), md.join('\n'));
console.log(JSON.stringify({ outDir, summary }));
EOF
node "$W/render.mjs" "<output-dir>"   # replace <output-dir> with a literal path; omit it to write to the workspace root
```

## CI mode

When the user asks for CI mode (or a fail threshold), write the reports first. In hosted CI, the agent step itself may not be able to fail the job reliably, so document/run this threshold check as a separate workflow step against the report file:

```bash
node -e '
const fs = require("node:fs");
const path = require("node:path");
const order = ["low", "medium", "high", "critical"];
const reportPath = process.argv[1];
const threshold = process.argv[2] || "high";
const min = order.indexOf(threshold);
if (!reportPath || min === -1) {
  console.error("usage: node -e <script> <report.json> <low|medium|high|critical>");
  process.exit(2);
}
const r = JSON.parse(fs.readFileSync(path.resolve(reportPath), "utf8"));
const bad = (r.findings ?? []).filter((f) => order.indexOf(f.severity) >= min);
for (const f of bad) console.error(`${f.severity.toUpperCase()} ${f.id ?? "—"} ${f.location?.file ?? "—"}`);
process.exit(bad.length ? 1 : 0);
' "<output-dir>/monorepo-doctor-report.json" high
```
