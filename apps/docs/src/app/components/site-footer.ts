import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {LucideDynamicIcon, LucideHeart} from '@lucide/angular';
import {GithubIcon} from '../ui/github-icon';
import {DiscordIcon} from '../ui/discord-icon';
import siteConfig from '../../ngmd.config';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, LucideDynamicIcon, GithubIcon, DiscordIcon],
  template: `
    <footer
      class="border-t border-zinc-200 dark:border-zinc-800 py-6 px-4 sm:px-6 text-sm text-zinc-500 dark:text-zinc-400"
    >
      <div class="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>© {{ year }} {{ name }} contributors. Released under the MIT License.</span>
        <nav class="flex items-center gap-2" aria-label="Project links">
          @for (link of footerNav; track link.href) {
            <a
              [routerLink]="link.href"
              class="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              [attr.aria-label]="link.label"
              [title]="link.label"
            >
              <img
                src="/logo-mark-light.svg"
                alt=""
                width="18"
                height="16"
                class="h-4 w-auto dark:hidden"
              />
              <img
                src="/logo-mark-dark.svg"
                alt=""
                width="18"
                height="16"
                class="hidden h-4 w-auto dark:block"
              />
            </a>
          }
          @if (sponsorUrl) {
            <a
              [href]="sponsorUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              aria-label="Sponsor {{ name }}"
              title="Sponsor"
            >
              <svg [lucideIcon]="heartIcon" class="size-4" aria-hidden="true"></svg>
            </a>
          }
          @if (discordUrl) {
            <a
              [href]="discordUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              aria-label="{{ name }} on Discord"
              title="Discord"
            >
              <svg ngmdDiscordIcon class="size-4" aria-hidden="true"></svg>
            </a>
          }
          <a
            [href]="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            aria-label="{{ name }} on GitHub"
            title="GitHub"
          >
            <svg ngmdGithubIcon class="size-4" aria-hidden="true"></svg>
          </a>
        </nav>
      </div>
    </footer>
  `,
})
export class SiteFooter {
  readonly year = new Date().getFullYear();
  readonly name = siteConfig.site.name;
  readonly footerNav = siteConfig.footerNav ?? [];
  readonly sponsorUrl = siteConfig.site.links?.sponsor;
  readonly discordUrl = siteConfig.site.links?.discord;
  readonly githubUrl = siteConfig.site.githubUrl;
  readonly heartIcon = LucideHeart;
}
