---
title: Injectors
description: The injector hierarchy, token lookup paths and the providers at each level.
---

<ngmd-hero title="Injectors" gradient>
  The injector tree of the running page. Find a token, see who provides it, and follow the path Angular takes to resolve it.
</ngmd-hero>

# Injectors

When a component asks for a token, Angular walks up the element injectors, then through the environment injectors, until something provides it. The Injectors tab shows that tree. Without a live page, it lists the DI found in your source.

<ngmd-image src="/images/panel/injectors.png" alt="The Injectors tab on the Elements view with the demo's app-di-child element selected: the element injector tree on the left, and on the right its lookup path through the parent elements, Root, Platform and the Null injector, with the tokens injected there"></ngmd-image>

## What it shows

### View switch

A switch at the top picks the view:

- **Elements**: one node per host element that has a component or a directive, including elements inside a shadow root and `<ng-container>` elements with a directive.
- **Environment**: the environment injectors, such as the root and platform injectors.

Each row shows a kind letter (`C`, `D` or `E`), the tag or injector name, the component or directive classes, and icons with the number of injected and provided tokens.

The toolbar also shows the change detection mode the page reported: **Zoneless**, **zone.js**, or **Zoneless, zone.js loaded** when zone.js is on the page but the app doesn't use it.

### Page picker

When more than one open page reports an injector tree, a **Page** picker appears in the toolbar. It lists each page by title, or by URL when the page has no title. The tab starts on the page that reported last, and stays on the page you choose when another page reports later. Each page keeps its own selected injector and expanded rows, and hovering a row highlights the element in the chosen page.

If the chosen page closes, the tab moves to the page that reported last and announces the change to screen readers. When the panel opens framed by a page, such as the popup on that page, the tab shows that page only and has no **Page** picker.

### Search and filters

