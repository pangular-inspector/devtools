import { describe, expect, it } from 'vitest';
import { redactMessage as redactLogMessage } from '../analog-server-log.ts';
import { redactJwt, redactMessage } from '../forms-privacy.ts';
import { redactText } from '../text-redact.ts';
import { toPluginsPage } from '../rpc/plugins-register.ts';
import { resolvePangularConfig } from '../config.ts';

const token = 'eyJabcd.payload.signature';

describe('JWT redaction', () => {
  it('keeps the original matching rules for signed, unsigned and adjacent tokens', () => {
    const samples = [
      `before ${token} after`,
      'eyJabcd.efgh.',
      `${token},eyJ1234.5678.-_9`,
      'eyJabc.efgh.signature eyJabcd.efg.signature',
      `eyJbad.${token}`,
      `prefix${token}!`,
      'eyJabcd.efgh.é',
      'eyJeyJeyJeyJ.nope',
    ];
    for (const sample of samples) {
      expect(redactJwt(sample)).toBe(
        sample.replace(/eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]*/g, '[redacted]'),
      );
    }
    for (const redact of [redactMessage, redactText, redactLogMessage]) {
      expect(redact(`before ${token} after`)).toBe('before [redacted] after');
      expect(redact('eyJabcd.efgh.')).toBe('[redacted]');
    }
  });

  it('handles many overlapping candidates and still masks a later token', () => {
    const input = `${'eyJ'.repeat(100_000)}!${token}`;
    expect(redactJwt(input)).toBe(`${'eyJ'.repeat(100_000)}![redacted]`);
  });

  it('processes an adversarial plugin view and masks its token before clipping', () => {
    const page = toPluginsPage(
      {
        pageId: 'tab1',
        plugins: [
          {
            id: 'test',
            view: {
              sections: [{ kind: 'text', title: 'Test', text: `${token}!${'eyJ'.repeat(20_000)}` }],
            },
          },
        ],
      },
      resolvePangularConfig(),
    );
    expect(page?.plugins[0].view?.sections).toHaveLength(1);
    expect(page?.plugins[0].view?.sections[0]).toMatchObject({
      text: expect.stringMatching(/^\[redacted\]!/),
    });
    expect(JSON.stringify(page)).not.toContain(token);
  });
});
