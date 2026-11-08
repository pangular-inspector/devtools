import { Component, inject, input } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { StoreGlobal } from '../../ui/store-global';
import { ProviderValue } from '../di-provider-value';
import type { InjectorNode, ProviderInfo } from './injector-model';
import { InjectorsState } from './injectors-state';
import { SourceScan } from './source-scan';

/**
 * The "Provides" block of the injector detail: each provider with its flags, where the source
 * declares it, the store-as-global action and its live value.
 */
@Component({
  selector: 'div[appInjectorProviders]',
  imports: [ProviderValue, SourceLink, StoreGlobal],
  templateUrl: './injector-providers.html',
  styleUrl: './injector-providers.scss',
})
export class InjectorProviders {
  private readonly state = inject(InjectorsState);
  private readonly scan = inject(SourceScan);

  readonly node = input.required<InjectorNode>();

  readonly rpc = this.state.rpc;
  readonly shownPageId = this.state.shownPageId;

  providerCount(node: InjectorNode) {
    return this.state.providerCount(node);
  }

  hiddenProviders(node: InjectorNode) {
    return this.state.hiddenProviders(node);
  }

  isHidden(provider: ProviderInfo) {
    return this.state.isHidden(provider);
  }

  setHideFramework(hide: boolean) {
    this.state.setHideFramework(hide);
  }

  matches(token: string) {
    return this.state.matches(token);
  }

  sourceOf(token: string) {
    return this.scan.sourceOf(token);
  }

  tokenPosition(providers: readonly ProviderInfo[], index: number) {
    return this.state.tokenPosition(providers, index);
  }

  positionSuffix(providers: readonly ProviderInfo[], index: number) {
    return this.state.positionSuffix(providers, index);
  }

  capital(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
