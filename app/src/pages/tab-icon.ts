import { Component, input } from '@angular/core';

@Component({
  selector: 'app-tab-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('dashboard') {
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        }
        @case ('components') {
          <path d="M12 2 3 7l9 5 9-5-9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 17 9 5 9-5" />
        }
        @case ('routes') {
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        }
        @case ('signals') {
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        }
        @case ('injectors') {
          <path d="M12 22v-5" />
          <path d="M9 8V2" />
          <path d="M15 8V2" />
          <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
        }
        @case ('store') {
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14a9 3 0 0 0 18 0V5" />
          <path d="M3 12a9 3 0 0 0 18 0" />
        }
        @case ('forms') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 9h10" />
          <path d="M7 13h6" />
          <path d="M7 17h8" />
        }
        @case ('network') {
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
        }
        @case ('pipes') {
          <path d="M4 7h10" />
          <path d="M4 17h6" />
          <path d="m14 13 4 4-4 4" />
          <path d="M10 17h8" />
          <circle cx="18" cy="7" r="3" />
        }
        @case ('analog') {
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        }
        @case ('capacitor') {
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
          <path d="m10 7 4 4" />
          <path d="m14 7-4 4" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
  `,
})
export class TabIcon {
  readonly name = input.required<string>();
}
