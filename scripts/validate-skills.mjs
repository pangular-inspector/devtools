#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) {
    errors.push(`${file}: missing the --- frontmatter block`);
    return null;
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (field) fields[field[1]] = field[2].trim();
  }
  return { fields, body: match[2] };
}

function checkLinks(file, body) {
  const prose = body.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
  for (const [, link] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|#|mailto:)/.test(link)) continue;
    const target = normalize(join(dirname(file), link.split('#')[0]));
    if (!existsSync(target)) errors.push(`${file}: broken link ${link}`);
  }
  for (const [, path] of body.matchAll(
    /`((?:app|apps|packages|docs|scripts|src|\.claude|\.github)\/[^`\s*<>]+)`/g,
  )) {
    if (!existsSync(join(root, path))) errors.push(`${file}: ${path} does not exist`);
  }
}

function check(file, name, kind) {
  const parsed = frontmatter(file);
  if (!parsed) return;
  const { fields, body } = parsed;
  if (fields.name !== name) {
    errors.push(
      `${file}: name must be "${name}" (the ${kind === 'skill' ? 'folder' : 'file'} name)`,
    );
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    errors.push(`${file}: use lowercase words joined by hyphens for the name`);
  }
  if (!fields.description || fields.description.length < 40) {
    errors.push(`${file}: add a description of at least 40 characters that says when to use it`);
  }
  if (body.trim().length < 100) errors.push(`${file}: the instructions are too short`);
  checkLinks(file, body);
}

const skills = join(root, '.claude/skills');
const agents = join(root, '.claude/agents');
let count = 0;

if (existsSync(skills)) {
  for (const name of readdirSync(skills)) {
    const dir = join(skills, name);
    if (!statSync(dir).isDirectory()) continue;
    const file = join(dir, 'SKILL.md');
    if (!existsSync(file)) {
      errors.push(`${dir}: missing SKILL.md`);
      continue;
    }
    check(file, name, 'skill');
    count++;
  }
}

if (existsSync(agents)) {
  for (const entry of readdirSync(agents)) {
    if (!entry.endsWith('.md')) continue;
    check(join(agents, entry), entry.replace(/\.md$/, ''), 'agent');
    count++;
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`${count} skills and roles OK.`);
