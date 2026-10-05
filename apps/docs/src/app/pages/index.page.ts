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
import {RouterLink} from '@angular/router';
import {
  LucideDynamicIcon,
  type LucideIconInput,
  LucideArrowRight,
  LucideBox,
  LucideCheck,
  LucideCompass,
  LucideCopy,
  LucideDatabase,
  LucideFileText,
  LucideHeart,
  LucideLayers,
  LucideServer,
  LucideShieldCheck,
  LucideSparkles,
  LucideZap,
} from '@lucide/angular';
import {GithubIcon} from '../ui/github-icon';
import {DiscordIcon} from '../ui/discord-icon';
import {SponsorList} from '../components/sponsor-list';
import {animate, stagger} from 'motion';
import siteConfig from '../../ngmd.config';
import {ToastService} from '../services/toast/toast.service';
import {writeToClipboard} from '../utils/clipboard';

@Component({
  selector: 'app-home',
  imports: [RouterLink, LucideDynamicIcon, GithubIcon, DiscordIcon, SponsorList],
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
      <div class="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
        <a
          [href]="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur px-4 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-6 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span class="text-yellow-400">★</span>
          Star on GitHub
          <svg [lucideIcon]="arrowIcon" class="size-3.5"></svg>
        </a>

        <h1 #hero class="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
          <span class="ngmd-hero-anim inline-block">One</span>&nbsp;<span
            class="ngmd-hero-anim inline-block"
            >devtool</span
          >&nbsp;<span class="ngmd-hero-anim inline-block">to</span>&nbsp;<span
            class="ngmd-hero-anim inline-block"
            >rule</span
          >
          <span class="ngmd-hero-anim block pb-2"
            >the
            <span
              class="bg-clip-text text-transparent ngmd-hero-gradient"
              [style.background-image]="angularGradient"
              >Angular</span
            >
            ecosystem</span
          >
        </h1>

        <p
          class="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed"
        >
          Components, signals, injectors, routes, forms and stores, live. In the page, from the CLI,
          in Chrome DevTools, and for your coding agent over MCP.
        </p>

        <a
          href="https://devfra.me"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-5 inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Built on
          <img src="/logos/devframe.svg" alt="" aria-hidden="true" class="size-5" />
          <span class="font-semibold text-zinc-700 dark:text-zinc-200">Devframe</span>
        </a>

        <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            routerLink="/getting-started/introduction"
            class="inline-flex items-center gap-2 rounded-md bg-zinc-900 dark:bg-zinc-50 px-6 py-3 text-base font-medium text-zinc-50 dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Get started
            <svg [lucideIcon]="arrowIcon" class="size-4"></svg>
          </a>
          <a
            routerLink="/agents/mcp-server"
            class="inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur px-6 py-3 text-base font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg [lucideIcon]="sparklesIcon" class="size-4"></svg>
            Connect an agent
          </a>
          <a
            [href]="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur px-6 py-3 text-base font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg ngmdGithubIcon class="size-4"></svg>
            View on GitHub
          </a>
        </div>

        <!-- Stack badges -->
        <div class="mt-14">
          <p class="text-xs font-medium tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-5">
            WORKS WITH
          </p>
          <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            @for (tech of stack; track tech.name) {
              <a
                [href]="tech.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/30 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
              >
                <img [src]="tech.logo" alt="" class="size-5 object-contain" />
                {{ tech.name }}
              </a>
            }
          </div>
          <p
            class="mt-8 text-[10px] font-medium tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-3"
          >
            COMING SOON
          </p>
          <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            @for (tech of comingSoon; track tech.name) {
              <a
                [href]="tech.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
              >
                <img [src]="tech.logo" alt="" class="size-4 object-contain opacity-70" />
                {{ tech.name }}
              </a>
            }
          </div>
        </div>
      </div>
    </section>

    <!-- Code preview -->
    <section
      class="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20"
    >
      <div class="mx-auto max-w-5xl px-6 py-20">
        <div class="text-center mb-10">
          <h2 class="text-3xl sm:text-4xl font-bold tracking-tight">A few lines to a live panel</h2>
          <p class="mt-3 text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            Mount the hub where your app runs, load the overlay, and open the panel on your page.
          </p>
        </div>
        <div class="grid gap-6 md:grid-cols-2">
          <div
            class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden"
          >
            <div
              class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-mono text-zinc-500 dark:text-zinc-400"
            >
              <span>src/server.ts</span>
              <span class="text-zinc-500 dark:text-zinc-400">typescript</span>
            </div>
            <pre
              tabindex="0"
              aria-label="src/server.ts and src/main.ts"
              class="p-4 text-sm overflow-x-auto text-zinc-700 dark:text-zinc-300 leading-relaxed"
            ><code><span class="text-[color:var(--accent-strong)] font-semibold">import</span> {{ '{' }} initPangularHub {{ '}' }}
  <span class="text-[color:var(--accent-strong)] font-semibold">from</span> '@pangular-inspector/devtools/hub';

<span class="text-[color:var(--accent-strong)] font-semibold">const</span> devtools = initPangularHub({{ '{' }} ws: false {{ '}' }});
app.use(devtools.nodeMiddleware);

<span class="text-zinc-500 dark:text-zinc-400">// src/main.ts</span>
<span class="text-[color:var(--accent-strong)] font-semibold">if</span> (typeof ngDevMode === 'undefined' || ngDevMode) <span class="text-[color:var(--accent-strong)] font-semibold">import</span>('@pangular-inspector/devtools/overlay');</code></pre>
          </div>
          <div
            class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden"
          >
            <div
              class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-mono text-zinc-500 dark:text-zinc-400"
            >
              <span>Browser → Components</span>
              <span class="text-[color:var(--accent-strong)]">live</span>
            </div>
            <div class="p-6 font-mono text-sm text-zinc-700 dark:text-zinc-300 space-y-1.5">
              <p>▾ &lt;app-root&gt;</p>
              <p class="pl-4">▾ &lt;app-search&gt;</p>
              <p class="pl-8 text-zinc-500 dark:text-zinc-400">
                query <span class="text-[color:var(--accent-strong)]">signal</span> = "Lisbon"
              </p>
              <p class="pl-8 text-zinc-500 dark:text-zinc-400">
                results <span class="text-[color:var(--accent-strong)]">computed</span> = 12 items
              </p>
              <p class="pl-4">▸ &lt;app-trip-list&gt;</p>
              <p class="pl-4">▸ &lt;router-outlet&gt;</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="mx-auto max-w-6xl px-6 py-20">
      <div class="text-center mb-12">
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight">Everything you can inspect</h2>
        <p class="mt-3 text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          One inspector per part of Angular, all reading the live page.
        </p>
      </div>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        @for (feature of features; track feature.title) {
          <a
            [routerLink]="feature.link"
            class="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            @if (feature.logo) {
              <img
                [src]="feature.logo"
                alt=""
                aria-hidden="true"
                class="size-6 mb-4 object-contain"
              />
            } @else {
              <svg
                [lucideIcon]="feature.icon"
                class="size-6 mb-4 text-[color:var(--accent)]"
                aria-hidden="true"
              ></svg>
            }
            <p class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {{ feature.title }}
            </p>
            <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {{ feature.description }}
            </p>
          </a>
        }
      </div>
    </section>

    <!-- Maintainers -->
    <section class="border-t border-zinc-200 dark:border-zinc-800">
      <div class="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight">Maintainers</h2>
        <p class="mt-3 text-zinc-600 dark:text-zinc-400">The people who build and look after it.</p>
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
    <section class="border-t border-zinc-200 dark:border-zinc-800">
      <div class="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight">Sponsors</h2>
        <p class="mt-3 text-zinc-600 dark:text-zinc-400">
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
    <section class="border-t border-zinc-200 dark:border-zinc-800">
      <div class="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight">Ready to look inside?</h2>
        <p class="mt-3 text-zinc-600 dark:text-zinc-400">
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
            <span class="overflow-x-auto whitespace-nowrap">{{ activeCmd() }}</span>
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
      </div>
    </section>
  `,
})
export default class Home implements AfterViewInit {
  private readonly toast = inject(ToastService);
  private copyTimer: ReturnType<typeof setTimeout> | undefined;
  readonly hero = viewChild<ElementRef<HTMLElement>>('hero');

  readonly angularGradient =
    'linear-gradient(to right, #d97706, #f5a524, #fcd34d, #f5a524, #d97706)';

  readonly arrowIcon = LucideArrowRight;
  readonly heartIcon = LucideHeart;
  readonly sparklesIcon = LucideSparkles;
  readonly copyIcon = LucideCopy;
  readonly checkIcon = LucideCheck;
  readonly githubUrl = siteConfig.site.githubUrl;
  readonly discordUrl = siteConfig.site.links?.discord;
  readonly sponsorUrl = siteConfig.site.links?.sponsor ?? '';

  readonly copied = signal('');

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

  readonly stack = [
    {name: 'Angular', url: 'https://angular.dev', logo: '/logos/angular.svg'},
    {
      name: 'AnalogJS',
      url: 'https://analogjs.org',
      logo: 'https://analogjs.org/img/logos/analog-logo.svg',
    },
    {name: 'Vite', url: 'https://vite.dev', logo: '/logos/vite.svg'},
    {
      name: 'Express',
      url: 'https://expressjs.com',
      logo: 'https://cdn.simpleicons.org/express/71717A',
    },
    {name: 'NgRx', url: 'https://ngrx.io', logo: 'https://cdn.simpleicons.org/ngrx/BA2BD2'},
  ];

  readonly maintainers = [
    {name: 'Erkam Yaman', login: 'erkamyaman', role: 'Lead maintainer'},
    {name: 'Santosh Yadav', login: 'santoshyadavdev', role: 'Maintainer'},
  ];

  readonly comingSoon = [
    {
      name: 'NativeScript',
      url: 'https://github.com/pangular-inspector/devtools/pull/16',
      logo: 'https://cdn.simpleicons.org/nativescript/3C5AFD',
    },
    {
      name: 'Capacitor',
      url: 'https://github.com/pangular-inspector/devtools/pull/21',
      logo: 'https://cdn.simpleicons.org/capacitor/119EFF',
    },
  ];

  readonly features: {
    icon: LucideIconInput;
    logo?: string;
    title: string;
    link: string;
    description: string;
  }[] = [
    {
      icon: LucideBox,
      title: 'Components',
      link: '/inspectors/components',
      description:
        'Every instance on the page with live inputs, outputs, change detection and injected services.',
    },
    {
      icon: LucideZap,
      title: 'Signals',
      link: '/inspectors/signals',
      description: 'The live signal graph of a component, with a value history for each signal.',
    },
    {
      icon: LucideLayers,
      title: 'Injectors',
      link: '/inspectors/injectors',
      description:
        'The injector hierarchy, the lookup path for any token, and the providers at each level.',
    },
    {
      icon: LucideCompass,
      title: 'Router',
      link: '/inspectors/router',
      description:
        'Every navigation as a story: who started it, redirects, timing, and the guard that decided it.',
    },
    {
      icon: LucideFileText,
      title: 'Forms',
      link: '/inspectors/forms',
      description:
        'Signal Forms, reactive and template-driven forms with readable errors, a timeline and a lint.',
    },
    {
      icon: LucideDatabase,
      logo: 'https://cdn.simpleicons.org/ngrx/BA2BD2',
      title: 'NgRx Store',
      link: '/inspectors/ngrx-store',
      description: 'Live signal stores and @ngrx/store state with change logs, diffs and restore.',
    },
    {
      icon: LucideServer,
      title: 'SSR & HTTP',
      link: '/inspectors/ssr-http',
      description:
        'SSR and client HTTP calls, fault injection, hydration stats and the TransferState payload.',
    },
    {
      icon: LucideSparkles,
      title: 'Agent tools',
      link: '/agents/tools',
      description:
        'More than 40 MCP tools, so your coding agent can read and act on the running app.',
    },
    {
      icon: LucideShieldCheck,
      title: 'Access and redaction',
      link: '/security',
      description:
        'The Vite plugin answers only your machine, the Express hub asks for a one-time code, and secret-looking values are redacted.',
    },
  ];
}
