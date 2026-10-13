// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { attachAxe } from '../axe-runner.ts';
import type { BlockOwnerDebugNg } from '../block-owner.ts';
import { bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

class TripPhoto {}
Component({
  ...STANDALONE,
  selector: 'app-trip-photo',
  template: `<img src="/rome.jpg"><button type="button"></button>`,
})(TripPhoto);

class Trips {}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [TripPhoto],
  template: `<main><h1>Trips</h1><app-trip-photo></app-trip-photo></main>`,
})(Trips);

describe('the axe pass with a real app and real axe-core', () => {
  let app: BootedApp | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('reports violations in the app with their component, and none from the overlay', async () => {
    document.documentElement.lang = 'en';
    document.title = 'Trips';
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(Trips, { declarations: [TripPhoto] });
    app.appRef.tick();
    // The popup's elements break rules too, and must not count.
    const popup = document.createElement('div');
    popup.id = 'pangular-popup-root';
    popup.innerHTML = '<img src="/fab.png"><button></button>';
    document.body.appendChild(popup);

    const runner = attachAxe(
      { rpc: { call: async () => {} } },
      'real-page',
      () => (globalThis as { ng?: BlockOwnerDebugNg }).ng,
    );
    const result = await runner.run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byRule = new Map(result.report.violations.map((v) => [v.id, v]));
    const imageAlt = byRule.get('image-alt');
    expect(imageAlt).toMatchObject({ count: 1, impact: 'critical' });
    expect(imageAlt!.nodes[0]!.owner?.name).toBe('TripPhoto');
    expect(imageAlt!.nodes[0]!.html).toBe('<img src="/rome.jpg">');
    expect(byRule.get('button-name')?.count).toBe(1);
    expect(result.report.version).toMatch(/^4\./);
    expect(JSON.stringify(result.report)).not.toContain('fab.png');
  }, 30_000);
});
