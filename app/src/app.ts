import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { connectDevframe, type DevframeRpcClient } from 'devframe/client';
import { Dashboard } from './pages/dashboard';
import { ComponentTree } from './pages/component-tree';
import { RouteInspector } from './pages/route-inspector';
import { SignalInspector } from './pages/signal-inspector';
import { DiInspector } from './pages/di-inspector';
import { StoreInspector } from './pages/store-inspector';
import { FormsInspector } from './pages/forms-inspector';
import { PipesInspector } from './pages/pipes-inspector';
import type { Tab, Tabs } from './types/tab.types';
import { AnalogInspector } from './pages/analog-inspector';
import { NetworkInspector } from './pages/network-inspector';
import { ComingSoon, type ComingSoonInfo } from './pages/coming-soon';
import { TabIcon } from './pages/tab-icon';
import { styleHubRail } from './hub-rail-style';
import { followHubDocks, selectHubDock } from './hub-dock-sync';
import { panelConfig, tabEnabled } from './devtools-config';
import { hostPageId } from './page-id';
import { initialTab, storeTab, storedTab } from './tab-memory';
import { detectBaseURL } from './base-url';
import { clearHighlightsOnHide } from './rpc';

const HUB_VIEWS = ['angular', 'ngrx', 'analog', 'nativescript', 'capacitor'] as const;

type View = (typeof HUB_VIEWS)[number];

const VIEW_TITLE: Record<View, string> = {
  angular: 'Angular',
  ngrx: 'NgRx Store',
  analog: 'Analog',
  nativescript: 'NativeScript',
  capacitor: 'Capacitor',
};

const VIEW_ACCENT: Partial<Record<View, string>> = {
  ngrx: '#d770e8',
  analog: '#ff5470',
  nativescript: '#8196ff',
  capacitor: '#53b9ff',
};

const VIEW_TAB: Partial<Record<View, Tab>> = { ngrx: 'store', analog: 'analog' };
const TAB_VIEW: Partial<Record<Tab, View>> = { store: 'ngrx', analog: 'analog' };

const COMING_SOON: Partial<Record<View, ComingSoonInfo>> = {
  nativescript: {
    id: 'nativescript',
    name: 'NativeScript',
    badge: 'Coming Soon',
    heading: 'NativeScript Support',
    summary:
      'Inspect NativeScript Angular apps running natively on iOS and Android, with the same tools.',
    color: '#3c5afd',
    plans: [
      'Native overlay that reports the component tree from the device',
      'Standalone devtools server your phone or simulator connects to',
      'Example NativeScript app to try it end to end',
    ],
    pr: 16,
    author: { name: 'Nathan Walker', login: 'NathanWalker' },
  },
  capacitor: {
    id: 'capacitor',
    name: 'Capacitor',
    badge: 'Coming Soon',
    heading: 'Capacitor Support',
    summary: 'Connect Ionic and Capacitor apps running in a device WebView back to these tools.',
    color: '#119eff',
    plans: [
      'Manual overlay start for apps that load from capacitor:// or a device',
      'Connection settings passed in, no cross-origin probing',
      'Setup guides for the Android emulator and iOS simulator',
    ],
    pr: 21,
    author: { name: 'Erkam Yaman', login: 'erkamyaman' },
  },
};

const NOT_ANALOG: ComingSoonInfo = {
  id: 'analog',
  name: 'Analog',
  badge: 'Not in this app',
  heading: 'This app doesn’t use Analog',
  summary:
    'In an Analog app this dock shows your file routes, server load() and API calls, render modes and route lint.',
  color: '#dd0330',
  plans: [
    'Which page, layout and .server.ts files render a URL',
    'Every load(), server function and API call with timing',
    'SSR, prerendered or client only, per page',
  ],
  link: { label: 'Get started with Analog', href: 'https://analogjs.org/docs/getting-started' },
};

function readView(): View | null {
  const view = new URLSearchParams(location.search).get('view');
  return HUB_VIEWS.find((known) => known === view) ?? null;
}

