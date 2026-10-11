import type { AnalogRuntimeReport } from './analog-runtime.ts';
import { redactPreview } from './http-redact.ts';
import { redactText, redactUrl } from './router.ts';
import { clip } from './text.ts';

/** Longest URL, `load()` preview and file path kept from a page report. */
const MAX_URL = 2000;
const MAX_PREVIEW = 1001;
const MAX_PATH = 500;
const MAX_ERROR = 300;

/**
 * Clips `value` to twice `max` before redacting it, so an oversized field
 * costs little to redact, and to `max` after.
 */
function capped(value: string, max: number, redact: (text: string) => string = (t) => t) {
  return clip(redact(clip(value, max * 2)), max);
}

/**
 * Hides secret query values, JWTs, bearer tokens and `redaction.secretNames`
 * in the text fields of a page report before it is stored or served, and
 * clips each text field.
 */
export function redactAnalogReport(report: AnalogRuntimeReport): AnalogRuntimeReport {
  const path = (value: string) => capped(value, MAX_PATH);
  return {
    ...report,
    url: capped(report.url, MAX_URL, redactUrl),
    chain: report.chain.map((item) => ({
      ...item,
      path: path(item.path),
      ...(item.file !== undefined && { file: path(item.file) }),
      ...(item.serverFile !== undefined && { serverFile: path(item.serverFile) }),
    })),
    ...(report.load && {
      load: {
        ...report.load,
        preview: capped(report.load.preview, MAX_PREVIEW, redactPreview),
        keys: report.load.keys.map((key) => capped(key, MAX_PATH, redactUrl)),
      },
    }),
    hydrationErrors: report.hydrationErrors.map((error) => capped(error, MAX_ERROR, redactText)),
    configPaths: report.configPaths.map(path),
  };
}
