---
title: NgRx Store
description: Live NgRx signal stores and @ngrx/store state, with entities, dispatched events, change logs, diffs, restore and dispatch, plus NGXS, Elf and MiniRx stores.
---

<ngmd-hero title="NgRx Store" logo="https://cdn.simpleicons.org/ngrx/BA2BD2" gradient>
  Your NgRx state as it changes. Signal stores and the classic Store, with entity collections, dispatched events, a log of every change, a diff per entry, restore and dispatch.
</ngmd-hero>

# NgRx Store

The Store tab shows your *NgRx state live. It covers `@ngrx/signals` stores (`signalStore` and `signalState`) and the classic `@ngrx/store`. NGXS, Elf and MiniRx stores show up in the same list through their Redux DevTools integration (see [Other stores](#other-stores)). With the hub mounted, it lives in the **NgRx** dock.

The tab has two sections. **Live stores** reads the running page. **Source declarations** lists what your files declare.

<ngmd-image src="/images/panel/ngrx-store.png" alt="The Store tab with three live stores listed and the PackingStore signal store selected, showing its scope, its source file, the state as a tree of packing items, its methods with call counts, and the start of its change log"></ngmd-image>

## What it shows

### Store list

Each store shows its label, its kind (**signalStore**, **signalState** or **@ngrx/store**), its scope and its change count. The scope is where the store lives:

- `root`, `platform` or another environment injector that provides it.
- `Owner (component)` for a store a component provides.
- `Owner (field)` for a store found only in a component field.

The tab labels a signal store with the matching declaration name from your source. Without a match, it uses the first component field that holds it, then its class name. The classic Store shows with the label **Store**. Use the filter box to narrow stores, changes and declarations. When more than one page reports, a picker chooses the page.

### Store detail

Select a store to see:

- Its kind, scope and declaring file. The file appears when the store's state keys match a `signalStore` or `signalState` in your source.
- **Store DevTools on** or **Store DevTools off**, for the classic Store.
- **Referenced by**: the component fields that hold it.
- **State**, **Computed** and **Methods**, with a call count per method. **Copy** next to **State** copies the state as shown in the panel, with secrets already redacted. The copy is the panel's formatted text, not strict JSON. The tab tags `signalMethod` and `rxMethod` members. Once a method has been called, its chip also shows the average and last call duration, in milliseconds.
- **Entities**, for a `signalStore` that calls `withEntities()`. One group per collection, with the entity count and the ids as chips. A group past 30 ids shows the first 30 and a count of the rest.

### Store the state as a global

**Store as global** next to **State** stores a copy of the selected store's state in the page console as `temp1`, then the first free `tempN`, and shows the name it used. For the classic Store, the copy is the whole state. For a signal store, it holds the state fields. Secret-looking keys, JWTs and `Bearer` values are replaced by `[redacted]` in the copy, and the button then says **Stored a copy as temp1, with secret fields masked.** Changing the copy doesn't change the store. Only the tab you are looking at gets the global. See [Console handles](./components.md#console-handles).

### Change log

Signal stores get a **Change log**. The classic Store gets an **Action log**. Each entry shows its number, its type, the number of changes and the time. A method-call entry also shows how long the call itself took, and an entry whose change came from a dispatched event carries a tag with the event's type. An action also shows a badge for where it came from:

| Badge      | Sent by                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `dispatch` | A `store.dispatch(action)` call, usually from a component or a service.       |
| `effect`   | An NgRx effect. Effects send their actions through `Store.next`.              |
| `reactive` | `store.dispatch(() => action)`, which dispatches again when a signal changes. |

Open an entry to see its time, **Origin** and **Duration**, and three tabs. **Action** shows the action, or the method's arguments and the event that caused it. **Diff** shows the **State diff** with the value before and after each change. **State** reads the whole state of the store right after the entry, or right before it, from the page; see [Read any past state](#read-any-past-state). The diff lists up to 50 changes. When there were more, a line under it says how many are not shown, for example **12 more changes not shown**, and the entry's change count includes them. The overlay counts up to 1000 more, so a larger change reads **1000+ more changes not shown**. A method-call entry also shows its **Duration**, in milliseconds. An entry caused by a dispatched event shows the event under **Caused by event**. An action entry also has **Dispatch again**. **Copy** next to **State diff** copies that entry's diff in the same format as **State**, one object per change with its `path`, `op`, `before` and `after`. An entry that changed nothing has no diff to copy.

Entry numbers start at 1 again when the app reloads. So when the app reloads, or the selected page closes and the tab shows another one, the open entry closes and a pending **Restore** confirmation is cancelled.

### Read any past state

The **State** tab of an entry asks the page for the state of the store around that entry and shows it with **After #N** and **Before #N**, with **Copy**. The page keeps the states of every entry still in the log. NgRx state is immutable, so consecutive states share everything an entry did not change, and keeping them costs what changed. Values are redacted like the rest of the tab. When the log entry lists only 50 changes, **Show all changes** on the **Diff** tab reads up to 500 of them.

Reading a state changes nothing in the app, so it works with [`actions.ngrx`](../getting-started/configuration.md#actions) off.

### Session

Under the log, **Session** works on a range of the selected NgRx store's entries, picked with **From** and **To**:

| Control            | What it does                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Export session** | Saves the range as a JSON file: the state before the first entry, then each action or method call with the changes it made.                                                                                        |
| **Import session** | Reads an exported file back. Its entries show under **Imported** with the same **Action**, **Diff** and **State** tabs, and **Generate test** works on the whole session. The app does not change.                 |
| **Generate test**  | Writes a Vitest spec that starts from the state before the range, replays its actions or method calls, and expects the state after it. **Copy** and **Download** save it. Notes above the code say what to adjust. |

An `@ngrx/store` range becomes a reducer spec: for one feature reducer when only one top-level key changed, or through `combineReducers` otherwise. A signal store range becomes a spec that injects the store with `TestBed`, sets the start state with `unprotected()` from `@ngrx/signals/testing`, calls the recorded methods and checks `getState()`. A `patchState` write outside a method is replayed as a `patchState` call with what it changed. Point the import at your reducer or store, since the devtools cannot tell its file.

The server checks an imported file before it reads it: the format and version, at most 1000 entries and 4,000,000 characters, and change paths that cannot reach a prototype. It keeps at most 5 imported sessions, each for an hour after its last use.

### Events

When a page dispatches at least one `@ngrx/signals/events` event, an **Events** section lists them: the event type, its payload and the time. This section covers every store on the page, not only the selected one. Open an event to see its full payload in the same detail panel as the change log.

### Dispatch an action

The classic Store gets a **Dispatch an action** form under the action log. **Type** suggests the action types from your source and the log. **Payload** takes the action props as a JSON object, like `{"id": 7}`, and cannot have a `type` key. **Dispatch** sends the action through `store.dispatch`, so the log gets a `dispatch` entry and the tab selects it.

### Source declarations

The server scans your files for:

- `signalStore` with its `withState`, `withComputed`, `withMethods`, `withProps`, `withHooks`, `withEntities` and `rxMethod` members.
- `signalState` and `signalMethod`.
- `createAction`, `createActionGroup`, `createReducer`, `createEffect`, `createSelector`, `createFeatureSelector` and `createFeature`. An action shows its type strings, like `[Cart] Add Item`, when they are string literals.
- Store setup: `provideStore`, `provideState`, `provideEffects`, and the `StoreModule` and `EffectsModule` calls.

Filter by kind with the chips.

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay finds stores in the page's injectors and component fields, and records every change.
  </ngmd-card>
  <ngmd-card icon="file" title="Source scan">
    The server reads your <code>.ts</code> files for NgRx declarations, skipping specs.
  </ngmd-card>
</ngmd-card-grid>

### How changes are recorded

The overlay wraps the state signals of each signal store and the store's methods. Every method call, nested or not, adds its duration to that method's average and last figures in **Methods**. The duration covers the synchronous call only, not any async work an `rxMethod` or an effect starts from it.

How the log groups changes depends on whether `watchState` is registered (see [Restore NgRx signal state](../guides/ngrx-signals-restore.md)):

| Setup                | Change log entries                                                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| With `watchState`    | One entry per `patchState` call, including several in the same tick, labeled with the method that is running. Each entry carries a duration: the time from the start of that method to that patch, so an earlier patch in a method shows a shorter duration than a later one. |
| Without `watchState` | One entry per outermost method call that changes state, with the duration of the whole call. Writes outside a method are grouped per microtask into one `patchState` entry.                                                                                                   |

A `patchState` outside a method and a `Restore #N` entry carry no duration. A method call that changes nothing still gets an entry, at most once per second.

For the classic Store, the overlay listens to the dispatched actions. It also wraps `dispatch` and `next` on the Store to tag each action with its origin, and puts them back when the page disconnects.

The overlay diffs a copy of the state that keeps the first 100 items of each array or object. When a change is past that limit, it compares the live state instead, so the entry still lists the change.

For `@ngrx/signals/events`, the overlay finds the platform `Dispatcher` and every component-scoped one from `provideDispatcher()`, and records each event once, from the dispatcher that handles it. When a store's state changes while an event is being dispatched, that change's log entry is tagged with the event.

### Development builds

The overlay finds stores through Angular's debug API, so the live section needs a development build.

## How to use it

### Find the change that broke the state

<ngmd-workflow>
  <ngmd-step title="Select the store">
    Pick it in the list. Filter by name if there are many.
  </ngmd-step>
  <ngmd-step title="Walk the log">
    Open entries from newest to oldest. Each <strong>State diff</strong> shows the keys that changed.
  </ngmd-step>
  <ngmd-step title="Read the arguments">
    The entry that set the wrong value shows the method and the arguments it got.
  </ngmd-step>
</ngmd-workflow>

### Restore an earlier state

<ngmd-workflow>
  <ngmd-step title="Open an entry">
    Pick the change you want to go back to.
  </ngmd-step>
  <ngmd-step title="Restore this state">
    Click <strong>Restore this state</strong>, then <strong>Restore</strong> to confirm. Focus moves to <strong>Cancel</strong>. Press <kbd>Escape</kbd> or <strong>Cancel</strong> to back out.
  </ngmd-step>
  <ngmd-step title="Check the page">
    Components that read the store update at once. The log gets a <code>Restore #N</code> entry.
  </ngmd-step>
</ngmd-workflow>

### Restore modes

<ngmd-tabs>
  <ngmd-tab title="Signal store" icon="zap">
    Restore sets every state key that differs back to its value right after that change. Every state signal must be writable.
  </ngmd-tab>
  <ngmd-tab title="&#64;ngrx/store" icon="box">
    Restore uses Store DevTools to jump to the state right after that action, and the log gets a <code>Restore #N</code> entry. Unless you restored the newest action, the store is then paused on that state: a <strong>Viewing a past state</strong> banner appears, and new actions are logged but do not change the state. Select <strong>Back to latest</strong> to resume. It needs <code>provideStoreDevtools()</code>. Without it, entries cannot be restored, but you can still dispatch actions.
  </ngmd-tab>
</ngmd-tabs>

### Turn a bug into a test

<ngmd-workflow>
  <ngmd-step title="Reproduce it">
    Use the app until the state goes wrong, with the store selected.
  </ngmd-step>
  <ngmd-step title="Pick the range">
    In <strong>Session</strong>, set <strong>From</strong> to the last good entry and <strong>To</strong> to the one that broke the state. Check them on the <strong>State</strong> tab of each entry.
  </ngmd-step>
  <ngmd-step title="Generate the test">
    Click <strong>Generate test</strong>, then <strong>Download</strong>. Save the spec next to your reducer or store, point its import there, and fix the expected state to what it should be.
  </ngmd-step>
</ngmd-workflow>

To share the bug instead, **Export session** and send the file. Anyone can **Import session** it to read the same entries and states.

### Replay an action

<ngmd-workflow>
  <ngmd-step title="Open an action">
    Pick an entry in the <strong>Action log</strong>.
  </ngmd-step>
  <ngmd-step title="Dispatch again">
    Click <strong>Dispatch again</strong>. The Store gets a copy of the same action, and the log gets a new entry with its diff.
  </ngmd-step>
</ngmd-workflow>

To try another payload, type the action in **Dispatch an action** instead.

## Other stores

NGXS, Elf and MiniRx each ship an integration for the Redux DevTools browser extension. The overlay stands in for that extension, so these stores report to the Store tab too: their name, their state and every action they send, with a state diff per action.

| Library | Its devtools integration                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| NGXS    | `withNgxsReduxDevtoolsPlugin()` from `@ngxs/devtools-plugin` (or `NgxsReduxDevtoolsPluginModule.forRoot()`) |
| Elf     | `devTools()` from `@ngneat/elf-devtools`                                                                    |
| MiniRx  | `new ReduxDevtoolsExtension()` in the store's `extensions`                                                  |

Any other library that calls `window.__REDUX_DEVTOOLS_EXTENSION__.connect()` reports the same way, with the library shown as **Redux DevTools**.

### Set it up

These libraries look for the extension once, when the app starts, and the overlay usually connects later. Load `@pangular-inspector/devtools/store-hook` before your app, from the polyfills of your development configuration. A configuration's `polyfills` replace the list in the build's `options`, so copy that list and add the hook to it. In `angular.json` (excerpt):

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "configurations": {
            "development": {
              "polyfills": ["zone.js", "@pangular-inspector/devtools/store-hook"]
            }
          }
        }
      }
    }
  }
}
```

This sample assumes the base list is `["zone.js"]`. Leave `zone.js` out if your app doesn't use it. The hook starts on import, and does nothing when `ngDevMode` is off. Without it, the overlay installs the stand-in when it connects, so only stores that connect after that report.

On a device, see [Other stores on a device](../getting-started/angular-native.md#other-stores-on-a-device) for Angular Native. The [NativeScript](../getting-started/nativescript.md#how-it-works) overlay installs the stand-in itself before the app starts.

### In the Store tab

Each store shows its name (the `name` option it passed, or the library), **Redux DevTools** as its kind, the library, such as **NGXS**, and how many actions its log holds, `@@INIT` included. Select it for its **State** and its **Action log**. Each entry shows the action and a **State diff** against the state before it, with up to 50 changes, without the **Action**, **Diff** and **State** tabs of the NgRx log. The first entry of NGXS is `@@INIT`, with the initial state.

The tab only reads these stores. It has no **Restore**, **Dispatch again**, **Store as global** or **Session** for them, since the page keeps only their latest state.

### With the Redux DevTools extension installed

The extension keeps working. The overlay passes every call on to it, and returns the extension's answers to the store, so jumps and imports in the extension still reach the app. The overlay itself never sends anything back to the store.

`@ngrx/store-devtools` connects through the same API. The overlay passes it on to the extension when one is installed and does not list it again, since the classic Store already shows in the tab.

### Turn it off

The stand-in is part of the NgRx inspector. With [`inspectors.ngrx`](../getting-started/configuration.md#inspectors-and-agent-tools) set to `false`, the overlay removes it again when it connects and puts back the extension, if there was one. The log keeps the last [`limits.changeLog`](../getting-started/configuration.md#limits) actions per page.

## Agent tools

| Tool or resource                | Kind     | What it does                                                                                                                      |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:ngrx-scan`            | tool     | NgRx declarations from source, with the members of each `signalStore` and the type strings of each action.                        |
| `pangular:ngrx-dispatch`        | tool     | Dispatches an action to the classic Store, or an action from the log again, and returns the new log entry.                        |
| `pangular:ngrx-store`           | resource | The live stores per page, with state, computeds, methods, references and the change log. Classic Store actions carry an `origin`. |
| `pangular:ngrx-inspect-store`   | tool     | The live state of one store, or a summary of every store discovered so far.                                                       |
| `pangular:ngrx-history`         | tool     | The live change log, oldest first: state diffs, classic `@ngrx/store` actions and `@ngrx/signals/events` events.                  |
| `pangular:ngrx-inspect-entry`   | tool     | The State, Diff and Action of one past entry, from the page or an imported session.                                               |
| `pangular:ngrx-export-session`  | tool     | A range of one store's log as session JSON.                                                                                       |
| `pangular:ngrx-import-session`  | tool     | Reads an exported session back, for the two tools above and below.                                                                |
| `pangular:ngrx-generate-test`   | tool     | A Vitest spec from a range of entries, live or imported.                                                                          |
| `pangular:ngrx-restore`         | tool     | Restores the state after an entry, or sends Store DevTools back to the latest state. An action tool.                              |
| `pangular:redux-inspect-stores` | tool     | The NGXS, Elf, MiniRx and other Redux DevTools stores of a page, or one of them with its state and latest actions.                |

