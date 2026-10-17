import {
  Component,
  ElementRef,
  afterNextRender,
  effect,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, FormRoot, form, required } from '@angular/forms/signals';
import type { DevframeRpcClient } from 'devframe/client';

export const AUTH_CODE_DOCS_URL = 'https://pangular-inspector.dev/security/#one-time-code';

type AuthClient = Pick<DevframeRpcClient, 'requestTrustWithCode' | 'requestAuthCode'>;

/**
 * Asks for the one-time code the devtools server prints in its terminal, and
 * trades it for a token over the devframe auth API. The panel connects once
 * the server trusts the client.
 */
@Component({
  selector: 'app-auth-code',
  imports: [FormField, FormRoot],
  template: `
    <section class="pairing" aria-labelledby="auth-code-title">
      <h2 id="auth-code-title">Enter the one-time code</h2>
      <p>
        The devtools server asks for a one-time code before it shares data from your app. Find the
        6-digit code in the terminal that runs the dev server.
      </p>
      <form [formRoot]="codeForm">
        <label for="auth-code-input">One-time code</label>
        <div class="row">
          <input
            #codeInput
            id="auth-code-input"
            [formField]="codeForm.code"
            autocomplete="one-time-code"
            inputmode="numeric"
            spellcheck="false"
            [attr.aria-invalid]="error() ? true : null"
            [attr.aria-describedby]="error() ? 'auth-code-error' : null"
          />
          <button type="submit" class="primary" [disabled]="busy()">
            {{ busy() ? 'Checking…' : 'Connect' }}
          </button>
        </div>
      </form>
      <p id="auth-code-error" class="error" role="alert">{{ error() }}</p>
      <div class="more">
        <button type="button" (click)="newCode()" [disabled]="busy()">Print a new code</button>
        <p class="notice" role="status">{{ notice() }}</p>
      </div>
      <a [href]="docsUrl" target="_blank" rel="noopener noreferrer"
        >About the one-time code<span class="sr-only"> (opens in a new tab)</span></a
      >
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .pairing {
      max-width: 60ch;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      line-height: 1.5;
    }
    h2 {
      margin: 0 0 6px;
      color: var(--text-strong);
      font-size: 15px;
    }
    p {
      margin: 0 0 12px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      color: var(--text-2);
      font-weight: 500;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    input {
      flex: 1 1 10ch;
      min-width: 0;
      max-width: 16ch;
      height: var(--control-h);
      padding: 0 10px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text-strong);
      font: inherit;
      font-family: var(--font-mono);
      letter-spacing: 0.08em;
      &:focus {
        @include m.field-focus;
      }
    }
    input[aria-invalid='true'] {
      border-color: var(--danger);
    }
    button {
      display: inline-flex;
      align-items: center;
      height: var(--control-h);
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      &:hover:not(:disabled) {
        background: var(--surface-3);
        border-color: var(--accent-line);
      }
      &:focus-visible {
        @include m.focus-ring;
      }
      &:disabled {
        cursor: default;
        opacity: 0.7;
      }
    }
    button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
      &:hover:not(:disabled) {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
      }
    }
    .error {
      min-height: 0;
      margin: 8px 0 0;
      color: var(--danger-text);
      &:empty {
        margin: 0;
      }
    }
    .more {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: 12px 0;
    }
    .notice {
      margin: 0;
      color: var(--text-2);
    }
    a {
      color: var(--accent);
      border-radius: 2px;
      &:focus-visible {
        @include m.focus-ring;
      }
    }
  `,
})
export class AuthCode {
  readonly client = input.required<AuthClient>();

  protected readonly docsUrl = AUTH_CODE_DOCS_URL;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  private readonly model = signal({ code: '' });
  protected readonly codeForm = form(this.model, (path) => required(path.code), {
    submission: {
      action: async () => {
        await this.send();
      },
      onInvalid: () => this.fail('Enter the code from the terminal.'),
    },
  });
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  constructor() {
    // Asks the server to print its code, once per client; it prints each code at most once.
    effect(() => {
      const client = this.client();
      untracked(() => void client.requestAuthCode().catch(() => {}));
    });
    afterNextRender(() => this.codeInput()?.nativeElement.focus());
  }

  private async send() {
    const code = this.model().code.replace(/\s+/g, '');
    this.busy.set(true);
    this.notice.set('');
    try {
      const trusted = await this.client().requestTrustWithCode(code);
      if (!trusted) this.fail("That code didn't match. Check the terminal and try again.");
      else this.error.set('');
    } catch {
      this.fail("Can't reach the devtools server. Check that the dev server is running.");
    } finally {
      this.busy.set(false);
    }
  }

  protected async newCode() {
    this.busy.set(true);
    try {
      await this.client().requestAuthCode({ reissue: true });
      this.error.set('');
      this.model.set({ code: '' });
      this.notice.set('A new code was printed in the terminal.');
    } catch {
      this.notice.set("Couldn't ask for a new code. Try again.");
    } finally {
      this.busy.set(false);
      this.codeInput()?.nativeElement.focus();
    }
  }

  private fail(message: string) {
    // A repeated message changes slightly, so screen readers say it again.
    this.error.update((current) => (current === message ? `${message} ` : message));
    this.codeInput()?.nativeElement.focus();
  }
}
