# Changelog

All notable changes to `@pangular-inspector/devtools` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com).

## Unreleased

### Upgrade notes

- The package is renamed from `@santoshyadavdev/ng-devtools` to `@pangular-inspector/devtools`. Update your `package.json` and imports.
- The CLI command is renamed from `ng-devtools` to `pangular`.
- The project is now called Pangular Inspector, the unified Angular devtools.

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
