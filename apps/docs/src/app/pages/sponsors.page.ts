import {Component, inject} from '@angular/core';
import type {RouteMeta} from '@analogjs/router';
import {LayoutMode} from '../layout-mode.service';
import {SponsorList} from '../components/sponsor-list';
import siteConfig from '../../ngmd.config';

export const routeMeta: RouteMeta = {
  title: 'Sponsors',
};

@Component({
  selector: 'app-sponsors',
  imports: [SponsorList],
  template: `
    <article class="mx-auto max-w-3xl px-4 sm:px-8 py-8">
      <h1 class="text-3xl font-bold tracking-tight">Sponsors</h1>
      <p class="mt-4 text-zinc-700 dark:text-zinc-300">
        If {{ name }} helps your work, please consider
        <a
          [href]="sponsorUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium underline underline-offset-4 hover:text-[color:var(--accent)]"
          >sponsoring the project on GitHub</a
        >. Your support keeps development going.
      </p>

      <h2 id="current-sponsors" class="mt-10 text-xl font-semibold tracking-tight">
        Thanks to our current sponsors
      </h2>
      <div class="mt-4">
        <app-sponsor-list [size]="80" [showNames]="true" />
      </div>

      <h2 id="become-a-sponsor" class="mt-10 text-xl font-semibold tracking-tight">
        Become a sponsor
      </h2>
      <p class="mt-4 text-zinc-700 dark:text-zinc-300">
        Sponsorships go through GitHub Sponsors. New sponsors are added to this page and to the
        README.
      </p>
      <a
        [href]="sponsorUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-4 inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold bg-[color:var(--accent)] text-[color:var(--accent-fg)] hover:opacity-90"
      >
        Sponsor on GitHub
      </a>
    </article>
  `,
})
export default class SponsorsPage {
  protected readonly name = siteConfig.site.name;
  protected readonly sponsorUrl = siteConfig.site.links?.sponsor ?? '';

  constructor() {
    inject(LayoutMode).chromeHidden.set(false);
  }
}
