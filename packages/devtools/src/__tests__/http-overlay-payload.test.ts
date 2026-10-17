// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { attachHttp } from '../http-overlay.ts';
import { httpRegistry } from '../http-rules.ts';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXRlc3Q';

describe('TransferState sent from the page', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    httpRegistry().calls = [];
  });

  it('is masked before it leaves the page', async () => {
    const state = {
      'http-1': {
        b: { refresh_token: 'RT-SECRET-41', note: JWT, name: 'ada' },
        s: 200,
        u: '/api/me?token=URL-SECRET-42',
      },
      password: 'PW-SECRET-43',
      plain: { title: 'Trips' },
    };
    document.body.innerHTML = `<script id="ng-state" type="application/json">${JSON.stringify(state)}</script>`;
    const sent: unknown[] = [];
    const my = {
      rpc: {
        call: async (name: string, report?: unknown) => {
          if (name === 'push-http') sent.push(report);
          if (name === 'get-http-rules') return [];
          return name === 'push-http' ? { needPayload: false } : { known: true };
        },
        register: () => {},
      },
    };
    const http = attachHttp(my, 'p1');
    try {
      await http.push();
      const text = JSON.stringify(sent);
      expect(text).toContain('"payload"');
      expect(text).toContain('Trips');
      expect(text).toContain('ada');
      for (const secret of ['RT-SECRET-41', JWT, 'URL-SECRET-42', 'PW-SECRET-43']) {
        expect(text).not.toContain(secret);
      }
    } finally {
      http.stop();
    }
  });
});
