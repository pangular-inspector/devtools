import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  type Stats,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CAC } from 'cac';

/**
 * `pangular skills`: the agent skills this package ships in `skills/`, each a
 * folder with a `SKILL.md`, copied into an agent's skill folder.
 */

/** Where each agent looks for project skills, relative to the project folder. */
export const SKILL_AGENTS = {
  claude: '.claude/skills',
  agents: '.agents/skills',
  github: '.github/skills',
} as const;

export type SkillAgent = keyof typeof SKILL_AGENTS;

export interface BundledSkill {
  name: string;
  description: string;
  dir: string;
  /** Paths inside the skill folder, with `/` separators. */
  files: string[];
}

export type SkillStatus = 'installed' | 'unchanged' | 'replaced' | 'skipped';

export interface SkillResult {
  name: string;
  status: SkillStatus;
  target: string;
  /** Files that differ from the bundled copy (`skipped` and `replaced` only). */
  changed?: string[];
}

export interface SkillsInstallOptions {
  /** The project folder; `dir` and the agent folders resolve against it. */
  cwd: string;
  agent?: string;
  /** A skill folder to install into instead of the agent's. */
  dir?: string;
  /** The agent's folder in the home directory instead of the project's. */
  global?: boolean;
  /** Only these skills. */
  skills?: string[];
  force?: boolean;
  dryRun?: boolean;
  /** Where the bundled skills are. Defaults to the package's `skills/`. */
  source?: string;
  home?: string;
}

export interface SkillsInstallResult {
  target: string;
  dryRun: boolean;
  results: SkillResult[];
}

/** The package's `skills/` folder, next to `src/` and `dist/`. */
export function bundledSkillsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
}

function filesIn(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...filesIn(path, base));
    else out.push(relative(base, path).split('\\').join('/'));
  }
  return out;
}

function descriptionOf(file: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'));
  const line = match?.[1].split(/\r?\n/).find((entry) => entry.startsWith('description:'));
  return line ? line.slice('description:'.length).trim() : '';
}

export function listBundledSkills(source = bundledSkillsDir()): BundledSkill[] {
  if (!existsSync(source)) return [];
  return readdirSync(source)
    .sort()
    .map((name) => join(source, name))
    .filter((dir) => statSync(dir).isDirectory() && existsSync(join(dir, 'SKILL.md')))
    .map((dir) => ({
      name: dir.slice(source.length + 1),
      description: descriptionOf(join(dir, 'SKILL.md')),
      dir,
      files: filesIn(dir),
    }));
}

export function skillsTarget(options: SkillsInstallOptions): string {
  if (options.dir) return resolve(options.cwd, options.dir);
  const agent = options.agent ?? 'claude';
  if (!Object.hasOwn(SKILL_AGENTS, agent)) {
    throw new Error(
      `[pangular] Unknown agent "${agent}". Use ${Object.keys(SKILL_AGENTS).join(', ')}, or pass --dir <folder>.`,
    );
  }
  const folder = SKILL_AGENTS[agent as SkillAgent];
  return join(options.global ? (options.home ?? homedir()) : options.cwd, folder);
}

function sameFile(a: string, b: string): boolean {
  return existsSync(b) && statSync(b).isFile() && readFileSync(a).equals(readFileSync(b));
}

