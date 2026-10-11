import { Component, signal } from '@angular/core';
import {
  applyEach,
  debounce,
  email,
  form,
  FormField,
  FormRoot,
  min,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { demoModelContext } from './webmcp-demo';

interface Signup {
  name: string;
  email: string;
  age: number;
  plan: 'free' | 'pro';
  tags: { label: string }[];
}

@Component({
  selector: 'app-signal-form-example',
  imports: [FormField, FormRoot],
  template: `
    <form class="card" [formRoot]="signup" aria-labelledby="signal-form-title">
      <h3 id="signal-form-title">Signal Forms</h3>

      <label>
        Name
        <input
          [formField]="signup.name"
          [attr.aria-invalid]="signup.name().invalid()"
          [attr.aria-describedby]="signup.name().invalid() ? 'signal-name-errors' : null"
        />
      </label>
      <div id="signal-name-errors">
        @for (error of signup.name().errors(); track error.kind) {
          <p class="error">{{ error.message }}</p>
        }
      </div>

      <label>
        Email
        <input
          type="email"
          [formField]="signup.email"
          [attr.aria-invalid]="signup.email().invalid()"
          [attr.aria-describedby]="signup.email().invalid() ? 'signal-email-errors' : null"
        />
      </label>
      <div id="signal-email-errors">
        @for (error of signup.email().errors(); track error.kind) {
          <p class="error">{{ error.message }}</p>
        }
      </div>

      <label>
        Age
        <input
          type="number"
          [formField]="signup.age"
          [attr.aria-invalid]="signup.age().invalid()"
          [attr.aria-describedby]="signup.age().invalid() ? 'signal-age-errors' : null"
        />
      </label>
      <div id="signal-age-errors">
        @for (error of signup.age().errors(); track error.kind) {
          <p class="error">{{ error.message }}</p>
        }
      </div>

      <fieldset>
        <legend>Plan</legend>
        <label class="inline">
          <input type="radio" value="free" [formField]="signup.plan" />
          Free
        </label>
        <label class="inline">
          <input type="radio" value="pro" [formField]="signup.plan" />
          Pro
        </label>
      </fieldset>

      <fieldset>
        <legend>Tags</legend>
        @for (tag of signup.tags; track $index) {
          <label>
            Tag {{ $index + 1 }}
            <input
              [formField]="tag.label"
              [attr.aria-invalid]="tag.label().invalid()"
              [attr.aria-describedby]="tag.label().invalid() ? 'signal-tag-errors-' + $index : null"
            />
          </label>
          <div [id]="'signal-tag-errors-' + $index">
            @for (error of tag.label().errors(); track error.kind) {
              <p class="error">{{ error.message }}</p>
            }
          </div>
        }
        <button type="button" (click)="addTag()">Add tag</button>
      </fieldset>

      <div class="row">
        <button type="submit">Save</button>
        <button type="button" (click)="fillAsAgent()">Fill as an agent</button>
      </div>
      <p class="status" role="status">{{ result() }}</p>
    </form>
  `,
  styleUrl: './forms-example.css',
})
export class SignalFormExample {
  protected readonly model = signal<Signup>({
    name: '',
    email: 'not-an-email',
    age: 12,
    plan: 'free',
    tags: [{ label: 'angular' }, { label: '' }],
  });

  protected readonly result = signal('');

  protected readonly signup = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Name is required' });
      minLength(path.name, 2, { message: 'Name needs at least 2 characters' });
      validate(path.name, ({ value }) =>
        value() === 'admin' ? { kind: 'reserved', message: 'That name is reserved' } : null,
      );
      debounce(path.email, 400);
      required(path.email, { message: 'Email is required' });
      email(path.email, { message: 'Enter a valid email address' });
      min(path.age, 13, { message: 'You must be 13 or older' });
      applyEach(path.tags, (tag) => {
        required(tag.label, { message: 'A tag needs a label' });
      });
    },
    {
      submission: {
        action: async () => {
          this.result.set('Saved.');
        },
        onInvalid: () => this.result.set('Fix the errors above before saving.'),
      },
      experimentalWebMcpTool: {
        name: 'sign_up',
        description: 'Create a demo account with a name, email, age, plan and tags.',
      },
    },
  );

  protected async fillAsAgent() {
    const context = demoModelContext();
    if (!context) {
      this.result.set('This browser has its own modelContext. Call sign_up from your agent.');
      return;
    }
    const answer = (await context.executeTool('sign_up', {
      name: 'Ada',
      email: 'ada@example.com',
      age: 36,
      plan: 'pro',
      tags: [{ label: 'agent' }],
    })) as { content?: { text?: string }[] } | undefined;
    this.result.set(answer?.content?.[0]?.text ?? 'The agent call finished.');
  }

  protected addTag() {
    this.model.update((value) => ({ ...value, tags: [...value.tags, { label: '' }] }));
  }
}
