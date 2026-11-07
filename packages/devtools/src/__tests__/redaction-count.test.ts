import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { REDACTED } from '../forms-privacy.ts';
import {
  countRedacted,
  countRedactedText,
  EMAIL_ADDRESS_MASK,
  REDACTED_MASK,
  redactionNote,
} from '../redaction-count.ts';
import { redactCall } from '../redaction.ts';
import { withRedactionNote } from '../rpc/agent-output.ts';
import { UNTRUSTED } from '../rpc/forms-tools.ts';
import { EMAIL_MASK } from '../text-redact.ts';
import { answerText } from './tool-answer.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

describe('redaction counts', () => {
  it('counts the masks the redaction helpers write', () => {
    expect(REDACTED_MASK).toBe(REDACTED);
    expect(EMAIL_ADDRESS_MASK).toBe(EMAIL_MASK);
    const call = redactCall({
      id: 'h1',
      url: `/api/me?token=${JWT}&user=ada@example.com`,
      method: 'GET',
      status: 200,
      durationMs: 1,
      side: 'client',
      cacheHit: false,
      faulted: false,
      at: 1,
      requestHeaders: { authorization: `Bearer ${JWT}`, accept: 'application/json' },
    });
    expect(countRedacted(call)).toEqual({ count: 3, capped: false });
    expect(countRedactedText(JSON.stringify(call))).toBe(3);
  });

  it('reads keys and strings once, survives cycles and stops at its budget', () => {
    const value: Record<string, unknown> = { a: '[redacted]', '[redacted]': 1, list: ['[email]'] };
    value['self'] = value;
    expect(countRedacted(value)).toEqual({ count: 3, capped: false });
    const big = Array.from({ length: 100 }, () => '[redacted]');
    expect(countRedacted(big, 10)).toEqual({ count: 10, capped: true });
    expect(countRedacted(42)).toEqual({ count: 0, capped: false });
  });

  it('adds a short line to an answer with masked values, and leaves others alone', () => {
    expect(withRedactionNote('Nothing to hide.')).toBe('Nothing to hide.');
    expect(withRedactionNote('token=[redacted], key=[redacted]')).toBe(
      `token=[redacted], key=[redacted]\n\n${redactionNote(2)}`,
    );
    expect(redactionNote(1)).toBe('_Redaction masked 1 value in this answer._');
    const json = `${UNTRUSTED}\n\n{"token":"[redacted]"}`;
    expect(withRedactionNote(json)).toBe(json);
    const file = 'The export.\n\n```json\n{"token":"[redacted]"}\n```';
    expect(withRedactionNote(file)).toBe(
      `The export.\n\n${redactionNote(1)}\n\n\`\`\`json\n{"token":"[redacted]"}\n\`\`\``,
    );
  });

  it('ends an agent answer that carries masked values with the count', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    await ctx.rpc.invokeLocal(
      'pangular:push-http' as never,
      ...([
        {
          pageId: 'tab1',
          url: '/trips',
          payload: { entries: [] },
          calls: [
            {
              id: 'h1',
              url: `/api/me?token=${JWT}`,
              method: 'GET',
              status: 200,
              durationMs: 3,
              side: 'client',
              at: Date.now(),
            },
          ],
        },
      ] as never),
    );
    const text = await answerText(ctx.agent.invoke('pangular:list-http-calls', {}));
    expect(text).not.toContain(JWT);
    expect(text).toMatch(/_Redaction masked \d+ values? in this answer\._$/);
  });
});
