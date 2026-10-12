// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { OUTPUT_TRIGGER_MS, PROFILER_EVENT as E, createCdRecorder } from '../cd-recorder.ts';
import { MAX_SPANS } from '../cd-data.ts';
import { MAX_TRACKED_TIMINGS, hookName } from '../cd-timing.ts';

class Shell {}
class Row {
  ngOnInit() {}
  ngDoCheck() {}
  ngOnChanges() {}
  ngAfterViewChecked() {}
}
class Picker {
  onPick() {}
}

function clocked() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function recorderAt() {
  const clock = clocked();
  const recorder = createCdRecorder({ maxCycles: 10, now: clock.now, clock: () => 1000 });
  recorder.start();
  return { clock, recorder, snap: () => recorder.snapshot(() => null) };
}

// Angular passes this wrapper, not the class's ngOnChanges, for every class.
function rememberChangeHistoryAndInvokeOnChangesHook() {}

describe('lifecycle hook timing', () => {
  it('names hooks from the instance, including the ngOnChanges wrapper and minified names', () => {
    const row = new Row();
    expect(hookName(row, Row.prototype.ngOnInit)).toBe('ngOnInit');
    expect(hookName(row, rememberChangeHistoryAndInvokeOnChangesHook)).toBe('ngOnChanges');
    class Minified {
      a() {}
    }
    const minified = new Minified();
    (minified as unknown as Record<string, unknown>)['ngDoCheck'] = Minified.prototype.a;
    expect(hookName(minified, Minified.prototype.a)).toBe('ngDoCheck');
    expect(hookName({}, function other() {})).toBe('other');
    expect(hookName({}, undefined)).toBe('hook');
  });

  it('times hooks per class and hook, per cycle and as spans inside the component', () => {
    const { clock, recorder, snap } = recorderAt();
    const shell = new Shell();
    const row = new Row();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.LifecycleHookStart, row, rememberChangeHistoryAndInvokeOnChangesHook);
    clock.advance(1);
    recorder.onEvent(E.LifecycleHookEnd, row, rememberChangeHistoryAndInvokeOnChangesHook);
    recorder.onEvent(E.LifecycleHookStart, row, Row.prototype.ngOnInit);
    clock.advance(2);
    recorder.onEvent(E.LifecycleHookEnd, row, Row.prototype.ngOnInit);
    recorder.onEvent(E.LifecycleHookStart, row, Row.prototype.ngDoCheck);
    clock.advance(0.5);
    recorder.onEvent(E.LifecycleHookEnd, row, Row.prototype.ngDoCheck);
    clock.advance(1);
    recorder.onEvent(E.ComponentEnd, shell);
    recorder.onEvent(E.ChangeDetectionEnd);

    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.LifecycleHookStart, row, Row.prototype.ngDoCheck);
    clock.advance(1.5);
    recorder.onEvent(E.LifecycleHookEnd, row, Row.prototype.ngDoCheck);
    recorder.onEvent(E.ChangeDetectionEnd);

    const result = snap();
    expect(result.cycles.map((c) => c.hookMs)).toEqual([3.5, 1.5]);
    expect(result.hooks).toEqual([
      // Equal times list the more often called hook first.
      { name: 'Row', hook: 'ngDoCheck', calls: 2, ms: 2, maxMs: 1.5 },
      { name: 'Row', hook: 'ngOnInit', calls: 1, ms: 2, maxMs: 2 },
      { name: 'Row', hook: 'ngOnChanges', calls: 1, ms: 1, maxMs: 1 },
    ]);
    const names = result.spanNames!;
    const spans = result.cycles[0]!.spans!.map(([name, start, ms, depth, kind]) => [
      names[name],
      start,
      ms,
      depth,
      kind,
    ]);
    expect(spans).toEqual([
      ['Shell', 0, 4.5, 0, 'c'],
      ['Row.ngOnChanges', 0, 1, 1, 'h'],
      ['Row.ngOnInit', 1, 2, 1, 'h'],
      ['Row.ngDoCheck', 3, 0.5, 1, 'h'],
    ]);
    // A component's self time still includes the hooks its view ran.
    expect(result.components[0]).toMatchObject({ name: 'Shell', ms: 4.5 });
  });

  it('nests a component checked inside a running hook under that hook', () => {
    const { clock, recorder, snap } = recorderAt();
    const shell = new Shell();
    const row = new Row();
    const outlet = new Row();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ComponentStart);
    clock.advance(0.5);
    recorder.onEvent(E.LifecycleHookStart, outlet, Row.prototype.ngOnInit);
    clock.advance(1);
    recorder.onEvent(E.ComponentStart);
    clock.advance(2);
    recorder.onEvent(E.ComponentEnd, row);
    recorder.onEvent(E.LifecycleHookEnd, outlet, Row.prototype.ngOnInit);
    recorder.onEvent(E.ComponentEnd, shell);
    recorder.onEvent(E.ChangeDetectionEnd);
    const result = snap();
    const names = result.spanNames!;
    const depths = result.cycles[0]!.spans!.map(([name, , , depth, kind]) => [
      names[name],
      depth,
      kind,
    ]);
    expect(depths).toEqual([
      ['Shell', 0, 'c'],
      ['Row.ngOnInit', 1, 'h'],
      ['Row', 2, 'c'],
    ]);
  });

  it('counts a hook run by another hook once in the cycle total', () => {
    const { clock, recorder, snap } = recorderAt();
    const row = new Row();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.LifecycleHookStart, row, Row.prototype.ngAfterViewChecked);
    recorder.onEvent(E.LifecycleHookStart, row, Row.prototype.ngDoCheck);
    clock.advance(1);
    recorder.onEvent(E.LifecycleHookEnd, row, Row.prototype.ngDoCheck);
    clock.advance(1);
    recorder.onEvent(E.LifecycleHookEnd, row, Row.prototype.ngAfterViewChecked);
    recorder.onEvent(E.ChangeDetectionEnd);
    expect(snap().cycles[0]!.hookMs).toBe(2);
  });

  it('keeps hook totals for hooks that run outside a cycle, such as ngOnDestroy', () => {
    const { clock, recorder, snap } = recorderAt();
    const destroy = function ngOnDestroy() {};
    recorder.onEvent(E.LifecycleHookStart, new Shell(), destroy);
    clock.advance(1);
    recorder.onEvent(E.LifecycleHookEnd, new Shell(), destroy);
    expect(snap().hooks).toEqual([
      { name: 'Shell', hook: 'ngOnDestroy', calls: 1, ms: 1, maxMs: 1 },
    ]);
    expect(snap().cycles).toEqual([]);
  });

  it('lists at most 100 rows and counts the rest', () => {
    const { recorder, snap } = recorderAt();
    for (let i = 0; i < MAX_TRACKED_TIMINGS + 5; i++) {
      const Class = class {};
      const hook = function ngDoCheck() {};
      recorder.onEvent(E.LifecycleHookStart, new Class(), hook);
      recorder.onEvent(E.LifecycleHookEnd, new Class(), hook);
    }
    const result = snap();
    expect(result.hooks).toHaveLength(100);
    expect(result.droppedTimings).toBe(MAX_TRACKED_TIMINGS + 5 - 100);
  });
});

