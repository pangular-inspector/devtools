import { Component, inject, input, output, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { InjectorFocus } from '../../types/injector-focus.types';
import type { SignalFocus } from '../../types/signal-focus.types';
import { RedactionCount } from '../../ui/redaction-count';
import { SearchField } from '../../ui/search-field';
import { SourceLink } from '../../ui/source-link';
import { StoreGlobal } from '../../ui/store-global';
import { ComponentPipesSection } from '../component-pipes-section';
import { ValueTree } from '../component-value-tree';
import { bare, type Detail, type LiveNode, type SourceComponent } from './component-model';
import { DetailState } from './detail-state';
import { SourceScan } from './source-scan';
import { TreeState } from './tree-state';

/**
 * The detail of a selected component: where its source is, the Chrome DevTools, copy and tab
 * links, its live inputs, outputs and properties with a filter, its directives, what it injects
 * and the pipes of its template.
 */
@Component({
  selector: 'section[appComponentDetail]',
  imports: [
    NgTemplateOutlet,
    RedactionCount,
    SearchField,
    SourceLink,
    StoreGlobal,
    ValueTree,
    ComponentPipesSection,
  ],
  templateUrl: './component-detail.html',
  styleUrl: './component-detail.scss',
})
export class ComponentDetail {
  private readonly state = inject(TreeState);
  private readonly scan = inject(SourceScan);
  private readonly details = inject(DetailState);

  /** The selected component instance. */
  readonly node = input.required<LiveNode>();
  readonly showForm = output<string>();
  readonly showInjector = output<InjectorFocus>();
  readonly showSignals = output<SignalFocus>();
  readonly showPipe = output<{ name: string; pageId?: string }>();

  protected readonly rpc = this.state.rpc;
  protected readonly page = this.state.page;
  protected readonly detail = this.state.detail;
  protected readonly native = this.state.native;
  protected readonly staticReport = this.state.staticReport;
  protected readonly canEdit = this.state.canEdit;
  protected readonly canShowInjector = this.state.canShowInjector;
  protected readonly canShowSignals = this.state.canShowSignals;
  protected readonly canShowPipes = this.state.canShowPipes;
  protected readonly routedById = this.state.routedById;
  protected readonly ownedDeferBlocks = this.state.ownedDeferBlocks;

  protected readonly guessTitle = this.scan.guessTitle;

  protected readonly devtoolsActions = this.details.devtoolsActions;
  protected readonly actionMessage = this.details.actionMessage;
  protected readonly copyMessage = this.details.copyMessage;
  protected readonly values = this.details.values;
  protected readonly propFilter = this.details.propFilter;
  protected readonly propQuery = this.details.propQuery;
  protected readonly shownValues = this.details.shownValues;
  protected readonly valueTotal = this.details.valueTotal;
  protected readonly propFilterStatus = this.details.propFilterStatus;
  private readonly propFilterInput = viewChild<SearchField>('propFilterInput');

  /** Clears the detail filter and keeps focus in its field. */
  protected clearPropFilter(event?: Event) {
    if (event && this.propFilter()) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.propFilter.set('');
    this.propFilterInput()?.focus();
  }

  protected flashed(section: 'input' | 'property' | 'directive', name: string, index?: number) {
    return this.details.flashed(section, name, index);
  }

  protected revealInElements(node: LiveNode) {
    return this.details.revealInElements(node);
  }

  protected openSource(node: LiveNode) {
    return this.details.openSource(node);
  }

  protected copyJson(detail: Detail) {
    return this.details.copyJson(detail);
  }

  protected copyHostPath(detail: Detail) {
    return this.details.copyHostPath(detail);
  }

  /** Opens the Signals tab on this component's graph, with the signal in `key` selected. */
  protected openSignals(node: LiveNode, key?: string) {
    const pageId = this.page()?.pageId;
    this.showSignals.emit({
      componentId: node.id,
      ...(pageId ? { pageId } : {}),
      ...(key ? { key } : {}),
    });
  }

  /** Opens the Injectors tab on this component's element injector. */
  protected openInjector(node: LiveNode) {
    const pageId = this.page()?.pageId;
    this.showInjector.emit(pageId ? { componentId: node.id, pageId } : { componentId: node.id });
  }

  protected formsIn(file: string) {
    return this.scan.formsIn(file);
  }

  protected sourceCandidates(node: LiveNode) {
    return this.scan.sourceCandidates(node);
  }

  protected sourceFor(node: LiveNode) {
    return this.scan.sourceFor(node);
  }

  protected directiveSources(name: string) {
    return this.scan.directiveSources(name);
  }

  protected sourceKey(comp: SourceComponent) {
    return this.scan.sourceKey(comp);
  }

  protected bareName(name: string) {
    return bare(name);
  }
}
