import { CD_CAUSE_KINDS, CD_CAUSE_LABEL, cdCauseText, cdHints } from '../cd-data.ts';
import type { AngularPageInfo, CdCycle } from '../config.ts';
import { unsupportedToolText } from './angular-pages.ts';
import { pickCdPage, type CdState } from './cd-tools.ts';
import { code, UNTRUSTED } from './forms-tools.ts';

const percent = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : '0%';

/**
 * Markdown for the `diagnose-change-detection` agent tool: what started the
 * recorded cycles, which components only zone.js keeps up to date, which
 * checks changed nothing, inputs that broke OnPush, and the hints from them.
 */
export function cdDiagnosisText(
  state: CdState,
  args: { page?: string; limit?: number } = {},
  angularOf: (pageId: string) => AngularPageInfo | undefined = () => undefined,
): string {
  const page = pickCdPage(state, args.page);
  if (!page) {
    return args.page
      ? `Page ${code(args.page)} has no change detection recording yet. Start one with \`pangular:change-detection\` and \`record: "start"\` (or **Record** in the panel), use the app, then call this tool again.`
      : 'No change detection recording yet. Start one with `pangular:change-detection` and `record: "start"` (or **Record** in the panel), use the app, then call this tool again.';
  }
  if (!page.supported) {
    const unsupported = unsupportedToolText(angularOf(page.pageId), 'profiler');
    if (unsupported) return `Page ${code(page.pageId)}: ${unsupported}`;
    return `Page ${code(page.pageId)} can't record change detection: it needs Angular 20 or later in a development build.`;
  }
  const diagnosis = page.diagnosis;
  if (!diagnosis) {
    return `Page ${code(page.pageId)} reported no diagnosis. Its overlay is older than this server, or the recording started before the page loaded it; clear the recording and record again.`;
  }
  const asked = Number(args.limit ?? 10);
  const limit = Math.max(1, Math.min(Math.floor(Number.isFinite(asked) ? asked : 10), 50));
  const status = page.recording ? 'Recording is on.' : 'Recording is off.';
  const cycles = page.cycles.length;
  if (!cycles && !diagnosis.components.length) {
    return `${status} No change detection cycle was recorded on page ${code(page.pageId)} yet. Use the app, then call this tool again.`;
  }
  const parts: string[] = [
    `${UNTRUSTED}\n\n${status} Page ${code(page.pageId)}: ${cycles} cycle(s) kept.`,
  ];

  if (diagnosis.triggers) {
    const rows = CD_CAUSE_KINDS.filter((kind) => diagnosis.causes[kind]).map(
      (kind) => `- ${CD_CAUSE_LABEL[kind]} (\`${kind}\`): ${diagnosis.causes[kind]} cycle(s)`,
    );
    const recent = page.cycles
      .filter((c): c is CdCycle & Required<Pick<CdCycle, 'cause'>> => !!c.cause)
      .slice(-limit)
      .reverse()
      .map(
        (c) =>
          `- #${c.id}: ${code(cdCauseText(c.cause))}${c.cause.stack?.length ? ` at ${c.cause.stack.map(code).join(' < ')}` : ''}`,
      );
    parts.push(
      `**What started the cycles**\n${rows.length ? rows.join('\n') : '- No cycle had a cause yet.'}${recent.length ? `\n\n**Latest causes**, newest first\n${recent.join('\n')}` : ''}`,
    );
  } else {
    parts.push(
      '_The page has no Angular change detection scheduler the overlay could find (it needs Angular 18 or later), so cycles carry no cause. Wasted checks below still count._',
    );
  }

  const zone = diagnosis.zone ?? [];
  const zoneOnly = diagnosis.causes.zone ?? 0;
  if (diagnosis.zoneJs === false && !zone.length && !zoneOnly) {
    parts.push('**zone.js**: the page does not load zone.js, so it runs zoneless.');
  } else if (zone.length) {
    parts.push(
      `**Components that depend on zone.js**: they changed in ticks zone.js started with no signal write, markForCheck, event listener or input before them (${zoneOnly} such tick(s))\n${zone
        .slice(0, limit)
        .map(
          (z) =>
            `- ${code(z.name)}: ${z.ticks} tick(s)${z.tasks?.length ? `, after ${z.tasks.map(code).join(', ')}` : ''}`,
        )
        .join('\n')}`,
    );
  } else if (zoneOnly) {
    parts.push(
      `**zone.js**: ${zoneOnly} tick(s) came from zone.js alone, and no component changed in them, so they only cost time.`,
    );
  } else if (diagnosis.triggers) {
    parts.push(
      '**zone.js**: no component changed in a tick that only zone.js started, so the recorded interactions would work zoneless.',
    );
  }

  if (diagnosis.waste) {
    const wasted = diagnosis.components.filter((c) => c.unchanged > 0).slice(0, limit);
    parts.push(
      `**Wasted checks**: refreshed checks where nothing the component renders changed (no DOM update, no new input reference for a child), the development checkNoChanges pass left out\n${
        wasted.length
          ? wasted
              .map(
                (c) =>
                  `- ${code(c.name)}: ${c.unchanged} of ${c.refreshed} refreshed check(s) changed nothing (${percent(c.unchanged, c.refreshed)})${c.strategy ? `, ${c.strategy}` : ''}`,
              )
              .join('\n')
          : '- None: every refreshed check changed something.'
      }`,
    );
  } else {
    parts.push(
      '_The page could not watch DOM updates (no `MutationObserver`), so wasted checks are not counted._',
    );
  }

  const inputs = diagnosis.inputs ?? [];
  if (inputs.length) {
    parts.push(
      `**Inputs that break OnPush**\n${inputs
        .slice(0, limit)
        .map(
          (i) =>
            `- ${code(`${i.name}.${i.input}`)}${i.parent ? ` (set by ${code(i.parent)})` : ''}: ${i.inPlace} change(s) in place, ${i.sameContents} new reference(s) with the same contents`,
        )
        .join('\n')}`,
    );
  }

  const hints = cdHints(diagnosis);
  parts.push(
    `**Hints**\n${
      hints.length
        ? hints
            .slice(0, limit)
            .map((h) => `- ${h.text}`)
            .join('\n')
        : `- No hint: no component was refreshed at least 10 times while changing in under 20% of them, and no input or zone.js problem was seen.`
    }`,
  );
  return parts.join('\n\n');
}
