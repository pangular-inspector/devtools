import { Component, inject } from '@angular/core';
import { SignalGraphView } from '../signal-graph-view';
import { kindColor, plural, type SignalNode } from './signal-model';
import { SignalState } from './signal-state';

/**
 * The drawn signal graph of the Signals page, with the framework, write stack and show or hide
 * toggles, and a line about the node selected in it.
 */
@Component({
  selector: 'section[appSignalGraphSection]',
  imports: [SignalGraphView],
  templateUrl: './signal-graph-section.html',
  styleUrl: './signal-graph-section.scss',
})
export class SignalGraphSection {
  private readonly state = inject(SignalState);

  readonly frameworkCount = this.state.frameworkCount;
  readonly showFramework = this.state.showFramework;
  readonly stacksOn = this.state.stacksOn;
  readonly showGraph = this.state.showGraph;
  readonly graphNodes = this.state.graphNodes;
  readonly graphLinks = this.state.graphLinks;
  readonly selectedId = this.state.selectedId;
  readonly selectedNode = this.state.selectedNode;
  readonly watchedIds = this.state.watchedIds;
  readonly kindColorOf = (kind: string) => kindColor(kind);
  readonly plural = plural;

  toggleStacks() {
    this.state.toggleStacks();
  }

  selectFromGraph(id: string) {
    this.state.selectFromGraph(id);
  }

  getDependencies(node: SignalNode): SignalNode[] {
    return this.state.getDependencies(node);
  }

  getConsumers(node: SignalNode): SignalNode[] {
    return this.state.getConsumers(node);
  }

  jumpTo(node: SignalNode) {
    this.state.jumpTo(node);
  }
}
