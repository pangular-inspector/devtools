import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {RouterLink} from '@angular/router';
import {
  LucideDynamicIcon,
  type LucideIconInput,
  LucideActivity,
  LucideArrowRight,
  LucideBot,
  LucideCheck,
  LucideCopy,
  LucideFileCode,
  LucideHeart,
  LucideMonitorSmartphone,
  LucidePackage,
  LucidePlug,
  LucideServerCog,
  LucideShieldCheck,
  LucideTerminal,
  LucideZap,
} from '@lucide/angular';
import {GithubIcon} from '../ui/github-icon';
import {DiscordIcon} from '../ui/discord-icon';
import {SponsorList} from '../components/sponsor-list';
import {animate, stagger} from 'motion';
import siteConfig from '../../ngmd.config';
import {ToastService} from '../services/toast/toast.service';
import {writeToClipboard} from '../utils/clipboard';

interface Token {
  c: string;
  t: string;
}

interface RunWay {
  id: string;
  icon?: LucideIconInput;
  brandPath?: string;
  title: string;
  description: string;
  file: string;
  lang: 'ts' | 'bash';
  code: string;
}

const GOOGLE_CHROME_PATH =
  'M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z';

const TS_KEYWORDS = new Set(['import', 'from', 'const', 'if', 'typeof', 'false', 'true']);

function tokenize(line: string, lang: RunWay['lang']): Token[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith(lang === 'ts' ? '//' : '#')) return [{c: 'tk-c', t: line}];
  const pattern =
    lang === 'ts'
      ? /('[^']*'|"[^"]*")|([A-Za-z_$][\w$]*)(?=\s*\()|\b([A-Za-z_$][\w$]*)\b/g
      : /('[^']*'|"[^"]*")|(?<=^\s*)([\w.-]+)|(\s--?[A-Za-z][\w-]*)/g;
  const tokens: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(pattern)) {
    const index = m.index ?? 0;
    if (index > last) tokens.push({c: 'tk-u', t: line.slice(last, index)});
    const [text, str, fn, word] = m;
    const c = str
      ? 'tk-s'
      : lang === 'ts'
        ? TS_KEYWORDS.has(text)
          ? 'tk-k'
          : fn
            ? 'tk-f'
            : 'tk-v'
        : fn
          ? 'tk-f'
          : word
            ? 'tk-p'
            : '';
    tokens.push({c, t: text});
    last = index + text.length;
  }
  if (last < line.length) tokens.push({c: lang === 'ts' ? 'tk-u' : '', t: line.slice(last)});
  return tokens;
}

interface StackItem {
  name: string;
  url: string;
  logo: string;
  logoDark?: string;
  size: number;
}

