---
title: Capacitor
description: The platform, plugins, plugin calls and listeners of a Capacitor app, as its WebView reports them.
---

<ngmd-hero title="Capacitor" logo="https://cdn.simpleicons.org/capacitor/119EFF" gradient>
  Which plugins a Capacitor app has, every plugin call it makes with its arguments and result, and the listeners it keeps.
</ngmd-hero>

# Capacitor

The Capacitor tab shows a Capacitor app from the inside: its platform and environment, the plugins it can use, each plugin call with its arguments and outcome, and its plugin listeners. The data comes from the running app, through the [browser overlay](../getting-started/overlay.md). To connect an app, follow [Set up Capacitor](../guides/capacitor.md).

The tab appears in the panel while a Capacitor app reports. In the hub, the **Capacitor** dock shows it, and shows the setup steps while no app reports.

## What it shows

### Environment

| Field             | What it is                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| **Platform**      | `Capacitor.getPlatform()`, and whether it is native or web.                                                   |
| **Server URL**    | `Capacitor.getServerUrl()`: where the WebView loads the app from.                                             |
| **CapacitorHttp** | On when CapacitorHttp sends `fetch` through the native layer.                                                 |
| **Calls logged**  | **Native and web**, **Native only**, **Web only**, or **None on this platform**. See [Web calls](#web-calls). |
| **User agent**    | The WebView's user agent.                                                                                     |

The Capacitor version is not available at runtime, so the tab doesn't show it. When several Capacitor apps report, pick one with **Page**.

### Plugin calls

Each call, newest first, with its time, `Plugin.method()`, its outcome and its duration. The chips say:

| Chip                | Meaning                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| **OK**              | The call resolved.                                                               |
| **Error**           | The call rejected.                                                               |
| **Not implemented** | The platform has no implementation for it: the error code is `UNIMPLEMENTED`.    |
| **Pending**         | No answer yet.                                                                   |
| **native**, **web** | Whether the call went to the native bridge, or a web implementation answered it. |
| **stream**          | A method that calls back more than once, such as `Geolocation.watchPosition`.    |

Search by plugin or method, and check **Only failed** to keep the calls that rejected. Select a call to see its arguments, and its result or its error with the code. A stream shows its latest result and how many times it called back.

### Plugins

Every plugin the app imported or the native project has:

| Column        | What it says                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Available** | `Capacitor.isPluginAvailable()` on this platform.                                                                              |
| **Imported**  | The app registered it with `registerPlugin()`, usually by importing its package.                                               |
| **Native**    | The native project has it.                                                                                                     |
| **Note**      | A plugin the app imports that is not available, with a hint to run `npx cap sync`, or a native plugin the app does not import. |

### Listeners

Each `addListener` registration: plugin, event, how many events it received, the time of the last one, and whether it is still active. The tab counts events and doesn't keep their payloads.

## Where the data comes from

A plugin's native calls go through `Capacitor.nativePromise` and `Capacitor.nativeCallback`. The overlay wraps both on the page to watch the calls, and passes every argument and result through unchanged. It never adds plugin listeners of its own. This works with plugins the app registered before the overlay loaded, in Capacitor 6, 7 and 8.

The log starts when the overlay starts, unless the app loads the Capacitor hook earlier. See [Startup calls](#startup-calls).

## Web calls

A call that a plugin's web implementation answers never reaches the native bridge, and neither does the **Not implemented** error that `@capacitor/core` raises for a method no platform implements. The tab sees these calls only when `@pangular-inspector/devtools/capacitor-hook` runs before `@capacitor/core`. On the web, without the hook, the tab says that calls aren't shown.

Add the hook to the polyfills of your development configuration, so it loads before your app and stays out of production builds:

```json
// angular.json (excerpt)
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "configurations": {
            "development": {
              "polyfills": ["zone.js", "@pangular-inspector/devtools/capacitor-hook"]
            }
          }
        }
      }
    }
  }
}
```

Leave `zone.js` out if your app doesn't use it. The hook starts on import, and does nothing when `ngDevMode` is off.

If the hook runs after `@capacitor/core`, it logs native calls only and changes nothing else. In that case, the tab still records a **Not implemented** error that your app leaves unhandled.

## Startup calls

The overlay usually starts after bootstrap, so calls your app makes at startup, such as `SplashScreen.hide()` or `StatusBar.setStyle()`, happen before it. The Capacitor hook from [Web calls](#web-calls) starts logging at once and keeps the calls in a capped buffer. The overlay sends them when it connects.

## Redaction

Arguments, results and errors are masked like other live values, on the page and again on the server with its own [`redaction`](../getting-started/configuration.md#redaction) config:

- Fields with a secret-looking name, JWTs and bearer tokens are masked.
- The `value` next to a secret-looking `key`, as in `Preferences.set({key: 'authToken', value})`, is masked in the arguments and in the result.
- CapacitorHttp request URLs are masked like the URLs in **SSR & HTTP**, and secret headers are masked by name.
- Long strings, such as base64 photos, are cut.

The overlay leaves its own requests to the devtools server out of the log.

## Agent tools

| Tool                     | What it answers                                                                 |
| ------------------------ | ------------------------------------------------------------------------------- |
| `list-capacitor-calls`   | Recent plugin calls, with filters for a plugin, failed calls and slow calls.    |
| `list-capacitor-plugins` | The environment and every plugin, with the same hints as the **Plugins** table. |

See [Tools](../agents/tools.md#capacitor) for their arguments.

## Limits

The page and the server keep the latest [`limits.capacitorCalls`](../getting-started/configuration.md#limits) calls, 200 by default. When older calls are dropped, the tab says how many.

To turn the inspector off, set `inspectors.capacitor` to `false`. The tab, the dock, the page collector and both agent tools go away. See [Inspectors and agent tools](../getting-started/configuration.md#inspectors-and-agent-tools).

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why is the call list empty on the web?" open>
    On the web, plugins don't use the native bridge. Load the Capacitor hook before <code>&#64;capacitor/core</code> to log the calls their web implementations answer. See <a href="#web-calls">Web calls</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does watching the calls change them?">
    No. The wrappers hand the app the same promise, arguments and results, and the hook passes everything through once it stops.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why are my startup calls missing?">
    They ran before the overlay started. Load the Capacitor hook from your polyfills. See <a href="#startup-calls">Startup calls</a>.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/guides/capacitor" title="Set up Capacitor"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
</ngmd-pill-row>