function lstatOrNull(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Throws when writing `file` could leave `target` (the chosen skill folder)
 * through a symbolic link: the skill folder, a folder inside it or the file
 * itself must not be one. `copyFileSync` and `mkdirSync` follow links, so a
 * planted `SKILL.md` link would otherwise overwrite the file it points to.
 * `target` itself may be a link; writes stay inside where it resolves.
 */
function assertSafeWrite(target: string, file: string): void {
  if (!inside(target, file)) {
    throw new Error(`[pangular] Refusing to write ${file}: it is outside ${target}.`);
  }
  let path = target;
  for (const part of relative(target, file).split(sep)) {
    path = join(path, part);
    const stat = lstatOrNull(path);
    if (!stat) return;
    if (stat.isSymbolicLink()) {
      throw new Error(
        `[pangular] Refusing to write through the symbolic link ${path}. Remove it and run the command again.`,
      );
    }
  }
}

/** Throws when the folder `file` is written into resolves outside `target`. */
function assertResolvedInside(target: string, file: string): void {
  const root = realpathSync(target);
  const folder = realpathSync(dirname(file));
  if (folder !== root && !inside(root, folder)) {
    throw new Error(`[pangular] Refusing to write ${file}: it resolves outside ${target}.`);
  }
}

/**
 * Copies the bundled skills into the agent's skill folder. A skill folder
 * that already exists and differs is left alone unless `force` is set, and
 * `dryRun` writes nothing. Files the user added to a skill folder are kept.
 */
export function installSkills(options: SkillsInstallOptions): SkillsInstallResult {
  const all = listBundledSkills(options.source);
  if (!all.length) throw new Error('[pangular] This package has no bundled skills.');
  const wanted = options.skills?.length ? options.skills : all.map((skill) => skill.name);
  const unknown = wanted.filter((name) => !all.some((skill) => skill.name === name));
  if (unknown.length) {
    throw new Error(
      `[pangular] Unknown skill ${unknown.map((name) => `"${name}"`).join(', ')}. Bundled skills: ${all.map((skill) => skill.name).join(', ')}.`,
    );
  }
  const target = skillsTarget(options);
  const results: SkillResult[] = [];
  for (const skill of all.filter((entry) => wanted.includes(entry.name))) {
    const into = join(target, skill.name);
    const changed = skill.files.filter(
      (file) => !sameFile(join(skill.dir, file), join(into, file)),
    );
    const status: SkillStatus = !existsSync(into)
      ? 'installed'
      : !changed.length
        ? 'unchanged'
        : options.force
          ? 'replaced'
          : 'skipped';
    results.push({
      name: skill.name,
      status,
      target: into,
      ...(status === 'skipped' || status === 'replaced' ? { changed } : {}),
    });
    if (options.dryRun || status === 'unchanged' || status === 'skipped') continue;
    // Check every file before writing any, so a refused skill is left as it was.
    for (const file of changed) assertSafeWrite(target, join(into, file));
    for (const file of changed) {
      const to = join(into, file);
      mkdirSync(dirname(to), { recursive: true });
      assertSafeWrite(target, to);
      assertResolvedInside(target, to);
      copyFileSync(join(skill.dir, file), to);
    }
  }
  return { target, dryRun: !!options.dryRun, results };
}

const VERB: Record<SkillStatus, [done: string, planned: string]> = {
  installed: ['Installed', 'Would install'],
  replaced: ['Replaced', 'Would replace'],
  unchanged: ['Up to date', 'Up to date'],
  skipped: ['Skipped', 'Would skip'],
};

export function skillsInstallLines(result: SkillsInstallResult, cwd: string): string[] {
  const shown = (path: string) => {
    const rel = relative(cwd, path);
    return rel && !rel.startsWith('..') ? rel : path;
  };
  const lines = result.results.map((entry) => {
    const verb = VERB[entry.status][result.dryRun ? 1 : 0];
    const why =
      entry.status === 'skipped' ? ` (it exists and differs: ${entry.changed!.join(', ')})` : '';
    return `  ${verb} ${entry.name} -> ${shown(entry.target)}${why}`;
  });
  if (result.results.some((entry) => entry.status === 'skipped')) {
    lines.push('  Pass --force to replace the skipped skills with the bundled copy.');
  }
  if (result.dryRun) lines.push('  Dry run: nothing was written.');
  return lines;
}

export interface SkillsCommandFlags {
  agent?: string;
  dir?: string;
  global?: boolean;
  skill?: string | string[];
  force?: boolean;
  dryRun?: boolean;
}

/**
 * Adds `pangular skills [list|install]` to the CLI. `cwd` gives the project
 * folder for the given flags (`--root`, `PANGULAR_ROOT`, the working directory).
 */
export function registerSkillsCommand(
  cli: CAC,
  options: {
    cwd: (flags: Record<string, unknown>) => string;
    log: (message: string) => void;
    source?: string;
  },
) {
  cli
    .command('skills [action]', 'List the bundled agent skills, or install them (skills install)')
    .option(
      '--agent <name>',
      `The agent's skill folder: ${Object.entries(SKILL_AGENTS)
        .map(([name, dir]) => `${name} (${dir})`)
        .join(', ')}. Default: claude`,
    )
    .option('--dir <folder>', 'Install into this folder instead of the agent folder')
    .option('--global', 'Install into the agent folder in your home directory')
    .option('--skill <name>', 'Install only this skill (repeat for more)')
    .option('--force', 'Replace skills that exist and differ from the bundled copy')
    .option('--dry-run', 'Print what would change and write nothing')
    .action((action: string | undefined, flags: SkillsCommandFlags) => {
      const skills = listBundledSkills(options.source);
      if (!action || action === 'list') {
        options.log(
          [
            'Agent skills in @pangular-inspector/devtools:',
            ...skills.map((skill) => `  ${skill.name}: ${skill.description}`),
            '',
            'Install them with: pangular skills install [--agent claude|agents|github] [--dir <folder>] [--dry-run] [--force]',
          ].join('\n'),
        );
        return;
      }
      if (action !== 'install') {
        throw new Error(
          `[pangular] Unknown skills action "${action}". Use pangular skills list or pangular skills install.`,
        );
      }
      const cwd = options.cwd(flags as Record<string, unknown>);
      const result = installSkills({
        cwd,
        agent: flags.agent,
        dir: flags.dir,
        global: flags.global,
        skills: flags.skill === undefined ? undefined : [flags.skill].flat().map(String),
        force: flags.force,
        dryRun: flags.dryRun,
        source: options.source,
      });
      options.log(skillsInstallLines(result, cwd).join('\n'));
    });
}
