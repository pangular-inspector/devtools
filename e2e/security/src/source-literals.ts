// Secrets written as literals in source, for the source scan: the static
// report (`pangular build`) and the stdio MCP server read these files.
import { Component, InjectionToken, signal } from '@angular/core';
import type { Routes } from '@angular/router';

export const LEGACY_CONFIG = new InjectionToken<{ clientSecret: string }>('LEGACY_CONFIG');

@Component({
  selector: 'app-literal-card',
  providers: [{ provide: LEGACY_CONFIG, useValue: { clientSecret: 'CNRY_srcProvSecret_q7Zx' } }],
  template: '<p>{{ authToken().length }}</p>',
})
export class LiteralCard {
  readonly authToken = signal('CNRY_srcSignalToken_q7Zx');
  readonly password = 'CNRY_srcPropPassword_q7Zx';
}

export const literalRoutes: Routes = [
  {
    path: 'legacy',
    component: LiteralCard,
    data: { apiKey: 'CNRY_srcRouteApiKey_q7Zx', title: 'Legacy' },
  },
];