@Component({
  selector: 'app-root',
  host: {
    '[style.--accent]': 'viewAccent()',
    '(window:message)': 'inspectFromPanel($event)',
  },
  imports: [
    Dashboard,
    ComponentTree,
    RouteInspector,
    SignalInspector,
    DiInspector,
    StoreInspector,
    FormsInspector,
    PipesInspector,
    AnalogInspector,
    NetworkInspector,
    ComingSoon,
    TabIcon,
  ],
  template: `
    <header>
      <h1 class="brand">
        <span class="mark" [class.ng-mark]="view() === 'angular'">
          @if (view() === 'nativescript') {
            <svg width="22" height="22" viewBox="0 0 256 256" aria-hidden="true">
              <path
                fill="#3c5afd"
                d="M237.248 18.752q18.061 18.06 18.748 45.247V192c-.457 18.12-6.707 33.207-18.748 45.247c-12.04 12.04-27.127 18.291-45.251 18.752H63.999q-27.187-.69-45.247-18.752C6.712 225.208.46 210.121 0 192.001V64q.69-27.187 18.752-45.247Q36.812.692 63.999 0h127.998c18.124.46 33.211 6.711 45.251 18.752m-17.655 103q-6.033-6.003-6.28-15.066V64q-.192-9.063-6.221-15.091c-4.02-4.023-9.054-6.093-15.095-6.22h-21.312v106.626L85.315 42.687H63.999c-6.042.128-11.072 2.198-15.091 6.221c-4.023 4.02-6.093 9.05-6.22 15.09v42.688q-.249 9.063-6.281 15.066q-6.03 5.996-15.091 6.246q9.062.255 15.09 6.25c4.024 4.002 6.115 9.024 6.281 15.066V192c.128 6.037 2.198 11.072 6.221 15.091q6.03 6.03 15.09 6.22h21.317V106.687l85.37 106.627h21.312c6.041-.128 11.076-2.202 15.095-6.221s6.093-9.054 6.22-15.09v-42.688q.249-9.063 6.281-15.066q6.03-5.995 15.091-6.25q-9.062-.25-15.09-6.246"
              />
            </svg>
          } @else if (view() === 'capacitor') {
            <svg width="22" height="22" viewBox="0 0 256 256" aria-hidden="true">
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
          } @else if (view() === 'analog') {
            <svg width="24" height="17" viewBox="0 0 256 182" aria-hidden="true">
              <path fill="#c30f2e" d="M152.228.001L48.455 181.046H256L152.228 0z" />
              <path fill="#dd0330" d="M88.314 26.967L0 181.52h176.628L88.315 26.967z" />
              <path fill="#fff" d="M18.167 135.294h220.236v-2.419H18.167z" />
              <path
                fill="#fff"
                d="M204.38 170.667c-.861 0-1.67-.358-2.348-1.034c-4.045-4.063-4.221-20.586-4.026-45.33c.11-13.521.257-32.043-1.9-33.504c-2.104.873-2.315 16.172-2.451 26.301c-.162 11.785-.327 23.98-2.242 30.189c-.57 1.84-1.306 3.525-2.786 3.39c-2.086-.185-2.76-3.48-4.317-16.478c-.647-5.4-1.317-10.98-2.101-13.14a11 11 0 0 0-.269-.66c-.835 1.889-1.8 7.079-2.47 10.682c-.927 4.976-1.803 9.676-2.9 11.726c-.847 1.575-2.19 3.63-4.067 3.231c-2.558-.537-3.323-5.693-3.552-8.719c0-25.455-3.33-28.417-3.997-28.753l-.107.081l-.162-.036c-2.377 1.038-2.506 9.294-2.627 17.276c-.096 5.856-.198 12.492-1.053 18.701c-1.108 8.05-2.448 9.603-4.115 9.507c-3.838-.262-3.95-13.482-3.95-14.987c0-.472.012-1.028.027-1.642c.074-3.076.205-8.8-1.687-10.604c-.25-.239-.603-.515-.879-.437c-1.347.339-2.745 4.714-3.209 6.153c-.147.457-.265.833-.364 1.09c-.078.214-.177.515-.294.88c-1.02 3.095-2.18 6.183-4.16 6.944c-.732.284-1.498.222-2.216-.183c-.953-.541-1.73-1.646-2.455-3.482c-.397-1.016-.735-2.046-1.082-3.081c-.419-1.263-.85-2.569-1.384-3.808c-.419-.965-1.464-1.4-2.796-1.164c-2.768.494-3.232 3.29-3.622 7.5c-.07.733-.137 1.452-.228 2.128c-.011.198-.501 6.38-.814 8.344c-.865 5.39-2.002 7.512-3.89 7.358c-4.66-.398-6.798-20.836-6.684-29.47c.088-6.592-1.104-9-1.818-9.382c-.074-.034-.189-.096-.46.095c-.843.571-1.594 2.348-1.363 4.215c2.566 20.32.674 43.592-3.96 48.833c-1.46 1.649-3.448 1.627-4.832.236c-4.049-4.064-4.218-20.586-4.026-45.33c.11-13.521.254-32.043-1.9-33.504c-2.105.873-2.311 16.172-2.45 26.301c-.163 11.785-.329 23.98-2.246 30.189c-.57 1.84-1.307 3.525-2.782 3.39c-2.091-.186-2.761-3.48-4.321-16.478c-.649-5.4-1.319-10.98-2.101-13.14c-.1-.273-.189-.49-.27-.66c-.832 1.889-1.796 7.079-2.466 10.682c-.927 4.976-1.803 9.676-2.904 11.726c-.846 1.575-2.19 3.63-4.063 3.231c-2.558-.537-3.324-5.693-3.552-8.719c-.003-25.455-3.33-28.417-3.997-28.753l-.106.081l-.166-.036c-2.374 1.038-2.503 9.293-2.629 17.276c-.091 5.856-.194 12.492-1.048 18.701c-1.107 8.05-2.437 9.618-4.111 9.507c-3.846-.262-3.958-13.482-3.958-14.987c0-.472.016-1.028.03-1.642c.074-3.076.207-8.8-1.685-10.604c-.25-.239-.603-.515-.88-.438c-1.347.34-2.75 4.715-3.206 6.155a47 47 0 0 1-.364 1.09q-.16.432-.298.875c-1.02 3.096-2.18 6.187-4.155 6.95c-.736.282-1.506.22-2.22-.185c-.953-.541-1.734-1.646-2.454-3.482c-.398-1.016-.74-2.046-1.083-3.081c-.42-1.263-.854-2.569-1.387-3.808c-.416-.965-1.465-1.4-2.797-1.164c-3.188.567-3.943 4.52-4.55 9.238l-.106.839l-2.411-.32l.114-.824c.527-4.137 1.328-10.39 6.53-11.31c2.446-.435 4.585.581 5.446 2.583c.578 1.34 1.031 2.695 1.466 4.008c.324.99.654 1.98 1.037 2.959c.674 1.708 1.197 2.15 1.392 2.257c1.218-.38 2.462-4.167 2.873-5.414c.13-.402.24-.732.328-.968c.085-.233.195-.571.328-.98c1.097-3.43 2.474-7.144 4.918-7.762c.747-.191 1.903-.166 3.157 1.035c2.665 2.544 2.525 8.48 2.433 12.41c-.014.59-.028 1.126-.028 1.583c0 6.272.93 10.655 1.64 12.16c.367-.77.998-2.63 1.598-7.007c.831-6.066.938-12.624 1.027-18.41c.161-10.24.275-17.663 3.982-19.408c.552-.339 1.469-.522 2.436-.033c3.586 1.803 5.326 11.885 5.326 30.817c.225 2.926 1.013 6.006 1.66 6.448c.004-.066.53-.39 1.394-2.01c.925-1.718 1.845-6.665 2.655-11.026c1.792-9.614 2.606-12.989 4.726-13.166c1.615-.158 2.362 1.896 2.676 2.76c.883 2.422 1.537 7.888 2.23 13.678c.54 4.49 1.31 10.902 2.094 13.497c.084-.228.18-.5.283-.836c1.815-5.878 1.98-17.887 2.14-29.507c.22-16.14.503-26.139 3.448-28.226a2.44 2.44 0 0 1 2.233-.316c3.448 1.144 3.714 11.254 3.519 35.8c-.14 17.799-.313 39.952 3.323 43.603c.317.32.542.32.622.32c.17 0 .413-.161.67-.452c3.681-4.162 6.01-26.022 3.372-46.927c-.328-2.602.677-5.337 2.392-6.514c.946-.652 2.036-.736 2.978-.232c2.145 1.14 3.187 5.024 3.102 11.546c-.15 11.387 2.584 24.714 4.37 26.842c.282-.471.842-1.763 1.379-5.145c.301-1.87.799-8.153.806-8.216c.09-.71.155-1.398.217-2.097c.369-3.924.82-8.804 5.613-9.654c2.444-.435 4.583.577 5.448 2.583c.577 1.34 1.027 2.695 1.46 4.008c.332.99.664 1.98 1.046 2.959c.67 1.708 1.197 2.15 1.387 2.257c1.218-.38 2.467-4.167 2.875-5.41c.132-.402.243-.737.328-.973c.088-.228.195-.57.324-.979c1.1-3.43 2.477-7.144 4.924-7.762c.74-.191 1.9-.166 3.154 1.035c2.665 2.543 2.526 8.48 2.437 12.41q-.029.792-.033 1.583c0 6.272.931 10.655 1.641 12.16c.365-.77.994-2.63 1.601-7.007c.832-6.066.931-12.624 1.027-18.41c.159-10.24.273-17.663 3.98-19.408c.55-.339 1.467-.522 2.44-.033c3.58 1.803 5.325 11.884 5.325 30.817c.224 2.926 1.012 6.006 1.656 6.448c.008-.066.526-.39 1.399-2.01c.923-1.718 1.84-6.665 2.653-11.026c1.786-9.614 2.602-12.989 4.722-13.166c1.62-.158 2.367 1.896 2.68 2.76c.88 2.422 1.535 7.888 2.233 13.678c.534 4.49 1.304 10.902 2.092 13.497c.08-.228.176-.5.28-.836c1.813-5.878 1.976-17.887 2.138-29.507c.216-16.14.504-26.139 3.448-28.226a2.45 2.45 0 0 1 2.234-.316c3.452 1.144 3.718 11.254 3.52 35.8c-.141 17.799-.314 39.952 3.319 43.603c.324.32.544.32.63.32c.165 0 .408-.161.662-.452c3.687-4.162 6.014-26.022 3.375-46.927c-.342-2.723.43-5.47 1.84-6.526c.71-.537 1.575-.647 2.37-.313c2.054.877 3.445 4.63 4.255 11.484c.339 2.87.641 5.974.931 9.036c.641 6.683 1.509 15.69 2.684 17.67c.36-.46 1.096-1.704 2.19-5.038l2.307.753c-1.696 5.157-3.026 7.1-4.755 6.902c-2.69-.299-3.468-5.734-4.84-20.055c-.29-3.048-.59-6.132-.928-8.989c-1.03-8.74-2.782-9.532-2.801-9.54c-.342.174-1.137 1.992-.842 4.31c2.558 20.32.673 43.597-3.964 48.834c-.747.842-1.587 1.27-2.485 1.27"
              />
            </svg>
          } @else if (view() === 'ngrx') {
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M12.024.017V0L12 .008L11.976 0v.017L.812 3.892l1.605 14.875l9.559 5.207V24l.024-.013l.024.013v-.026l9.559-5.207l1.605-14.875zm6.868 14.244q-1.64 3.948-6.031 4.166c-2.829 0-4.661-1.7-4.66-1.7q-1.745-1.359-2.398-3.417c-.695-.76-.702-.841-.774-1.145c-.072-.303.045-.388.249-.685q.204-.298.098-.85q-.26-.36-.3-1.128q0-.37.496-.783q.495-.413.607-.632q.083-.119.065-1.031q-.006-.897.995-.975c1-.08 1.565-.832 1.879-1.174c.21-.228.52-.339.91-.341c.551-.026 1.052.185 1.484.62c1.075-.055 2.176.235 3.292.863q2.379 1.414 2.596 3.055q-.257 2.158-5.788-.113q-2.895.819-2.846 3.552q0 2.508 2.422 3.643c-.787-.772-1.122-1.422-1.01-1.959q2.456 2.906 5.588 2.173c-.92.032-1.65-.264-2.198-.893q2.116-.05 3.998-1.972c-.724.576-1.482.794-2.284.657q3.26-2.563 2.307-5.98l-.002-.006a3.02 3.02 0 0 1 .788 2.03q.023 1.175-.795 2.477q.613-.478 1.413-2.047c.23 2.117-.625 3.724-2.574 4.825q.934-.085 2.473-1.23m-5.567-6.63a.319.319 0 1 1 .638 0a.319.319 0 0 1-.638 0"
              />
            </svg>
          } @else if (view() === 'angular') {
            <svg width="20" height="22" viewBox="0 0 223 236" aria-hidden="true">
              <defs>
                <linearGradient
                  id="ng-grad"
                  x1="49"
                  x2="226"
                  y1="214"
                  y2="130"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stop-color="#E40035" />
                  <stop offset=".24" stop-color="#F60A48" />
                  <stop offset=".352" stop-color="#F20755" />
                  <stop offset=".494" stop-color="#DC087D" />
                  <stop offset=".745" stop-color="#9717E7" />
                  <stop offset="1" stop-color="#6C00F5" />
                </linearGradient>
              </defs>
              <path
                fill="url(#ng-grad)"
                d="m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z"
              />
            </svg>
          } @else {
            <svg
              width="20"
              height="22"
              viewBox="0 0 223 236"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z"
              />
            </svg>
          }
        </span>
        <span class="title" [class.ng-text]="view() === 'angular'">{{ title() }}</span>
      </h1>
      <nav
        #nav
        aria-label="Inspectors"
        [class.fade-start]="navFade().start"
        [class.fade-end]="navFade().end"
        (scroll)="measureNav()"
      >
        @if (availableTabs().length > 1) {
          @for (t of tabs(); track t.id) {
            <button
              type="button"
              [class.active]="tab() === t.id"
              [attr.aria-current]="tab() === t.id ? 'page' : null"
              (click)="switchTab(t.id)"
            >
              <app-tab-icon [name]="t.id" />
              <span>{{ t.label }}</span>
            </button>
          }
        }
      </nav>
      <span
        class="status"
        [class.connected]="connected()"
        [class.failed]="connectionFailed()"
        role="status"
      >
        <span class="dot" aria-hidden="true"><span></span></span>
        {{ connected() ? 'Live' : connectionFailed() ? 'Disconnected' : 'Connecting…' }}
      </span>
    </header>
    <main #main tabindex="-1">
      <p class="background-note" role="status">{{ backgroundNote() }}</p>
      @if (connectionFailed()) {
        <p class="connection-error" role="alert">
          Can't reach the devtools server. Check that the dev server is running, then reload.
        </p>
      } @else if (comingSoon(); as info) {
        <app-coming-soon [info]="info" />
      } @else if (!tabEnabled(tab(), config())) {
        <p class="turned-off">
          This inspector is turned off in the devtools config (<code>inspectors</code>).
        </p>
      } @else {
        @switch (tab()) {
          @case ('dashboard') {
            <app-dashboard [rpc]="rpc()" (navigate)="switchTab($event)" />
          }
          @case ('components') {
            <app-component-tree
              [rpc]="rpc()"
              [focus]="componentFocus()"
              (focusHandled)="componentFocus.set(null)"
              (showForm)="showForm($event)"
            />
          }
          @case ('routes') {
            <app-route-inspector [rpc]="rpc()" />
          }
          @case ('signals') {
            <app-signal-inspector [rpc]="rpc()" />
          }
          @case ('injectors') {
            <app-di-inspector [rpc]="rpc()" />
          }
          @case ('store') {
            <app-store-inspector [rpc]="rpc()" />
          }
          @case ('network') {
            <app-network-inspector [rpc]="rpc()" />
          }
          @case ('forms') {
            <app-forms-inspector
              [rpc]="rpc()"
              [focus]="formFocus()"
              (focusHandled)="formFocus.set(null)"
            />
          }
          @case ('pipes') {
            <app-pipes-inspector [rpc]="rpc()" />
          }
          @case ('analog') {
            <app-analog-inspector [rpc]="rpc()" />
          }
        }
      }
    </main>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      --accent-soft: color-mix(in srgb, var(--accent) 12%, transparent);
      --accent-line: color-mix(in srgb, var(--accent) 45%, transparent);
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      min-width: 0;
      background:
        radial-gradient(
          900px 300px at 10% -10%,
          color-mix(in srgb, var(--accent) 7%, transparent),
          transparent 70%
        ),
        var(--bg);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      flex-wrap: nowrap;
      flex-shrink: 0;
      align-items: center;
      gap: 8px 16px;
      height: 45px;
      padding: 0 16px;
      background: color-mix(in srgb, var(--surface) 82%, transparent);
      backdrop-filter: blur(12px) saturate(1.3);
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 10px;
      min-width: 0;
      margin: 0;
      color: var(--accent);
      font-size: 15px;
      font-weight: 650;
      line-height: 1.2;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .title {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mark {
      display: grid;
      flex-shrink: 0;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent);
    }
    .mark.ng-mark {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, #f60a48 12%, transparent),
        color-mix(in srgb, #9717e7 12%, transparent)
      );
      box-shadow: inset 0 0 0 1px color-mix(in srgb, #dc087d 34%, transparent);
    }
    .ng-text {
      background: linear-gradient(90deg, #ff4d75 0%, #f23d9a 45%, #c06bf5 80%, #a98bff 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    nav {
      position: relative;
      display: flex;
      flex: 0 1 auto;
      flex-wrap: nowrap;
      gap: 2px;
      min-width: 0;
      height: 34px;
      padding: 2px;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scroll-padding-inline: 24px;
      scrollbar-width: none;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
    }
    nav::-webkit-scrollbar {
      display: none;
    }
    nav.fade-start {
      mask-image: linear-gradient(90deg, transparent, #000 28px);
    }
    nav.fade-end {
      mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
    }
    nav.fade-start.fade-end {
      mask-image: linear-gradient(
        90deg,
        transparent,
        #000 28px,
        #000 calc(100% - 28px),
        transparent
      );
    }
    nav:empty {
      display: none;
    }
    nav button {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      gap: 6px;
      height: 28px;
      padding: 0 10px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text-2);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition:
        background-color 0.16s var(--ease),
        color 0.16s var(--ease),
        box-shadow 0.16s var(--ease),
        transform 0.12s var(--ease);
    }
    nav button app-tab-icon {
      color: var(--text-3);
      transition: color 0.16s var(--ease);
    }
    nav button:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    nav button:hover app-tab-icon {
      color: var(--text-2);
    }
    nav button:active {
      transform: scale(0.97);
    }
    nav button.active {
      background: var(--surface-3);
      color: var(--text-strong);
      box-shadow:
        inset 0 0 0 1px var(--border-strong),
        0 4px 14px -8px rgba(0, 0, 0, 0.9);
    }
    nav button.active app-tab-icon {
      color: var(--accent);
    }
    nav button:focus-visible {
      @include m.focus-ring(-2px);
    }
    .status {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      gap: 6px;
      height: 24px;
      margin-left: auto;
      padding: 0 10px 0 6px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
      transition:
        color 0.2s var(--ease),
        border-color 0.2s var(--ease),
        background-color 0.2s var(--ease);
    }
    .dot {
      position: relative;
      display: grid;
      place-items: center;
      width: 12px;
      height: 12px;
    }
    .dot span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--warn);
      animation: blink 1.2s ease-in-out infinite;
    }
    .dot::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: var(--warn);
      opacity: 0;
    }
    .status.connected {
      border-color: color-mix(in srgb, var(--ok) 28%, transparent);
      background: color-mix(in srgb, var(--ok) 8%, transparent);
      color: var(--text);
    }
    .status.connected .dot span {
      background: var(--ok);
      box-shadow: 0 0 6px var(--ok);
      animation: none;
    }
    .status.failed {
      border-color: color-mix(in srgb, var(--danger) 36%, transparent);
      color: var(--text);
    }
    .status.failed .dot span {
      background: var(--danger);
      animation: none;
    }
    .status.connected .dot::before {
      background: var(--ok);
      animation: ping 2s var(--ease) infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.3;
      }
    }
    @keyframes ping {
      0% {
        transform: scale(0.5);
        opacity: 0.55;
      }
      80%,
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }
    main {
      flex: 1;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      padding: 20px;
    }
    main:focus {
      outline: none;
    }
    main > * {
      animation: enter 0.28s var(--ease) both;
    }
    .background-note {
      margin: 0 0 12px;
      color: var(--text-2);
      font-size: 12px;
      &:empty {
        display: none;
      }
    }
    .turned-off {
      max-width: 60ch;
      margin: 0;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
    }
    .connection-error {
      max-width: 60ch;
      margin: 0;
      padding: 12px 14px;
      border: 1px solid color-mix(in srgb, var(--danger) 36%, transparent);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
    }
    @media (max-width: 720px) {
      header {
        flex-wrap: wrap;
        height: auto;
        padding: 8px 16px;
      }
      nav {
        order: 3;
        flex: 1 1 100%;
      }
    }
    @media (max-width: 560px) {
      header {
        padding-inline: 12px;
      }
      main {
        padding: 16px 12px;
      }
    }
    @media (max-width: 400px) {
      .brand {
        flex-shrink: 1;
        gap: 8px;
      }
    }
  `,
})
export class App implements OnInit, OnDestroy {
  readonly analog = signal(false);
  private readonly allTabs: Tabs[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analog', label: 'Analog' },
    { id: 'components', label: 'Components' },
    { id: 'routes', label: 'Routes' },
    { id: 'signals', label: 'Signals' },
    { id: 'injectors', label: 'Injectors' },
    { id: 'store', label: 'Store' },
    { id: 'forms', label: 'Forms' },
    { id: 'pipes', label: 'Pipes' },
    { id: 'network', label: 'SSR & HTTP' },
  ];
  readonly view = signal<View | null>(readView());
  readonly viewAccent = computed(() => {
    const view = this.view();
    return (view && VIEW_ACCENT[view]) ?? null;
  });
  readonly title = computed(() => {
    const view = this.view();
    return view ? VIEW_TITLE[view] : 'Angular DevTools';
  });
  readonly analogKnown = signal(false);
  readonly comingSoon = computed(() => {
    const view = this.view();
    if (view === 'analog') return this.analogKnown() && !this.analog() ? NOT_ANALOG : undefined;
    return view ? COMING_SOON[view] : undefined;
  });
  readonly config = computed(() => panelConfig(this.rpc()));
  protected readonly tabEnabled = tabEnabled;
  protected readonly availableTabs = computed(() => {
    if (this.comingSoon()) return [];
    const view = this.view();
    const only = view ? VIEW_TAB[view] : undefined;
    const enabled = this.allTabs.filter((t) => tabEnabled(t.id, this.config()));
    if (only) return enabled.filter((t) => t.id === only);
    return enabled.filter(
      (t) => (t.id !== 'analog' || this.analog()) && !(view === 'angular' && TAB_VIEW[t.id]),
    );
  });
  readonly tabs = computed(() => {
    const tabs = this.availableTabs();
    if (this.rpc()) return tabs;
    const tab = this.tab();
    return tabs.filter((t) => t.id === 'dashboard' || t.id === tab);
  });

