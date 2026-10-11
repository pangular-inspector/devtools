import { Component, input } from '@angular/core';
import { ago, type CapacitorPage } from './capacitor-types';

// Plugin state cards show a plugin's live state from what the app already
// recorded: the results of its successful calls and the last event of its
// listeners. They never call into the page.

/** Where a field can come from: a method's result or an event's payload. */
export type StateSource =
  | { method: string; read: (value: unknown) => string | null }
  | { event: string; read: (value: unknown) => string | null };

export interface StateFieldDefinition {
  label: string;
  /** Every place the value shows up. The newest one wins. */
  sources: readonly StateSource[];
}

export interface PluginStateDefinition {
  /** The name the plugin registers with `registerPlugin()`. */
  plugin: string;
  fields: readonly StateFieldDefinition[];
}

export interface StateFieldValue {
  label: string;
  /** Null when the app never read it. */
  value: string | null;
  /** `foldStateChange` or `getFoldState()`. */
  from: string | null;
  at: number | null;
}

export interface PluginStateCard {
  plugin: string;
  fields: StateFieldValue[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Reads one string, number or boolean field of a result or event. */
function field(name: string, format: (value: string) => string = (value) => value) {
  return (value: unknown): string | null => {
    const item = isObject(value) ? value[name] : undefined;
    return typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
      ? format(String(item))
      : null;
  };
}

/** The same field, from the methods and events that carry it. */
function from(
  methods: readonly string[],
  events: readonly string[],
  read: (value: unknown) => string | null,
): StateSource[] {
  return [
    ...methods.map((method) => ({ method, read })),
    ...events.map((event) => ({ event, read })),
  ];
}

const sizeClass = (value: unknown): string | null => {
  const width = field('widthClass')(value);
  const height = field('heightClass')(value);
  if (!width && !height) return null;
  return [width && `width ${width}`, height && `height ${height}`].filter(Boolean).join(', ');
};

/** `@erkamyaman/capacitor-foldable`. */
const FOLDABLE: PluginStateDefinition = {
  plugin: 'Foldable',
  fields: [
    { label: 'Fold state', sources: from(['getFoldState'], ['foldStateChange'], field('state')) },
    { label: 'Posture', sources: from(['getFoldState'], ['foldStateChange'], field('posture')) },
    {
      label: 'Hinge orientation',
      sources: from(['getFoldState'], ['foldStateChange'], field('hingeOrientation')),
    },
    {
      label: 'Hinge angle',
      sources: from(
        ['getHingeAngle'],
        ['hingeAngleChange'],
        field('angle', (angle) => `${angle}°`),
      ),
    },
    {
      label: 'Active display',
      sources: from(['getFoldState'], ['foldStateChange'], field('activeDisplay')),
    },
    { label: 'Size class', sources: from(['getSizeClass'], ['sizeClassChange'], sizeClass) },
  ],
};

export const PLUGIN_STATE_DEFINITIONS: readonly PluginStateDefinition[] = [FOLDABLE];

interface Reading {
  value: string;
  from: string;
  at: number;
}

function newestReading(page: CapacitorPage, plugin: string, source: StateSource): Reading | null {
  let best: Reading | null = null;
  const consider = (value: unknown, label: string, at: number) => {
    if (best && best.at >= at) return;
    const read = source.read(value);
    if (read !== null) best = { value: read, from: label, at };
  };
  if ('method' in source) {
    for (const call of page.calls) {
      if (call.plugin !== plugin || call.method !== source.method || call.status !== 'ok') continue;
      consider(call.result, `${source.method}()`, call.startedAt + (call.durationMs ?? 0));
    }
  } else {
    for (const listener of page.listeners) {
      if (listener.plugin !== plugin || listener.event !== source.event) continue;
      if (listener.lastEventAt === undefined || listener.last === undefined) continue;
      consider(listener.last, source.event, listener.lastEventAt);
    }
  }
  return best;
}

/** The cards for the plugins on this page that have a definition. */
export function pluginStateCards(
  page: CapacitorPage,
  definitions: readonly PluginStateDefinition[] = PLUGIN_STATE_DEFINITIONS,
): PluginStateCard[] {
  const names = new Set(page.info.plugins.map((plugin) => plugin.name));
  return definitions
    .filter((definition) => names.has(definition.plugin))
    .map((definition) => ({
      plugin: definition.plugin,
      fields: definition.fields.map((stateField) => {
        let best: Reading | null = null;
        for (const source of stateField.sources) {
          const reading = newestReading(page, definition.plugin, source);
          if (reading && (!best || reading.at > best.at)) best = reading;
        }
        const found = best as Reading | null;
        return {
          label: stateField.label,
          value: found?.value ?? null,
          from: found?.from ?? null,
          at: found?.at ?? null,
        };
      }),
    }));
}

@Component({
  selector: 'app-capacitor-state',
  template: `
    <p class="lead">
      Read from the results and events the app already received. The panel calls nothing in the app.
    </p>
    <div class="cards">
      @for (card of cards(); track card.plugin) {
        <article class="card" [attr.aria-labelledby]="'cap-state-' + card.plugin">
          <h3 [id]="'cap-state-' + card.plugin">
            <code>{{ card.plugin }}</code>
          </h3>
          <dl>
            @for (item of card.fields; track item.label) {
              <div>
                <dt>{{ item.label }}</dt>
                <dd>
                  @if (item.value !== null) {
                    <span class="value">{{ item.value }}</span
                    >&ngsp;
                    <span class="source"
                      >from <code>{{ item.from }}</code
                      >, {{ ago(item.at!, now()) }}</span
                    >
                  } @else {
                    <span class="missing">Not reported yet</span>
                  }
                </dd>
              </div>
            }
          </dl>
        </article>
      }
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .lead {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .cards {
      display: grid;
      gap: 12px;
    }
    .card {
      @include m.panel;
      padding: 12px;
      min-width: 0;
    }
    h3 {
      margin: 0 0 8px;
      color: var(--text-strong);
      font-size: 14px;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 8px 16px;
      margin: 0;
    }
    dl > div {
      min-width: 0;
    }
    dt {
      @include m.label;
      margin: 0 0 2px;
    }
    dd {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .value {
      color: var(--text-strong);
      font-weight: 600;
    }
    .source,
    .missing {
      color: var(--text-2);
      font-size: 12px;
    }
    .missing {
      font-style: italic;
    }
  `,
})
export class CapacitorState {
  readonly cards = input.required<PluginStateCard[]>();
  readonly now = input.required<number>();
  protected readonly ago = ago;
}
