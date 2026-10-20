import { withMcpContent } from 'devframe';
import { describe, expect, it } from 'vitest';
import { answerText, answeringText } from '../agent-output.ts';
import { refusalOf, refusal } from '../refusal.ts';

describe('answerText', () => {
  it('turns a markdown answer into the markdown itself', () => {
    expect(answerText({ markdown: '# Title\n\n"quoted"' })).toBe('# Title\n\n"quoted"');
  });

  it('keeps an answer that carries its own MCP blocks', () => {
    const answer = withMcpContent({ markdown: 'Screenshot' }, [
      { type: 'text', text: 'Screenshot' },
    ]);
    expect(answerText(answer)).toBe(answer);
  });

  it('leaves strings, compact JSON and other values as they are', () => {
    expect(answerText('[]')).toBe('[]');
    expect(answerText(undefined)).toBeUndefined();
    const other = { rows: [] };
    expect(answerText(other)).toBe(other);
  });

  it('keeps a refusal readable by refusalOf after the conversion', async () => {
    const handler = answeringText(async () => ({ markdown: refusal('Pass `page`.') }));
    expect(refusalOf(await handler(undefined))).toBe('Pass `page`.');
  });
});