  tab = linkedSignal<Tab>(() => {
    const view = this.view();
    return (view && VIEW_TAB[view]) || 'dashboard';
  });
  rpc = signal<DevframeRpcClient | null>(null);
  connected = signal(false);
  readonly connectionFailed = signal(false);
  private readonly hiddenPages = signal<string[]>([]);
  private readonly pageId = hostPageId();
  readonly backgroundNote = computed(() => {
    const hidden = this.hiddenPages();
    if (this.pageId) {
      return hidden.includes(this.pageId) ? 'Tab in background, showing the last data.' : '';
    }
    if (!hidden.length) return '';
    return hidden.length === 1
      ? 'A tab is in the background, showing its last data.'
      : `${hidden.length} tabs are in the background, showing their last data.`;
  });
  private stopVisibility = () => {};

  private stopFollowing = () => {};
  private stopHighlights = () => {};
  private readonly nav = viewChild<ElementRef<HTMLElement>>('nav');
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');
  private readonly injector = inject(Injector);
  private navObserver?: ResizeObserver;
  readonly navFade = signal({ start: false, end: false });

  constructor() {
    afterNextRender(() => {
      const nav = this.nav()?.nativeElement;
      if (!nav || typeof ResizeObserver === 'undefined') return;
      this.navObserver = new ResizeObserver(() => this.measureNav());
      this.navObserver.observe(nav);
    });
    afterRenderEffect(() => {
      this.tab();
      this.tabs();
      untracked(() => {
        this.revealActiveTab();
        this.measureNav();
      });
    });
  }

