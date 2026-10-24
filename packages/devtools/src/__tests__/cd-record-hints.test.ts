import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import { createPangular } from '../devframe.ts';
import { buildAudit } from '../rpc/audit-findings.ts';
import { cdDiagnosisText } from '../rpc/cd-diagnosis-tools.ts';
import { cdExportText } from '../rpc/cd-export-tools.ts';
import { cdRecordAnswer } from '../rpc/cd-record-tool.ts';
import { changeDetectionText, type CdPage, type CdState } from '../rpc/cd-tools.ts';
import { createPushAcks } from '../rpc/push-acks.ts';
import { answerText } from './tool-answer.ts';

/**
 * `record` moved from `change-detection` to `record-change-detection`, and
 * `change-detection` refuses it. An answer that still sends agents there
 * leads them into that refusal.
 */
const STALE = [
  /(?<!record-)change-detection`? (?:and|with) `record/,
  /this tool (?:again )?with(?:out)? `record/,
  /Record one first with `record/,
];

const stale = (text: string) => STALE.filter((pattern) => pattern.test(text));

const EMPTY: CdState = { pages: {} };

async function recordAnswer(record: 'start' | 'stop' | 'clear') {
  const acks = createPushAcks<CdPage>();
  const answer = await cdRecordAnswer({
    record,
    page: 'p1',
    connected: ['p1'],
    recording: ['p1'],
    acks,
    send: () =>
      acks.notify('p1', {
        recording: record === 'start',
        cycles: [],
      } as unknown as CdPage),
  });
  return answer.markdown;
}

describe('change detection recording hints', () => {
  it('send agents to record-change-detection when there is no recording', () => {
    const answers = [
      changeDetectionText(EMPTY),
      changeDetectionText(EMPTY, { page: 'p1' }),
      cdDiagnosisText(EMPTY),
      cdDiagnosisText(EMPTY, { page: 'p1' }),
      cdExportText(EMPTY, { export: 'json' }),
      cdExportText(EMPTY, { page: 'p1', export: 'trace' }),
      buildAudit({ cd: EMPTY }, 'p1', {}, 0).sources.find(
        (source) => source.area === 'change-detection',
      )?.note ?? '',
    ];
    for (const answer of answers) {
      expect(stale(answer), answer).toEqual([]);
      expect(answer).toContain('pangular:record-change-detection');
    }
  });

  it('name the page in the hint when the answer is about one page', () => {
    for (const answer of [
      changeDetectionText(EMPTY, { page: 'p1' }),
      cdDiagnosisText(EMPTY, { page: 'p1' }),
      cdExportText(EMPTY, { page: 'p1', export: 'trace' }),
    ]) {
      expect(answer).toContain('this `page`');
    }
  });

  it('name only Record in the panel when the agent is read-only', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({ agent: { readOnly: true } }).setup(ctx as never);
    const tools = ctx.agent.list().tools;
    expect(tools.map((tool) => tool.id)).not.toContain('pangular:record-change-detection');
    const read = tools.find((tool) => tool.id === 'pangular:change-detection')!;
    expect(read.description).not.toContain('record-change-detection');
    const call = (id: string, args: Record<string, unknown>) =>
      answerText(ctx.agent.invoke(id, args));
    await ctx.rpc.invokeLocal(
      'pangular:push-component-tree' as never,
      ...([{ pageId: 'p1', count: 1, detail: null, roots: [] }] as never),
    );
    const audit = await call('pangular:audit', { page: 'p1' });
    expect(audit).toContain('Start one with Record in the panel');
    const answers = [
      audit,
      await call('pangular:change-detection', {}),
      await call('pangular:change-detection', { export: 'json' }),
      await call('pangular:diagnose-change-detection', {}),
      changeDetectionText(EMPTY, { page: 'p1' }, undefined, false),
      cdDiagnosisText(EMPTY, { page: 'p1' }, undefined, false),
      cdExportText(EMPTY, { page: 'p1', export: 'trace' }, undefined, undefined, false),
      buildAudit({ cd: EMPTY, noCdRecord: true }, 'p1', {}, 0).sources.find(
        (source) => source.area === 'change-detection',
      )?.note ?? '',
    ];
    for (const answer of answers) {
      expect(answer).not.toContain('record-change-detection');
      expect(answer).toMatch(/Record\b.* in the panel/);
    }
  });

  it('point at the read tools after a recording starts, not back at itself', async () => {
    const started = await recordAnswer('start');
    expect(started).toContain('Recording started on page `p1`.');
    expect(started).toContain('`pangular:change-detection`');
    expect(stale(started)).toEqual([]);
    expect(stale(await recordAnswer('stop'))).toEqual([]);
  });

  it('leave no stale hint in the package source, its skills or the docs', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const files = [
      ...walk(join(root, 'src'), /\.ts$/, '__tests__'),
      ...walk(join(root, 'skills'), /\.md$/),
      ...walk(join(root, '..', '..', 'apps', 'docs', 'src', 'content'), /\.md$/),
    ];
    const hits = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter(
          (line) =>
            // The upgrade tables name the old call next to the tool that took it over.
            (stale(line).length && !/^\|.*\| `record-change-detection`/.test(line)) ||
            /"tool": "pangular:change-detection", "arguments": \{"record"/.test(line),
        )
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  });
});

function walk(dir: string, match: RegExp, skip?: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === skip ? [] : walk(path, match, skip);
    return match.test(entry.name) ? [path] : [];
  });
}
