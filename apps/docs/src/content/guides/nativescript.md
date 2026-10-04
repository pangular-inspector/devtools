---
title: Set up NativeScript
description: Inspect a NativeScript Angular app from the simulator or a device, step by step.
---

<ngmd-hero title="Set up NativeScript" logo="https://cdn.simpleicons.org/nativescript/3C5AFD" gradient>
  A NativeScript overlay walks the native view tree and reports over a WebSocket to a devtools server on your machine.
</ngmd-hero>

# Set up NativeScript

This guide adds the devtools to a NativeScript Angular app. The app has no DOM, so a separate overlay walks the native view tree through *Angular's debug API and reports to the standalone devtools server.

## What you get

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Angular inspectors">
    The component tree, the signal graph and the injector tree, including environment injectors and their providers.
  </ngmd-card>
  <ngmd-card icon="box" title="NgRx stores">
    Signal stores and the change log, when your app uses NgRx.
  </ngmd-card>
  <ngmd-card icon="search" title="Highlight">
    The highlight tool outlines a component's view on the simulator or device.
  </ngmd-card>
  <ngmd-card icon="terminal" title="MCP endpoint">
    <code>/__mcp</code> on the devtools server. The source scanners read the app's <code>src/</code>.
  </ngmd-card>
</ngmd-card-grid>

## The flow

<ngmd-workflow>
  <ngmd-step title="Install the packages">
    Add <code>&#64;pangular-inspector/devtools</code> and <code>&#64;valor/nativescript-websockets</code>.
  </ngmd-step>
  <ngmd-step title="Add a WebSocket global">
    Import <code>&#64;valor/nativescript-websockets</code> first in <code>src/polyfills.ts</code>.
  </ngmd-step>
  <ngmd-step title="Start the overlay">
    Call <code>initNativeScriptOverlay()</code> in <code>src/main.ts</code>, before the app bootstraps.
  </ngmd-step>
  <ngmd-step title="Run the devtools server">
    Start <code>pangular dev</code> in the app's folder and open the UI.
  </ngmd-step>
</ngmd-workflow>

## Step 1: Install

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837" active
npm install @pangular-inspector/devtools @valor/nativescript-websockets
```

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220"
pnpm add @pangular-inspector/devtools @valor/nativescript-websockets
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add @pangular-inspector/devtools @valor/nativescript-websockets
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add @pangular-inspector/devtools @valor/nativescript-websockets
```

## Step 2: Add a WebSocket global

The overlay talks to the server over a WebSocket, and the NativeScript runtime has no `WebSocket` global. Import the polyfill first:

```ts
// src/polyfills.ts
import '@valor/nativescript-websockets';
```

## Step 3: Start the overlay

```ts {2,4-6}
// src/main.ts
import {initNativeScriptOverlay} from '@pangular-inspector/devtools/overlay-nativescript';

if (__DEV__) {
  initNativeScriptOverlay();
}
```

Call it before `runNativeScriptAngularApp()`. The injector inspector relies on *Angular's injector profiler, which *Angular only wires while it creates the platform.

### Where the overlay connects

| Target           | Default URL              |
| ---------------- | ------------------------ |
| iOS simulator    | `http://localhost:9999/` |
| Android emulator | `http://10.0.2.2:9999/`  |
| Physical device  | Pass `{ baseURL }`       |

For a physical device, pass the address of your machine as `baseURL`, and allow plain HTTP to that address in `Info.plist` and `AndroidManifest.xml`.

## Step 4: Run the devtools server

Run the server in the app's folder, so the source scanners read its `src/`:

```bash
cd my-nativescript-app
npx @pangular-inspector/devtools dev --no-auth
```

The server listens on `localhost` only, which the iOS simulator and the Android emulator reach. `--no-auth` is needed because the app cannot enter the one-time code the panel asks for.

| What         | Where                         |
| ------------ | ----------------------------- |
| Devtools UI  | `http://localhost:9999/`      |
| MCP endpoint | `http://localhost:9999/__mcp` |

A physical device reaches your machine over the network, so the server has to listen on an interface the device can reach:

```bash
npx @pangular-inspector/devtools dev --host 192.168.1.20 --no-auth
```

<ngmd-alert severity="warning" label="Trusted networks only">
  With <code>--host</code> and <code>--no-auth</code>, every host that can reach that address can call the devtools RPC and MCP endpoints without a code. Use it on a trusted network only, and bind to the one interface the device uses rather than <code>0.0.0.0</code>.
</ngmd-alert>

See [Standalone CLI](../getting-started/cli.md) for the other server options and [Security](../security.md) for what `--no-auth` turns off.

## Try the demo

`examples/nativescript` is a `ns create --ng` project wired up this way, with a small showcase component (signals, a computed, an effect and a component-level provider). It is tested on the iOS simulator. Android is untested.

The demo maps `@pangular-inspector/devtools/*` to the package's build output in `packages/devtools/dist`, so build the package first:

```bash
pnpm devtools:build-pkg
pnpm devtools:nativescript
cd examples/nativescript && npm install && ns debug ios --no-hmr
```

`pnpm devtools:nativescript` starts the devtools server on `localhost`, scanning `examples/nativescript/src`. For a physical device, `pnpm devtools:nativescript:device` listens on every interface instead, with the same warning as above.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components inspector"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
</ngmd-pill-row>