describe('output timing', () => {
  it('times outputs without the outputs they emit and credits the trigger with its time', () => {
    const { clock, recorder, snap } = recorderAt();
    const picker = new Picker();
    const shell = new Shell();
    const onSelect = function onSelect() {};
    recorder.onEvent(E.OutputStart, picker, Picker.prototype.onPick);
    clock.advance(1);
    recorder.onEvent(E.OutputStart, shell, onSelect);
    clock.advance(2);
    recorder.onEvent(E.OutputEnd, shell, onSelect);
    clock.advance(1);
    recorder.onEvent(E.OutputEnd, picker, Picker.prototype.onPick);
    clock.advance(1);
    recorder.onEvent(E.ChangeDetectionStart);
    clock.advance(1);
    recorder.onEvent(E.ChangeDetectionEnd);

    const result = snap();
    expect(result.outputs).toEqual([
      { name: 'Shell', listener: 'onSelect', calls: 1, ms: 2, maxMs: 2 },
      { name: 'Picker', listener: 'onPick', calls: 1, ms: 2, maxMs: 2 },
    ]);
    const cycle = result.cycles[0]!;
    // The trigger is the listener that ran last; its time is the outermost output's.
    expect(cycle.trigger).toBe('Shell (onSelect)');
    expect(cycle.outputMs).toBe(4);
    // The output span sits before the cycle, so its start is negative.
    expect(cycle.spans).toEqual([[0, -5, 4, 0, 'o']]);
    expect(result.spanNames).toEqual(['Picker (onPick)']);
  });

  it('does not credit an output that ended long before the cycle', () => {
    const { clock, recorder, snap } = recorderAt();
    const picker = new Picker();
    recorder.onEvent(E.OutputStart, picker, Picker.prototype.onPick);
    clock.advance(1);
    recorder.onEvent(E.OutputEnd, picker, Picker.prototype.onPick);
    clock.advance(OUTPUT_TRIGGER_MS + 1);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    const cycle = snap().cycles[0]!;
    expect(cycle.trigger).toBeUndefined();
    expect(cycle.outputMs).toBeUndefined();
    expect(cycle.spans).toBeUndefined();
    expect(snap().outputs).toHaveLength(1);
  });
});

