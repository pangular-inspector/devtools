import { Component, ViewEncapsulation, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';

/** A Signal Form inside a shadow root, to check that the Forms tab still finds it. */
@Component({
  selector: 'app-shadow-form-example',
  imports: [FormField, FormRoot],
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    <form class="card" [formRoot]="address" aria-labelledby="shadow-form-title">
      <h3 id="shadow-form-title">Shadow DOM</h3>
      <label>
        City
        <input
          [formField]="address.city"
          [attr.aria-invalid]="address.city().invalid()"
          [attr.aria-describedby]="address.city().invalid() ? 'shadow-city-errors' : null"
        />
      </label>
      <div id="shadow-city-errors">
        @for (error of address.city().errors(); track error.kind) {
          <p class="error">{{ error.message }}</p>
        }
      </div>
    </form>
  `,
  styleUrl: './forms-example.css',
})
export class ShadowFormExample {
  readonly address = form(signal({ city: '' }), (p) => {
    required(p.city, { message: 'City is required' });
  });
}
