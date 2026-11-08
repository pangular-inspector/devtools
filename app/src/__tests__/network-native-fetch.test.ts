import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;

const call = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  url: `/api/${id}`,
  method: 'GET',
  status: 200,
  durationMs: 12,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at: 1000,
  ...overrides,
});

describe('NetworkInspector native fetch calls', () => {
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('tags a native fetch() call and leaves HttpClient calls untagged', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    fixture.componentInstance.pages.set([
      {
        pageId: 'p1',
        url: '/trips',
        title: 'Trips',
        hydration: null,
        reportedAt: 1000,
        calls: [call('client'), call('native', { nativeFetch: true })],
      },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const rowOf = (id: string) =>
      host.querySelector(`button[data-call-id="${id}"]`)!.closest('tr')!;
    const tags = (id: string) =>
      [...rowOf(id).querySelectorAll('.tag')].map((tag) => tag.textContent!.trim());
    expect(tags('native')).toContain('fetch()');
    expect(tags('client')).not.toContain('fetch()');
  });

  it('offers no mock for a native fetch() call and says why', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    const inspector = fixture.componentInstance;
    inspector.pages.set([
      {
        pageId: 'p1',
        url: '/trips',
        title: 'Trips',
        hydration: null,
        reportedAt: 1000,
        calls: [call('client'), call('native', { nativeFetch: true })],
      },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const open = async (id: string) => {
      host.querySelector<HTMLButtonElement>(`button[data-call-id="${id}"]`)!.click();
      await fixture.whenStable();
      return host.querySelector('#call-preview')!;
    };
    const mockButton = (preview: Element) =>
      [...preview.querySelectorAll('button')].find((b) =>
        b.textContent!.includes('Mock this request'),
      );
    let preview = await open('native');
    expect(mockButton(preview)).toBeUndefined();
    expect(preview.textContent).toContain('skips the HttpClient interceptor');
    preview = await open('client');
    expect(mockButton(preview)).toBeDefined();
    expect(preview.textContent).not.toContain('skips the HttpClient interceptor');
  });
});
