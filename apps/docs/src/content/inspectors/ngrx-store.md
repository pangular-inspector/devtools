---
title: NgRx Store
description: Live NgRx signal stores and @ngrx/store state, with entities, dispatched events, change logs, diffs, restore and dispatch.
---

<ngmd-hero title="NgRx Store" logo="https://cdn.simpleicons.org/ngrx/BA2BD2" gradient>
  Your NgRx state as it changes. Signal stores and the classic Store, with entity collections, dispatched events, a log of every change, a diff per entry, restore and dispatch.
</ngmd-hero>

# NgRx Store

The Store tab shows your *NgRx state live. It covers `@ngrx/signals` stores (`signalStore` and `signalState`) and the classic `@ngrx/store`. With the hub mounted, it lives in the **NgRx** dock.

The tab has two sections. **Live stores** reads the running page. **Source declarations** lists what your files declare.

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
- **State**, **Computed** and **Methods**, with a call count per method. The tab tags `signalMethod` and `rxMethod` members. Once a method has been called, its chip also shows the average and last call duration, in milliseconds.
- **Entities**, for a `signalStore` that calls `withEntities()`. One group per collection, with the entity count and the ids as chips. A group past 30 ids shows the first 30 and a count of the rest.

### Change log

Signal stores get a **Change log**. The classic Store gets an **Action log**. Each entry shows its number, its type, the number of changes and the time. A method-call entry also shows how long the call itself took, and an entry whose change came from a dispatched event carries a tag with the event's type. An action also shows a badge for where it came from:

| Badge      | Sent by                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `dispatch` | A `store.dispatch(action)` call, usually from a component or a service.       |
| `effect`   | An NgRx effect. Effects send their actions through `Store.next`.              |
| `reactive` | `store.dispatch(() => action)`, which dispatches again when a signal changes. |

Open an entry to see its arguments, or the action and its **Origin** for the classic Store, and a **State diff** with the value before and after each change. The diff lists up to 50 changes. A method-call entry also shows its **Duration**, in milliseconds. An entry caused by a dispatched event shows the event under **Caused by event**. An action entry also has **Dispatch again**.

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

## Agent tools

| Tool or resource                | Kind     | What it does                                                                                                                      |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:get-ngrx-store`       | tool     | NgRx declarations from source, with the members of each `signalStore` and the type strings of each action.                        |
| `pangular:dispatch-ngrx-action` | tool     | Dispatches an action to the classic Store, or an action from the log again, and returns the new log entry.                        |
| `pangular:ngrx-store`           | resource | The live stores per page, with state, computeds, methods, references and the change log. Classic Store actions carry an `origin`. |
| `pangular:inspect-signal-store` | tool     | The live state of one store, or a summary of every store discovered so far.                                                       |
| `pangular:signal-store-history` | tool     | The live change log, oldest first: state diffs, classic `@ngrx/store` actions and `@ngrx/signals/events` events.                  |

No tool can restore a state. See [Dispatch an action](../agents/tools.md#dispatch-an-action) and [Resources](../agents/resources.md).

## Limits and gotchas

### `watchState` needs `registerNgrxSignals`

Without it, restore writes the state signals directly. Components update, but `watchState` listeners do not run, and the log entry says so. Call `registerNgrxSignals({ patchState, watchState })` from `@pangular-inspector/devtools/overlay` once, and restore goes through `patchState`. This applies to `signalStore` only. A `signalState` restore always writes directly. See [Restore NgRx signal state](../guides/ngrx-signals-restore.md).

### Stores appear when they are created

Angular creates a `signalStore` the first time something injects it. Open a page that uses it, and it appears.

### The classic Store must be in an environment injector

Use `provideStore()` or `StoreModule.forRoot()`. The overlay stops looking after a few tries, so if you provide the Store late, reload the page.

### Redaction

The devtools replace state keys with secret-looking names with `[redacted]`, at any depth. See [what the devtools redact](../security.md).

### Action origin

The origin comes from the Store calls made while the page is connected. A `store.dispatch(() => action)` that started before the overlay connected shows as `dispatch`. An action sent straight to `ActionsSubject` has no origin.

### Write actions

Restore, **Back to latest**, **Dispatch** and **Dispatch again** need [`actions.ngrx`](../getting-started/configuration.md#actions). With it off, the panel disables them and the server refuses them.

### Log size

The log keeps the last 200 entries. Set the count with [`limits.changeLog`](../getting-started/configuration.md#limits). Once older entries are dropped, the log says how many. The overlay logs a method call that changes nothing at most once per second.

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
