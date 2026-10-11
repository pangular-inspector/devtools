# Changelog

All notable changes to `@pangular-inspector/devtools` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com).

## 0.0.7

### Upgrade notes

- HTTP mock rules only accept statuses from the list (2xx to 5xx, plus 499 and 520 to 524). A stored rule with another status loses it.

### Features

- Renamed to Pangular Inspector: the package is `@pangular-inspector/devtools` and the CLI is `pangular`.
- Inspect Angular Native apps from a simulator, an emulator or a phone (`/overlay-angular-native`).
- Inspect NativeScript apps (`/overlay-nativescript`).
- Live NgRx Signal Store entities and events, and timings for method calls.
- A light theme for the panel that follows the DevTools or hub theme.
- The Chrome extension retries finding the server, explains a refusal and waits for the page id.

### Fixes

- HTTP mock rules offer a list of valid statuses instead of a free number.

### Dependencies

- devframe 1.2.0.

## 0.0.6

### Upgrade notes

- The MCP route requires a bearer token when auth is on.
- When a tunnel host is allowed, the Vite plugin asks for the one-time code.

### Security fixes

- Require a bearer token on the MCP route when auth is on.
- Require the one-time code when a tunnel host is allowed.
- Block the router probe when router actions are off.

### Features

- Configure inspectors, agent tools, write actions, redaction and limits.
- Detect redirect and navigation loops in the router inspector.
- Show the change detection strategy in the component tree.
- Add `disposeOverlay` and keep a single overlay per page.
- Refresh the overlay on change detection instead of polling.
- Add the Chrome extension host access flow and Elements panel selection.
- Accept the Chrome extension panel in the hub by default.

### Fixes

- Resolve the P1, P2 and P3 issues from the issue tracker.

### Documentation

- Add the documentation site.