@Component({
  selector: 'app-home',
  imports: [NgTemplateOutlet, RouterLink, LucideDynamicIcon, GithubIcon, DiscordIcon, SponsorList],
  template: `
    <!-- Spotlight backdrop -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-24 size-[60rem] rounded-full opacity-20 blur-3xl"
        [style.background-image]="angularGradient"
      ></div>
    </div>

    <!-- Hero -->
    <section class="relative">
      <div class="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 sm:pt-14 sm:pb-20">
        <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div class="text-center lg:text-left">
            <picture class="mb-6 block dark:hidden">
              <source media="(prefers-reduced-motion: reduce)" srcset="/logo-mark-light.svg" />
              <img
                src="/logo-mark-light-animated.svg"
                alt=""
                aria-hidden="true"
                width="121"
                height="97"
                class="mx-auto block h-[81px] w-auto -translate-x-0.5 sm:h-[97px] lg:mx-0 lg:-ml-[9px] lg:translate-x-0 motion-reduce:h-20 motion-reduce:translate-x-0 sm:motion-reduce:h-24 lg:motion-reduce:ml-0"
              />
            </picture>
            <picture class="mb-6 hidden dark:block">
              <source media="(prefers-reduced-motion: reduce)" srcset="/logo-mark-dark.svg" />
              <img
                src="/logo-mark-dark-animated.svg"
                alt=""
                aria-hidden="true"
                width="121"
                height="97"
                class="mx-auto block h-[81px] w-auto -translate-x-0.5 sm:h-[97px] lg:mx-0 lg:-ml-[9px] lg:translate-x-0 motion-reduce:h-20 motion-reduce:translate-x-0 sm:motion-reduce:h-24 lg:motion-reduce:ml-0"
              />
            </picture>
            <h1
              #hero
              class="text-4xl sm:text-6xl lg:text-[3.25rem] xl:text-[4.25rem] font-bold tracking-tight leading-[1.05] text-balance"
            >
              <span class="sm:block sm:whitespace-nowrap"
                ><span
                  class="ngmd-hero-anim inline-block pb-1 bg-clip-text text-transparent ngmd-hero-gradient"
                  [style.background-image]="angularGradient"
                  >Angular</span
                >&ngsp;<span class="ngmd-hero-anim inline-block">devtools</span></span
              >&ngsp;<span class="ngmd-hero-anim inline-block sm:block sm:whitespace-nowrap"
                >for you and</span
              >&ngsp;<span class="ngmd-hero-anim inline-block sm:block sm:whitespace-nowrap"
                >your agent</span
              >
            </h1>

            <p
              class="mx-auto mt-5 max-w-xl text-base sm:mt-6 sm:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed lg:mx-0"
            >
              Inspect components, signals, dependency injection, routes, forms and NgRx stores in
              your running app. In the browser, Chrome DevTools, the CLI, or your coding agent over
              MCP.
            </p>

            <div
              class="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:mt-10 lg:justify-start"
            >
              <a
                routerLink="/getting-started/introduction"
                class="inline-flex h-9 items-center gap-2 rounded-md bg-(--accent) px-3.5 text-sm font-medium text-(--accent-fg) hover:bg-(--accent-strong) transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              >
                Get started
                <svg [lucideIcon]="arrowIcon" class="size-4"></svg>
              </a>
              <a
                routerLink="/agents/mcp-server"
                class="inline-flex h-9 items-center gap-2 rounded-md border border-[#8e8e96] bg-transparent px-3.5 text-sm font-medium text-zinc-800 dark:border-[#63636c] dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              >
                <svg [lucideIcon]="botIcon" class="size-4" aria-hidden="true"></svg>
                Connect your agent
              </a>
              <a
                [href]="githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <svg ngmdGithubIcon class="size-5"></svg>
                View on GitHub
              </a>
            </div>
          </div>

          <div class="code-card group min-w-0">
            <div class="code-head">
              <span class="code-tab">
                <svg [lucideIcon]="fileCodeIcon" class="size-4 shrink-0" aria-hidden="true"></svg>
                <span>.mcp.json</span>
              </span>
              <button
                type="button"
                (click)="copySnippet()"
                [attr.aria-label]="copied() === heroSnippet ? 'Copied' : 'Copy code to clipboard'"
                class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-(--code-file) hover:bg-(--code-hover) transition lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent)"
              >
                <svg
                  [lucideIcon]="copied() === heroSnippet ? checkIcon : copyIcon"
                  class="size-4"
                ></svg>
              </button>
            </div>
            <pre
              tabindex="0"
              aria-label="Claude Code MCP config"
              class="code-body"
            ><code><span class="tk-u">{{ '{' }}</span>
  <span class="tk-p">"mcpServers"</span><span class="tk-u">:</span> <span class="tk-u">{{ '{' }}</span>
    <span class="tk-p">"pangular"</span><span class="tk-u">:</span> <span class="tk-u">{{ '{' }}</span>
      <span class="tk-p">"type"</span><span class="tk-u">:</span> <span class="tk-s">"http"</span><span class="tk-u">,</span>
      <span class="tk-p">"url"</span><span class="tk-u">:</span> <span class="tk-s">"http://localhost:4000/__devframes/__mcp"</span><span class="tk-u">,</span>
      <span class="tk-p">"headers"</span><span class="tk-u">:</span> <span class="tk-u">{{ '{' }}</span>
        <span class="tk-p">"Authorization"</span><span class="tk-u">:</span> <span class="tk-s">"Bearer \${{ '{' }}PANGULAR_MCP_TOKEN{{ '}' }}"</span><span class="tk-u">,</span>
        <span class="tk-p">"Origin"</span><span class="tk-u">:</span> <span class="tk-s">"http://localhost:4000"</span>
      <span class="tk-u">{{ '}' }}</span>
    <span class="tk-u">{{ '}' }}</span>
  <span class="tk-u">{{ '}' }}</span>
<span class="tk-u">{{ '}' }}</span></code></pre>
          </div>
        </div>

        <!-- Stack badges -->
        <div class="mt-12 text-center sm:mt-14">
          <p class="text-xs font-medium tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-5">
            WORKS WITH
          </p>
          <ul
            class="mx-auto grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 xl:flex xl:max-w-none xl:flex-nowrap xl:justify-center"
            aria-label="Works with"
          >
            @for (tech of stack; track tech.name) {
              <li class="flex">
                <a [routerLink]="tech.url" class="w-full px-2.5 sm:px-4 {{ badgeClass }}">
                  <ng-container
                    [ngTemplateOutlet]="logo"
                    [ngTemplateOutletContext]="{$implicit: tech}"
                  />
                  {{ tech.name }}
                </a>
              </li>
            }
            @for (tech of comingSoon; track tech.name) {
              <li class="flex">
                <a
                  [href]="tech.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-full border-dashed px-2.5 sm:px-4 {{ badgeClass }}"
                >
                  <ng-container
                    [ngTemplateOutlet]="logo"
                    [ngTemplateOutletContext]="{$implicit: tech}"
                  />
                  {{ tech.name }}
                  <span
                    class="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-zinc-600 dark:text-zinc-300"
                    >Soon</span
                  >
                </a>
              </li>
            }
          </ul>
        </div>

        <ng-template #logo let-tech>
          <span class="flex h-5 w-6 shrink-0 items-center justify-center">
            <img
              [src]="tech.logo"
              alt=""
              [style.height.px]="tech.size"
              [class]="tech.logoDark ? 'w-auto max-w-none dark:hidden' : 'w-auto max-w-none'"
            />
            @if (tech.logoDark) {
              <img
                [src]="tech.logoDark"
                alt=""
                [style.height.px]="tech.size"
                class="hidden w-auto max-w-none dark:block"
              />
            }
          </span>
        </ng-template>
      </div>
    </section>

    <!-- Why Pangular -->
    <section class="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div class="text-center mb-12">
        <p class="{{ labelClass }}">
          <span aria-hidden="true">//&ngsp;</span>Why Pangular<span aria-hidden="true"
            >&ngsp;//</span
          >
        </p>
        <h2 class="{{ titleClass }}">One inspector for all of Angular</h2>
        <p class="mx-auto {{ descriptionClass }}">
          The same live view of your app, wherever it runs and whoever is asking: you in the browser
          or your agent over MCP.
        </p>
      </div>
      <ul class="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
        @for (reason of reasons; track reason.title) {
          <li
            class="group relative flex rounded-lg bg-white ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:ring-zinc-800 dark:hover:bg-zinc-900/60 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-(--accent)/40 has-[a:focus-visible]:ring-(--accent)"
          >
            <div class="flex flex-col p-4 sm:p-6">
              <span class="mb-4 {{ iconTileClass }}">
                <svg
                  [lucideIcon]="reason.icon"
                  class="size-5 text-[color:var(--accent)]"
                  aria-hidden="true"
                ></svg>
              </span>
              <h3 class="text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                <a
                  [routerLink]="reason.link"
                  class="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
                  >{{ reason.title }}</a
                >
              </h3>
              <p class="mt-1 text-sm leading-relaxed text-pretty text-zinc-600 dark:text-zinc-400">
                {{ reason.description }}
              </p>
            </div>
          </li>
        }
      </ul>
    </section>

    <!-- Ways to run -->
    <section>
      <div
        class="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16"
      >
        <div class="min-w-0 space-y-10">
          <div>
            <p class="{{ labelClass }}">
              <span aria-hidden="true">//&ngsp;</span>Ways to run<span aria-hidden="true"
                >&ngsp;//</span
              >
            </p>
            <h2 class="{{ titleClass }}">Use it the way you work</h2>
            <p class="{{ descriptionClass }}">
              The same inspectors run in your app, in Chrome DevTools, from the CLI, as a static
              report or in your coding agent.
              <span class="whitespace-nowrap"
                ><a routerLink="/getting-started/installation" class="{{ linkClass }}"
                  >Read the installation guide</a
                >.</span
              >
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Ways to run"
            aria-orientation="vertical"
            class="space-y-2"
            (keydown)="onRunKeydown($event)"
          >
            @for (way of runWays; track way.id) {
              <button
                type="button"
                role="tab"
                [id]="'run-tab-' + way.id"
                aria-controls="run-panel"
                [attr.aria-selected]="activeRun() === way.id"
                [tabIndex]="activeRun() === way.id ? 0 : -1"
                (click)="activeRun.set(way.id)"
                class="flex w-full gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) aria-selected:border-(--accent)/50 aria-selected:bg-white aria-selected:ring-1 aria-selected:ring-(--accent)/25 dark:aria-selected:bg-zinc-900/60 [&[aria-selected=false]]:border-transparent [&[aria-selected=false]]:hover:bg-white/70 dark:[&[aria-selected=false]]:hover:bg-zinc-900/40"
              >
                <span class="{{ iconTileClass }}">
                  @if (way.brandPath) {
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      class="size-5 text-[color:var(--accent)]"
                      aria-hidden="true"
                    >
                      <path [attr.d]="way.brandPath" />
                    </svg>
                  } @else if (way.icon) {
                    <svg
                      [lucideIcon]="way.icon"
                      class="size-5 text-[color:var(--accent)]"
                      aria-hidden="true"
                    ></svg>
                  }
                </span>
                <span class="min-w-0">
                  <span
                    class="block text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100"
                    >{{ way.title }}</span
                  >
                  <span
                    class="mt-1 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
                    >{{ way.description }}</span
                  >
                </span>
              </button>
            }
          </div>
        </div>
        <div
          id="run-panel"
          role="tabpanel"
          [attr.aria-labelledby]="'run-tab-' + activeRun()"
          class="code-card group min-w-0 lg:self-center"
          [style.--run-lines]="maxRunLines"
        >
          <div class="code-head">
            <span class="code-tab">
              <svg
                [lucideIcon]="activeWay().lang === 'ts' ? fileCodeIcon : terminalIcon"
                class="size-4 shrink-0"
                aria-hidden="true"
              ></svg>
              <span>{{ activeWay().file }}</span>
            </span>
            <button
              type="button"
              (click)="copySnippet(activeWay().code)"
              [attr.aria-label]="
                copied() === activeWay().code ? 'Copied' : 'Copy code to clipboard'
              "
              class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-(--code-file) hover:bg-(--code-hover) transition lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent)"
            >
              <svg
                [lucideIcon]="copied() === activeWay().code ? checkIcon : copyIcon"
                class="size-4"
              ></svg>
            </button>
          </div>
          <pre
            tabindex="0"
            [attr.aria-label]="activeWay().title + ' code'"
            class="code-body run-body"
          ><code>@for (line of activeLines(); track $index) {<span class="block min-h-5">@for (tok of line; track $index) {<span [class]="tok.c">{{ tok.t }}</span>}</span>}</code></pre>
        </div>
      </div>
    </section>

    <!-- Maintainers -->
    <section>
      <div class="mx-auto max-w-3xl px-6 py-20 text-center">
        <p class="{{ labelClass }}">
          <span aria-hidden="true">//&ngsp;</span>Team<span aria-hidden="true">&ngsp;//</span>
        </p>
        <h2 class="{{ titleClass }}">Maintainers</h2>
        <p class="mx-auto {{ descriptionClass }}">The people who build and look after it.</p>
        <div class="mt-8 flex flex-wrap justify-center gap-6">
          @for (m of maintainers; track m.login) {
            <a
              [href]="'https://github.com/' + m.login"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-8 py-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <img
                [src]="'https://github.com/' + m.login + '.png?size=160'"
                alt=""
                width="80"
                height="80"
                class="size-20 rounded-full"
              />
              <span class="text-base font-semibold text-zinc-900 dark:text-zinc-100">{{
                m.name
              }}</span>
              <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">{{ m.role }}</span>
              <span class="text-sm text-zinc-500 dark:text-zinc-400">&#64;{{ m.login }}</span>
            </a>
          }
        </div>
      </div>
    </section>

    <!-- Sponsors -->
    <section>
      <div class="mx-auto max-w-3xl px-6 py-20 text-center">
        <p class="{{ labelClass }}">
          <span aria-hidden="true">//&ngsp;</span>Support<span aria-hidden="true">&ngsp;//</span>
        </p>
        <h2 class="{{ titleClass }}">Sponsors</h2>
        <p class="mx-auto {{ descriptionClass }}">
          Thanks to the current sponsors. Your support keeps development going.
        </p>
        <div class="mt-8 flex justify-center">
          <app-sponsor-list />
        </div>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            [href]="sponsorUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-md border border-pink-200 dark:border-pink-900/60 bg-pink-50 dark:bg-pink-950/40 px-5 py-2.5 text-sm font-medium text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-950/70 transition-colors"
          >
            <svg [lucideIcon]="heartIcon" class="size-4 fill-current" aria-hidden="true"></svg>
            Sponsor on GitHub
          </a>
          @if (discordUrl) {
            <a
              [href]="discordUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-md bg-[#5865f2] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#4752c4] transition-colors"
            >
              <svg ngmdDiscordIcon class="size-4" aria-hidden="true"></svg>
              Join the Discord
            </a>
          }
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section>
      <div class="mx-auto max-w-3xl px-6 py-20 text-center">
        <p class="{{ labelClass }}">
          <span aria-hidden="true">//&ngsp;</span>Get started<span aria-hidden="true"
            >&ngsp;//</span
          >
        </p>
        <h2 class="{{ titleClass }}">Look inside your running app</h2>
        <p class="mx-auto {{ descriptionClass }}">
          Install the package, mount the hub, and open the panel on your page.
        </p>
        <div
          class="mt-8 inline-block w-[34rem] max-w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden text-left"
        >
          <div
            role="tablist"
            aria-label="Package manager"
            class="flex border-b border-zinc-200 dark:border-zinc-800"
            (keydown)="onTabKeydown($event)"
          >
            @for (cmd of installCommands; track cmd.pm) {
              <button
                type="button"
                role="tab"
                [id]="'install-tab-' + cmd.pm"
                aria-controls="install-panel"
                [attr.aria-selected]="activePM() === cmd.pm"
                [tabIndex]="activePM() === cmd.pm ? 0 : -1"
                (click)="activePM.set(cmd.pm)"
                class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors aria-selected:border-[color:var(--accent)] aria-selected:text-[color:var(--accent-strong)] [&[aria-selected=false]]:border-transparent [&[aria-selected=false]]:text-zinc-500 dark:[&[aria-selected=false]]:text-zinc-400 [&[aria-selected=false]]:hover:text-zinc-900 dark:[&[aria-selected=false]]:hover:text-zinc-100"
              >
                <img [src]="cmd.logo" alt="" aria-hidden="true" class="size-4 object-contain" />
                {{ cmd.pm }}
              </button>
            }
          </div>
          <div
            id="install-panel"
            role="tabpanel"
            [attr.aria-labelledby]="'install-tab-' + activePM()"
            class="flex items-center gap-3 pl-4 pr-2 py-2.5 font-mono text-sm"
          >
            <span class="text-zinc-500 dark:text-zinc-400">$</span>
            <span tabindex="0" class="overflow-x-auto whitespace-nowrap">{{ activeCmd() }}</span>
            <button
              type="button"
              (click)="copyCmd(activeCmd())"
              [attr.aria-label]="copied() === activeCmd() ? 'Copied' : 'Copy install command'"
              class="ml-auto shrink-0 inline-flex items-center justify-center size-7 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <svg
                [lucideIcon]="copied() === activeCmd() ? checkIcon : copyIcon"
                class="size-3.5"
              ></svg>
            </button>
          </div>
        </div>
        <div class="mt-8">
          <a
            routerLink="/getting-started/installation"
            class="inline-flex items-center gap-2 text-base font-medium text-[color:var(--accent-strong)] hover:opacity-80"
          >
            Read the installation guide
            <svg [lucideIcon]="arrowIcon" class="size-4"></svg>
          </a>
        </div>
        <div class="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a
            href="https://devfra.me"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Built on
            <img src="/logos/devframe.svg" alt="" width="16" height="16" class="size-4 shrink-0" />
            <span class="font-medium text-zinc-700 dark:text-zinc-300">Devframe</span>
          </a>
          <a
            href="https://github.com/erkamyaman/ngmd"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Docs built with
            <img src="/logos/ngmd.svg" alt="" width="16" height="16" class="size-4 shrink-0" />
            <span class="font-medium text-zinc-700 dark:text-zinc-300">NgMd</span>
          </a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .code-card {
      --code-bg: #fffcf5;
      --code-head: #fbf3e2;
      --code-border: #eadfca;
      --code-accent: #d97706;
      --code-file: #44403c;
      --code-hover: rgb(217 119 6 / 0.12);
      --tk-fg: #1c1a17;
      --tk-k: #92400e;
      --tk-s: #a16207;
      --tk-v: #44403c;
      --tk-f: #c2410c;
      --tk-p: #78350f;
      --tk-u: #6b645c;
      --tk-c: #73685b;
      overflow: hidden;
      border: 1px solid var(--code-border);
      border-radius: 0.5rem;
      background: var(--code-bg);
    }
    :host-context(.dark) .code-card {
      --code-bg: #1c1a17;
      --code-head: #25221e;
      --code-border: #3a342b;
      --code-accent: #f59e0b;
      --code-file: #d6cfc2;
      --code-hover: rgb(251 191 36 / 0.12);
      --tk-fg: #ede6d8;
      --tk-k: #fbbf24;
      --tk-s: #fde68a;
      --tk-v: #e7dccb;
      --tk-f: #fdba74;
      --tk-p: #f5c98a;
      --tk-u: #a8a29e;
      --tk-c: #968c7e;
    }
    .code-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0 0.5rem 0 1rem;
      border-bottom: 1px solid var(--code-border);
      background: var(--code-head);
    }
    .code-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: -1px;
      padding: 0.625rem 0.125rem;
      border-bottom: 2px solid var(--code-accent);
      color: var(--code-file);
      font-family:
        Geist Mono,
        ui-monospace,
        monospace;
      font-size: 13px;
      line-height: 1.25rem;
    }
    .code-body {
      overflow-x: auto;
      padding: 0.875rem 1rem;
      color: var(--tk-fg);
      font-family:
        Geist Mono,
        ui-monospace,
        monospace;
      font-size: 13px;
      line-height: 1.25rem;
    }
    @media (min-width: 64rem) {
      .run-body {
        min-height: calc(var(--run-lines) * 1.25rem + 1.75rem);
      }
    }
    .code-body:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .code-body ::selection {
      background: rgb(251 191 36 / 0.3);
    }
    .tk-k {
      color: var(--tk-k);
    }
    .tk-s {
      color: var(--tk-s);
    }
    .tk-v {
      color: var(--tk-v);
    }
    .tk-f {
      color: var(--tk-f);
    }
    .tk-p {
      color: var(--tk-p);
    }
    .tk-u {
      color: var(--tk-u);
    }
    .tk-c {
      color: var(--tk-c);
    }
  `,
})
export default class Home implements AfterViewInit {
  private readonly toast = inject(ToastService);
  private copyTimer: ReturnType<typeof setTimeout> | undefined;
  readonly hero = viewChild<ElementRef<HTMLElement>>('hero');

