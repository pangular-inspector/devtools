import { Component, inject, input } from '@angular/core';
import { DatePipe, JsonPipe, NgTemplateOutlet } from '@angular/common';
import type { SignalChange } from '@pangular-inspector/devtools/internal/types';
import { SourceLink } from '../../ui/source-link';
import type { SignalResource } from '../../types/signal-graph.types';
import type { JsonDiffEntry } from '../json-diff';
import { SignalDetailState } from './signal-detail-state';
import { kindColor, sourceLabel, type SignalNode } from './signal-model';
import { SignalState } from './signal-state';

/**
 * The detail panel under a selected card: a resource's fields and internal signals, or a
 * signal's fields, producers, consumers and watch toggle, each with its value history.
 */
@Component({
  selector: 'div[appSignalDetail]',
  imports: [DatePipe, JsonPipe, NgTemplateOutlet, SourceLink],
  templateUrl: './signal-detail.html',
  styleUrl: './signal-detail.scss',
})
export class SignalDetail {
  /** The resource to show; without one the panel shows the selected signal. */
  readonly resource = input<SignalResource | null>(null);

  private readonly state = inject(SignalState);
  private readonly detail = inject(SignalDetailState);

  readonly selectedNode = this.state.selectedNode;
  readonly showInternals = this.state.showInternals;
  readonly watchedIds = this.state.watchedIds;
  readonly selectedHistory = this.detail.selectedHistory;
  readonly restoreBlocked = this.detail.restoreBlocked;
  readonly restoring = this.detail.restoring;
  readonly restoreResult = this.detail.restoreResult;
  readonly diffs = this.detail.diffs;
  readonly sourceMatch = this.detail.sourceMatch;
  readonly writeHint = this.detail.writeHint;
  readonly kindColor = kindColor;
  readonly sourceLabel = sourceLabel;

  getDependencies(node: SignalNode): SignalNode[] {
    return this.state.getDependencies(node);
  }

  getConsumers(node: SignalNode): SignalNode[] {
    return this.state.getConsumers(node);
  }

  jumpTo(node: SignalNode) {
    this.state.jumpTo(node);
  }

  isWatchable(node: SignalNode): boolean {
    return this.state.isWatchable(node);
  }

  toggleWatch(node: SignalNode) {
    this.state.toggleWatch(node);
  }

  internalsOf(resource: SignalResource): SignalNode[] {
    return this.state.internalsOf(resource);
  }

  historySummary(id: string): string {
    return this.detail.historySummary(id);
  }

  restorable(id: string): SignalNode | null {
    return this.detail.restorable(id);
  }

  restore(node: SignalNode, change: SignalChange, time: string) {
    return this.detail.restore(node, change, time);
  }

  diffLabel(kind: JsonDiffEntry['kind']): string {
    return this.detail.diffLabel(kind);
  }
}
