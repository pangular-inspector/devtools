import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as prettier from 'prettier';
import {TOOL_INDEX_PATH, findSection, renderToolIndex} from './agent-tool-index';

const docsRoot = import.meta.dirname;

describe('agent tool index', () => {
  it('names every agent tool and resource in tools.md or resources.md', () => {
    expect(renderToolIndex(docsRoot).problems).toEqual([]);
  });

  it('matches the page in the repository; run pnpm docs:agent-tools when it fails', async () => {
    const file = join(docsRoot, TOOL_INDEX_PATH);
    const options = (await prettier.resolveConfig(file)) ?? {};
    const expected = await prettier.format(renderToolIndex(docsRoot).markdown, {
      ...options,
      filepath: file,
    });
    expect(readFileSync(file, 'utf8')).toBe(expected);
  }, 30_000);

  it('links a tool to its own heading, then to the table that defines it', () => {
    const markdown = [
      '## Before you call a tool',
      'Use `explain-field` and `explain-form-changes`.',
      '## Forms',
      '### Read',
      '| Tool | What it answers |',
      '| --- | --- |',
      '| `explain-field` | One field |',
      '',
      '| Tool | Cap |',
      '| --- | --- |',
      '| `explain-form-changes` | 100 fields |',
      '### Track',
      '| Tool | What it answers |',
      '| --- | --- |',
      '| `explain-form-changes` | The net change |',
      '### wait-for',
    ].join('\n');
    expect(findSection(markdown, 'explain-field')?.slug).toBe('read');
    expect(findSection(markdown, 'explain-form-changes')?.slug).toBe('track');
    expect(findSection(markdown, 'wait-for')?.slug).toBe('wait-for');
    expect(findSection(markdown, 'missing-tool')).toBeNull();
  });
});