  readonly angularGradient = 'linear-gradient(to right, #f0060b, #cc26d5, #7702ff)';

  readonly badgeClass =
    'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)';

  readonly arrowIcon = LucideArrowRight;
  readonly heartIcon = LucideHeart;
  readonly copyIcon = LucideCopy;
  readonly checkIcon = LucideCheck;
  readonly githubUrl = siteConfig.site.githubUrl;
  readonly discordUrl = siteConfig.site.links?.discord;
  readonly sponsorUrl = siteConfig.site.links?.sponsor ?? '';

  readonly copied = signal('');

  readonly labelClass =
    'font-mono text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--accent-strong)]';
  readonly titleClass = 'mt-6 text-3xl font-medium leading-tight tracking-tight sm:text-4xl';
  readonly descriptionClass =
    'mt-4 max-w-lg text-base leading-relaxed text-zinc-600 dark:text-zinc-400';
  readonly linkClass =
    'font-medium text-[color:var(--accent-strong)] underline decoration-1 underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)';

  readonly iconTileClass =
    'flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800';

  readonly terminalIcon = LucideTerminal;
  readonly botIcon = LucideBot;
  readonly fileCodeIcon = LucideFileCode;

  readonly runWays: RunWay[] = [
    {
      id: 'app',
      icon: LucideServerCog,
      title: 'In your app',
      description: 'Mount the hub on your server and load the overlay in the browser.',
      file: 'src/server.ts',
      lang: 'ts',
      code: `import {initPangularHub} from '@pangular-inspector/devtools/hub';

const devtools = initPangularHub({ws: false});
app.use(devtools.nodeMiddleware);

// src/main.ts
if (typeof ngDevMode === 'undefined' || ngDevMode) {
  import('@pangular-inspector/devtools/overlay');
}`,
    },
    {
      id: 'extension',
      brandPath: GOOGLE_CHROME_PATH,
      title: 'Chrome extension',
      description: 'Open the Pangular Inspector panel in Chrome DevTools, next to Elements.',
      file: 'Terminal',
      lang: 'bash',
      code: `git clone https://github.com/pangular-inspector/devtools.git
cd devtools && pnpm install
pnpm extension:build

# chrome://extensions: Developer mode, Load unpacked, extension/
# Your app still mounts the hub and loads the overlay`,
    },
    {
      id: 'cli',
      icon: LucideTerminal,
      title: 'CLI',
      description: 'Scan your source and serve the panel without starting your app.',
      file: 'Terminal',
      lang: 'bash',
      code: `# From the root of your Angular workspace
npx @pangular-inspector/devtools dev

# Or point it at another project folder
npx @pangular-inspector/devtools dev --root ./travel-app`,
    },
    {
      id: 'mcp',
      icon: LucideBot,
      title: 'MCP',
      description: 'Give your coding agent the source scan tools over stdio.',
      file: 'Terminal',
      lang: 'bash',
      code: `# Claude Code
claude mcp add pangular -- \\
  npx @pangular-inspector/devtools mcp --root /path/to/your-app`,
    },
    {
      id: 'report',
      icon: LucidePackage,
      title: 'Static report',
      description: 'Build an offline snapshot of the scan to open or host anywhere.',
      file: 'Terminal',
      lang: 'bash',
      code: `npx @pangular-inspector/devtools build --outDir dist-report

# Static files: open them offline or host them`,
    },
  ];

