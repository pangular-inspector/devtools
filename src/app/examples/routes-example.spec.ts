import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { RoutesExample } from './routes-example';

@Component({ template: '' })
class Page {}

describe('RoutesExample', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'examples/routes',
            children: [
              { path: 'summary', component: Page },
              { path: 'details', component: Page },
            ],
          },
        ]),
      ],
    });
  });

  it('runs one ping-pong at a time and marks the button busy while it runs', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/examples/routes/summary');
    const fixture = TestBed.createComponent(RoutesExample);
    await fixture.whenStable();
    const calls = vi.spyOn(router, 'navigateByUrl');
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (el) => el.textContent?.includes('Navigation ping-pong'),
    )!;

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.click();
    await fixture.whenStable();

    expect(calls).toHaveBeenCalledTimes(6);
    expect(button.hasAttribute('aria-disabled')).toBe(false);
  });
});
