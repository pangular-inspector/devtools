import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPangularCli } from '../cli.ts';
import { failsAt, runSourceLints, toLintJson, toSarif } from '../lint-export.ts';
import { projectCompiler, type TemplateCompiler } from '../rpc/template-lint.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';
import { BASE_FILES, BROKEN_FILES, makeProject } from './analog-fixture.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

let compiler: TemplateCompiler;
beforeAll(async () => {
  const found = await projectCompiler(REPO);
  if (!found) throw new Error('@angular/compiler is not installed in the workspace');
  compiler = found;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

const VIEW = `import { Component } from '@angular/core';

@Component({
  selector: 'app-view',
  template: \`
    <img src="a.png">
    @for (item of items; track item.id) {
      <p>{{ item.tail | slice:1 }}</p>
    }
  \`,
})
export class View {}
`;

function project(): string {
  const dir = fixtureDir('pangular-lint-export-');
  mkdirSync(join(dir, 'src', 'app'), { recursive: true });
  writeFileSync(join(dir, 'src', 'app', 'view.ts'), VIEW);
  return dir;
}

describe('runSourceLints', () => {
  it('collects template and pipe findings with project-relative files and lines', async () => {
    const result = await runSourceLints(project(), { compiler });
    expect(result.lints).toEqual([
      { lint: 'templates', tool: 'scan-templates', ran: true, findings: 1 },
      { lint: 'pipes', tool: 'scan-pipe-usage', ran: true, findings: 1 },
      {
        lint: 'analog',
        tool: 'analog-lint',
        ran: false,
        skipped: 'The project is not an Analog app.',
        findings: 0,
      },
    ]);
    expect(result.findings.map((f) => [f.lint, f.rule, f.file, f.line])).toEqual([
      ['templates', 'img-missing-alt', 'src/app/view.ts', 6],
      ['pipes', 'impure-pipe-in-for', 'src/app/view.ts', 8],
    ]);
    expect(toLintJson(result).counts).toEqual({ error: 0, warning: 2, info: 0 });
  });

  it('runs only the lints asked for', async () => {
    const result = await runSourceLints(project(), { compiler, only: ['pipes'] });
    expect(result.lints.map((l) => l.lint)).toEqual(['pipes']);
    expect(result.findings.every((f) => f.lint === 'pipes')).toBe(true);
  });

  it('gives Analog files relative to the project folder', async () => {
    const root = makeProject(BASE_FILES, BROKEN_FILES);
    const result = await runSourceLints(root, { only: ['analog'] });
    expect(result.lints[0]).toMatchObject({ ran: true });
    const missing = result.findings.find((f) => f.rule === 'missing-default-export');
    expect(missing?.file).toMatch(/^src\/app\/pages\//);
  });

  it('fails only at or above the chosen severity', async () => {
    const result = await runSourceLints(project(), { compiler });
    expect(failsAt(result, 'none')).toBe(false);
    expect(failsAt(result, 'error')).toBe(false);
    expect(failsAt(result, 'warning')).toBe(true);
    expect(failsAt(result, 'info')).toBe(true);
  });
});

describe('toSarif', () => {
  it('writes a SARIF 2.1.0 log with rules, levels and physical locations', async () => {
    const sarif = toSarif(await runSourceLints(project(), { compiler }));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    const [run] = sarif.runs;
    const ids = run.tool.driver.rules.map((r) => r.id);
    expect(run.tool.driver.name).toBe('Pangular Inspector');
    expect(ids).toEqual(
      expect.arrayContaining([
        'templates/img-missing-alt',
        'templates/template-parse-error',
        'pipes/impure-pipe-in-for',
      ]),
    );
    expect(run.results).toHaveLength(2);
    for (const result of run.results) {
      expect(ids[result.ruleIndex!]).toBe(result.ruleId);
      expect(result.level).toBe('warning');
      expect(result.message.text).toContain('Fix:');
      expect(result.locations[0].physicalLocation).toEqual({
        artifactLocation: { uri: 'src/app/view.ts', uriBaseId: '%SRCROOT%' },
        region: { startLine: expect.any(Number) },
      });
    }
  });

  it('maps info findings to note and keeps findings without a file', () => {
    const sarif = toSarif({
      lints: [{ lint: 'analog', tool: 'analog-lint', ran: true, findings: 1 }],
      findings: [
        {
          lint: 'analog',
          rule: 'duplicate-url',
          severity: 'info',
          path: '/about',
          message: 'Two pages serve /about.',
          fix: 'Remove one.',
        },
      ],
    });
    expect(sarif.runs[0].results[0]).toMatchObject({
      ruleId: 'analog/duplicate-url',
      level: 'note',
      message: { text: '/about: Two pages serve /about. Fix: Remove one.' },
      locations: [],
    });
  });
});

describe('pangular lint', () => {
  async function run(args: string[]) {
    const out: string[] = [];
    const notes = vi.spyOn(console, 'error').mockImplementation(() => {});
    await createPangularCli({ log: (m) => out.push(m) }).parse(['node', 'pangular', ...args]);
    return { out: out.join('\n'), notes: notes.mock.calls.map((c) => String(c[0])) };
  }

  it('prints JSON by default and says which lints did not run', async () => {
    const dir = project();
    const { out, notes } = await run(['lint', '--root', dir]);
    const json = JSON.parse(out);
    expect(json.tool.name).toBe('pangular');
    expect(json.findings.map((f: { rule: string }) => f.rule)).toContain('impure-pipe-in-for');
    expect(notes.join('\n')).toContain('analog-lint did not run');
    expect(process.exitCode).toBeUndefined();
  });

  it('writes SARIF to --output and exits with 1 with --fail-on warning', async () => {
    const dir = project();
    const file = join(dir, 'reports', 'lint.sarif');
    const { out } = await run([
      'lint',
      '--root',
      dir,
      '--only',
      'pipes',
      '--format',
      'sarif',
      '--output',
      file,
      '--fail-on',
      'warning',
    ]);
    expect(out).toBe('');
    const sarif = JSON.parse(readFileSync(file, 'utf8'));
    expect(sarif.runs[0].results[0].ruleId).toBe('pipes/impure-pipe-in-for');
    expect(process.exitCode).toBe(1);
  });

  it('refuses an unknown format or lint', async () => {
    const dir = project();
    const bad = await run(['lint', '--root', dir, '--format', 'xml']);
    expect(bad.notes.join('\n')).toContain('Unknown --format "xml"');
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    const unknown = await run(['lint', '--root', dir, '--only', 'forms']);
    expect(unknown.notes.join('\n')).toContain('Unknown lint "forms"');
  });
});