  readonly maxRunLines = Math.max(...this.runWays.map((way) => way.code.split('\n').length));

  readonly activeRun = signal('app');
  readonly activeWay = computed(
    () => this.runWays.find((w) => w.id === this.activeRun()) ?? this.runWays[0],
  );
  readonly activeLines = computed(() => {
    const way = this.activeWay();
    return way.code.split('\n').map((line) => tokenize(line, way.lang));
  });

  protected onRunKeydown(event: KeyboardEvent): void {
    const ids = this.runWays.map((w) => w.id);
    const index = ids.indexOf(this.activeRun());
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const next = forward
      ? (index + 1) % ids.length
      : back
        ? (index - 1 + ids.length) % ids.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? ids.length - 1
            : -1;
    if (next === -1) return;
    event.preventDefault();
    this.activeRun.set(ids[next]);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`#run-tab-${ids[next]}`)
      ?.focus();
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copyTimer));
  }

  readonly installCommands = [
    {
      pm: 'npm',
      cmd: 'npm install @pangular-inspector/devtools devframe',
      logo: 'https://cdn.simpleicons.org/npm/CB3837',
    },
    {
      pm: 'pnpm',
      cmd: 'pnpm add @pangular-inspector/devtools devframe',
      logo: 'https://cdn.simpleicons.org/pnpm/F69220',
    },
    {
      pm: 'yarn',
      cmd: 'yarn add @pangular-inspector/devtools devframe',
      logo: 'https://cdn.simpleicons.org/yarn/2C8EBB',
    },
    {
      pm: 'bun',
      cmd: 'bun add @pangular-inspector/devtools devframe',
      logo: 'https://bun.sh/logo.svg',
    },
  ];

  readonly activePM = signal('npm');
  readonly activeCmd = computed(
    () => this.installCommands.find((c) => c.pm === this.activePM())?.cmd ?? '',
  );

  protected onTabKeydown(event: KeyboardEvent): void {
    const pms = this.installCommands.map((c) => c.pm);
    const index = pms.indexOf(this.activePM());
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % pms.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + pms.length) % pms.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? pms.length - 1
              : -1;
    if (next === -1) return;
    event.preventDefault();
    this.activePM.set(pms[next]);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`#install-tab-${pms[next]}`)
      ?.focus();
  }

  readonly heroSnippet = `{
  "mcpServers": {
    "pangular": {
      "type": "http",
      "url": "http://localhost:4000/__devframes/__mcp",
      "headers": {
        "Authorization": "Bearer \${PANGULAR_MCP_TOKEN}",
        "Origin": "http://localhost:4000"
      }
    }
  }
}
`;

  async copySnippet(snippet = this.heroSnippet): Promise<void> {
    if (!(await writeToClipboard(snippet))) {
      this.toast.error('Could not copy code.');
      return;
    }
    this.toast.success('Code copied to clipboard.');
    this.copied.set(snippet);
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(''), 1500);
  }

  async copyCmd(cmd: string): Promise<void> {
    if (!(await writeToClipboard(cmd))) {
      this.toast.error('Could not copy command.');
      return;
    }
    this.toast.success('Command copied to clipboard.');
    this.copied.set(cmd);
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(''), 1500);
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const root = this.hero()?.nativeElement;
    if (!root) return;
    const parts = root.querySelectorAll<HTMLElement>('.ngmd-hero-anim');
    if (parts.length === 0) return;

    animate(
      parts,
      {opacity: [0, 1], transform: ['translateY(0.5em)', 'translateY(0)']},
      {duration: 1.1, delay: stagger(0.18), ease: [0.22, 1, 0.36, 1]},
    );
  }

  readonly stack: StackItem[] = [
    {name: 'Angular', url: '/getting-started/installation', logo: '/logos/angular.svg', size: 20},
    {name: 'AnalogJS', url: '/guides/analog', logo: '/logos/analog.svg', size: 17},
    {name: 'Vite', url: '/getting-started/vite', logo: '/logos/vite-mark.svg', size: 19},
    {
      name: 'Express',
      url: '/getting-started/express',
      logo: '/logos/express-light.svg',
      logoDark: '/logos/express-dark.svg',
      size: 16,
    },
    {
      name: 'NgRx',
      url: '/inspectors/ngrx-store',
      logo: '/logos/ngrx.svg',
      logoDark: '/logos/ngrx-dark.svg',
      size: 20,
    },
    {name: 'NativeScript', url: '/guides/nativescript', logo: '/logos/nativescript.svg', size: 17},
    {
      name: 'Angular Native',
      url: '/getting-started/angular-native',
      logo: '/logos/angular-native.svg',
      size: 17,
    },
  ];

  readonly maintainers = [
    {name: 'Erkam Yaman', login: 'erkamyaman', role: 'Lead maintainer'},
    {name: 'Santosh Yadav', login: 'santoshyadavdev', role: 'Maintainer'},
  ];

  readonly comingSoon: StackItem[] = [
    {
      name: 'Capacitor',
      url: 'https://github.com/pangular-inspector/devtools/pull/21',
      logo: '/logos/capacitor.svg',
      size: 16,
    },
  ];

  readonly reasons: {
    icon: LucideIconInput;
    title: string;
    link: string;
    description: string;
  }[] = [
    {
      icon: LucideActivity,
      title: 'Live, not snapshots',
      link: '/inspectors/components',
      description: "Reads your running app through Angular's own debug APIs, as it changes.",
    },
    {
      icon: LucideBot,
      title: 'Your agent sees it too',
      link: '/agents/mcp-server',
      description: 'The same data over MCP, so coding agents can inspect the app and act on it.',
    },
    {
      icon: LucideMonitorSmartphone,
      title: 'Wherever Angular runs',
      link: '/getting-started/installation',
      description:
        'Browser apps with SSR and NgRx, Analog, NativeScript and Angular Native, with Capacitor coming soon.',
    },
    {
      icon: LucideZap,
      title: 'Built for signals',
      link: '/inspectors/signals',
      description:
        'The live signal graph with its effects and value history, plus NgRx Signal Store state.',
    },
    {
      icon: LucidePlug,
      title: 'Mount it anywhere',
      link: '/getting-started/introduction',
      description: 'Express, Vite, the Chrome extension, the CLI or a static report.',
    },
    {
      icon: LucideShieldCheck,
      title: 'Private by default',
      link: '/security',
      description: 'Local-only access, a one-time code, and secret-looking values redacted.',
    },
  ];
}
