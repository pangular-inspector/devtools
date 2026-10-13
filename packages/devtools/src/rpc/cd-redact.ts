import type { CdCause, CdDiagnosis, CdRecording } from '../config.ts';
import { redactText } from '../text-redact.ts';

/** Every page-controlled string of a recording, masked with the redaction helpers. */
export function redactCdRecording(recording: CdRecording): CdRecording {
  const mask = (text: string) => redactText(text);
  return {
    ...recording,
    cycles: recording.cycles.map((cycle) => ({
      ...cycle,
      ...(cycle.trigger ? { trigger: mask(cycle.trigger) } : {}),
      components: cycle.components.map((c) => ({ ...c, name: mask(c.name) })),
      ...(cycle.cause ? { cause: redactCdCause(cycle.cause) } : {}),
    })),
    ...(recording.diagnosis ? { diagnosis: redactCdDiagnosis(recording.diagnosis) } : {}),
    components: recording.components.map((c) => ({ ...c, name: mask(c.name) })),
    ...(recording.hooks
      ? { hooks: recording.hooks.map((h) => ({ ...h, name: mask(h.name), hook: mask(h.hook) })) }
      : {}),
    ...(recording.outputs
      ? {
          outputs: recording.outputs.map((o) => ({
            ...o,
            name: mask(o.name),
            ...(o.listener ? { listener: mask(o.listener) } : {}),
          })),
        }
      : {}),
    ...(recording.spanNames ? { spanNames: recording.spanNames.map(mask) } : {}),
  };
}

/** A cycle's cause with every page-controlled string masked. */
export function redactCdCause(cause: CdCause): CdCause {
  const out: CdCause = { ...cause };
  for (const field of ['component', 'listener', 'event', 'target', 'signal', 'task'] as const) {
    const value = out[field];
    if (value) out[field] = redactText(value);
  }
  if (out.stack) out.stack = out.stack.map((frame) => redactText(frame));
  return out;
}

/** A diagnosis with every class, input and task name masked. */
export function redactCdDiagnosis(diagnosis: CdDiagnosis): CdDiagnosis {
  const mask = (text: string) => redactText(text);
  return {
    ...diagnosis,
    components: diagnosis.components.map((c) => ({ ...c, name: mask(c.name) })),
    ...(diagnosis.inputs
      ? {
          inputs: diagnosis.inputs.map((i) => ({
            ...i,
            name: mask(i.name),
            input: mask(i.input),
            ...(i.parent ? { parent: mask(i.parent) } : {}),
          })),
        }
      : {}),
    ...(diagnosis.zone
      ? {
          zone: diagnosis.zone.map((z) => ({
            ...z,
            name: mask(z.name),
            ...(z.tasks ? { tasks: z.tasks.map(mask) } : {}),
          })),
        }
      : {}),
  };
}
