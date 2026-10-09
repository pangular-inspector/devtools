import type { AnalogRuntimeReport } from './analog-runtime.ts';
import { redactPreview } from './http-redact.ts';
import { redactText, redactUrl } from './router.ts';
import { clip } from './text.ts';

/**
 * Hides secret query values, JWTs, bearer tokens and `redaction.secretNames`
 * in the text fields of a page report before it is stored or served.
 */
export function redactAnalogReport(report: AnalogRuntimeReport): AnalogRuntimeReport {
  return {
    ...report,
    url: redactUrl(report.url),
    ...(report.load && {
      load: {
        ...report.load,
        preview: redactPreview(report.load.preview),
        keys: report.load.keys.map((key) => redactUrl(key)),
      },
    }),
    hydrationErrors: report.hydrationErrors.map((error) => clip(redactText(error), 300)),
  };
}