See [NgRx tools](../agents/tools.md#ngrx-inspect-entry), [Restore a state](../agents/tools.md#restore-a-state) and [Resources](../agents/resources.md).

## Limits and gotchas

### On older Angular

The overlay finds the `@ngrx/store` `Store`, and signal stores that components provide, through `ng.ɵgetInjectorProviders`, which Angular 16.2 added. On an older page the tab finds no such store and shows a note with the page's version. See [Supported Angular versions](../getting-started/installation.md#supported-angular-versions).

### `watchState` needs `registerNgrxSignals`

Without it, restore writes the state signals directly. Components update, but `watchState` listeners do not run, and the log entry says so. Call `registerNgrxSignals({ patchState, watchState })` from `@pangular-inspector/devtools/overlay` once, and restore goes through `patchState`. This applies to `signalStore` only. A `signalState` restore always writes directly. See [Restore NgRx signal state](../guides/ngrx-signals-restore.md).

### Stores appear when they are created

Angular creates a `signalStore` the first time something injects it. Open a page that uses it, and it appears.

### The classic Store must be in an environment injector

Use `provideStore()` or `StoreModule.forRoot()`. The overlay stops looking after a few tries, so if you provide the Store late, reload the page.

### Redaction

The devtools replace state keys with secret-looking names with `[redacted]`, at any depth. A signal store method call that writes such a key shows every argument as `[redacted]` in the change log, and so do later calls of that method. An argument whose parameter name looks secret, such as `password` in `login(email, password)`, is masked too. See [what the devtools redact](../security.md#components-signals-ngrx-and-pipes).

### Action origin

The origin comes from the Store calls made while the page is connected. A `store.dispatch(() => action)` that started before the overlay connected shows as `dispatch`. An action sent straight to `ActionsSubject` has no origin.

### Copy needs clipboard access

The copy buttons use the browser clipboard. If the panel cannot write to it, for example in a page without clipboard permission, the tab says **The clipboard is not available here.** instead of **Copied.**

### Write actions

Restore, **Back to latest**, **Dispatch** and **Dispatch again** need [`actions.ngrx`](../getting-started/configuration.md#actions). With it off, the panel disables them, the server refuses them, and the `ngrx-dispatch` and `ngrx-restore` tools are dropped. The **State** tab, **Session** and their tools only read, so they keep working.

### Log size

The log keeps the last 200 entries, and the page keeps the states of the same entries for the **State** tab and **Export session**. Set the count with [`limits.changeLog`](../getting-started/configuration.md#limits). Once older entries are dropped, the log says how many. The overlay logs a method call that changes nothing at most once per second.

### Past states assume immutable state

The page keeps a reference to each state an entry produced. NgRx reducers and `patchState` return new objects, so those references stay as they were. An app that mutates its state objects in place changes the kept states too, and the **State** tab then shows the newer values. Exported states are serialized like the rest of the tab, so very deep or large values are cut and marked, and a generated test notes them.

### The selected entity is a convention, not an API

`@ngrx/signals` has no built-in concept of a selected entity. The tab looks for a `selectedId` state key (or `<collection>SelectedId` for a named collection) next to a `withEntities()` collection, and shows it as **Selected** when it holds a value. A `null` or missing key shows no **Selected** row.

### Events come from every `Dispatcher`, and only synchronous changes are tagged

The overlay listens to the platform `Dispatcher` from `@ngrx/signals/events`. It also listens to a `Dispatcher` that a component provides with `provideDispatcher()`, and stops when that component is destroyed. An event sent with `scope: 'parent'` or `scope: 'global'` is logged once, by the dispatcher that handles it.

A change gets a **Caused by event** tag only when it happens during the `dispatch()` call, like a `withReducer()` case or an event handler that patches state right away. A change made later, after an HTTP call or a timer, shows as a plain state change. The tag names the event, not which case reducer handled it.

### `signalMethod` vs `rxMethod`

Both wrap the returned callable with a `.destroy` function, so the overlay cannot tell them apart from the live store alone. The tab reads the source scan to decide which label to show. A store with no matching declaration file (because its state keys do not line up with any `signalStore` in the scanned source) labels every reactive method as `rxMethod` by default.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why can't I restore an &#64;ngrx/store entry?">
    Store DevTools is not set up, so entries cannot be restored. The store detail shows <strong>Store DevTools off</strong>. Add <code>provideStoreDevtools()</code> to the app config.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why is there no Restore for an older action?">
    Store DevTools no longer holds it. The entry says <strong>Store DevTools no longer holds this action</strong>. With <code>maxAge</code> set, Store DevTools keeps only the last <code>maxAge</code> actions, while the log keeps 200 entries. Raise <code>maxAge</code> in <code>provideStoreDevtools()</code> to restore further back. Committing, resetting or importing the history in the Redux DevTools extension also removes the older actions, and no setting brings them back.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why is there no Restore for an action Store DevTools never recorded?">
    Store DevTools skipped it. An <code>actionsBlocklist</code>, <code>actionsSafelist</code> or <code>predicate</code> option filtered it out, or recording was paused in the Redux DevTools extension. The entry says <strong>Store DevTools never recorded this action</strong>. Change the filter so Store DevTools records the action next time.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does restore say this change is no longer in the page history?">
    The entry fell out of the 200-entry log in the page. Pick a newer entry.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does my store have no declaring file?">
    The tab matches the file by state keys. A store whose keys match no <code>signalStore</code> or <code>signalState</code> in the scanned source has none.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="wrench" title="Restore NgRx signal state" link="/guides/ngrx-signals-restore" cta="Guide">
    Register <code>patchState</code> and <code>watchState</code> so restore notifies listeners and each patch gets its own entry.
  </ngmd-card>
  <ngmd-card icon="zap" title="Signals" link="/inspectors/signals" cta="Open">
    The signal graph of the components that read the store.
  </ngmd-card>
  <ngmd-card icon="layers" title="Injectors" link="/inspectors/injectors" cta="Open">
    Where each store is provided.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
</ngmd-card-grid>
