# Angular Native demo

A small [Angular Native](https://ng-native.com) app (Expo, React Native's Fabric renderer) wired to Pangular Inspector with `@pangular-inspector/devtools/overlay-angular-native`. It gives the live tabs something to show:

| File                         | What it covers                                              |
| ---------------------------- | ----------------------------------------------------------- |
| `src/main.ts`                | `mount()` and the overlay, started in `__DEV__` only        |
| `src/app/app.ts`             | The root component with a `signal()`                        |
| `src/app/counter-card.ts`    | An `input()`, a `computed()` and an injected service        |
| `src/app/counter.service.ts` | A root service with a signal and a computed                 |
| `src/app/todo.store.ts`      | An `@ngrx/signals` store with state, a computed and methods |
| `src/app/todo-list.ts`       | A component that reads the store in an `@for` block         |

The app is not part of the pnpm workspace (`pnpm-workspace.yaml` excludes it), so the root install and CI never pull in Expo or React Native. It installs with npm and uses the devtools package built from this repository, as a tarball, so Metro bundles the same files that npm publishes.

## Requirements

- Node and the repository's own setup (`pnpm install` at the root).
- Xcode with an iOS simulator, or Android Studio with an emulator. See the [Expo environment setup](https://docs.expo.dev/get-started/set-up-your-environment/) for a development build.

## Run it

1. Build and pack the devtools package into this folder, then install:

   ```bash
   cd examples/angular-native
   npm run devtools:pack
   npm install
   ```

   After a change in `packages/devtools`, run `npm run devtools:pack` and then `npm install ./pangular-inspector-devtools.tgz`. A plain `npm install` keeps the tarball it installed before, because `package-lock.json` pins it.

2. Start the devtools server in its own terminal. It scans this app's `src` folder and listens on `http://localhost:9999/`:

   ```bash
   npm run devtools
   ```

   `--no-auth` is in the script because the app can't answer the one-time code. Keep the server on `localhost`.

3. Build and start the app. The first run generates the native `ios` or `android` folder (ignored by git) and starts Metro:

   ```bash
   npm run ios
   ```

   On Android, forward the devtools port as well, so the emulator's `localhost:9999` reaches your machine:

   ```bash
   adb reverse tcp:9999 tcp:9999
   npm run android
   ```

4. Open `http://localhost:9999/`. The Metro log shows `[pangular] Connected to the devtools server at http://localhost:9999/`, and the **Components**, **Signals**, **Injectors** and **Store** tabs fill. Hover a component in the tree to outline its view on the device.

If you restart the devtools server, the app reconnects within five seconds.

Type-check the app with `npm run typecheck`.

The setup is explained in the [Set up Angular Native](../../apps/docs/src/content/guides/angular-native.md) guide.