- Search for a token, component, directive or injector. When a token matches, **Provided by** chips list the injectors that provide it. Click one to jump there. The row shows up to 12 chips, then **+N more**. Once typing pauses, a screen reader announces how many injectors provide the token, or that nothing matches.
- **Components only** hides elements without a component. It keeps an element when it is an ancestor of one that stays. It is on by default, in the Elements view only.
- **With providers** hides injectors that provide nothing.
- **Hide framework** hides the injectors and providers that come from Angular, and shows how many it hides, for example **1 injector and 68 providers hidden**. The panel remembers the choice. See [Framework injectors](#framework-injectors).
- Hover or focus an element injector to highlight its element in the page.

### Framework injectors

The devtools server reads the `fesm2022` bundles of every installed `@angular/*` package once (except the compiler and the CLI packages), and collects the class names and `InjectionToken` descriptions they declare. A provider whose token has one of these names is a framework provider, and shows an **Angular** chip.

**Hide framework** hides these injectors:

| Injector                                | Hidden when                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Platform                                | Always. Angular creates it for every app.                                                              |
| Root                                    | Never. It holds your `providedIn: 'root'` services and app config providers.                           |
| Any other environment injector          | Every provider in it is a framework provider, such as a route that only adds `provideHttpClient()`.    |
| An element injector without a component | Every directive on the element and every provider in it comes from Angular, such as `<router-outlet>`. |

The children of a hidden injector move up to its place in the tree. In the injectors that stay, framework providers are hidden too, and **Provides** says how many with a **Show them** button that turns the filter off. Opening a hidden injector, from a lookup path step or a **Provided by** chip, turns the filter off for that visit without changing the saved choice.

The match is by name, so an app class with the same name as an Angular class, such as `Location`, counts as a framework provider. Element injectors with a component are never hidden.

### Links to the Components tab

Select an element injector that belongs to a component, and **Show in Components** opens the [Components tab](./components.md) with that instance selected. From the Components tab, **Show in Injectors** comes back to the element injector. Both buttons match the instance by the id the component tree gives it, so they work on the page each tab shows, and they appear when the other inspector is on. If the injector is no longer on the page, a screen reader announces it.

### Lookup path

Select an injector to see the **Lookup path**: the injectors Angular asks, in order, until one has the token. The path ends at the null injector, which throws `NullInjectorError`. Click any step, except the null injector, to open it.

### Injected here

For element injectors, **Injected here** lists each token requested at this level and the injector that answered. The block marks a token that nobody provides as **not provided anywhere**, and an optional token that nobody provides as **optional, not provided**. A provider with a `null` value, such as `useValue: null`, still counts as provided. When the element has more than one class, each row says which class asked.

### Injected by its services

For environment injectors, **Injected by its services** lists what the services this injector created inject, and which injector answered. Each row says which service asked. `InjectionToken` providers built by a factory, such as `useFactory`, are listed too, with the token as the one that asked. Services that Angular has not created yet are left out, because reading their dependencies would create them. A `providedIn: 'root'` service shows on the root injector once something injects it.

### Provides

**Provides** lists each provider with its kind: `useClass`, `useValue`, `useFactory` or `useExisting`. A bare class shows as `useClass`. Chips mark **viewProviders** and **multi** providers. Providers that come from imported modules show the import path, as `via A › B`.

### Store a provider as a global

Each live provider row has a **Store as global** button. It stores the provider's value in the page console as `temp1`, then the first free `tempN`, and shows the name it used, for example **Stored as temp1.** Only the tab you are looking at gets the global, and the overlay never overwrites a `tempN` the page set itself. See [Console handles](./components.md#console-handles).

Storing never creates a provider:

| Provider in             | Stored when                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| An environment injector | The injector already created the value. Otherwise the button says **… has not been created yet**. |
| An element injector     | A component or directive on the page injected it from that element, so Angular created it.        |

**Log to console** next to it prints the value in the page console instead, as `[pangular] TOKEN: value`, and says **Logged TOKEN in the page console.** It follows the same rules as **Store as global**. The value never reaches the panel.

A class instance is stored as the live object. A `useValue` object or array is stored as a copy, with secret-looking keys, JWTs and `Bearer` values replaced by `[redacted]`. A provider whose token name looks secret, such as `API_KEY`, or whose value is a credential string, is not stored or logged. See [what the devtools redact](../security.md).

### Source mode

Without a live tree, the tab lists DI found in your source files, in four groups:

| Group                          | Lists                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Root Providers (provide\*)** | Calls to known Angular `provide*()` functions, such as `provideRouter()` and `provideHttpClient()`.           |
| **Injectable Services**        | `@Injectable` and `@Service` classes, plus `signalStore` and `InjectionToken` declarations with `providedIn`. |
| **inject() Calls**             | `inject(T)` calls and constructor parameters of decorated classes, typed or with `@Inject(T)`.                |
| **Component Providers**        | Any `providers` or `viewProviders` array, in components, routes, app config or NgModules.                     |

If the devtools server does not answer, the tab says **Couldn't load DI data** with a **Retry** button instead of an empty list. If only the live tree fails, the source list stays and a **Couldn't load the live injector tree** message with **Retry** sits above it.

### Startup timing

Below the live tree, the **Startup** section shows how the shown page started, from navigation start, and how long Angular took from its start to the app's first stable state.

| Milestone                  | Where it comes from                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **DOM content loaded**     | The browser's navigation timing.                                                                           |
| **First contentful paint** | The browser's paint timing.                                                                                |
| **Angular started**        | When Angular published `ng`, with the startup hook. Without it, Angular's first `mark_feature_usage` mark. |
| **Root component created** | Angular's profiler, with the startup hook on Angular 20 or later.                                          |
| **First stable**           | The first time `ApplicationRef.isStable` was `true`.                                                       |
| **Load event**             | The browser's navigation timing.                                                                           |
| **Overlay started**        | When the overlay ran on the page.                                                                          |

The first stable time is exact when the overlay or the startup hook watched the app become stable. Sometimes the overlay loads after that, as when `main.ts` imports it after `whenStable()`. The overlay then checks an app that is already stable, so it knows only that the app became stable before this time. The row reads **First stable, at the latest**.

**Slowest providers** lists the providers that took longest to construct, by own time (without the providers each one created while it ran), with total time and instance count. Components and directives show up in it too, since Angular creates them through injectors. Angular reports provider construction only through its own profiling (`ng.enableProfiling()`, Angular 20 or later, development builds), so this list needs the startup hook loaded before Angular, from the polyfills of your development build. A configuration's `polyfills` replaces the build target's list, so repeat the polyfills the target already has and add the hook after them:

```json
// angular.json (or project.json), build target
"configurations": {
  "development": {
    "polyfills": ["zone.js", "@pangular-inspector/devtools/startup-hook"]
  }
}
```

A zoneless app has no `zone.js` in its polyfills, so it lists only the hook (and any other polyfills it has).

The hook turns Angular's profiling on right after `bootstrapApplication()` creates the platform and reads its provider entries until one second after the app is first stable, then turns it off. Providers created by environment initializers before that point are not timed. Angular's own track shows in the Chrome Performance panel while the hook records.

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay reads the tree with Angular's debug API and pushes it with the component tree, after change detection.
  </ngmd-card>
  <ngmd-card icon="file" title="Source scan">
    The server reads your <code>.ts</code> files, skipping specs and type declarations.
  </ngmd-card>
</ngmd-card-grid>

### Debug APIs

The live tree needs a development build. It uses `ng.getInjector`, `ng.getComponent`, `ng.getDirectives` and these private helpers:

- `ɵgetInjectorMetadata` tells element and environment injectors apart.
- `ɵgetInjectorProviders` lists the providers of each injector.
- `ɵgetInjectorResolutionPath` gives the lookup path.
- `ɵgetDependenciesFromInjectable` gives the tokens each class injects.

The source-mode notice says to connect the overlay to a development build for the live tree. Before Angular 17.0 some of these helpers are missing, and the tree is reduced. See [On older Angular](#on-older-angular).

## How to use it

### Fix a NullInjectorError

<ngmd-workflow>
  <ngmd-step title="Search for the token">
    Type the token name in the search box. If no <strong>Provided by</strong> chip appears, nothing on the page provides it.
  </ngmd-step>
  <ngmd-step title="Select the component that asks for it">
    Read <strong>Injected here</strong>. The token is marked <strong>not provided anywhere</strong>.
  </ngmd-step>
  <ngmd-step title="Read the lookup path">
    Each step is an injector Angular asked. Add the provider to one of them, usually the app config or the component.
  </ngmd-step>
</ngmd-workflow>

When the error reached the page, the [Errors](./errors.md#missing-provider-ng0201) tab has an **Explain lookup** button on it. It walks the same path for the missing token and says at each injector whether it provides the token and why the lookup stops. An agent does the same with `explain-injection`, flags included.

### Explain a lookup with flags

`pangular:explain-injection` follows Angular's own lookup for a token from one component, element or environment injector, without creating anything:

| Flag       | What changes                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `self`     | Only the first injector is asked.                                                                                                                                                               |
| `skipSelf` | The lookup starts at the parent injector.                                                                                                                                                       |
| `host`     | The lookup stops at the host element of the component whose template declares the start. There, only its `viewProviders` and the component itself count. Environment injectors are never asked. |
| `optional` | A token nobody provides gives `null` instead of NG0201.                                                                                                                                         |

Each step says **provides it**, **not provided**, **hidden** (only in `viewProviders`, which projected content can't see), **skipped**, **not asked** or **unknown**. A service created on demand, such as `providedIn: 'root'`, counts as provided by the injector that gave it to something else on the page. Before anything injects it, the root injector's step says the tool can't tell from the token name.

### Find which instance a component gets

<ngmd-workflow>
  <ngmd-step title="Select the component">
    Open its element injector.
  </ngmd-step>
  <ngmd-step title="Read Injected here">
    Each token shows the injector that answered. A component-level provider shadows the root one.
  </ngmd-step>
</ngmd-workflow>

### Keyboard

Arrow keys, Home and End move the selection through the tree. The right arrow expands a row or moves to its first child. The left arrow collapses a row or moves to its parent. The first row is selected when nothing else is.

Press Escape in the search box to clear it. When the search matches nothing, **Clear search** clears it and moves focus back to the search box. In the source scan view, **Clear filter** does the same.

If the selected injector leaves the page because its component or directive was destroyed, the details say so and a screen reader announces it. The tab doesn't pick another injector for you. Click **Show** with the first injector's name, or select a row.

## Agent tools

| Tool or resource             | Kind     | What it does                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pangular:get-providers`     | tool     | DI providers from source: `@Injectable` services, `inject()` calls, constructor parameters and `providers` arrays.                                                                                                                                                                                                                                                             |
| `pangular:explain-injection` | tool     | The lookup of one token from a component, element or environment injector, step by step, with `self`, `skipSelf`, `host` and `optional`. Says at each injector whether it provides the token and why the lookup stops. See [Explain a lookup with flags](#explain-a-lookup-with-flags).                                                                                        |
| `pangular:inspect-providers` | tool     | The injector tree a page reported, with what components and created services inject. `selector` narrows it to matching element or environment injectors (`Root`, `Platform`, `Route: admin`) or a component instance id, `token` to where a token is provided and injected. `componentId` and `framework` mark the owning component and Angular's own injectors and providers. |
| `pangular:startup-timing`    | tool     | How the page started: milestones from navigation start to the first stable state, and the slowest providers to construct with own and total time. See [Startup timing](#startup-timing).                                                                                                                                                                                       |
| `pangular:injector-tree`     | resource | The live tree last reported by a page.                                                                                                                                                                                                                                                                                                                                         |

See [Tools](../agents/tools.md) and [Resources](../agents/resources.md).

## Limits and gotchas

### On older Angular

The full tree needs Angular 17.0 or later. On older versions the tab shows a note with the page's version above a reduced tree:

| Angular      | What the tree shows                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| 16.2 to 16.x | Element and environment injectors with providers and dependencies. Lookup paths list only the environment injectors. |
| 12.0 to 16.1 | Element injectors with their components and directives, without providers or environment injectors.                  |

`inspect-providers` starts its answer with the same note. Before 16.2, `explain-injection` rebuilds the lookup path from the rendered tree and answers **unknown** where it can't see providers, and says so. See [Supported Angular versions](../getting-started/installation.md#supported-angular-versions).

### Up to 2000 element injectors

The page reports at most 2000 element injectors. Environment injectors are kept after them, up to 2500 injectors in all, so they never push element injectors out. Injectors nested more than 1000 levels deep are left out too. When any of these limits cuts the tree, a notice above the tree says the page reported only part of its injector tree, and a lookup path or a provider can point to an injector that isn't listed. `inspect-providers` says it too.

### Some injectors can't be highlighted

Hover highlights need a CSS selector for the element. Elements inside a shadow root and `<ng-container>` elements have none, so hovering them highlights nothing.

### Source mode only knows some provide functions

The **Root Providers** group matches a fixed list of Angular `provide*()` functions. It doesn't list your own provider functions.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why is a constructor-injected service missing from source mode?">
    The source scan reads constructor parameters only in classes with an Angular decorator, such as <code>&#64;Component</code> or <code>&#64;Injectable</code>. A parameter typed as a primitive, without <code>&#64;Inject()</code>, has no token to list. The live tree has every injection.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does the tab show source mode instead of the live tree?">
    No live tree has reached the tab. The live tree needs the overlay and a development build of Angular 12 or later. If the page's Angular lacks the debug API, the tab says which version it needs.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Open">
    Each instance, with the services it injects.
  </ngmd-card>
  <ngmd-card icon="box" title="NgRx Store" link="/inspectors/ngrx-store" cta="Open">
    Signal stores, found through the injectors.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
  <ngmd-card icon="compass" title="Browser overlay" link="/getting-started/overlay" cta="Set up">
    The script that reports the live page.
  </ngmd-card>
</ngmd-card-grid>