  measureNav() {
    const nav = this.nav()?.nativeElement;
    if (!nav) return;
    const max = nav.scrollWidth - nav.clientWidth;
    const start = nav.scrollLeft > 1;
    const end = max > 1 && nav.scrollLeft < max - 1;
    const current = this.navFade();
    if (current.start !== start || current.end !== end) this.navFade.set({ start, end });
  }

  private revealActiveTab() {
    const nav = this.nav()?.nativeElement;
    const active = nav?.querySelector<HTMLElement>('button.active');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const inset = 24;
    const left = active.offsetLeft - inset;
    const right = active.offsetLeft + active.offsetWidth + inset - nav.clientWidth;
    if (nav.scrollLeft > left) nav.scrollLeft = Math.max(0, left);
    else if (nav.scrollLeft < right) nav.scrollLeft = right;
  }

  ngOnInit() {
    if (this.view()) {
      this.stopFollowing = followHubDocks(HUB_VIEWS, (view) => this.showView(view));
    }
    try {
      if (window.parent !== window) styleHubRail(window.parent.document);
    } catch {
      // a cross origin parent cannot be styled
    }
    const restored = initialTab(
      location.hash,
      storedTab(this.tabScope()),
      this.availableTabs().map((t) => t.id),
    );
    if (restored) this.tab.set(restored);

    this.stopHighlights = clearHighlightsOnHide(() => this.rpc());
    const baseURL = detectBaseURL();
    connectDevframe(baseURL ? { baseURL } : {}).then(
      (client) => {
        this.rpc.set(client);
        this.connected.set(true);
        void this.watchVisibility(client);
        const scoped = client.scope('ng-devtools').rpc as unknown as {
          call: (name: string) => Promise<unknown>;
        };
        scoped.call('analog-project').then(
          (project) => {
            const isAnalog = !!(project as { analog?: boolean } | null)?.analog;
            this.analog.set(isAnalog);
            this.analogKnown.set(true);
            if (!isAnalog && this.tab() === 'analog' && !this.view()) this.tab.set('dashboard');
          },
          () => {
            this.analogKnown.set(true);
            if (this.tab() === 'analog' && !this.view()) this.tab.set('dashboard');
          },
        );
        client.events.on('connection:status', (status) => {
          this.connected.set(status === 'connected');
        });
      },
      () => {
        this.connectionFailed.set(true);
        this.analogKnown.set(true);
      },
    );
  }

