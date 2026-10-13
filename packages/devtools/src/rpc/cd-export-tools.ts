import { cdExportFile, cdTraceFile } from '../cd-data.ts';
import { redactCdRecording } from './cd-redact.ts';
import { pickCdPage, type CdState } from './cd-tools.ts';
import { code, UNTRUSTED } from './forms-tools.ts';

/** The longest export the `change-detection` tool answers with. */
export const CD_EXPORT_MAX_CHARS = 100_000;

export type CdExportKind = 'json' | 'trace';

/** A code fence longer than any run of backticks in `text`. */
function fence(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return '`'.repeat(Math.max(3, longest + 1));
}

/**
 * The `change-detection` tool's answer for `export`: the recording as the
 * panel's JSON file or as a Trace Event Format file for Perfetto, redacted.
 * A file over {@link CD_EXPORT_MAX_CHARS} is never cut, since cut JSON does
 * not parse; the answer gives its size and counts instead.
 */
export function cdExportText(
  state: CdState,
  args: { page?: string; export: CdExportKind },
  max = CD_EXPORT_MAX_CHARS,
): string {
  const page = pickCdPage(state, args.page);
  if (!page) {
    return args.page
      ? `Page ${code(args.page)} has no change detection recording to export yet. Record one first with \`record: "start"\`.`
      : 'No change detection recording to export yet. Record one first with `record: "start"`.';
  }
  if (!page.supported) {
    return `Page ${code(page.pageId)} can't record change detection: it needs Angular 20 or later in a development build.`;
  }
  const { pageId } = page;
  const safe = redactCdRecording(page);
  const file = args.export === 'trace' ? cdTraceFile(safe, pageId) : cdExportFile(safe, pageId);
  const json = JSON.stringify(file);
  const spans = safe.cycles.reduce((sum, cycle) => sum + (cycle.spans?.length ?? 0), 0);
  const counts = `${safe.cycles.length} cycle(s)${safe.dropped ? ` (${safe.dropped} older ones dropped)` : ''}, ${spans} timed span(s), ${safe.components.length} component class(es), ${safe.hooks?.length ?? 0} lifecycle hook row(s) and ${safe.outputs?.length ?? 0} output row(s)`;
  const what =
    args.export === 'trace'
      ? 'a Trace Event Format file (open it in ui.perfetto.dev or chrome://tracing)'
      : 'a recording file (the panel imports it with Import)';
  if (json.length > max) {
    return `The export of page ${code(pageId)} as ${what} is ${json.length.toLocaleString('en-US')} characters, over the ${max.toLocaleString('en-US')} this tool returns, so it is not included. It holds ${counts}. Export it from the change detection section of the panel's Components page instead, or clear the recording (\`record: "clear"\`), record a shorter session and export again.`;
  }
  const status = page.recording ? ' Recording is still on, so later cycles are not in it.' : '';
  const marks = fence(json);
  return `${UNTRUSTED}\n\nPage ${code(pageId)} as ${what}: ${counts}.${status} Save the JSON below as a \`.json\` file.\n\n${marks}json\n${json}\n${marks}`;
}
