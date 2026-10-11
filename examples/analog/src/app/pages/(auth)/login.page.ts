import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'Log in',
};

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <h1>Log in</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" class="form" novalidate>
      <label for="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        formControlName="email"
        autocomplete="email"
        [attr.aria-invalid]="invalid('email')"
        aria-describedby="login-email-error"
      />
      <p id="login-email-error" class="error">
        @if (invalid('email')) {
          {{
            form.controls.email.hasError('required')
              ? 'Enter your email.'
              : 'Enter a valid email address.'
          }}
        }
      </p>
      <label for="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        formControlName="password"
        autocomplete="current-password"
        [attr.aria-invalid]="invalid('password')"
        aria-describedby="login-password-error"
      />
      <p id="login-password-error" class="error">
        @if (invalid('password')) {
          {{
            form.controls.password.hasError('required')
              ? 'Enter your password.'
              : 'Use at least 8 characters.'
          }}
        }
      </p>
      <label><input type="checkbox" formControlName="remember" /> Remember me</label>
      <button type="submit">Log in</button>
      <p role="status">{{ message() }}</p>
    </form>
    <p>New here? <a routerLink="/register">Create an account</a></p>
  `,
})
export default class Login {
  protected readonly message = signal('');
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    remember: new FormControl(false, { nonNullable: true }),
  });

  protected invalid(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  submit() {
    this.form.markAllAsTouched();
    this.message.set(this.form.valid ? 'Logged in (demo).' : 'Fix the errors above.');
  }
}
