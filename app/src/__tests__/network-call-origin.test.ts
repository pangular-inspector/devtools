import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;

const call = (id: string, origin?: 'httpResource' | 'resource' | 'defer') => ({
  id,
  url: `/api/${id}`,
  method: 'GET',
  status: 200,
  durationMs: 5,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at: 1,
  ...(origin ? { origin } : {}),
});

describe('NetworkInspector call origin', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('tags calls with the API that likely started them', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    fixture.componentInstance.pages.set([
      {
        pageId: 'p1',
        url: '/',
        title: 'Home',
        hydration: null,
        reportedAt: 1,
        calls: [call('a', 'httpResource'), call('b', 'resource'), call('c', 'defer'), call('d')],
      },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const tags = [...host.querySelectorAll('app-call-origin .tag')];
    expect(tags.map((t) => t.textContent!.trim()).sort()).toEqual([
      'likely @defer',
      'likely httpResource()',
      'likely resource()',
    ]);
    expect(tags[0].getAttribute('title')).toContain('guessed from the call stack');
  });
});
