import { describe, expect, it } from 'vitest';
import type { AngularPageInfo } from '../config.ts';
import { cdRecordAnswer } from '../rpc/cd-record-tool.ts';
import type { CdPage } from '../rpc/cd-tools.ts';
import { createPushAcks } from '../rpc/push-acks.ts';

const report = (pageId: string, fields: Partial<CdPage>) =>
  ({ pageId, recording: false, supported: true, cycles: [], ...fields }) as unknown as CdPage;

/**
 * Starts a recording on `pages`. Each page answers the start with the report
 * `answers` gives it, the way the overlay pushes right after
 * `change-detection-record`.
 */
async function start(
  pages: string[],
  answers: Record<string, Partial<CdPage>>,
  angular: Record<string, AngularPageInfo> = {},
) {
  const acks = createPushAcks<CdPage>();
  return cdRecordAnswer({
    record: 'start',
    connected: pages,
    recording: [],
    acks,
    ms: 1000,
    angularOf: (id) => angular[id],
    send: () => {
      for (const [id, fields] of Object.entries(answers)) acks.notify(id, report(id, fields));
    },
  });
}

describe('record-change-detection start on a page that cannot record', () => {
  it('passes on why a page with the profiler hook could not attach, without a version guess', async () => {
    const answer = await start(
      ['p1'],
      { p1: { supported: false } },
      { p1: { version: '21.0.1', capabilities: { profiler: true } } },
    );
    expect(answer).toHaveProperty('refused', true);
    expect(answer.markdown).toContain('could not attach to it yet');
    expect(answer.markdown).not.toContain('did not confirm');
    expect(answer.markdown).not.toContain('Angular 20');
  });

  it('names the Angular version a page without the profiler hook runs', async () => {
    const answer = await start(
      ['p1'],
      { p1: { supported: false } },
      { p1: { version: '18.2.0', capabilities: { profiler: false } } },
    );
    expect(answer).toHaveProperty('refused', true);
    expect(answer.markdown).toContain('Unsupported on this Angular version');
    expect(answer.markdown).toContain('18.2');
    expect(answer.markdown).not.toContain('did not confirm');
  });

  it('reports the pages that started apart from the ones that answered unsupported', async () => {
    const answer = await start(
      ['p1', 'p2', 'p3'],
      { p1: { recording: true }, p2: { supported: false } },
      { p2: { capabilities: { profiler: true } } },
    );
    expect(answer).not.toHaveProperty('refused');
    expect(answer.markdown).toContain('Recording started on page `p1`.');
    expect(answer.markdown).toContain('Page `p3` did not confirm');
    expect(answer.markdown).toContain('Page `p2` has Angular');
    expect(answer.markdown).not.toContain('`p2` did not confirm');
  });

  it('no longer blames the Angular version when a page stays silent', async () => {
    const answer = await start(['p1'], {});
    expect(answer).toHaveProperty('refused', true);
    expect(answer.markdown).toContain('`p1` did not confirm within 1s');
    expect(answer.markdown).not.toContain('Angular 20');
  });
});
