import { Component, computed, input } from '@angular/core';

export interface ComingSoonInfo {
  id: 'nativescript' | 'capacitor' | 'analog' | 'angular-native';
  name: string;
  badge: string;
  heading: string;
  summary: string;
  color: string;
  plans: string[];
  plansTitle?: string;
  pr?: number;
  author?: { name: string; login: string };
  link?: { label: string; href: string };
}

@Component({
  selector: 'app-coming-soon',
  host: { '[style.--brand]': 'info().color' },
  template: `
    <section class="soon" aria-labelledby="soon-title">
      <div class="stage" aria-hidden="true">
        <span class="ring r1"></span>
        <span class="ring r2"></span>
        <span class="orbit o1"><span class="dot"></span></span>
        <span class="orbit o2"><span class="dot"></span></span>
        <span class="orbit o3"><span class="dot"></span></span>
        <div class="logo">
          @switch (info().id) {
            @case ('nativescript') {
              <svg viewBox="0 0 256 256" width="96" height="96">
                <path
                  fill="#3c5afd"
                  d="M237.248 18.752q18.061 18.06 18.748 45.247V192c-.457 18.12-6.707 33.207-18.748 45.247c-12.04 12.04-27.127 18.291-45.251 18.752H63.999q-27.187-.69-45.247-18.752C6.712 225.208.46 210.121 0 192.001V64q.69-27.187 18.752-45.247Q36.812.692 63.999 0h127.998c18.124.46 33.211 6.711 45.251 18.752m-17.655 103q-6.033-6.003-6.28-15.066V64q-.192-9.063-6.221-15.091c-4.02-4.023-9.054-6.093-15.095-6.22h-21.312v106.626L85.315 42.687H63.999c-6.042.128-11.072 2.198-15.091 6.221c-4.023 4.02-6.093 9.05-6.22 15.09v42.688q-.249 9.063-6.281 15.066q-6.03 5.996-15.091 6.246q9.062.255 15.09 6.25c4.024 4.002 6.115 9.024 6.281 15.066V192c.128 6.037 2.198 11.072 6.221 15.091q6.03 6.03 15.09 6.22h21.317V106.687l85.37 106.627h21.312c6.041-.128 11.076-2.202 15.095-6.221s6.093-9.054 6.22-15.09v-42.688q.249-9.063 6.281-15.066q6.03-5.995 15.091-6.25q-9.062-.25-15.09-6.246"
                />
              </svg>
            }
            @case ('angular-native') {
              <svg viewBox="0 0 32 32" width="88" height="88">
                <defs>
                  <linearGradient id="an-hero-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#f0224f" />
                    <stop offset="1" stop-color="#c4002d" />
                  </linearGradient>
                </defs>
                <path
                  d="M16 0C27.2 0 32 4.8 32 16S27.2 32 16 32 0 27.2 0 16 4.8 0 16 0Z"
                  fill="url(#an-hero-grad)"
                />
                <g transform="translate(6.4 6.4) scale(0.8)" fill="#fff">
                  <path d="M14.8486 0L23.138 16.8551L23.9996 3.99892L14.8486 0Z" />
                  <path
                    d="M16.9875 17.7114H7.01272L5.73926 20.627L12.0001 24L18.261 20.627L16.9875 17.7114Z"
                  />
                  <path d="M8.72168 13.9298H15.2812L11.9997 6.39575L8.72168 13.9298Z" />
                  <path d="M9.15103 0L0 3.99892L0.861556 16.8551L9.15103 0Z" />
                </g>
              </svg>
            }
            @case ('analog') {
              <svg viewBox="0 0 256 182" width="104" height="74">
                <path fill="#c30f2e" d="M152.228.001L48.455 181.046H256L152.228 0z" />
                <path fill="#dd0330" d="M88.314 26.967L0 181.52h176.628L88.315 26.967z" />
                <path fill="#fff" d="M18.167 135.294h220.236v-2.419H18.167z" />
                <path
                  fill="#fff"
                  d="M204.38 170.667c-.861 0-1.67-.358-2.348-1.034c-4.045-4.063-4.221-20.586-4.026-45.33c.11-13.521.257-32.043-1.9-33.504c-2.104.873-2.315 16.172-2.451 26.301c-.162 11.785-.327 23.98-2.242 30.189c-.57 1.84-1.306 3.525-2.786 3.39c-2.086-.185-2.76-3.48-4.317-16.478c-.647-5.4-1.317-10.98-2.101-13.14a11 11 0 0 0-.269-.66c-.835 1.889-1.8 7.079-2.47 10.682c-.927 4.976-1.803 9.676-2.9 11.726c-.847 1.575-2.19 3.63-4.067 3.231c-2.558-.537-3.323-5.693-3.552-8.719c0-25.455-3.33-28.417-3.997-28.753l-.107.081l-.162-.036c-2.377 1.038-2.506 9.294-2.627 17.276c-.096 5.856-.198 12.492-1.053 18.701c-1.108 8.05-2.448 9.603-4.115 9.507c-3.838-.262-3.95-13.482-3.95-14.987c0-.472.012-1.028.027-1.642c.074-3.076.205-8.8-1.687-10.604c-.25-.239-.603-.515-.879-.437c-1.347.339-2.745 4.714-3.209 6.153c-.147.457-.265.833-.364 1.09c-.078.214-.177.515-.294.88c-1.02 3.095-2.18 6.183-4.16 6.944c-.732.284-1.498.222-2.216-.183c-.953-.541-1.73-1.646-2.455-3.482c-.397-1.016-.735-2.046-1.082-3.081c-.419-1.263-.85-2.569-1.384-3.808c-.419-.965-1.464-1.4-2.796-1.164c-2.768.494-3.232 3.29-3.622 7.5c-.07.733-.137 1.452-.228 2.128c-.011.198-.501 6.38-.814 8.344c-.865 5.39-2.002 7.512-3.89 7.358c-4.66-.398-6.798-20.836-6.684-29.47c.088-6.592-1.104-9-1.818-9.382c-.074-.034-.189-.096-.46.095c-.843.571-1.594 2.348-1.363 4.215c2.566 20.32.674 43.592-3.96 48.833c-1.46 1.649-3.448 1.627-4.832.236c-4.049-4.064-4.218-20.586-4.026-45.33c.11-13.521.254-32.043-1.9-33.504c-2.105.873-2.311 16.172-2.45 26.301c-.163 11.785-.329 23.98-2.246 30.189c-.57 1.84-1.307 3.525-2.782 3.39c-2.091-.186-2.761-3.48-4.321-16.478c-.649-5.4-1.319-10.98-2.101-13.14c-.1-.273-.189-.49-.27-.66c-.832 1.889-1.796 7.079-2.466 10.682c-.927 4.976-1.803 9.676-2.904 11.726c-.846 1.575-2.19 3.63-4.063 3.231c-2.558-.537-3.324-5.693-3.552-8.719c-.003-25.455-3.33-28.417-3.997-28.753l-.106.081l-.166-.036c-2.374 1.038-2.503 9.293-2.629 17.276c-.091 5.856-.194 12.492-1.048 18.701c-1.107 8.05-2.437 9.618-4.111 9.507c-3.846-.262-3.958-13.482-3.958-14.987c0-.472.016-1.028.03-1.642c.074-3.076.207-8.8-1.685-10.604c-.25-.239-.603-.515-.88-.438c-1.347.34-2.75 4.715-3.206 6.155a47 47 0 0 1-.364 1.09q-.16.432-.298.875c-1.02 3.096-2.18 6.187-4.155 6.95c-.736.282-1.506.22-2.22-.185c-.953-.541-1.734-1.646-2.454-3.482c-.398-1.016-.74-2.046-1.083-3.081c-.42-1.263-.854-2.569-1.387-3.808c-.416-.965-1.465-1.4-2.797-1.164c-3.188.567-3.943 4.52-4.55 9.238l-.106.839l-2.411-.32l.114-.824c.527-4.137 1.328-10.39 6.53-11.31c2.446-.435 4.585.581 5.446 2.583c.578 1.34 1.031 2.695 1.466 4.008c.324.99.654 1.98 1.037 2.959c.674 1.708 1.197 2.15 1.392 2.257c1.218-.38 2.462-4.167 2.873-5.414c.13-.402.24-.732.328-.968c.085-.233.195-.571.328-.98c1.097-3.43 2.474-7.144 4.918-7.762c.747-.191 1.903-.166 3.157 1.035c2.665 2.544 2.525 8.48 2.433 12.41c-.014.59-.028 1.126-.028 1.583c0 6.272.93 10.655 1.64 12.16c.367-.77.998-2.63 1.598-7.007c.831-6.066.938-12.624 1.027-18.41c.161-10.24.275-17.663 3.982-19.408c.552-.339 1.469-.522 2.436-.033c3.586 1.803 5.326 11.885 5.326 30.817c.225 2.926 1.013 6.006 1.66 6.448c.004-.066.53-.39 1.394-2.01c.925-1.718 1.845-6.665 2.655-11.026c1.792-9.614 2.606-12.989 4.726-13.166c1.615-.158 2.362 1.896 2.676 2.76c.883 2.422 1.537 7.888 2.23 13.678c.54 4.49 1.31 10.902 2.094 13.497c.084-.228.18-.5.283-.836c1.815-5.878 1.98-17.887 2.14-29.507c.22-16.14.503-26.139 3.448-28.226a2.44 2.44 0 0 1 2.233-.316c3.448 1.144 3.714 11.254 3.519 35.8c-.14 17.799-.313 39.952 3.323 43.603c.317.32.542.32.622.32c.17 0 .413-.161.67-.452c3.681-4.162 6.01-26.022 3.372-46.927c-.328-2.602.677-5.337 2.392-6.514c.946-.652 2.036-.736 2.978-.232c2.145 1.14 3.187 5.024 3.102 11.546c-.15 11.387 2.584 24.714 4.37 26.842c.282-.471.842-1.763 1.379-5.145c.301-1.87.799-8.153.806-8.216c.09-.71.155-1.398.217-2.097c.369-3.924.82-8.804 5.613-9.654c2.444-.435 4.583.577 5.448 2.583c.577 1.34 1.027 2.695 1.46 4.008c.332.99.664 1.98 1.046 2.959c.67 1.708 1.197 2.15 1.387 2.257c1.218-.38 2.467-4.167 2.875-5.41c.132-.402.243-.737.328-.973c.088-.228.195-.57.324-.979c1.1-3.43 2.477-7.144 4.924-7.762c.74-.191 1.9-.166 3.154 1.035c2.665 2.543 2.526 8.48 2.437 12.41q-.029.792-.033 1.583c0 6.272.931 10.655 1.641 12.16c.365-.77.994-2.63 1.601-7.007c.832-6.066.931-12.624 1.027-18.41c.159-10.24.273-17.663 3.98-19.408c.55-.339 1.467-.522 2.44-.033c3.58 1.803 5.325 11.884 5.325 30.817c.224 2.926 1.012 6.006 1.656 6.448c.008-.066.526-.39 1.399-2.01c.923-1.718 1.84-6.665 2.653-11.026c1.786-9.614 2.602-12.989 4.722-13.166c1.62-.158 2.367 1.896 2.68 2.76c.88 2.422 1.535 7.888 2.233 13.678c.534 4.49 1.304 10.902 2.092 13.497c.08-.228.176-.5.28-.836c1.813-5.878 1.976-17.887 2.138-29.507c.216-16.14.504-26.139 3.448-28.226a2.45 2.45 0 0 1 2.234-.316c3.452 1.144 3.718 11.254 3.52 35.8c-.141 17.799-.314 39.952 3.319 43.603c.324.32.544.32.63.32c.165 0 .408-.161.662-.452c3.687-4.162 6.014-26.022 3.375-46.927c-.342-2.723.43-5.47 1.84-6.526c.71-.537 1.575-.647 2.37-.313c2.054.877 3.445 4.63 4.255 11.484c.339 2.87.641 5.974.931 9.036c.641 6.683 1.509 15.69 2.684 17.67c.36-.46 1.096-1.704 2.19-5.038l2.307.753c-1.696 5.157-3.026 7.1-4.755 6.902c-2.69-.299-3.468-5.734-4.84-20.055c-.29-3.048-.59-6.132-.928-8.989c-1.03-8.74-2.782-9.532-2.801-9.54c-.342.174-1.137 1.992-.842 4.31c2.558 20.32.673 43.597-3.964 48.834c-.747.842-1.587 1.27-2.485 1.27"
                />
              </svg>
            }
            @case ('capacitor') {
              <svg viewBox="0 0 256 256" width="96" height="96">
                <path
                  fill="#53b9ff"
                  d="M39.863 54.115L.311 93.716l60.995 61.179L0 216.385l39.428 39.619l61.43-61.507l61.097 61.068l39.552-39.602z"
                />
                <path
                  fill="#119eff"
                  d="m140.517 154.896l-39.658 39.601l61.097 61.069l39.552-39.602z"
                />
                <path fill-opacity=".2" d="m140.517 154.896l-39.658 39.601l15.267 15.182z" />
                <path
                  fill="#53b9ff"
                  d="M194.57 100.985L256 39.478L216.431 0l-61.412 61.384L93.917.311L54.365 39.913L216.01 201.761l39.552-39.602z"
                />
                <path fill="#119eff" d="m115.36 100.987l39.659-39.602L93.917.313L54.365 39.914z" />
                <path fill-opacity=".2" d="m115.359 100.985l39.659-39.601l-15.271-15.186z" />
              </svg>
            }
          }
        </div>
      </div>

      <p class="badge"><span class="spark" aria-hidden="true">✦</span> {{ info().badge }}</p>
      <h2 id="soon-title">{{ info().heading }}</h2>
      <p class="summary">{{ info().summary }}</p>

      @if (info().author; as author) {
        <a
          class="author"
          [href]="'https://github.com/pangular-inspector/devtools/pull/' + info().pr"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            [src]="'https://github.com/' + author.login + '.png?size=96'"
            width="40"
            height="40"
            alt=""
          />
          <span class="who">
            <span class="by">Being built by</span>
            <strong>{{ author.name }}</strong>
            <span class="login">&#64;{{ author.login }} · PR #{{ info().pr }}</span>
          </span>
          <span class="go" aria-hidden="true">→</span>
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      }
      @if (info().link; as link) {
        <a class="author cta" [href]="link.href" target="_blank" rel="noopener noreferrer">
          <span class="who"
            ><strong>{{ link.label }}</strong></span
          >
          <span class="go" aria-hidden="true">→</span>
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      }

      <h3 class="plans-title">
        {{ plansTitle() }}
      </h3>
      <ul class="plans">
        @for (plan of info().plans; track plan; let i = $index) {
          <li [style.animation-delay.ms]="200 + i * 120">{{ plan }}</li>
        }
      </ul>
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      min-height: 100%;
      background: radial-gradient(
        60% 50% at 50% 18%,
        color-mix(in srgb, var(--brand) 22%, transparent),
        transparent 70%
      );
    }
    .soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 560px;
      margin: 0 auto;
      padding: 24px 0 40px;
      color: var(--text-2);
      text-align: center;
    }
    .stage {
      position: relative;
      display: grid;
      place-items: center;
      width: 180px;
      height: 180px;
      margin: 0 auto 16px;
    }
    .logo {
      position: relative;
      z-index: 2;
      display: grid;
      place-items: center;
      width: 116px;
      height: 116px;
      border-radius: 32px;
      background: var(--surface-2);
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--brand) 45%, transparent),
        0 20px 60px -10px color-mix(in srgb, var(--brand) 70%, transparent);
      animation: float 4s ease-in-out infinite;
    }
    .ring {
      position: absolute;
      inset: 30px;
      border-radius: 50%;
      border: 1px solid color-mix(in srgb, var(--brand) 60%, transparent);
      animation: pulse 3s ease-out infinite;
    }
    .r2 {
      animation-delay: 1.5s;
    }
    .orbit {
      position: absolute;
      inset: 0;
      animation: spin 9s linear infinite;
    }
    .o2 {
      inset: 18px;
      animation-duration: 6s;
      animation-direction: reverse;
    }
    .o3 {
      inset: 40px;
      animation-duration: 12s;
    }
    .dot {
      position: absolute;
      top: -4px;
      left: 50%;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      border-radius: 50%;
      background: var(--brand);
      box-shadow: 0 0 12px var(--brand);
    }
    .o2 .dot {
      width: 6px;
      height: 6px;
      background: var(--accent);
      box-shadow: 0 0 10px var(--accent);
    }
    .o3 .dot {
      width: 4px;
      height: 4px;
      background: var(--text-strong);
    }
    .badge {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      margin: 0 0 12px;
      padding: 0 12px;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--brand) 55%, transparent);
      border-radius: 99px;
      background: color-mix(in srgb, var(--brand) 14%, var(--surface));
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .badge::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        transparent 20%,
        rgba(255, 255, 255, 0.2) 50%,
        transparent 80%
      );
      transform: translateX(-100%);
      animation: shimmer 2.8s ease-in-out infinite;
    }
    .spark {
      color: var(--accent);
      animation: twinkle 1.6s ease-in-out infinite;
    }
    h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 28px;
      line-height: 1.2;
      letter-spacing: -0.02em;
      text-wrap: balance;
      overflow-wrap: anywhere;
    }
    .summary {
      max-width: 480px;
      margin: 12px 0 24px;
      font-size: 14px;
      line-height: 1.6;
      text-wrap: pretty;
    }
    .author {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      max-width: 100%;
      min-height: 44px;
      padding: 8px 16px 8px 8px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      text-align: left;
      text-decoration: none;
      transition:
        border-color 0.2s var(--ease),
        background-color 0.2s var(--ease),
        transform 0.2s var(--ease);
    }
    .author:hover {
      border-color: color-mix(in srgb, var(--brand) 70%, transparent);
      background: var(--surface-2);
      transform: translateY(-2px);
    }
    .author:active {
      transform: none;
    }
    .author:focus-visible {
      @include m.focus-ring;
    }
    .cta {
      padding: 8px 16px;
    }
    .author img {
      flex: none;
      border-radius: 50%;
      background: var(--surface-3);
    }
    .who {
      display: grid;
      min-width: 0;
      line-height: 1.35;
    }
    .who strong {
      overflow: hidden;
      color: var(--text-strong);
      font-size: 14px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .by,
    .login {
      overflow: hidden;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .go {
      flex: none;
      margin-left: 4px;
      color: var(--brand);
      font-size: 16px;
      transition:
        transform 0.2s var(--ease),
        color 0.2s var(--ease);
    }
    .author:hover .go,
    .author:focus-visible .go {
      transform: translateX(3px);
    }
    .plans-title {
      @include m.label;
      width: 100%;
      max-width: 440px;
      margin: 32px 0 12px;
      text-align: left;
    }
    .plans {
      display: grid;
      gap: 8px;
      width: 100%;
      max-width: 440px;
      margin: 0 auto;
      padding: 0;
      list-style: none;
      text-align: left;
    }
    .plans li {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
      line-height: 20px;
      overflow-wrap: anywhere;
      opacity: 0;
      animation: rise 0.5s var(--ease) forwards;
    }
    .plans li::before {
      content: '';
      flex: none;
      width: 8px;
      height: 8px;
      margin-top: 6px;
      border-radius: 50%;
      background: var(--brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 20%, transparent);
    }
    @media (max-height: 640px) {
      .soon {
        padding-top: 12px;
      }
      .stage {
        width: 120px;
        height: 120px;
        margin-bottom: 8px;
      }
      .logo {
        width: 80px;
        height: 80px;
        border-radius: 22px;
      }
      .logo svg {
        width: 60px;
        height: auto;
      }
      .o3 {
        display: none;
      }
      h2 {
        font-size: 22px;
      }
    }
    @media (max-width: 420px) {
      h2 {
        font-size: 22px;
      }
      .author {
        align-self: stretch;
      }
      .who {
        flex: 1;
      }
    }
    @keyframes float {
      50% {
        transform: translateY(-10px) rotate(-2deg);
      }
    }
    @keyframes pulse {
      from {
        transform: scale(0.8);
        opacity: 0.9;
      }
      to {
        transform: scale(1.6);
        opacity: 0;
      }
    }
    @keyframes shimmer {
      60%,
      100% {
        transform: translateX(100%);
      }
    }
    @keyframes twinkle {
      50% {
        opacity: 0.35;
        transform: scale(0.8);
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .logo,
      .ring,
      .orbit,
      .badge::after,
      .spark {
        animation: none;
      }
      .ring {
        opacity: 0.3;
      }
      .plans li {
        opacity: 1;
        animation: none;
      }
      .author:hover,
      .author:hover .go {
        transform: none;
      }
    }
  `,
})
export class ComingSoon {
  readonly info = input.required<ComingSoonInfo>();
  readonly plansTitle = computed(() => {
    const info = this.info();
    return info.plansTitle ?? (info.link ? `In an ${info.name} app` : 'On the roadmap');
  });
}
