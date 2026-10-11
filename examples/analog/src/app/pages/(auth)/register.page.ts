import { Component, signal } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import type { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'Create account',
};

@Component({
  imports: [FormsModule],
  template: `
    <h1>Create account</h1>
    <form #f="ngForm" (ngSubmit)="submit(!!f.valid)" class="form" novalidate>
      <label for="reg-name">Name</label>
      <input
        id="reg-name"
        name="name"
        autocomplete="name"
        [(ngModel)]="name"
        #nameModel="ngModel"
        required
        minlength="2"
        [attr.aria-invalid]="shown(nameModel, f.submitted)"
        aria-describedby="reg-name-error"
      />
      <p id="reg-name-error" class="error">
        @if (shown(nameModel, f.submitted)) {
          {{ nameModel.hasError('required') ? 'Enter your name.' : 'Use at least 2 characters.' }}
        }
      </p>
      <label for="reg-email">Email</label>
      <input
        id="reg-email"
        name="email"
        type="email"
        autocomplete="email"
        [(ngModel)]="email"
        #emailModel="ngModel"
        required
        email
        [attr.aria-invalid]="shown(emailModel, f.submitted)"
        aria-describedby="reg-email-error"
      />
      <p id="reg-email-error" class="error">
        @if (shown(emailModel, f.submitted)) {
          {{
            emailModel.hasError('required') ? 'Enter your email.' : 'Enter a valid email address.'
          }}
        }
      </p>
      <label
        ><input
          type="checkbox"
          name="terms"
          [(ngModel)]="terms"
          #termsModel="ngModel"
          required
          [attr.aria-invalid]="shown(termsModel, f.submitted)"
          aria-describedby="reg-terms-error"
        />
        I accept the terms</label
      >
      <p id="reg-terms-error" class="error">
        @if (shown(termsModel, f.submitted)) {
          Accept the terms to create an account.
        }
      </p>
      <button type="submit">Create account</button>
      <p role="status">{{ status() }}</p>
    </form>
  `,
})
export default class Register {
  protected name = '';
  protected email = '';
  protected terms = false;
  protected readonly status = signal('');

  protected shown(model: NgModel, submitted: boolean): boolean {
    return !!model.invalid && (!!model.touched || submitted);
  }

  protected submit(valid: boolean) {
    this.status.set(valid ? 'Account created (demo).' : 'Fix the errors above.');
  }
}