  ngOnDestroy() {
    this.stopFollowing();
    this.stopVisibility();
    this.stopHighlights();
    this.navObserver?.disconnect();
  }

  private showView(view: View) {
    if (view === this.view()) return;
    this.view.set(view);
    const url = new URL(location.href);
    url.searchParams.set('view', view);
    url.hash = '';
    history.replaceState(history.state, '', url);
  }

  formFocus = signal<{ id: string } | null>(null);
  // Belongs to the Components tab that received it, so leaving the tab drops it.
  readonly componentFocus = linkedSignal<Tab, { id: string } | null>({
    source: this.tab,
    computation: () => null,
  });

  showForm(formId: string) {
    this.formFocus.set({ id: formId });
    this.switchTab('forms');
  }

  inspectFromPanel({ source, origin, data }: MessageEvent<unknown>) {
    if (source !== window.parent || origin !== location.origin) return;
    const message = data as { type?: unknown; id?: unknown } | null;
    if (message?.type !== 'ng-devtools:inspect-component' || typeof message.id !== 'string') return;
    // Any element inside the app resolves to a component, so following every
    // Elements selection would pull the user off whichever tab they are on.
    if (this.tab() !== 'components' || !this.config().inspectors.components) return;
    this.componentFocus.set({ id: message.id });
  }

