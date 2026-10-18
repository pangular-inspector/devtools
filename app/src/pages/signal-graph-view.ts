import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  chainOf,
  drawnIds,
  layoutGraph,
  moveFocus,
  type GraphKey,
  type GraphLink,
} from './signal-graph-layout';

export interface GraphViewNode {
  id: string;
  kind: string;
  label?: string;
}

const KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

/**
 * The signal graph drawn as nodes and links. Nodes are buttons in one Tab
 * stop: arrow keys move between them, Enter or Space selects. The selected
 * node's producers (upstream) and consumers (downstream) are highlighted.
 */
@Component({
  selector: 'app-signal-graph-view',
  template: `
    <p class="sr-only" [id]="helpId">
      Producers are on the left and consumers on the right. Use the arrow keys to move between
      signals and Enter to select one. The list below has the same signals.
    </p>
    <div class="legend" aria-hidden="true">
      <span class="key key-selected">Selected</span>
      <span class="key key-up">Upstream (producers)</span>
      <span class="key key-down">Downstream (consumers)</span>
    </div>
    @if (capped(); as cap) {
      <p class="cap-note" role="status">
        Drawing {{ cap.drawn }} of {{ cap.total }} signals.
        {{
          selectedId()
            ? 'The selected signal and its chain are drawn first.'
            : 'Select a signal in the list to draw its chain.'
        }}
      </p>
    }
    <div
      class="canvas"
      role="group"
      [attr.aria-label]="'Signal graph, ' + layout().nodes.length + ' signals'"
      [attr.aria-describedby]="helpId"
    >
      <div class="plane" [style.width.px]="layout().width" [style.height.px]="layout().height">
        <svg
          aria-hidden="true"
          focusable="false"
          [attr.width]="layout().width"
          [attr.height]="layout().height"
          [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
        >
          @for (edge of layout().edges; track edge.producer + '>' + edge.consumer) {
            <path class="edge" [attr.d]="edge.path" [class]="edgeTone(edge)" />
          }
        </svg>
        @for (node of layout().nodes; track node.id) {
          <button
            type="button"
            class="gnode"
            [class]="tone(node.id)"
            [style.left.px]="node.x"
            [style.top.px]="node.y"
            [style.width.px]="nodeWidth"
            [style.height.px]="nodeHeight"
            [attr.tabindex]="node.id === focusId() ? 0 : -1"
            [attr.aria-pressed]="node.id === selectedId()"
            [attr.aria-label]="describe(node.id)"
            [attr.data-node]="node.id"
            [title]="labelOf(node.id)"
            (click)="pick(node.id)"
            (focus)="focused.set(node.id)"
            (keydown)="onKey($event, node.id)"
          >
            <span class="gkind">
              <span class="dot" aria-hidden="true" [style.background]="colorOf(node.id)"></span>
              {{ byId().get(node.id)?.kind }}
              @if (watched().has(node.id)) {
                <span class="watching">watching</span>
              }
            </span>
            <span class="glabel">{{ labelOf(node.id) }}</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      min-width: 0;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--text-2);
    }
    .key {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .key::before {
      content: '';
      width: 18px;
      height: 0;
      border-top: 2px solid var(--graph-edge);
    }
    .key-selected::before {
      height: 10px;
      border: 2px solid var(--accent);
      border-radius: 3px;
      background: var(--accent-soft);
    }
    .key-up::before {
      border-top-color: var(--accent);
    }
    .key-down::before {
      border-top: 2px dashed var(--ok);
    }
    .cap-note {
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--text-2);
    }
    .canvas {
      max-height: 420px;
      overflow: auto;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .plane {
      position: relative;
    }
    svg {
      position: absolute;
      inset: 0;
      overflow: visible;
    }
    .edge {
      fill: none;
      stroke: var(--graph-edge);
      stroke-width: 1.5;
      transition: stroke 0.15s var(--ease);
    }
    .edge.up {
      stroke: var(--accent);
      stroke-width: 2;
    }
    .edge.down {
      stroke: var(--ok);
      stroke-width: 2;
      stroke-dasharray: 5 3;
    }
    .edge.faded {
      stroke: var(--border);
    }
    .gnode {
      position: absolute;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      min-width: 0;
      padding: 4px 8px;
      text-align: left;
      font: inherit;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        border-color 0.15s var(--ease);
    }
    .gnode:hover {
      background: var(--surface-2);
    }
    .gnode:focus-visible {
      @include m.focus-ring(-2px);
    }
    .gnode.selected {
      background: var(--accent-soft);
      border: 2px solid var(--accent);
    }
    .gnode.up {
      border-color: var(--accent);
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .gnode.down {
      border: 1px dashed var(--ok);
      box-shadow: inset 3px 0 0 var(--ok);
    }
    .gnode.faded {
      background: var(--bg);
      border-color: var(--border);
    }
    .gkind {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      font-size: 10.5px;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .watching {
      margin-left: auto;
      padding: 0 5px;
      border: 1px solid;
      border-radius: 99px;
      text-transform: none;
      letter-spacing: 0;
      @include m.tint(accent);
    }
    .glabel {
      @include m.truncate;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-strong);
    }
    @media (prefers-reduced-motion: reduce) {
      .edge,
      .gnode {
        transition: none;
      }
    }
  `,
})
export class SignalGraphView {
  readonly nodes = input.required<readonly GraphViewNode[]>();
  readonly links = input.required<readonly GraphLink[]>();
  readonly selectedId = input<string | null>(null);
  readonly watched = input<ReadonlySet<string>>(new Set());
  /** Colour of the dot for a kind, the same as the list's badges. */
  readonly kindColor = input<(kind: string) => string>(() => 'var(--text-3)');
  readonly selected = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private static seq = 0;
  readonly helpId = `signal-graph-help-${++SignalGraphView.seq}`;
  readonly nodeWidth = NODE_WIDTH;
  readonly nodeHeight = NODE_HEIGHT;

