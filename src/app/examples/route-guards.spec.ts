import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router, provideRouter } from '@angular/router';
import { pingPong } from './ping-pong';
import { loopAGuard, loopBGuard } from './route-guards';

@Component({ template: '' })
class Page {}

describe('guard loop lab routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'examples/routes',
            children: [
              { path: 'summary', component: Page },
              { path: 'details', component: Page },
              { path: 'loop-a', component: Page, canActivate: [loopAGuard] },
              { path: 'loop-b', component: Page, canActivate: [loopBGuard] },
            ],
          },
        ]),
      ],
    });
  });

  it('bounces between the two routes a few times, then lets go', async () => {
    const router = TestBed.inject(Router);
    const urls: string[] = [];
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) urls.push(event.url);
    });

    for (let run = 0; run < 2; run++) {
      await router.navigateByUrl('/examples/routes/summary');
      urls.length = 0;
      await router.navigateByUrl('/examples/routes/loop-a');
      expect(router.url).toBe('/examples/routes/summary?from=loop');
      expect(urls).toEqual([
        '/examples/routes/loop-a',
        '/examples/routes/loop-b',
        '/examples/routes/loop-a',
        '/examples/routes/loop-b',
        '/examples/routes/loop-a',
        '/examples/routes/loop-b',
        '/examples/routes/summary?from=loop',
      ]);
    }
  });

  it('navigates back and forth from code a few times, then stops', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/examples/routes/summary');
    const urls: string[] = [];
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) urls.push(event.url);
    });

    await pingPong(router, 4);
    expect(urls).toEqual([
      '/examples/routes/details',
      '/examples/routes/summary',
      '/examples/routes/details',
      '/examples/routes/summary',
    ]);
    expect(router.url).toBe('/examples/routes/summary');
  });

  it('starts from the other page when it is already on Details', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/examples/routes/details');
    const urls: string[] = [];
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) urls.push(event.url);
    });

    await pingPong(router, 2);
    expect(urls).toEqual(['/examples/routes/summary', '/examples/routes/details']);
  });
});
