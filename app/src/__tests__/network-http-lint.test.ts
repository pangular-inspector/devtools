import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;

const call = (id: string, at: number, overrides: Record<string, unknown> = {}) => ({
  id,
  url: `/api/${id}`,
  method: 'GET',
  status: 200,
  durationMs: 100,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at,
  pageUrl: '/shop',
  ...overrides,
});

const host = () => fixture.nativeElement as HTMLElement;
const lint = () => host().querySelector('app-http-lint')!;

async function mount(
  calls: ReturnType<typeof call>[],
  serverCalls: ReturnType<typeof call>[] = [],
) {
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  const inspector = fixture.componentInstance;
  inspector.serverCalls.set(serverCalls);
  inspector.pages.set([
    {
      pageId: 'p1',
      url: '/shop',
      title: 'Shop',
      hydration: null,
      ssrRequestId: 'r1',
      reportedAt: 1,
      calls,
    },
  ]);
  await fixture.whenStable();
  return inspector;
}

describe('NetworkInspector HTTP lint', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('has its own section with an h2', async () => {
    await mount([]);
    const heading = host().querySelector('#lint-heading')!;
    expect(heading.tagName).toBe('H2');
    expect(heading.textContent!.trim()).toBe('HTTP lint');
    expect(lint().querySelector('.none')!.textContent!.trim()).toBe(
      'No client calls to check yet.',
    );
  });

  it('says when nothing was found', async () => {
    await mount([call('a', 0)]);
    expect(lint().querySelector('.none.ok')!.textContent!.trim()).toBe(
      'No duplicate requests, waterfalls or repeated server calls.',
    );
  });

  it('lists duplicates, waterfalls and repeated server calls, and opens the first call', async () => {
    const inspector = await mount(
      [
        call('a', 0, { url: '/api/user' }),
        call('b', 300, { url: '/api/user' }),
        call('c', 5000),
        call('d', 5110),
        call('e', 5220),
        call('f', 9000, { url: '/api/p' }),
      ],
      [call('s1', 0, { side: 'server', url: 'http://api/api/p', requestId: 'r1' })],
    );
    const items = [...lint().querySelectorAll('.findings li')];
    expect(items.map((li) => li.querySelector('.kind')!.textContent!.trim())).toEqual([
      'Duplicate',
      'Waterfall',
      'Repeated server call',
    ]);
    expect(items[0].querySelector('.message')!.textContent).toContain(
      'GET /api/user ran 2 times within 300 ms.',
    );
    const show = items[1].querySelector('button')!;
    expect(show.getAttribute('aria-label')).toContain('Show the first call of: 3 calls ran');
    show.click();
    await fixture.whenStable();
    expect(inspector.selectedCall()?.id).toBe('c');
  });
});
