import { Component } from '@angular/core';
import { ExamplePage } from './example-page';
import { ReactiveFormExample } from './reactive-form-example';
import { ShadowFormExample } from './shadow-form-example';
import { SignalFormExample } from './signal-form-example';
import { TemplateFormExample } from './template-form-example';

@Component({
  selector: 'app-forms-example',
  imports: [
    ExamplePage,
    SignalFormExample,
    ReactiveFormExample,
    TemplateFormExample,
    ShadowFormExample,
  ],
  template: `
    <app-example-page heading="Forms" tab="Forms">
      <ng-container lead>
        All three kinds of Angular form on one page: Signal Forms, reactive forms and
        template-driven forms, each with nested fields, a list and failing validators, plus a Signal
        Form inside a shadow root.
      </ng-container>
      <ng-container hint>
        Type into the fields and watch validity, touched and dirty change in the Forms tab.
      </ng-container>

      <div class="grid">
        <app-signal-form-example />
        <app-reactive-form-example />
        <app-template-form-example />
        <app-shadow-form-example />
      </div>
    </app-example-page>
  `,
  styles: `
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
      align-items: start;
    }
  `,
})
export class FormsExample {}
