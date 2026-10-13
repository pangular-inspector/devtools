import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPangularCli } from '../cli.ts';
import {
  bundledSkillsDir,
  installSkills,
  listBundledSkills,
  skillsInstallLines,
  skillsTarget,
} from '../skills-install.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';
import pkg from '../../package.json' with { type: 'json' };

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

function source() {
  const dir = fixtureDir('pangular-skills-src-');
  mkdirSync(join(dir, 'alpha', 'references'), { recursive: true });
  writeFileSync(
    join(dir, 'alpha', 'SKILL.md'),
    '---\nname: alpha\ndescription: Alpha skill for tests.\n---\n\n# Alpha\n',
  );
  writeFileSync(join(dir, 'alpha', 'references', 'tools.md'), '# Tools\n');
  mkdirSync(join(dir, 'beta'));
  writeFileSync(join(dir, 'beta', 'SKILL.md'), '---\nname: beta\ndescription: Beta.\n---\n');
  mkdirSync(join(dir, 'not-a-skill'));
  return dir;
}

async function cli(args: string[], cwd: string) {
  const lines: string[] = [];
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  await createPangularCli({ log: (line) => lines.push(line), env: {} }).parse([
    'node',
    'pangular',
    ...args,
    '--root',
    cwd,
  ]);
  return { out: lines.join('\n'), err: errors.mock.calls.flat().join('\n') };
}

describe('bundled skills', () => {
  it('ship in the package, each with a SKILL.md whose name matches its folder', () => {
    expect(pkg.files).toContain('skills');
    const skills = listBundledSkills();
    expect(skills.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(['pangular-inspector', 'pangular-forms']),
    );
    for (const skill of skills) {
      const text = readFileSync(join(skill.dir, 'SKILL.md'), 'utf8');
      expect(text).toMatch(new RegExp(`^---\\nname: ${skill.name}\\n`));
      expect(skill.description.length).toBeGreaterThanOrEqual(40);
      expect(skill.dir.startsWith(bundledSkillsDir())).toBe(true);
    }
  });

  it('lists only folders with a SKILL.md, with every file inside', () => {
    expect(listBundledSkills(source())).toMatchObject([
      {
        name: 'alpha',
        description: 'Alpha skill for tests.',
        files: ['SKILL.md', 'references/tools.md'],
      },
      { name: 'beta', files: ['SKILL.md'] },
    ]);
  });
});

