import { scanPipes } from './get-pipes.ts';
import { lintPipes, type PipeLintFinding } from './pipe-lint.ts';
import type { PipesState, PipeUsageInfo } from './pipes-tools.ts';
import { code } from './forms-tools.ts';

const MAX_VALUE_CHARS = 200;

/** Size-capped JSON, so object/array structure survives (unlike `String`,
 * which collapses to `[object Object]`) without an unbounded blob. */
function capJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    json = undefined;
  }
  const text = json ?? String(value);
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text;
}

/** Formats everything known about one pipe — static declaration/usage, live
 * call counts and last input/output (if instrumented), and any lint findings
 * — as markdown for an agent asking "why is this pipe slow or stale?" */
export function explainPipeText(name: string, cwd: string, live: PipesState): string {
  const declared = scanPipes(cwd).filter((p) => p.name === name);
  const runtime = live.pipes.find((p) => p.name === name);
  const findings = lintPipes(cwd).filter((f) => f.pipe === name);

  if (!declared.length && !runtime) {
    return `No pipe named ${code(name)} was found in source or on the running page.`;
  }

  const lines: string[] = [];
  for (const d of declared) {
    lines.push(
      `${code(d.className)}${d.builtin ? ' (built-in, @angular/common)' : ''} — ${d.isPure ? 'pure' : 'impure'}, ${d.isStandalone ? 'standalone' : 'declared via NgModule'}, at ${code(`${d.file}:${d.line}`)}.`,
    );
  }
  if (!declared.length) lines.push(`Not found by source scan (only seen live).`);

  lines.push('', runtimeText(runtime, live.instrumented.length > 0));

  if (findings.length) {
    lines.push('', '**Lint findings:**');
    lines.push(...findings.map((f) => lintLine(f)));
  }

  return lines.join('\n');
}

function runtimeText(runtime: PipeUsageInfo | undefined, instrumented: boolean): string {
  if (!runtime) {
    return instrumented
      ? '**Live:** not seen on the currently connected page.'
      : '**Live:** unknown — instrumentation is off. Turn on "Instrument" in the Pipes panel for call counts, last input/output and stale-argument detection.';
  }
  const components = runtime.components.map((c) => `${c.name} (${c.count})`).join(', ');
  const parts = [
    `**Live:** ${runtime.instanceCount} instance(s), used by ${components || 'unknown'}.`,
  ];
  if (runtime.call) {
    parts.push(
      `Called ${runtime.call.callCount} time(s). Last input: ${code(capJson(runtime.call.lastArgs))}. Last output: ${code(capJson(runtime.call.lastResult))}.${
        runtime.call.lastCaller ? ` Last caller: ${code(runtime.call.lastCaller)}.` : ''
      }`,
    );
    const instances = runtime.call.instances;
    if (instances?.length) {
      parts.push(
        `Per instance: ${instances
          .map(
            (i) =>
              `${i.component} ×${i.callCount} ${code(capJson(i.lastArgs))} → ${code(capJson(i.lastResult))}`,
          )
          .join('; ')}.`,
      );
    }
  } else if (instrumented) {
    parts.push('No calls recorded yet.');
  }
  if (runtime.stale) {
    parts.push(
      '**Experimental:** this pure pipe was fed an argument that changed contents without changing reference — it may be showing a stale value.',
    );
  }
  return parts.join(' ');
}

function lintLine(f: PipeLintFinding): string {
  return `- **${f.severity}** ${f.rule} at ${code(`${f.file}:${f.line}`)}: ${f.message} Fix: ${f.fix}`;
}
