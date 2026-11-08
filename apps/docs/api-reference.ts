import {readFileSync} from 'node:fs';
import {join, posix} from 'node:path';
import {Node, Project, ts, type JSDoc} from 'ts-morph';

/**
 * Builds the API reference pages in `src/content/api/` from the public entry
 * points of `@pangular-inspector/devtools`: the `exports` of
 * `packages/devtools/package.json`, read from their TypeScript sources.
 *
 * Each entry point gets one page with every symbol it exports: its kind, the
 * JSDoc summary, the declaration and a link to the source. Symbols marked
 * `@internal` are left out, as the published types leave them out.
 * `scripts/docs-api.mjs` writes the pages, and `api-reference.spec.ts`
 * fails when a page in the repository is stale.
 */

export const API_DIR = 'src/content/api';

/** Entry points that are not part of the public API. */
const SKIPPED_EXPORTS = new Set(['./package.json', '.']);

type Kind = 'class' | 'interface' | 'function' | 'const' | 'type' | 'enum';

interface ApiSymbol {
  name: string;
  kind: Kind;
  summary: string;
  tags: Array<{name: string; text: string}>;
  declaration: string;
  /** The source file in this repository, or empty for a symbol re-exported from a dependency. */
  file: string;
  /** The npm package a re-exported symbol comes from. */
  from?: string;
}