  readonly byId = computed(() => new Map(this.nodes().map((n) => [n.id, n])));

  private readonly drawn = computed(() =>
    drawnIds(
      this.nodes().map((n) => n.id),
      this.links(),
      this.selectedId(),
    ),
  );

  readonly capped = computed(() => {
    const total = this.nodes().length;
    const drawn = this.drawn().length;
    return drawn < total ? { drawn, total } : null;
  });

  readonly layout = computed(() => layoutGraph(this.drawn(), this.links()));

  private readonly chain = computed(() => {
    const id = this.selectedId();
    return id && this.byId().has(id) ? chainOf(id, this.links()) : null;
  });

  private readonly counts = computed(() => {
    const counts = new Map<string, { producers: number; consumers: number }>();
    const of = (id: string) => {
      let entry = counts.get(id);
      if (!entry) counts.set(id, (entry = { producers: 0, consumers: 0 }));
      return entry;
    };
    for (const link of this.links()) {
      of(link.consumer).producers++;
      of(link.producer).consumers++;
    }
    return counts;
  });

  /** The node that holds the Tab stop: the last focused, else the selected, else the first. */
  readonly focused = signal<string | null>(null);
  readonly focusId = computed(() => {
    const drawn = new Set(this.drawn());
    const focused = this.focused();
    if (focused && drawn.has(focused)) return focused;
    const selected = this.selectedId();
    if (selected && drawn.has(selected)) return selected;
    return this.layout().nodes[0]?.id ?? null;
  });

  labelOf(id: string): string {
    const node = this.byId().get(id);
    return node?.label ?? `(unnamed ${node?.kind ?? 'node'})`;
  }

  colorOf(id: string): string {
    return this.kindColor()(this.byId().get(id)?.kind ?? 'unknown');
  }

  tone(id: string): string {
    if (id === this.selectedId()) return 'selected';
    const chain = this.chain();
    if (!chain) return '';
    if (chain.upstream.has(id)) return 'up';
    if (chain.downstream.has(id)) return 'down';
    return 'faded';
  }

  edgeTone(edge: GraphLink): string {
    const chain = this.chain();
    const id = this.selectedId();
    if (!chain || !id) return '';
    const up = (n: string) => n === id || chain.upstream.has(n);
    const down = (n: string) => n === id || chain.downstream.has(n);
    if (up(edge.consumer) && chain.upstream.has(edge.producer)) return 'up';
    if (down(edge.producer) && chain.downstream.has(edge.consumer)) return 'down';
    return 'faded';
  }

  describe(id: string): string {
    const node = this.byId().get(id);
    const { producers = 0, consumers = 0 } = this.counts().get(id) ?? {};
    const parts = [
      `${node?.kind ?? 'node'} ${node?.label ?? 'unnamed'}`,
      `${producers} ${producers === 1 ? 'producer' : 'producers'}`,
      `${consumers} ${consumers === 1 ? 'consumer' : 'consumers'}`,
    ];
    const tone = this.tone(id);
    if (tone === 'up') parts.push('upstream of the selected signal');
    if (tone === 'down') parts.push('downstream of the selected signal');
    if (this.watched().has(id)) parts.push('watched');
    return parts.join(', ');
  }

  pick(id: string) {
    this.focused.set(id);
    this.selected.emit(id);
  }

  onKey(event: KeyboardEvent, id: string) {
    if (!KEYS.has(event.key)) return;
    event.preventDefault();
    const next = moveFocus(this.layout(), this.links(), id, event.key as GraphKey);
    if (!next) return;
    this.focused.set(next);
    const button = [...this.host.querySelectorAll<HTMLElement>('[data-node]')].find(
      (el) => el.dataset['node'] === next,
    );
    button?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    button?.focus({ preventScroll: true });
  }
}