describe('afterRender timing', () => {
  it('times afterRender callbacks per cycle and in total', () => {
    const { clock, recorder, snap } = recorderAt();
    for (const ms of [2, 1]) {
      recorder.onEvent(E.ChangeDetectionStart);
      recorder.onEvent(E.ChangeDetectionSyncStart);
      clock.advance(1);
      recorder.onEvent(E.AfterRenderHooksStart);
      clock.advance(ms);
      recorder.onEvent(E.AfterRenderHooksEnd);
      recorder.onEvent(E.ChangeDetectionEnd);
    }
    // Events outside a cycle are not Angular's and are ignored.
    recorder.onEvent(E.AfterRenderHooksStart);
    recorder.onEvent(E.AfterRenderHooksEnd);
    const result = snap();
    expect(result.afterRender).toEqual({ runs: 2, ms: 3, maxMs: 2 });
    expect(result.cycles.map((c) => c.afterRenderMs)).toEqual([2, 1]);
    expect(result.cycles[0]!.spans).toEqual([[0, 1, 2, 0, 'r']]);
    expect(result.spanNames).toEqual(['afterRender']);
    // Cycle starts come from the high-resolution clock, from the start of the recording.
    expect(result.cycles.map((c) => c.t)).toEqual([0, 3]);
  });

  it('forgets timings on clear', () => {
    const { clock, recorder, snap } = recorderAt();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.AfterRenderHooksStart);
    clock.advance(1);
    recorder.onEvent(E.AfterRenderHooksEnd);
    recorder.onEvent(E.LifecycleHookStart, new Row(), Row.prototype.ngDoCheck);
    recorder.onEvent(E.LifecycleHookEnd, new Row(), Row.prototype.ngDoCheck);
    recorder.onEvent(E.ChangeDetectionEnd);
    recorder.clear();
    const result = snap();
    expect(result).not.toHaveProperty('afterRender');
    expect(result).not.toHaveProperty('hooks');
    expect(result).not.toHaveProperty('spanNames');
  });
});

describe('cycle spans', () => {
  it('keeps the longest spans of a cycle in start order and counts the rest', () => {
    const { clock, recorder, snap } = recorderAt();
    const rows = Array.from({ length: 100 }, () => new Row());
    recorder.onEvent(E.ChangeDetectionStart);
    rows.forEach((row, i) => {
      recorder.onEvent(E.ComponentStart);
      clock.advance(i % 2 ? 2 : 1);
      recorder.onEvent(E.ComponentEnd, row);
    });
    recorder.onEvent(E.ChangeDetectionEnd);
    const cycle = snap().cycles[0]!;
    expect(cycle.spans).toHaveLength(MAX_SPANS);
    expect(cycle.droppedSpans).toBe(100 - MAX_SPANS);
    expect(cycle.spans!.every(([, , ms]) => ms === 2)).toBe(true);
    const starts = cycle.spans!.map(([, start]) => start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(snap().spanNames).toEqual(['Row']);
  });
});
