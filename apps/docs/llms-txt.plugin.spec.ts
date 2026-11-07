import config from './src/ngmd.config.ts';
import {buildLlmsTxt} from './llms-txt.plugin.ts';

const {index, full} = buildLlmsTxt(import.meta.dirname, config);

describe('llms.txt', () => {
  it('starts with the site name and summary', () => {
    expect(index.startsWith(`# ${config.site.name}\n\n> ${config.site.description}\n`)).toBe(true);
    expect(full.startsWith(`# ${config.site.name}\n`)).toBe(true);
  });

  it('links each sidebar page to its markdown route with its description, in sidebar order', () => {
    const first = config.nav[0];
    expect(index).toContain(`## ${first.label}`);
    expect(index).toMatch(
      /- \[Quick start\]\(https:\/\/pangular-inspector\.dev\/getting-started\/quick-start\.md\): \S/,
    );
    const positions = first.items
      .map((item) => index.indexOf(`${config.site.url}${item.href}.md`))
      .filter((at) => at >= 0);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('leaves out noIndex pages and keeps page bodies without frontmatter', () => {
    expect(index).not.toContain('/contributing/kitchen-sink.md');
    expect(full).not.toContain('<!-- https://pangular-inspector.dev/contributing/kitchen-sink -->');
    expect(full).toContain(
      '<!-- https://pangular-inspector.dev/getting-started/troubleshooting -->',
    );
    expect(full).not.toContain('title: Troubleshooting\n');
    expect(full).toContain('\n\n# Troubleshooting\n');
  });
});
