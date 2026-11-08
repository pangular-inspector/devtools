/**
 * The Angular debug API page: every `window.ng` function the overlay reads,
 * from the `NgDebugApi` interface in `packages/devtools/src/debug-api.ts`,
 * with the first Angular version its `@since` tag names. `pnpm docs:api`
 * writes it with the API reference pages.
 */
import {join} from 'node:path';
import {Node, Project} from 'ts-morph';

export const DEBUG_API_PAGE = 'angular-debug-api.md';
const SOURCE = 'packages/devtools/src/debug-api.ts';

export interface DebugApiFunction {
  name: string;
  /** The first Angular version that publishes it, from `@since`. */
  since?: string;
  /** Every supported version publishes it, so the overlay needs it. */
  required: boolean;
  /** The doc comment without its `@since` tag. */
  summary: string;
}

/** The functions of `NgDebugApi`, in the order the interface declares them. */
export function readDebugApi(repoRoot: string): DebugApiFunction[] {
  const project = new Project({skipAddingFilesFromTsConfig: true});
  const file = project.addSourceFileAtPath(join(repoRoot, SOURCE));
  const api = file.getInterfaceOrThrow('NgDebugApi');
  return api.getMembers().flatMap((member) => {
    if (!Node.isMethodSignature(member) && !Node.isPropertySignature(member)) return [];
    // A one-line doc comment keeps `@since` inline, where the parser sees no tag.
    const text = member
      .getJsDocs()
      .map((doc) => doc.getInnerText())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const since = text.match(/@since\s+(\d+(?:\.\d+)*)/)?.[1];
    return [
      {
        name: member.getName(),
        ...(since ? {since} : {}),
        required: !member.hasQuestionToken(),
        summary: text.replace(/\s*@since\s+\S+/, '').trim(),
      },
    ];
  });
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

export function renderDebugApiCompat(repoRoot: string, githubUrl: string): string {
  const rows = readDebugApi(repoRoot).map(
    (fn) =>
      `| \`${fn.name}\` | ${fn.since ?? 'See note'} | ${fn.required ? 'Yes' : 'No'} | ${cell(fn.summary)} |`,
  );
  return [
    '---',
    'title: Angular debug API',
    "description: 'The window.ng functions the overlay reads and the first Angular version that publishes each one, generated from the package source.'",
    '---',
    '',
    '<ngmd-hero title="Angular debug API" gradient>',
    '  The <code>window.ng</code> functions the overlay reads, and the Angular version each one needs.',
    '</ngmd-hero>',
    '',
    '# Angular debug API',
    '',
    `The overlay reads live data through the debug API Angular publishes on \`window.ng\` in development builds. This page is generated from \`NgDebugApi\` in [\`${SOURCE}\`](${githubUrl}/blob/main/${SOURCE}). Run \`pnpm docs:api\` after you change it.`,
    '',
    'A required function is one every supported Angular version publishes, so the overlay needs it. The overlay checks the others on the page at runtime, and a tab whose feature needs a missing one says which Angular version it needs. **See note** marks a function with no single first version; its description says when the overlay uses it. See [Tested versions](../getting-started/installation.md#tested-versions).',
    '',
    '| Function | Since | Required | What it does |',
    '| -------- | ----- | -------- | ------------ |',
    ...rows,
    '',
  ].join('\n');
}
