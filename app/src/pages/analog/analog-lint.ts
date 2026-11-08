import { Component, inject } from '@angular/core';
import { plural } from '../../format';
import { SourceLink } from '../../ui/source-link';
import { base, dir, type Finding } from './analog-model';
import { AnalogPageState } from './analog-page-state';

/** The Lint view of the Analog page: one card per rule, with where it fired and how to fix it. */
@Component({
  selector: 'div[appAnalogLint]',
  imports: [SourceLink],
  templateUrl: './analog-lint.html',
  styleUrl: './analog-lint.scss',
})
export class AnalogLint {
  private readonly page = inject(AnalogPageState);

  protected readonly plural = plural;
  protected readonly findings = this.page.findings;
  protected readonly lintCards = this.page.lintCards;
  protected readonly dir = dir;
  protected readonly base = base;

  protected tone(severity: Finding['severity']): 'bad' | 'warn' | 'info' {
    return severity === 'error' ? 'bad' : severity === 'warning' ? 'warn' : 'info';
  }
}
