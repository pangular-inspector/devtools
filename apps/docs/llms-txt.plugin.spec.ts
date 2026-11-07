import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {NgmdConfig} from './src/ngmd.config.ts';
import siteConfig from './src/ngmd.config.ts';
import {buildLlmsTxt} from './llms-txt.plugin.ts';

const config: NgmdConfig = {
  site: {
    name: 'Fixture Docs',
    description: 'A fixture site.',
    url: 'https://docs.example/',
    githubUrl: 'https://github.com/example/docs',
  },
  nav: [
    {
      label: 'Start',
      items: [
        {label: 'Second', href: '/start/second'},
        {label: 'First', href: '/start/first'},
        {label: 'Hidden', href: '/start/hidden'},
      ],
    },
  ],
};

const page = (title: string, description: string, body: string, extra = '') =>
  `---\ntitle: ${title}\ndescription: ${description}\n${extra}---\n\n# ${title}\n\n${body}\n`;

let root: string;
let index: string;
let full: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'llms-txt-'));
  mkdirSync(join(root, 'src/content/start'), {recursive: true});
  writeFileSync(join(root, 'src/content/start/first.md'), page('First', 'The first page.', 'One.'));
  writeFileSync(
    join(root, 'src/content/start/second.md'),
    page('Second', 'The second page.', 'Two.'),
  );
  writeFileSync(
    join(root, 'src/content/start/hidden.md'),
    page('Hidden', 'Not indexed.', 'Secret.', 'noIndex: true\n'),
  );
  writeFileSync(join(root, 'src/content/extra.md'), page('Extra', 'Not in the sidebar.', 'Three.'));
  ({index, full} = buildLlmsTxt(root, config));
});

afterAll(() => rmSync(root, {recursive: true, force: true}));

describe('llms.txt', () => {
  it('starts with the site name and summary', () => {
    expect(index.startsWith('# Fixture Docs\n\n> A fixture site.\n')).toBe(true);
    expect(full.startsWith('# Fixture Docs\n')).toBe(true);
  });

  it('links each sidebar page to its markdown route with its description, in sidebar order', () => {
    const second = index.indexOf(
      '- [Second](https://docs.example/start/second.md): The second page.',
    );
    const first = index.indexOf('- [First](https://docs.example/start/first.md): The first page.');
    expect(index).toContain('## Start');
    expect(second).toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(second);
  });

  it('lists content pages missing from the sidebar under Optional', () => {
    expect(index).toMatch(/## Optional\n\n- \[Extra\]\(https:\/\/docs\.example\/extra\.md\)/);
  });

  it('leaves out noIndex pages and keeps page bodies without frontmatter', () => {
    expect(index).not.toContain('hidden');
    expect(full).not.toContain('Secret.');
    expect(full).toContain('<!-- https://docs.example/start/first -->\n\n# First\n\nOne.');
    expect(full).not.toContain('description: The first page.');
  });

  it('builds the real site without errors', () => {
    const site = buildLlmsTxt(import.meta.dirname, siteConfig);
    expect(site.index.startsWith(`# ${siteConfig.site.name}\n`)).toBe(true);
    expect(site.index).toContain(`## ${siteConfig.nav[0].label}`);
  });
});
