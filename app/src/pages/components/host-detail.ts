import { Component, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SourceLink } from '../../ui/source-link';
import { directiveHostLabel } from '../component-tree-state';
import { bare, type LiveNode } from './component-model';
import { SourceScan } from './source-scan';
import { TreeState } from './tree-state';

/** The detail of a selected directive host: its directives and the component that renders it. */
@Component({
  selector: 'section[appHostDetail]',
  imports: [NgTemplateOutlet, SourceLink],
  templateUrl: './host-detail.html',
  styleUrl: './host-detail.scss',
})
export class HostDetail {
  private readonly state = inject(TreeState);
  private readonly scan = inject(SourceScan);
  /** The selected row, an element that hosts directives but no component. */
  readonly node = input.required<LiveNode>();

  protected readonly guessTitle = this.scan.guessTitle;

  protected hostLabel(node: LiveNode) {
    return directiveHostLabel(node);
  }

  protected ownerOf(id: string) {
    return this.state.ownerOf(id);
  }

  protected reveal(id: string, focus = false) {
    this.state.reveal(id, focus);
  }

  protected directiveSources(name: string) {
    return this.scan.directiveSources(name);
  }

  protected bareName(name: string) {
    return bare(name);
  }
}