  switchTab(id: Tab) {
    const target = TAB_VIEW[id];
    if (this.view() === 'angular' && target) {
      void this.activateDock(target, id);
      return;
    }
    this.setTab(id);
    history.replaceState(history.state, '', `#tab=${id}`);
  }

  private setTab(id: Tab) {
    this.keepFocus();
    this.tab.set(id);
    storeTab(this.tabScope(), id);
  }

  private tabScope() {
    return this.view() ?? 'panel';
  }

  private async watchVisibility(client: DevframeRpcClient) {
    try {
      const state = await client.scope('ng-devtools').rpc.sharedState('page-visibility');
      const apply = (value: unknown) => {
        const hidden = (value as { hidden?: unknown } | undefined)?.hidden;
        this.hiddenPages.set(
          Array.isArray(hidden) ? hidden.filter((id) => typeof id === 'string') : [],
        );
      };
      apply(state.value());
      this.stopVisibility();
      this.stopVisibility = state.on('updated', apply);
    } catch {
      // an older server has no visibility state, and no note is shown
    }
  }

  private keepFocus() {
    const active = document.activeElement;
    const main = this.main()?.nativeElement;
    if (active && active !== document.body && !main?.contains(active)) return;
    afterNextRender(
      () => {
        const now = document.activeElement;
        if (now && now !== document.body) return;
        const target =
          this.nav()?.nativeElement.querySelector<HTMLElement>('button.active') ??
          this.main()?.nativeElement;
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  private async activateDock(view: View, fallback: Tab) {
    if (await selectHubDock(view)) return;
    if (window.parent === window) {
      this.keepFocus();
      this.showView(view);
      return;
    }
    const client = this.rpc() as unknown as {
      call?: (method: string, ...args: unknown[]) => Promise<unknown>;
    } | null;
    if (!client?.call) {
      this.setTab(fallback);
      return;
    }
    try {
      await client.call('hub:docks:activate', { dockId: `ng-devtools:${view}` });
      this.keepFocus();
      this.showView(view);
    } catch {
      this.setTab(fallback);
    }
  }
}
