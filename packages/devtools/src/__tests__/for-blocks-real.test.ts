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
import { createForTracker, type ControlFlowDebugNg } from '../for-blocks.ts';

class TripList {
  readonly trips = signal([
    { id: 1, city: 'Rome' },
    { id: 2, city: 'Oslo' },
  ]);
  readonly tags = signal<string[]>([]);
  readonly stops = signal(['a', 'b', 'c']);
}
Component({
  selector: 'app-root',
  template: `
    <ul>
      @for (trip of trips(); track trip.id) {
        <li>{{ trip.city }}</li>
      }
    </ul>
    @for (tag of tags(); track tag) {
      <span>{{ tag }}</span>
    } @empty {
      <p>No tags</p>
    }
    @for (stop of stops(); track $index) {
      <b>{{ stop }}</b>
    }
  `,
})(TripList);

class ExamplePanel {}
Component({
  selector: 'app-example-panel',
  template: `<div class="panel"><ng-content /></div>`,
})(ExamplePanel);

class SignalsExample {
  readonly items = signal(['x', 'y']);
}
Component({
  selector: 'app-root',
  imports: [ExamplePanel],
  template: `
    <app-example-panel>
      @for (item of items(); track item) {
        <i>{{ item }}</i>
      }
    </app-example-panel>
  `,
})(SignalsExample);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

describe('createForTracker with a real app', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('reads real @for blocks through ɵgetControlFlowBlocks and keeps their ids', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripList, {
      providers: [provideZonelessChangeDetection()],
    });
    await settle(app);

    const ng = (globalThis as { ng?: ControlFlowDebugNg }).ng!;
    expect(typeof ng.ɵgetControlFlowBlocks).toBe('function');
    const tracker = createForTracker();
    const report = tracker.collect(ng)!;
    expect(report.forBlocks).toHaveLength(3);
    const [trips, tags, stops] = report.forBlocks;
    expect(trips).toMatchObject({
      count: 2,
      track: 'function',
      hasEmptyBlock: false,
      showingEmpty: false,
      owner: { name: 'TripList', tag: 'app-root' },
    });
    expect(trips.rootIds.map((id) => elementById(id)?.textContent)).toEqual(['Rome', 'Oslo']);
    expect(tags).toMatchObject({
      count: 0,
      track: 'item',
      hasEmptyBlock: true,
      showingEmpty: true,
    });
    expect(stops).toMatchObject({ count: 3, track: '$index', hasEmptyBlock: false });

    const list = app.components[0].instance as TripList;
    list.trips.update((all) => [...all, { id: 3, city: 'Lima' }]);
    list.tags.set(['beach']);
    await settle(app);
    const [moreTrips, someTags] = tracker.collect(ng)!.forBlocks;
    expect(moreTrips).toMatchObject({ id: trips.id, count: 3 });
    expect(someTags).toMatchObject({ id: tags.id, count: 1, showingEmpty: false });
  });

  it('names the template owner of a @for block projected into another component', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(SignalsExample, {
      providers: [provideZonelessChangeDetection()],
    });
    await settle(app);

    const ng = (globalThis as { ng?: ControlFlowDebugNg }).ng!;
    const tracker = createForTracker();
    const [block] = tracker.collect(ng)!.forBlocks;
    expect(block).toMatchObject({
      count: 2,
      owner: { name: 'SignalsExample', tag: 'app-root' },
    });
    expect(elementById(block.owner!.id)).toBe(document.querySelector('app-root'));
    expect(tracker.collect(ng)!.forBlocks[0].id).toBe(block.id);
  });
});
