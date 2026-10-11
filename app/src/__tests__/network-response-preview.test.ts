import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;

const call = (overrides: Record<string, unknown>) => ({
  id: 'c1',
  url: '/api/products?page=2',
  method: 'GET',
  status: 200,
  durationMs: 12,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at: 1000,
  ...overrides,
});

async function open(overrides: Record<string, unknown>) {
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  const inspector = fixture.componentInstance;
  inspector.pages.set([
    {
      pageId: 'p1',
      url: '/products',
      title: 'Products',
      hydration: null,
      reportedAt: 1000,
      calls: [call(overrides)],
    },
  ]);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  host.querySelector<HTMLButtonElement>('button[data-call-id="c1"]')!.click();
  await fixture.whenStable();
  const preview = host.querySelector<HTMLElement>('#call-preview')!;
  const button = (name: string) =>
    [...preview.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent!.trim() === name,
    );
  const status = () => host.querySelector('.toolbar [role="status"]')!.textContent!.trim();
  return { host, preview, button, status, inspector };
}

describe('NetworkInspector response preview', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows a JSON preview indented by 2 spaces', async () => {
    const { preview } = await open({ preview: '{"items":[{"id":1,"token":"[redacted]"}]}' });
    expect(preview.querySelector('pre')!.textContent).toBe(
      '{\n  "items": [\n    {\n      "id": 1,\n      "token": "[redacted]"\n    }\n  ]\n}',
    );
  });

  it('shows other text as recorded', async () => {
    const clipped = '{"items":[1,2,3…';
    const { preview } = await open({ preview: clipped });
    expect(preview.querySelector('pre')!.textContent).toBe(clipped);
  });

  it('copies the shown preview and says so in a polite status', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
    });
    const { button, status, inspector } = await open({ preview: '{"a":1}' });
    const copy = button('Copy')!;
    expect(copy.getAttribute('aria-label')).toBe('Copy the response of GET /api/products?page=2');
    await inspector.copyPreview(inspector.selectedCall()!);
    await fixture.whenStable();
    expect(written).toEqual(['{\n  "a": 1\n}']);
    expect(status()).toBe('Copied.');
  });

  it('says when the clipboard is not available', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    const { status, inspector } = await open({ preview: 'plain text' });
    await inspector.copyPreview(inspector.selectedCall()!);
    await fixture.whenStable();
    expect(status()).toBe('The clipboard is not available here.');
  });

  it('has no Copy button without a body', async () => {
    const { button } = await open({ status: 0, error: 'Http failure' });
    expect(button('Copy')).toBeUndefined();
    expect(button('Mock this request')).toBeDefined();
  });

  it('fills the rule form with the method, URL and JSON body, then focuses it', async () => {
    const { host, button, status, inspector } = await open({
      url: 'http://localhost:4000/api/products?key=[redacted]',
      method: 'get',
      side: 'server',
      preview: '{"items":[]}',
    });
    button('Mock this request')!.click();
    await fixture.whenStable();
    expect(inspector.draft()).toMatchObject({
      pattern: '/api/products?key=*',
      method: 'GET',
      body: '{\n  "items": []\n}',
      status: '',
    });
    expect(inspector.draftRule()).toMatchObject({ pattern: '/api/products?key=*', method: 'GET' });
    const pattern = host.querySelector<HTMLInputElement>('#rule-pattern')!;
    expect(document.activeElement).toBe(pattern);
    expect(pattern.value).toBe('/api/products?key=*');
    expect(host.querySelector('textarea')!.value).toBe('{\n  "items": []\n}');
    expect(status()).toContain('with the preview as its body');
  });

  it('fills only the method and URL when the preview is not JSON', async () => {
    const { button, status, inspector } = await open({ method: 'HEAD', preview: 'hello' });
    button('Mock this request')!.click();
    await fixture.whenStable();
    expect(inspector.draft()).toMatchObject({ pattern: '/api/products?page=2', method: 'HEAD' });
    expect(inspector.draft().body).toBe('');
    expect(inspector.methodOptions().map((o) => o.value)).toContain('HEAD');
    expect(status()).toContain('not complete JSON');
  });
});
