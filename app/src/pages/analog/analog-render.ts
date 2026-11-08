import { Component, computed, inject } from '@angular/core';
import { plural } from '../../format';
import { rpcTry as call } from '../../rpc';
import { SourceLink } from '../../ui/source-link';
import { AnalogBuild } from '../analog-build';
import {
  MODE_LABEL,
  base,
  dir,
  modeLabel,
  statusClass,
  type RenderCheck,
  type RenderRow,
} from './analog-model';
import { AnalogPageState } from './analog-page-state';

/** The Render view of the Analog page: the render mode of each route, the prerender plan and the build. */
@Component({
  selector: 'div[appAnalogRender]',
  imports: [SourceLink, AnalogBuild],
  templateUrl: './analog-render.html',
  styleUrl: './analog-render.scss',
})
export class AnalogRender {
  private readonly page = inject(AnalogPageState);

  protected readonly plural = plural;
  protected readonly rpc = this.page.rpc;
  protected readonly plan = this.page.plan;
  protected readonly renderRows = this.page.renderRows;
  protected readonly checks = this.page.checks;
  protected readonly dir = dir;
  protected readonly base = base;
  protected readonly modeLabel = modeLabel;
  protected readonly statusClass = statusClass;

  protected readonly modeCounts = computed(() =>
    (['ssr', 'ssg', 'cached', 'client', 'redirect'] as const)
      .map((mode) => ({
        mode,
        label: MODE_LABEL[mode],
        count: this.renderRows().filter((r) => r.mode === mode).length,
      }))
      .filter((m) => m.count),
  );

  protected mismatch(row: RenderRow): boolean {
    if (!row.last?.render || row.mode === 'redirect') return false;
    return row.mode === 'client' ? row.last.render !== 'client' : row.last.render === 'client';
  }

  protected async checkRender(path: string) {
    this.checks.update((all) => ({ ...all, [path]: 'running' }));
    const check = await call<RenderCheck>(this.rpc(), 'analog-render-check', path);
    this.checks.update((all) => ({
      ...all,
      [path]: check ?? { path, error: 'No answer from the devtools server.' },
    }));
  }
}
