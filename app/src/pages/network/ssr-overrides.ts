import { Component, inject } from '@angular/core';
import { Select } from '../../ui/select';
import { overrideLabel, type OverrideDraft } from './http-model';
import { NetworkState } from './network-state';
import { OverrideState } from './override-state';

/** The SSR overrides section of the Network page: the override form and the override list. */
@Component({
  selector: 'section[appSsrOverrides]',
  imports: [Select],
  templateUrl: './ssr-overrides.html',
  styleUrl: './ssr-overrides.scss',
})
export class SsrOverrides {
  private readonly state = inject(NetworkState);
  private readonly overrideState = inject(OverrideState);
  protected readonly canWrite = this.state.canWrite;
  protected readonly overrides = this.state.overrides;
  protected readonly overrideDraft = this.overrideState.overrideDraft;
  protected readonly overrideKindOptions = this.overrideState.overrideKindOptions;
  protected readonly overrideValueError = this.overrideState.overrideValueError;
  protected readonly overrideFromPayload = this.overrideState.overrideFromPayload;
  protected readonly overrideReady = this.overrideState.overrideReady;
  protected readonly addingOverride = this.overrideState.addingOverride;

  protected readonly overrideLabel = overrideLabel;

  protected setOverrideDraft<K extends keyof OverrideDraft>(key: K, value: OverrideDraft[K]) {
    this.overrideState.setOverrideDraft(key, value);
  }

  protected patchOverride(key: keyof OverrideDraft, event: Event) {
    this.overrideState.patchOverride(key, event);
  }

  protected addOverride(event: Event) {
    void this.overrideState.addOverride(event);
  }

  protected toggleOverride(id: string) {
    this.overrideState.toggleOverride(id);
  }

  protected removeOverride(id: string) {
    void this.overrideState.removeOverride(id);
  }
}
