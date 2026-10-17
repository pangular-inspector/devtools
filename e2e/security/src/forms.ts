// Reactive, template-driven and Signal Forms holding the leak corpus.
import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { C } from '../canaries';

@Component({
  selector: 'app-reactive-secrets',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="group" aria-label="Reactive form">
      <label>User <input formControlName="username" /></label>
      <label>Password <input type="password" formControlName="password" /></label>
      <label>Confirm <input formControlName="confirmation" /></label>
      <label>Api key <input formControlName="apiKey" /></label>
      <label>Authorization <input formControlName="authorization" /></label>
      <label>Refresh <input formControlName="refresh_token" /></label>
      <label>Mfa <input formControlName="mfaCode" /></label>
      <label>Secret <input formControlName="secret" /></label>
      <label>Token <input formControlName="token" /></label>
      <label>Zorblax <input formControlName="zorblax" /></label>
      <label>Notes <input formControlName="notes" /></label>
      <label>Comment <input formControlName="comment" /></label>
      <label>Blob <input formControlName="blob" /></label>
      <label>Nickname <input formControlName="nickname" data-pangular="mask" /></label>
      <label>Iban2 <input formControlName="iban2" /></label>
      <label>Code <input formControlName="oneTime" autocomplete="one-time-code" /></label>
      <label>Recovery <input formControlName="recoveryKey" /></label>
      <label>Legacy <input formControlName="legacyPin" /></label>
      <label
        >Holder <input type="password" formControlName="holder" data-pangular="unmask"
      /></label>
      <label>Word <input type="password" formControlName="userWord" /></label>
      <label>Api secret <input formControlName="apiSecret" data-pangular="unmask" /></label>
      <fieldset formGroupName="credentials">
        <legend>Credentials</legend>
        <label>Value <input formControlName="value" /></label>
      </fieldset>
    </form>
  `,
})
export class ReactiveSecrets {
  readonly group = new FormGroup({
    username: new FormControl('ada'),
    password: new FormControl(C.rfPw.value),
    // Repeats the password under a harmless name.
    confirmation: new FormControl(C.rfPw.value),
    apiKey: new FormControl(C.rfApiKey.value),
    authorization: new FormControl(C.rfAuthz.value),
    refresh_token: new FormControl(C.rfRefresh.value),
    mfaCode: new FormControl(C.rfMfa.value),
    secret: new FormControl(C.rfSecret.value),
    token: new FormControl(C.rfToken.value),
    zorblax: new FormControl(C.rfCustom.value),
    notes: new FormControl(C.rfJwt.value),
    comment: new FormControl(C.rfBearer.value),
    blob: new FormControl(C.rfEntropy.value),
    nickname: new FormControl(C.rfMaskedAttr.value),
    iban2: new FormControl(C.rfWindowMask.value),
    oneTime: new FormControl(C.rfAutocomplete.value),
    recoveryKey: new FormControl(C.rfUnmaskWindow.value),
    legacyPin: new FormControl(C.rfUnmaskConfig.value),
    holder: new FormControl(C.rfUnmaskAttr.value),
    userWord: new FormControl(C.rfPwType.value),
    apiSecret: new FormControl(C.rfSecretNameUnmaskAttr.value),
    credentials: new FormGroup({ value: new FormControl(C.rfGroupInner.value) }),
  });

  /** Edits that land in the form event log, with the old secret as the previous value. */
  late() {
    this.group.patchValue({ password: C.rfPwChanged.value, token: C.rfTokenChanged.value });
    this.group.controls.notes.setValue(`${C.rfJwt.value} `);
  }
}

@Component({
  selector: 'app-template-secrets',
  imports: [FormsModule],
  template: `
    <form aria-label="Template form">
      <label>Token <input name="token" [(ngModel)]="model.token" /></label>
      <label>Password <input type="password" name="password" [(ngModel)]="model.password" /></label>
      <label>Nick <input name="nick" data-pangular="mask" [(ngModel)]="model.nick" /></label>
    </form>
  `,
})
export class TemplateSecrets {
  model = { token: C.tdToken.value, password: C.tdPw.value, nick: C.tdMasked.value };
}

@Component({
  selector: 'app-signal-secrets',
  imports: [FormField],
  template: `
    <form aria-label="Signal form">
      <label>Email <input [formField]="login.email" /></label>
      <label>Password <input type="password" [formField]="login.password" /></label>
      <label>Token <input [formField]="login.token" /></label>
      <label>Api key <input [formField]="login.apiKey" /></label>
      <label>Note <input [formField]="login.note" /></label>
    </form>
  `,
})
export class SignalSecrets {
  readonly model = signal({
    email: 'ada@example.com',
    password: C.sfPw.value,
    token: C.sfToken.value,
    apiKey: C.sfApiKey.value,
    note: C.sfJwt.value,
  });
  readonly login = form(this.model);
}
