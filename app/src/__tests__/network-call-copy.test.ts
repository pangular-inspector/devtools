import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;
const written: string[] = [];

const host = () => fixture.nativeElement as HTMLElement;
const button = (name: string) =>
  [...host().querySelectorAll<HTMLButtonElement>('#call-preview button')].find(
    (b) => b.textContent!.trim() === name,
  )!;
const status = () => host().querySelector('.toolbar .message')!.textContent!.trim();

async function openCall() {
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  fixture.componentInstance.pages.set([
    {
      pageId: 'p1',
      url: '/shop',
      title: 'Shop',
      hydration: null,
      reportedAt: 1,
      calls: [
        {
          id: 'c1',
          url: '/api/cart',
          method: 'POST',
          status: 201,
          durationMs: 5,
          side: 'client',
          cacheHit: false,
          faulted: false,
          at: 1,
          requestHeaders: { authorization: '[redacted]', 'content-type': 'application/json' },
        },
      ],
    },
  ]);
  await fixture.whenStable();
  fixture.componentInstance.openCall('c1');
  await fixture.whenStable();
}

describe('NetworkInspector copy as fetch and cURL', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    written.length = 0;
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('copies the masked call as a curl command and as fetch', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
    });
    await openCall();
    const curl = button('Copy as cURL');
    expect(curl.getAttribute('aria-label')).toBe('Copy POST /api/cart as cURL');
    curl.click();
    await fixture.whenStable();
    expect(written[0]).toContain("-X 'POST'");
    expect(written[0]).toContain("-H 'authorization: [redacted]'");
    expect(status()).toBe('Copied as cURL. Fill in the masked values first.');

    button('Copy as fetch').click();
    await fixture.whenStable();
    expect(written[1]).toContain('await fetch(');
    expect(written[1]).toContain('"method": "POST"');
  });

  it('says when the clipboard is not available', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    await openCall();
    button('Copy as fetch').click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    expect(status()).toBe('The clipboard is not available here.');
  });
});
