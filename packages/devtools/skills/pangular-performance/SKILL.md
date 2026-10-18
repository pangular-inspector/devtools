---
name: pangular-performance
description: Measure and reduce Angular change detection work (slow components, wasted checks, OnPush candidates, zone.js dependencies, leaked subscriptions) with the Pangular Inspector change detection and leak tools, comparing a recording before and after the fix.
---

# Speed up an Angular app with Pangular Inspector

Change detection data comes from Angular's profiler (Angular 20 or later). A recording holds the cycles of one page; compare a recording before and after each change.

## Record

1. `pangular_record-change-detection` with `record: "start"` starts a recording on the page. It is an action tool; under a read-only config the user starts the recording from the panel instead, and you only read it.
2. Ask the user to do the slow interaction, or reproduce it with `navigate` or `fill-form`.
3. `change-detection` reads it: the slowest components by self time, the most checked components, lifecycle hook and output listener time, and the latest cycles.

## Diagnose

`diagnose-change-detection` explains the same recording:

- **What started the cycles**: DOM events, signal writes, HTTP responses, timers, `markForCheck`, or zone.js ticks nothing in Angular asked for.
- **Components that depend on zone.js**: they would stop updating without zone.js.
- **Wasted checks**: refreshed checks where nothing the component renders changed.
- **Inputs that break OnPush**: inputs mutated in place, or new references with the same contents.
- **Hints**: OnPush candidates and the input or zone.js fixes to make.

For memory, `find-leaks` lists live subscriptions and effects per component and components destroyed but still alive across navigations. `track-subscriptions` with `action: "start"` records where subscriptions are made.

## Fix and verify

1. Make one change at a time: OnPush, a signal instead of a mutated input, `track` in `@for`, unsubscribing with `takeUntilDestroyed`.
2. `record-change-detection` with `record: "clear"`, then `"start"`, and repeat the same interaction.
3. Compare the new numbers with the old ones and report both. `change-detection` with `export: "json"` saves a recording the panel can import.
