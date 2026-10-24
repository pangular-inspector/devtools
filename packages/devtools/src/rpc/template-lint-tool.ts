import type { MarkdownAnswer } from './agent-output.ts';
import {
  TEMPLATE_LINT_RULES,
  lintTemplates,
  templateLintText,
  type TemplateCompiler,
  type TemplateLintArgs,
} from './template-lint.ts';

/** The `scan-templates` agent tool: reads source only, so the stdio server keeps it. */
export function templateLintTool(
  cwd: string,
  options: { compiler?: TemplateCompiler; rules?: Record<string, boolean> } = {},
) {
  return {
    id: 'pangular:scan-templates',
    title: 'Lint templates',
    description:
      "Source checks of component templates with the project's Angular parser: parse errors, @for tracking by $index, img without alt, click without key handler, structural directives and ngClass/ngStyle. Filter by `rule`, `file` or `severity`.",
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          enum: Object.keys(TEMPLATE_LINT_RULES),
          description: 'Only findings of this rule.',
        },
        file: {
          type: 'string',
          description: 'Only findings in files whose path contains this text, such as `cart/`.',
        },
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'info'],
          description: 'Only findings of this severity.',
        },
        limit: {
          type: 'integer',
          description: 'How many findings to list (1-200, default 50).',
        },
      },
    },
    handler: async (args: TemplateLintArgs = {}): Promise<MarkdownAnswer> => ({
      markdown: templateLintText(await lintTemplates(cwd, options), args ?? {}),
    }),
  };
}