/** The package a file under `node_modules` belongs to, such as `devframe` or `@scope/name`. */
function packageOf(filePath: string): string {
  const rest = filePath.replace(/\\/g, '/').split('/node_modules/').at(-1) ?? '';
  const parts = rest.split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

export interface ApiEntry {
  /** The import path, such as `@pangular-inspector/devtools/hub`. */
  specifier: string;
  /** The page slug, such as `hub`. */
  slug: string;
  source: string;
  symbols: ApiSymbol[];
  /** Other import paths that load the same file, such as the package root. */
  aliases?: string[];
}

function kindOf(node: Node): Kind | null {
  if (Node.isClassDeclaration(node)) return 'class';
  if (Node.isInterfaceDeclaration(node)) return 'interface';
  if (Node.isFunctionDeclaration(node)) return 'function';
  if (Node.isVariableDeclaration(node)) return 'const';
  if (Node.isTypeAliasDeclaration(node)) return 'type';
  if (Node.isEnumDeclaration(node)) return 'enum';
  return null;
}

function jsDocsOf(node: Node): JSDoc[] {
  const host = Node.isVariableDeclaration(node)
    ? (node.getFirstAncestorByKind(ts.SyntaxKind.VariableStatement) ?? node)
    : node;
  return Node.isJSDocable(host) ? host.getJsDocs() : [];
}

function declarationOf(nodes: Node[]): string {
  const [first] = nodes;
  if (Node.isFunctionDeclaration(first)) {
    const overloads = nodes.filter(Node.isFunctionDeclaration).filter((n) => n.isOverload());
    return (overloads.length ? overloads : [first])
      .map((n) => {
        const text = n.getText();
        const body = n.getBody();
        const head = clean(body ? text.slice(0, body.getStart() - n.getStart()) : text);
        // Without an annotation, show the return type TypeScript infers, as the published types do.
        return n.getReturnTypeNode() ? head : `${head}: ${n.getReturnType().getText(n)}`;
      })
      .join('\n');
  }
  if (Node.isClassDeclaration(first)) {
    const brace = first.getFirstChildByKind(ts.SyntaxKind.OpenBraceToken);
    const text = first.getText();
    return clean(brace ? text.slice(0, brace.getStart() - first.getStart()) : text);
  }
  if (Node.isVariableDeclaration(first)) {
    const type = first.getTypeNode()?.getText() ?? first.getType().getText(first);
    return `const ${first.getName()}: ${type}`;
  }
  return clean(first.getText());
}

function clean(text: string): string {
  return text
    .trim()
    .replace(/^export\s+(default\s+)?(declare\s+)?/, '')
    .replace(/;$/, '');
}

/** The entry points of the package, with the symbols each one exports. */
export function readApiEntries(repoRoot: string): ApiEntry[] {
  const pkgDir = join(repoRoot, 'packages/devtools');
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
    name: string;
    exports: Record<string, string | {default?: string; import?: string}>;
  };
  const project = new Project({
    tsConfigFilePath: join(pkgDir, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });
  const entries: ApiEntry[] = [];
  const targetOf = (target: string | {default?: string; import?: string}) =>
    typeof target === 'string' ? target : (target.import ?? target.default);
  const root = pkg.exports['.'];
  for (const [key, target] of Object.entries(pkg.exports)) {
    // `./internal/*` entries serve the panel and the extension, not apps.
    if (SKIPPED_EXPORTS.has(key) || key.startsWith('./internal/')) continue;
    const rel = targetOf(target);
    if (!rel?.endsWith('.ts')) continue;
    const sourceFile = project.addSourceFileAtPath(join(pkgDir, rel));
    const symbols: ApiSymbol[] = [];
    for (const [name, decls] of sourceFile.getExportedDeclarations()) {
      const nodes = decls.filter((d) => kindOf(d));
      const first = nodes[0];
      if (!first) continue;
      // A symbol re-exported from a dependency is still part of this entry point's API.
      const external = first.getSourceFile().isInNodeModules();
      const docs = nodes.flatMap(jsDocsOf);
      const tags = docs.flatMap((d) =>
        d.getTags().map((t) => ({name: t.getTagName(), text: (t.getCommentText() ?? '').trim()})),
      );
      if (tags.some((t) => t.name === 'internal')) continue;
      symbols.push({
        name,
        kind: kindOf(first)!,
        summary: docs.at(-1)?.getDescription().trim() ?? '',
        tags,
        declaration: declarationOf(nodes),
        file: external
          ? ''
          : posix.relative(repoRoot.replace(/\\/g, '/'), first.getSourceFile().getFilePath()),
        ...(external ? {from: packageOf(first.getSourceFile().getFilePath())} : {}),
      });
    }
    symbols.sort((a, b) => a.name.localeCompare(b.name));
    const slug = key === '.' ? 'index' : key.slice(2).replace(/\//g, '-');
    entries.push({
      specifier: key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`,
      slug,
      source: posix.join('packages/devtools', rel.replace(/^\.\//, '')),
      symbols,
      ...(root && targetOf(root) === rel ? {aliases: [pkg.name]} : {}),
    });
  }
  return entries;
}

const KIND_LABEL: Record<Kind, string> = {
  class: 'Class',
  interface: 'Interface',
  function: 'Function',
  const: 'Constant',
  type: 'Type',
  enum: 'Enum',
};

/** JSDoc text as one markdown paragraph: `{@link X}` becomes `X` in code. */
function prose(text: string): string {
  return text
    .replace(/\{@link\s+([^}\s|]+)(?:[\s|][^}]*)?\}/g, '`$1`')
    .replace(/\r/g, '')
    .trim();
}

export function renderApiPage(entry: ApiEntry, githubUrl: string): string {
  const out = [
    '---',
    `title: '${entry.specifier}'`,
    `description: 'Every symbol the ${entry.specifier} entry point exports, with its declaration and JSDoc, generated from the package source.'`,
    '---',
    '',
    `<ngmd-hero title="${entry.slug}" gradient>`,
    `  The symbols <code>${entry.specifier.replace('@', '&#64;')}</code> exports, generated from the package source.`,
    '</ngmd-hero>',
    '',
    `# ${entry.specifier}`,
    '',
    `Import from \`${entry.specifier}\`. This page is generated from [\`${entry.source}\`](${githubUrl}/blob/main/${entry.source}) and the files it re-exports. Run \`pnpm docs:api\` after you change the public API.`,
    '',
    ...(entry.aliases?.length
      ? [
          `${entry.aliases.map((alias) => `\`${alias}\``).join(', ')} loads the same file and exports the same symbols.`,
          '',
        ]
      : []),
  ];
  if (!entry.symbols.length) {
    out.push('This entry point exports no symbols. Importing it runs its side effect.', '');
  }
  for (const symbol of entry.symbols) {
    out.push(`## ${symbol.name}`, '');
    out.push(
      symbol.from
        ? `${KIND_LABEL[symbol.kind]}. Re-exported from the \`${symbol.from}\` package.`
        : `${KIND_LABEL[symbol.kind]}. Source: [\`${symbol.file}\`](${githubUrl}/blob/main/${symbol.file}).`,
      '',
    );
    if (symbol.summary) out.push(prose(symbol.summary), '');
    const deprecated = symbol.tags.find((t) => t.name === 'deprecated');
    if (deprecated) out.push(`Deprecated. ${prose(deprecated.text)}`.trim(), '');
    out.push('```ts', symbol.declaration, '```', '');
  }
  return escapeEnv(out.join('\n'));
}

/**
 * Vite replaces `process.env.NODE_ENV` and `import.meta.env.X` even inside the
 * compiled page, which breaks the build. The bracket form means the same and
 * is left alone, as the hand-written pages write it.
 */
function escapeEnv(text: string): string {
  return text.replace(/\b(process\.env|import\.meta\.env)\.([A-Za-z_]\w*)/g, "$1['$2']");
}

export function renderApiIndex(entries: ApiEntry[]): string {
  const rows = entries.map(
    (entry) =>
      `| [\`${entry.specifier}\`](./${entry.slug}.md)${entry.aliases?.length ? ` (also ${entry.aliases.map((alias) => `\`${alias}\``).join(', ')})` : ''} | ${entry.symbols.length ? entry.symbols.map((s) => `\`${s.name}\``).join(', ') : 'None, it runs on import'} |`,
  );
  return [
    '---',
    'title: API reference',
    "description: 'The public entry points of @pangular-inspector/devtools and the symbols each one exports, generated from the package source.'",
    '---',
    '',
    '<ngmd-hero title="API reference" gradient>',
    '  Every public entry point of the package and the symbols it exports, generated from the source.',
    '</ngmd-hero>',
    '',
    '# API reference',
    '',
    'Each entry point of `@pangular-inspector/devtools` has a page with every symbol it exports, its declaration and its JSDoc. The pages are generated from the package source, so names and types match the published code. [Installation](../getting-started/installation.md#entry-points) says what each entry point is for, and [Configuration](../getting-started/configuration.md) explains the options.',
    '',
    '| Entry point | Exports |',
    '| ----------- | ------- |',
    ...rows,
    '',
  ].join('\n');
}

/** Every page, keyed by its path under `src/content/api/`. */
export function renderApiReference(repoRoot: string, githubUrl: string): Map<string, string> {
  const entries = readApiEntries(repoRoot);
  const pages = new Map<string, string>([['index.md', renderApiIndex(entries)]]);
  for (const entry of entries) pages.set(`${entry.slug}.md`, renderApiPage(entry, githubUrl));
  return pages;
}
