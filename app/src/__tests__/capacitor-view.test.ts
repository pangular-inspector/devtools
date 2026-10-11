import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('devframe/client', () => ({
  connectDevframe: () => new Promise(() => {}),
}));

const { App } = await import('../app');

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function host(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

describe('Capacitor view', () => {
  beforeEach(() => history.replaceState(null, '', '/?view=capacitor'));
  afterEach(() => {
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
  });

  it('shows the setup steps and links to the Capacitor guide', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const el = host(fixture);

    expect(el.querySelector('h1')?.textContent).toContain('Capacitor');
    expect(el.querySelector('.badge')?.textContent).toContain('Available');
    expect(el.querySelector('#soon-title')?.textContent).toBe('Inspect Capacitor apps');
    expect(el.querySelector('.plans-title')?.textContent?.trim()).toBe('Set up an app');
    const steps = [...el.querySelectorAll('.plans li')].map((li) => li.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[1]).toContain('@pangular-inspector/devtools/overlay-manual');
    expect(steps[1]).toContain('connectionMeta');
    const link = el.querySelector<HTMLAnchorElement>('a.cta');
    expect(link?.textContent).toContain('Capacitor setup guide');
    expect(link?.href).toBe('https://pangular-inspector.dev/guides/capacitor/');
    expect(link?.target).toBe('_blank');
    expect(el.textContent).not.toContain('Coming Soon');
    expect(el.querySelectorAll('nav button')).toHaveLength(0);
  });
});
