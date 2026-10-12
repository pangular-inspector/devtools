// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { elementById } from '../element-id.ts';
import { createDeferTracker, type DeferDebugNg } from '../defer-blocks.ts';

class TripReviews {
  readonly ready = signal(false);
}
Component({
  selector: 'app-root',
  template: `
    @defer (when ready()) {
      <section class="reviews">Reviews</section>
    } @placeholder {
      <p>Reviews soon</p>
    } @error {
      <p>Could not load reviews</p>
    }
  `,
})(TripReviews);

class ExamplePanel {}
Component({
  selector: 'app-example-panel',
  template: `<div class="panel"><ng-content /></div>`,
})(ExamplePanel);

class LazyExample {}
Component({
  selector: 'app-root',
  imports: [ExamplePanel],
  template: `
    <app-example-panel>
      @defer (on idle) {
        <p>Loaded</p>
      } @placeholder {
        <p>Waiting</p>
      }
    </app-example-panel>
  `,
})(LazyExample);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

describe('createDeferTracker with a real app', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('reads a real @defer block through the private defer block util', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripReviews, {
      providers: [provideZonelessChangeDetection()],
    });
    await settle(app);

    const ng = (globalThis as { ng?: DeferDebugNg }).ng!;
    expect(typeof (ng.ɵgetControlFlowBlocks ?? ng.ɵgetDeferBlocks)).toBe('function');
    const tracker = createDeferTracker();
    const [block] = tracker.collect(ng) ?? [];
    expect(block).toMatchObject({
      state: 'placeholder',
      hydration: 'not-configured',
      hasErrorBlock: true,
      placeholder: { minimumTime: null },
      owner: { name: 'TripReviews', tag: 'app-root' },
    });
    expect(block.triggers.join(' ')).toContain('when');

    (app.components[0].instance as TripReviews).ready.set(true);
    await settle(app);
    const [loaded] = tracker.collect(ng) ?? [];
    expect(loaded).toMatchObject({ id: block.id, state: 'complete' });
    expect(loaded.rootIds).toHaveLength(1);
  });

  it('names the template owner of a @defer block projected into another component', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(LazyExample, {
      providers: [provideZonelessChangeDetection()],
    });
    await settle(app);

    const ng = (globalThis as { ng?: DeferDebugNg }).ng!;
    const tracker = createDeferTracker();
    const [block] = tracker.collect(ng) ?? [];
    expect(block).toMatchObject({ owner: { name: 'LazyExample', tag: 'app-root' } });
    expect(elementById(block.owner!.id)).toBe(document.querySelector('app-root'));
    const [again] = tracker.collect(ng) ?? [];
    expect(again.id).toBe(block.id);
  });
});
