---
title: Platforms
description: The browsers, devices and app frameworks the devtools inspect today, how each one is checked, and the platforms still planned with their tracking issues.
---

<ngmd-hero title="Platforms" gradient>
  Where an Angular app can run and still report to the devtools, and which platforms are planned next.
</ngmd-hero>

# Platforms

The devtools read a running Angular app through its debug API, wherever it renders. A browser page runs the [browser overlay](./overlay.md). A platform without a DOM gets an overlay of its own that walks its view tree and sends the same reports. For the build tools and servers each setup uses, see [Supported setups](./installation.md#supported-setups).

## Supported platforms

| Platform                     | How it reports                                                                                                                                                          | How it is checked                                                                                                                               | Set up                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Browser                      | The browser overlay, loaded in `main.ts` or by the Vite plugin                                                                                                          | CI and the weekly install check, in Chromium                                                                                                    | [Installation](./installation.md)                                          |
| Chrome DevTools              | The [Chrome extension](./chrome-extension.md) shows the panel for a page that already runs the overlay                                                                  | Package tests of the extension bridge. You build and load the extension from the repository                                                     | [Chrome extension](./chrome-extension.md)                                  |
| Firefox DevTools             | A Firefox build of the extension, for a page that already runs the overlay                                                                                              | Package tests of the manifest it writes. CI does not build it, and you load it as a temporary add-on                                            | [Build for Firefox](../contributing/chrome-extension.md#build-for-firefox) |
| Capacitor and Ionic WebViews | The browser overlay in the WebView, or `overlay-manual` in a bundled build. Ionic page stacks show on the [Capacitor tab](../inspectors/capacitor.md#ionic-page-stacks) | Android emulators and the iOS simulator. Checks on real phones are tracked in [#337](https://github.com/pangular-inspector/devtools/issues/337) | [Set up Capacitor](../guides/capacitor.md)                                 |
| NativeScript                 | `overlay-nativescript`, over a WebSocket                                                                                                                                | The demo in `examples/nativescript` on the iOS simulator. Android is untested                                                                   | [NativeScript](./nativescript.md)                                          |
| Angular Native               | `overlay-angular-native`, over a WebSocket                                                                                                                              | Package tests against a simulated view tree. No automated test runs the demo on a device                                                        | [Angular Native](./angular-native.md)                                      |

A platform without a DOM has no picker, no axe pass and no Router, Forms or SSR & HTTP data. The NativeScript and Angular Native pages list [what needs a browser](./nativescript.md#what-needs-a-browser).

## How a platform shows in the panel

| Platform       | Where its data shows                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Browser        | Every tab, scoped to the page you pick.                                                          |
| Capacitor      | Every tab, like a browser tab, and the **Capacitor** tab for plugin calls and Ionic page stacks. |
| NativeScript   | The tabs it fills, in the **Angular** dock or the CLI panel without `?view`.                     |
| Angular Native | The **Angular Native** view (`?view=angular-native`), and the panel without `?view`.             |

The hub's **NativeScript** dock always shows the setup steps and a link to the setup page. The **Capacitor** dock shows them while no Capacitor app reports, and the **Angular Native** view says **No Angular Native app is connected** while none does. `list-pages` gives each page's platform to agents. See [list-pages](../agents/tools.md#list-pages).

## Planned

Plans follow feedback. To ask for a platform, or to move one up, comment on its issue.

| Platform or channel               | What it adds                                                                | Issue                                                             |
| --------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Other app frameworks              | One core and an adapter per framework, after the mobile platforms.          | [#307](https://github.com/pangular-inspector/devtools/issues/307) |
| Chrome Web Store and Edge Add-ons | The extension installed from a store, instead of built from the repository. | [#342](https://github.com/pangular-inspector/devtools/issues/342) |

The [roadmap](../roadmap.md) lists the rest of the planned work.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/installation" title="Installation"></ngmd-pill>
  <ngmd-pill href="/guides/capacitor" title="Set up Capacitor"></ngmd-pill>
  <ngmd-pill href="/getting-started/nativescript" title="NativeScript"></ngmd-pill>
  <ngmd-pill href="/getting-started/angular-native" title="Angular Native"></ngmd-pill>
  <ngmd-pill href="/roadmap" title="Roadmap"></ngmd-pill>
</ngmd-pill-row>
