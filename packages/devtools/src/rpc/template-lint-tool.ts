import { MARKDOWN_OUTPUT_SCHEMA, type MarkdownAnswer } from './agent-output.ts';
import {
  TEMPLATE_LINT_RULES,
  lintTemplates,
  templateLintText,
  type TemplateCompiler,
  type TemplateLintArgs,
} from './template-lint.ts';

/** The `lint-templates` agent tool: reads source only, so the stdio server keeps it. */
export function templateLintTool(cwd: string, options: { compiler?: TemplateCompiler } = {}) {
  return {
    id: 'pangular:lint-templates',
    title: 'Lint templates',
    outputSchema: MARKDOWN_OUTPUT_SCHEMA,
    description:
      "Checks component templates in source (inline `template` and `templateUrl` files) with the project's own Angular template parser: parse errors (including `@for` without `track`), `@for` tracking objects by `$index`, `<img>` without `alt`, `(click)` on a non-interactive element without a key handler, `*ngIf`/`*ngFor`/`*ngSwitchCase` instead of `@if`/`@for`/`@switch`, and `[ngClass]`/`[ngStyle]`. Each finding has rule, severity, file:line and a fix. Filter by `rule`, `file` or `severity`.",
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