describe('installSkills', () => {
  it('picks the agent folder, the home folder with global, or --dir', () => {
    const cwd = '/work/app';
    expect(skillsTarget({ cwd })).toBe('/work/app/.claude/skills');
    expect(skillsTarget({ cwd, agent: 'agents' })).toBe('/work/app/.agents/skills');
    expect(skillsTarget({ cwd, agent: 'github' })).toBe('/work/app/.github/skills');
    expect(skillsTarget({ cwd, global: true, home: '/home/me' })).toBe('/home/me/.claude/skills');
    expect(skillsTarget({ cwd, dir: 'tools/skills', agent: 'agents' })).toBe(
      '/work/app/tools/skills',
    );
    expect(() => skillsTarget({ cwd, agent: 'toString' })).toThrow(/Unknown agent "toString"/);
  });

  it('copies every skill with its files into a new folder', () => {
    const cwd = fixtureDir('pangular-skills-');
    const result = installSkills({ cwd, source: source() });
    expect(result.results.map((entry) => entry.status)).toEqual(['installed', 'installed']);
    expect(readFileSync(join(cwd, '.claude/skills/alpha/references/tools.md'), 'utf8')).toBe(
      '# Tools\n',
    );
    expect(existsSync(join(cwd, '.claude/skills/beta/SKILL.md'))).toBe(true);
  });

  it('writes nothing on a dry run', () => {
    const cwd = fixtureDir('pangular-skills-');
    const result = installSkills({ cwd, source: source(), dryRun: true });
    expect(result.results.map((entry) => entry.status)).toEqual(['installed', 'installed']);
    expect(existsSync(join(cwd, '.claude'))).toBe(false);
    expect(skillsInstallLines(result, cwd)).toEqual([
      '  Would install alpha -> .claude/skills/alpha',
      '  Would install beta -> .claude/skills/beta',
      '  Dry run: nothing was written.',
    ]);
  });

  it('never overwrites a changed skill without force, and keeps files the user added', () => {
    const cwd = fixtureDir('pangular-skills-');
    const from = source();
    installSkills({ cwd, source: from });
    const skill = join(cwd, '.claude/skills/alpha');
    writeFileSync(join(skill, 'SKILL.md'), 'my edits');
    writeFileSync(join(skill, 'notes.md'), 'mine');

    const again = installSkills({ cwd, source: from });
    expect(again.results).toMatchObject([
      { name: 'alpha', status: 'skipped', changed: ['SKILL.md'] },
      { name: 'beta', status: 'unchanged' },
    ]);
    expect(readFileSync(join(skill, 'SKILL.md'), 'utf8')).toBe('my edits');
    expect(skillsInstallLines(again, cwd)).toContain(
      '  Pass --force to replace the skipped skills with the bundled copy.',
    );

    const planned = installSkills({ cwd, source: from, force: true, dryRun: true });
    expect(planned.results[0].status).toBe('replaced');
    expect(readFileSync(join(skill, 'SKILL.md'), 'utf8')).toBe('my edits');

    const forced = installSkills({ cwd, source: from, force: true });
    expect(forced.results[0].status).toBe('replaced');
    expect(readFileSync(join(skill, 'SKILL.md'), 'utf8')).toMatch(/^---\nname: alpha/);
    expect(readFileSync(join(skill, 'notes.md'), 'utf8')).toBe('mine');
  });

  it('never writes through a symbolic link at the destination, even with force', () => {
    const from = source();
    const outside = fixtureDir('pangular-skills-outside-');
    const victim = join(outside, 'victim.txt');
    writeFileSync(victim, 'keep me');

    // A planted SKILL.md link to a file outside the skill folder.
    const cwd = fixtureDir('pangular-skills-');
    const skills = join(cwd, '.claude/skills');
    mkdirSync(join(skills, 'alpha'), { recursive: true });
    symlinkSync(victim, join(skills, 'alpha', 'SKILL.md'));
    expect(() => installSkills({ cwd, source: from, skills: ['alpha'], force: true })).toThrow(
      /symbolic link .*SKILL\.md/,
    );
    expect(readFileSync(victim, 'utf8')).toBe('keep me');
    // Nothing of the refused skill was written, not even its other files.
    expect(existsSync(join(skills, 'alpha', 'references'))).toBe(false);

    // A planted skill folder link, existing or dangling.
    for (const linked of [outside, join(outside, 'missing')]) {
      const project = fixtureDir('pangular-skills-');
      const into = join(project, '.claude/skills');
      mkdirSync(into, { recursive: true });
      symlinkSync(linked, join(into, 'alpha'), 'dir');
      expect(() =>
        installSkills({ cwd: project, source: from, skills: ['alpha'], force: true }),
      ).toThrow(/symbolic link .*alpha/);
      expect(readdirSync(outside).sort()).toEqual(['victim.txt']);
    }

    // A linked folder inside the skill.
    const nested = fixtureDir('pangular-skills-');
    const alpha = join(nested, '.claude/skills/alpha');
    mkdirSync(alpha, { recursive: true });
    symlinkSync(outside, join(alpha, 'references'), 'dir');
    expect(() => installSkills({ cwd: nested, source: from, force: true })).toThrow(
      /symbolic link .*references/,
    );
    expect(readdirSync(outside).sort()).toEqual(['victim.txt']);
  });

  it('installs only the named skills and refuses unknown ones', () => {
    const cwd = fixtureDir('pangular-skills-');
    const result = installSkills({ cwd, source: source(), skills: ['beta'] });
    expect(result.results.map((entry) => entry.name)).toEqual(['beta']);
    expect(readdirSync(join(cwd, '.claude/skills'))).toEqual(['beta']);
    expect(() => installSkills({ cwd, source: source(), skills: ['gamma'] })).toThrow(
      /Unknown skill "gamma". Bundled skills: alpha, beta/,
    );
  });
});

describe('pangular skills', () => {
  it('lists the bundled skills', async () => {
    const cwd = fixtureDir('pangular-skills-cli-');
    const { out } = await cli(['skills'], cwd);
    expect(out).toContain('pangular-inspector: ');
    expect(out).toContain('pangular skills install');
  });

  it('installs into --root, honours --dry-run, --agent, --dir and --skill', async () => {
    const cwd = fixtureDir('pangular-skills-cli-');
    let { out } = await cli(['skills', 'install', '--dry-run'], cwd);
    expect(out).toContain('Would install pangular-inspector -> .claude/skills/pangular-inspector');
    expect(existsSync(join(cwd, '.claude'))).toBe(false);

    ({ out } = await cli(['skills', 'install', '--agent', 'agents'], cwd));
    expect(out).toContain('Installed pangular-inspector -> .agents/skills/pangular-inspector');
    expect(readFileSync(join(cwd, '.agents/skills/pangular-inspector/SKILL.md'), 'utf8')).toBe(
      readFileSync(join(bundledSkillsDir(), 'pangular-inspector/SKILL.md'), 'utf8'),
    );

    ({ out } = await cli(['skills', 'install', '--agent', 'agents'], cwd));
    expect(out).toContain('Up to date pangular-inspector');

    ({ out } = await cli(
      ['skills', 'install', '--dir', 'ai/skills', '--skill', 'pangular-forms'],
      cwd,
    ));
    expect(readdirSync(join(cwd, 'ai/skills'))).toEqual(['pangular-forms']);
  });

  it('reports an unknown action or agent and exits 1', async () => {
    const cwd = fixtureDir('pangular-skills-cli-');
    let { err } = await cli(['skills', 'remove'], cwd);
    expect(err).toMatch(/Unknown skills action "remove"/);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    ({ err } = await cli(['skills', 'install', '--agent', 'vim'], cwd));
    expect(err).toMatch(/Unknown agent "vim"/);
    expect(process.exitCode).toBe(1);
  });
});
