---
title: '@pangular-inspector/devtools/cd-data'
description: 'Every symbol the @pangular-inspector/devtools/cd-data entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="cd-data" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/cd-data</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/cd-data

Import from `@pangular-inspector/devtools/cd-data`. This page is generated from [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## CD_CAUSE_KINDS

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Every cause kind, in the order the panel and the agent tool list them.

```ts
const CD_CAUSE_KINDS: readonly CdCauseKind[];
```

## CD_CAUSE_LABEL

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

How the panel and the agent tool name each cause kind.

```ts
const CD_CAUSE_LABEL: Record<CdCauseKind, string>;
```

## CD_EXPORT_FORMAT

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

The `format` of a recording file, so an import can tell it apart from other JSON.

```ts
const CD_EXPORT_FORMAT: 'pangular-inspector/change-detection';
```

## CD_HINT_MAX_CHANGED

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

The share of refreshed checks that may change something for the OnPush hint.

```ts
const CD_HINT_MAX_CHANGED: 0.2;
```

## CD_HINT_MIN_CHECKS

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Refreshed checks a class needs before the OnPush hint looks at it.

```ts
const CD_HINT_MIN_CHECKS: 10;
```

## CD_SPAN_KIND

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

What each `CdSpan` kind letter means.

```ts
const CD_SPAN_KIND: {
  readonly component: 'c';
  readonly hook: 'h';
  readonly afterRender: 'r';
  readonly output: 'o';
};
```

## cdCauseText

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

One line on what started a cycle, such as `click on button in Cart (add), wrote count`.

```ts
function cdCauseText(reason: CdCause): string;
```

## cdExportFile

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

A recording as a JSON file, with only the recording's own fields. Host
counts are left out: their element ids only mean something in the page
that recorded them.

```ts
function cdExportFile(
  recording: CdRecording,
  pageId: string,
  exportedAt = Date.now(),
): CdExportFile;
```

## CdExportFile

Interface. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

```ts
interface CdExportFile {
  format: typeof CD_EXPORT_FORMAT;
  version: 1;
  /** When the file was written, in ms since the epoch. */
  exportedAt: number;
  pageId: string;
  recording: CdRecording;
}
```

## CdHint

Interface. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

A suggestion from a recording's diagnosis.

```ts
interface CdHint {
  /** The component class it is about. */
  name: string;
  kind: 'on-push' | 'already-on-push' | 'in-place' | 'same-contents' | 'zone';
  text: string;
}
```

## cdHints

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Suggestions from a diagnosis: OnPush for classes refreshed often that
rarely change, inputs mutated in place or renewed with equal contents, and
components that only zone.js keeps up to date.

```ts
function cdHints(diagnosis: CdDiagnosis | undefined): CdHint[];
```

## CdOptionsRequest

Interface. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

A `change-detection-options` request; a missing field leaves that view as it is.

```ts
interface CdOptionsRequest {
  flash?: boolean;
  track?: boolean;
  /** Only `true` does anything: Angular has no way to turn its profiling off again. */
  angularProfiling?: boolean;
}
```

## cdSlowMs

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

A recording's `slowMs`, or the default when it names none or one out of range.

```ts
function cdSlowMs(value: unknown): number;
```

## CdTraceEvent

Interface. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

One event of the Trace Event Format that Perfetto and `chrome://tracing` read.

```ts
interface CdTraceEvent {
  name: string;
  /** `X` is a complete event with `dur`, `M` a metadata event that names a process or thread. */
  ph: 'X' | 'M';
  pid: number;
  tid: number;
  /** Microseconds. */
  ts?: number;
  /** Microseconds. */
  dur?: number;
  cat?: string;
  args?: Record<string, unknown>;
}
```

## cdTraceFile

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

A recording in the Trace Event Format, for Perfetto (ui.perfetto.dev) or
`chrome://tracing`: one complete (`X`) event per cycle, one per kept span
(component check, lifecycle hook, afterRender) nested inside it, and the
output listeners that started cycles on a thread of their own. Times are in
microseconds from the first cycle.

```ts
function cdTraceFile(recording: CdRecording, pageId: string): CdTraceFile;
```

## CdTraceFile

Interface. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

```ts
interface CdTraceFile {
  traceEvents: CdTraceEvent[];
  displayTimeUnit: 'ms';
  otherData: Record<string, string | number>;
}
```

## DEFAULT_CD_SLOW_MS

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

The slow cycle threshold of a recording that names none, such as one from a
page older than `limits.cdSlowMs`. Matches that limit's default.

```ts
const DEFAULT_CD_SLOW_MS: 16;
```

## MAX_CD_IMPORT_BYTES

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Files larger than this are not read.

```ts
const MAX_CD_IMPORT_BYTES: 20000000;
```

## MAX_SPANS

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Spans a cycle keeps, the longest ones. The recorder uses the same cap.

```ts
const MAX_SPANS: 40;
```

## parseCdImport

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Reads a recording file: an export from the panel or the agent tool, or a
bare recording. Everything in it goes through `sanitizeCdRecording`.

```ts
function parseCdImport(
  json: string,
  maxCycles: number,
):
  | {ok: true; pageId: string; exportedAt?: number; recording: CdRecording}
  | {ok: false; error: string};
```

## sanitizeCdDiagnosis

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Checks a recording's `diagnosis`; undefined when there is none.

```ts
function sanitizeCdDiagnosis(value: unknown): CdDiagnosis | undefined;
```

## sanitizeCdRecording

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Checks a recording from a page push or a file: known fields only, strings
cut, numbers finite and lists capped. Null when `value` is not an object.

```ts
function sanitizeCdRecording(value: unknown, maxCycles: number): CdRecording | null;
```

## toCdOptions

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

The views a page reports it has on, with only the known boolean fields.

```ts
function toCdOptions(value: unknown): CdOptions | undefined;
```

## toCdOptionsRequest

Function. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

Reads an options request from the wire, keeping only the fields it knows.

```ts
function toCdOptionsRequest(value: unknown): CdOptionsRequest;
```

## UNNAMED_SIGNAL

Constant. Source: [`packages/devtools/src/cd-data.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cd-data.ts).

What a cause holds for a signal written without a `debugName`.

```ts
const UNNAMED_SIGNAL: '?';
```
