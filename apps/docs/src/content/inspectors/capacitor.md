---
title: Capacitor
description: The platform, plugins, plugin calls and listeners of a Capacitor app, as its WebView reports them.
---

<ngmd-hero title="Capacitor" logo="https://cdn.simpleicons.org/capacitor/119EFF" gradient>
  Which plugins a Capacitor app has, every plugin call it makes with its arguments and result, and the listeners it keeps.
</ngmd-hero>

# Capacitor

The Capacitor tab shows a Capacitor app from the inside: its platform and environment, the plugins it can use, each plugin call with its arguments and outcome, and its plugin listeners. The data comes from the running app, through the [browser overlay](../getting-started/overlay.md). To connect an app, follow [Set up Capacitor](../guides/capacitor.md).

The tab appears in the panel while a Capacitor app reports. In the hub, the **Capacitor** dock shows it, and shows the setup steps while no app reports. While no app reports, the dock's tooltip in the rail reads **Capacitor: no app connected**.

<ngmd-image src="/images/panel/capacitor.png" alt="The Capacitor tab for an Android app: the summary strip with calls, one failed and one slow call, the environment with the server URL and user agent, and the plugin calls list with a Camera.getPhoto call selected and its arguments shown" caption="Calls from a simulated Android bridge on the demo app."></ngmd-image>

## What it shows

### Summary

A strip at the top of the tab sums up the page:

