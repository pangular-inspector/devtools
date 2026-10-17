// @vitest-environment jsdom
import '@angular/compiler';
import * as core from '@angular/core';
import { Component } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { collectSignalGraph, type SignalDebugNg } from '../signal-graph.ts';
import {
  createSignalHistory,
  installSignalWriteHook,
  type RawSignalNode,
} from '../signal-history.ts';
import { rawNodeOf } from '../signal-resources.ts';
import type { SignalGraphNode } from '../types.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

const identity = (v: unknown) => v;
const GRAPH = angularAtLeast('20.1');
type AnyCore = Record<string, unknown>;

/** `signal()` with a debug name where Angular has one (16.0+), a plain field before. */
function namedSignal(initial: number, debugName: string): core.WritableSignal<number> | null {
  const create = (core as unknown as AnyCore)['signal'] as
    ((value: number, options: { debugName: string }) => core.WritableSignal<number>) | undefined;
  return create ? create(initial, { debugName }) : null;
}

class TripCounter {
  readonly trips = namedSignal(0, 'trips');
  addTrip() {
    this.trips?.update((n) => n + 1);
  }
}
Component({
  ...STANDALONE,
  selector: 'app-root',
  template: '<p>{{ trips ? trips() : 0 }} trips</p>',
})(TripCounter);

/**
 * The overlay's signal write hook and history on the primitives the installed
 * Angular ships. Before 17.0 there are none; the Vite plugin (and the compat
 * config) point the import at a stub. From 17.0 to 19.x the hook exists but
 * is called without the written node. History falls back to samples on both.
 */
const HOOK = angularAtLeast('20.0');
describe('signal history with a real app', () => {
  let app: BootedApp | null = null;
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  async function boot() {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(TripCounter);
    app.appRef.tick();
    return app.appRef.components[0]!.instance as TripCounter;
  }

  it('installs the write hook from 20.0 and falls back to samples before', async () => {
    const counter = await boot();
    const seen: RawSignalNode[] = [];
    restore = await installSignalWriteHook((node) => seen.push(node));
    if (!HOOK) {
      expect(restore).toBeNull();
      counter.addTrip();
      expect(seen).toEqual([]);
      return;
    }
    expect(restore).toBeTypeOf('function');
    const raw = rawNodeOf(counter.trips);
    counter.addTrip();
    expect(seen).toContain(raw);
    expect(raw).toMatchObject({ value: 1 });

    restore!();
    restore = null;
    seen.length = 0;
    counter.addTrip();
    expect(seen).toEqual([]);
  });

  it.runIf(HOOK)(
    'records a write from a component method with its value, epoch and app frames',
    async () => {
      const counter = await boot();
      const history = createSignalHistory(identity, Date.now, identity, { stacks: () => true });
      restore = await installSignalWriteHook(history.onWrite);
      const raw = rawNodeOf(counter.trips) as RawSignalNode;
      const ng = (globalThis as { ng?: SignalDebugNg }).ng;
      // From 20.1 the node comes from the real graph, as the overlay reads it. Before, the
      // graph util has no node ids, so the overlay reports it as unsupported.
      const nodeOf = (): SignalGraphNode => {
        const graph = GRAPH ? collectSignalGraph(ng) : null;
        const found = graph?.nodes.find((n) => n.label === 'trips');
        if (GRAPH) expect(found).toBeDefined();
        return (
          found ?? {
            id: 't',
            kind: 'signal',
            label: 'trips',
            epoch: raw.version!,
            value: raw.value,
          }
        );
      };

      const before = nodeOf();
      expect(before).toMatchObject({ kind: 'signal', value: 0 });
      history.collect([before]);
      counter.addTrip();
      app!.appRef.tick();
      await Promise.resolve();
      const after = nodeOf();
      expect(after).toMatchObject({ id: before.id, value: 1, epoch: raw.version });
      expect(document.body.textContent).toContain('1 trips');

      const last = history.collect([after])[after.id]!.at(-1)!;
      expect(last).toMatchObject({ source: 'write', value: 1, epoch: raw.version });
      expect(last.stack?.[0]).toMatch(/addTrip .*signal-history-real\.test\.ts/);
    },
  );
});
