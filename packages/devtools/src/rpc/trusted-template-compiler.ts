import * as compiler from '@angular/compiler';
import type { TemplateCompiler } from './template-lint.ts';

export const templateCompiler = compiler as TemplateCompiler;