| Item              | What it says                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| **Platform**      | The platform, and whether it is native or web.                                                        |
| **Calls**         | Every call logged. Select it to show all calls again.                                                 |
| **Failed**        | Calls that rejected. Select it to keep only those.                                                    |
| **Slow, 500 ms+** | Calls that took 500 ms or more, or have waited that long for an answer. Select it to keep only those. |
| **Pending**       | Calls without an answer yet. Select it to keep only those.                                            |
| **CapacitorHttp** | **On**, **Off** or **Unknown**, as in [Environment](#environment).                                    |
| **Plugin hints**  | How many rows of the [Plugins](#plugins) table have a note.                                           |

The selected count is marked as pressed, and selecting it again shows all calls. The call counts are left out on a page that logs no calls. A screen reader hears the strip change at most every two seconds, and hears nothing when a call arrives in the list.

### Environment

| Field             | What it is                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Platform**      | `Capacitor.getPlatform()`, and whether it is native or web.                                                                      |
| **Server URL**    | `Capacitor.getServerUrl()`: where the WebView loads the app from.                                                                |
| **CapacitorHttp** | On when CapacitorHttp sends `fetch` through the native layer, as the native layer reports it. **Unknown** when it can't be read. |
| **Calls logged**  | **Native and web**, **Native only**, **Web only**, or **None on this platform**. See [Web calls](#web-calls).                    |
| **User agent**    | The WebView's user agent.                                                                                                        |

The Capacitor version is not available at runtime, so the tab doesn't show it. When several Capacitor apps report, pick one with **Page**.

### Plugin calls

Each call, newest first: `Plugin.method()`, its status, its duration, whether it went to the native bridge, and its time. The status chips have an icon and a label:

| Chip                | Meaning                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| **OK**              | The call resolved.                                                               |
| **Error**           | The call rejected.                                                               |
| **Not implemented** | The platform has no implementation for it: the error code is `UNIMPLEMENTED`.    |
| **Pending**         | No answer yet. The row shows how long it has waited, such as `waiting 3 s`.      |
| **native**, **web** | Whether the call went to the native bridge, or a web implementation answered it. |
| **stream**          | A method that calls back more than once, such as `Geolocation.watchPosition`.    |

A bar next to each duration compares it with the slowest call in the list.

Search by plugin or method, and pick **All calls**, **Failed**, **Slow (500 ms or more)** or **Pending** in the menu next to the search, or select a count in the [summary](#summary). When nothing matches, the tab says which filters hide the calls, with **Clear filters**.

The list is one stop for the Tab key. Use the arrow keys, `Home` and `End` to move between calls, and `Enter` to select one. A selected call stays selected while more calls arrive.

### Call details

A selected call shows three tabs:

| Tab                     | What it shows                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Arguments**           | The arguments, masked.                                                                                      |
| **Result** or **Error** | The result, or the error with its code. A stream shows its latest result and how many times it called back. |
| **Timing**              | When the call started and finished, and how long it took or has waited.                                     |

Use the arrow keys, `Home` and `End` to move between the tabs.

**Copy as JSON** copies the call as the tab holds it. **Copy as code** copies the call as code to paste into the app:

```ts
await Camera.getPhoto({
  quality: 90,
});
```

Both copy the masked values the tab holds, so a masked value stays masked.

### Plugins

Every plugin the app imported or the native project has:

| Column        | What it says                                                                                                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Available** | `Capacitor.isPluginAvailable()` on this platform.                                                                                                                                                                                                                           |
| **Imported**  | The app registered it with `registerPlugin()`, usually by importing its package. On iOS and Android this is **Unknown** unless the [Capacitor hook](#web-calls) loads before `@capacitor/core`, because the native layer lists every installed plugin.                      |
| **Native**    | The native project has it.                                                                                                                                                                                                                                                  |
| **Note**      | A plugin the app imports that is not available, with the command to run, such as `npx cap sync android`, and a **Copy** button. Or a native plugin the app does not import. Plugins `@capacitor/core` registers itself, such as `WebView` and `CapacitorHttp`, get no note. |

### Listeners

Each `addListener` registration: plugin, event, how many events it received, the last event, and whether it is still active. **Last event** shows the payload of the last event, masked like a call result, and its time. Only the last event is kept, not a history.

When the same plugin and event have more than one active listener, each of their rows says how many, such as **2 active listeners: possible leak**. This often means a component adds a listener and never removes it.

### Plugin state

Some plugins get a card with their current state, read from what the app already received: the results of its successful calls and the last event of its listeners. The panel never calls the plugin. Each field says where it came from and when, such as `from foldStateChange, 3 s ago`, or **Not reported yet** when the app never read it. The newest value wins.

The card shows when the page has the plugin. One plugin has a card: `Foldable`, from [@erkamyaman/capacitor-foldable](https://www.npmjs.com/package/@erkamyaman/capacitor-foldable).

| Field                 | Read from                                                                |
| --------------------- | ------------------------------------------------------------------------ |
| **Fold state**        | `state` of `getFoldState()` and `foldStateChange`                        |
| **Posture**           | `posture` of `getFoldState()` and `foldStateChange`                      |
| **Hinge orientation** | `hingeOrientation` of `getFoldState()` and `foldStateChange`             |
| **Hinge angle**       | `angle` of `getHingeAngle()` and `hingeAngleChange`                      |
| **Active display**    | `activeDisplay` of `getFoldState()` and `foldStateChange`                |
| **Size class**        | `widthClass` and `heightClass` of `getSizeClass()` and `sizeClassChange` |

## Where the data comes from

A plugin's native calls go through `Capacitor.nativePromise` and `Capacitor.nativeCallback`. The overlay wraps both on the page to watch the calls, and passes every argument and result through unchanged. It never adds plugin listeners of its own. This works with plugins the app registered before the overlay loaded, in Capacitor 6, 7 and 8.

The log starts when the overlay starts, unless the app loads the Capacitor hook earlier. See [Startup calls](#startup-calls).

## Web calls

A call that a plugin's web implementation answers never reaches the native bridge, and neither does the **Not implemented** error that `@capacitor/core` raises for a method no platform implements. The tab sees these calls only when `@pangular-inspector/devtools/capacitor-hook` runs before `@capacitor/core`. On the web, without the hook, the tab says that calls aren't shown.

Add the hook to the polyfills of your development configuration, so it loads before your app and stays out of production builds. A configuration's `polyfills` replace the list in the build's `options`, so copy that list and add the hook to it. In `angular.json` (excerpt):

```json
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

This sample assumes the base list is `["zone.js"]`. Leave `zone.js` out if your app doesn't use it. The hook starts on import, and does nothing when `ngDevMode` is off.

If the hook runs after `@capacitor/core`, it logs native calls only and changes nothing else. In that case, the tab still records a **Not implemented** error that your app leaves unhandled.

## Startup calls

The overlay usually starts after bootstrap, so calls your app makes at startup, such as `SplashScreen.hide()` or `StatusBar.setStyle()`, happen before it. The Capacitor hook from [Web calls](#web-calls) starts logging at once and keeps the calls in a capped buffer. The overlay sends them when it connects.

## Redaction

Arguments, results, errors and the last event of each listener are masked like other live values, on the page and again on the server with its own [`redaction`](../getting-started/configuration.md#redaction) config:

- Fields with a secret-looking name, JWTs and bearer tokens are masked.
- Strings are masked like HTTP bodies before they are cut: a JSON string or a form body (`password=...`) has its secret fields masked.
- A `value` stored under a secret-looking `key` is masked in the arguments and in the result, as in `Preferences.set({key: 'authToken', value})`. Only this shape is recognised: the name has to be in a field called `key`, next to a field called `value`.
- CapacitorHttp request URLs are masked like the URLs in **SSR & HTTP**, and secret headers are masked by name.
- Long strings, such as base64 photos, are cut. A listener's last event is cut shorter, at 200 characters a string.

Values that no rule recognizes as secret are shown as they are.

The overlay leaves its own requests to the devtools server out of the log.

## Agent tools

| Tool                     | What it answers                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `capacitor-list-calls`   | Recent plugin calls, with filters for a plugin, failed calls and slow calls, then the active listeners with their last event. |
| `capacitor-list-plugins` | The environment and every plugin, with notes like the **Plugins** table.                                                      |

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
    No. The app gets a promise that settles the same way, with the same arguments and results, and a rejection the app leaves unhandled still reaches <code>unhandledrejection</code>. The hook passes everything through once it stops.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does the plugin state card call the plugin?">
    No. It reads the results and events the app already received. A field the app never read says <strong>Not reported yet</strong>. Call the method in your app, or add the listener, to fill it.
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
