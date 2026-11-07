import { describe, expect, it } from 'vitest';
import {
  contentPreview,
  contentUsageOf,
  loadContentSchema,
  typedFrontmatter,
  validateFrontmatter,
} from '../rpc/analog-content.ts';
import { lintAnalog, scanAnalog } from '../rpc/analog-scan.ts';
import { analogContentText } from '../rpc/analog-tools.ts';
import { pangularConfigProblems, resolvePangularConfig } from '../config.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const SCHEMA = JSON.stringify({
  type: 'object',
  required: ['title', 'date'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 3 },
    slug: { type: 'string', pattern: '^[a-z-]+$' },
    date: { type: 'string', format: 'date' },
    draft: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    author: { type: 'object', required: ['name'] },
  },
});

describe('typedFrontmatter', () => {
  it('reads scalars, lists and one level of maps with their YAML types', () => {
    const { values, body } = typedFrontmatter(
      '---\ntitle: "Hello: world"\ncount: 3\ndraft: false\ntags: [a, b]\nmore:\n  - x\n  - 2\nauthor:\n  name: Ada\n---\n# Body\n',
    );
    expect(values).toEqual({
      title: 'Hello: world',
      count: 3,
      draft: false,
      tags: ['a', 'b'],
      more: ['x', 2],
      author: { name: 'Ada' },
    });
    expect(body).toBe('# Body\n');
  });
});

describe('validateFrontmatter', () => {
  const { schema } = loadContentSchema(makeProject({ 's.json': SCHEMA }), 's.json');

  it('passes frontmatter that matches the schema', () => {
    expect(
      validateFrontmatter(
        { title: 'Hello', date: '2026-01-02', tags: ['a'], author: { name: 'Ada' } },
        schema!,
      ),
    ).toEqual([]);
  });

  it('names each mismatch: missing, wrong type, format, pattern, item and unknown keys', () => {
    const errors = validateFrontmatter(
      {
        title: 'Hi',
        slug: 'Bad Slug',
        date: 'soon',
        draft: 'yes',
        tags: [1],
        extra: 1,
        author: {},
      },
      schema!,
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'title should have at least 3 characters.',
        expect.stringContaining('slug does not match'),
        'date should be a date, got "soon".',
        'draft should be boolean, got string "yes".',
        'tags[0] should be string, got integer 1.',
        'extra is not in the schema.',
        'author.name is required.',
      ]),
    );
  });
});

describe('loadContentSchema', () => {
  it('refuses a file outside the project, a missing file and invalid JSON', () => {
    const root = makeProject({ 'bad.json': '{nope', 'list.json': '[]' });
    expect(loadContentSchema(root, '../../etc/passwd').info.error).toMatch(
      /outside|does not exist/,
    );
    expect(loadContentSchema(root, 'none.json').info.error).toMatch(/does not exist/);
    expect(loadContentSchema(root, 'bad.json').info.error).toMatch(/not valid JSON/);
    expect(loadContentSchema(root, 'list.json').info.error).toMatch(/not a JSON Schema object/);
  });

  it('lists the keywords the check skips', () => {
    const root = makeProject({ 's.json': JSON.stringify({ $ref: '#/x', properties: {} }) });
    expect(loadContentSchema(root, './s.json').info).toEqual({
      file: '/s.json',
      unsupported: ['$ref'],
    });
  });
});

describe('content schema in the scan', () => {
  const root = makeProject(BASE_FILES, {
    'content.schema.json': SCHEMA,
    'src/content/ok.md': '---\ntitle: Fine post\ndate: 2026-01-02\n---\nText\n',
    'src/app/pages/blog/index.page.ts':
      "import { injectContentFiles } from '@analogjs/content';\nexport default class Blog { posts = injectContentFiles(); }\n",
  });

  it('reports the files that do not match as content-schema findings', () => {
    const project = scanAnalog(root, { contentSchema: 'content.schema.json' });
    expect(project.contentSchema).toEqual({ file: '/content.schema.json' });
    const hello = project.content.find((f) => f.file === '/src/content/hello.md');
    expect(hello?.schemaErrors).toEqual(['date is required.']);
    expect(project.content.find((f) => f.file === '/src/content/ok.md')?.schemaErrors).toBe(
      undefined,
    );
    const findings = lintAnalog(project).filter((f) => f.rule === 'content-schema');
    expect(findings.map((f) => f.file)).toEqual(['/src/content/hello.md']);
    expect(analogContentText(project)).toContain('SCHEMA: date is required.');
  });

  it('finds where the app reads content files', () => {
    const project = scanAnalog(root);
    expect(project.contentUsage).toEqual([
      { file: '/src/app/pages/blog/index.page.ts', api: 'injectContentFiles', line: 2 },
    ]);
    expect(project.contentSchema).toBeUndefined();
    expect(analogContentText(project)).toContain('No analog.contentSchema set');
  });

  it('turns an unreadable schema into one lint warning', () => {
    const project = scanAnalog(root, { contentSchema: 'missing.json' });
    expect(lintAnalog(project).filter((f) => f.rule === 'content-schema-unreadable')).toHaveLength(
      1,
    );
    expect(project.content.every((f) => !f.schemaErrors)).toBe(true);
  });
});

describe('contentPreview', () => {
  const root = makeProject(BASE_FILES, {
    'src/content/secret.md':
      '---\ntitle: Keys\napiKey: abc123\n---\nUse Bearer abcdefghijklmnopqrstuvwxyz0123 here.\n',
  });

  it('returns typed frontmatter and the masked markdown body', () => {
    const preview = contentPreview(root, '/src/content/secret.md');
    expect(preview.values).toEqual({ title: 'Keys', apiKey: '[redacted]' });
    expect(preview.body).not.toContain('abcdefghijklmnopqrstuvwxyz0123');
  });

  it('refuses files outside src/content', () => {
    expect(contentPreview(root, '/package.json').error).toMatch(/under src\/content/);
    expect(contentPreview(root, '/src/content/../../package.json').error).toBeDefined();
  });
});

describe('contentUsageOf', () => {
  it('skips import lines and keeps call sites', () => {
    const source =
      "import {\n  injectContent,\n} from '@analogjs/content';\nconst post = injectContent();\n";
    expect(contentUsageOf('/a.ts', source)).toEqual([
      { file: '/a.ts', api: 'injectContent', line: 4 },
    ]);
  });
});

describe('analog.contentSchema option', () => {
  it('resolves a path and warns about a wrong value', () => {
    expect(resolvePangularConfig({ analog: { contentSchema: ' s.json ' } }).analog).toEqual({
      contentSchema: 's.json',
    });
    expect(resolvePangularConfig({}).analog).toEqual({});
    expect(pangularConfigProblems({ analog: { contentSchema: 3 } })).toEqual([
      expect.stringContaining('analog.contentSchema'),
    ]);
    expect(pangularConfigProblems({ analog: { contentschema: 'x' } })[0]).toContain('Did you mean');
  });
});
