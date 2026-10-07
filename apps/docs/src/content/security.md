---
title: Access and redaction
description: Who can reach the devtools, and which values are redacted before they leave the page.
---

<ngmd-hero title="Access and redaction" gradient>
  The devtools send what they read from your app to a server on your machine. Here is who can reach that server, and what is redacted on the way.
</ngmd-hero>

# Access and redaction

The devtools read your running app and send what they find to a server on your machine. This page covers who can reach that server, and what is redacted on the way.

<ngmd-alert severity="critical">
  Don't expose the dev server beyond localhost. Some values, such as HTTP response previews, are sent as they are.
</ngmd-alert>

## At a glance

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Vite plugin">
    Loopback requests only. A request that sends an <code>Origin</code> must come from a loopback host, the Pangular Inspector extension, an entry in <code>allowedOrigins</code> or Vite's <code>server.allowedHosts</code>. Asks for a one-time code when a non-loopback host or origin is allowed.
  </ngmd-card>
  <ngmd-card icon="layers" title="Express hub">
    A one-time code and an origin check that accepts loopback origins and the Pangular Inspector extension. Both on by default.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Standalone CLI">
    Binds to <code>localhost</code> and asks for a one-time code by default.
  </ngmd-card>
  <ngmd-card icon="compass" title="Chrome extension">
    Reaches loopback hosts out of the box. Any other host needs a click on <strong>Allow access</strong>, for that host only.
  </ngmd-card>
</ngmd-card-grid>

## Local-only access

### Vite plugin

The devtools only answer requests from this machine. When a request carries an `Origin` header, that origin must be a loopback host, the Pangular Inspector extension or an origin you allowed. Requests without an `Origin` header pass the origin check. Browsers leave the header out of some cross-site requests, such as image loads and link clicks, so the origin check alone does not stop every request from another website.

In detail, a request to the devtools must:

- come from a loopback address (any `127.x.x.x` address or `::1`), and
- have no `Origin` header, or an origin that is a loopback host, the [Pangular Inspector extension](#chrome-extension), an entry in `allowedOrigins`, or a host that Vite's `server.allowedHosts` accepts.

Other requests get `403` with the message "Pangular Inspector only answers requests from this machine." WebSocket upgrades follow the same rules.

If you open the dev server through another hostname that points to your machine (for example `myapp.test`), list it in Vite's `server.allowedHosts` and the devtools trust it too. Add other origins with `allowedOrigins`:

```ts {7-8}
// vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  server: {allowedHosts: ['myapp.test']},
  plugins: [analog(), pangular({allowedOrigins: ['https://tunnel.example']})],
});
```

#### One-time code

The plugin's `auth` option decides whether the devtools also ask for the one-time code. The server prints the code in the terminal, and a browser reads data only after it exchanges that code.

| `auth`  | One-time code                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| not set | On if `server.allowedHosts` or `allowedOrigins` allows a host other than `localhost` or a loopback address, otherwise off. `allowedHosts: true` turns it on. |
| `true`  | Always on.                                                                                                                                                   |
| `false` | Always off. The loopback and origin checks still apply.                                                                                                      |

With only loopback hosts allowed, the loopback and origin checks take the place of the code.

<ngmd-callout type="warning" title="Tunnels look local">
  A tunnel client runs on your machine, so the requests it forwards come from a loopback address. That is why an allowed tunnel host or origin turns the one-time code on. If your tunnel rewrites the <code>Host</code> header to <code>localhost</code>, nothing in your config names the tunnel, so pass <code>auth: true</code>. Don't pass <code>auth: false</code> while a tunnel is allowed.
</ngmd-callout>

### Express hub

`initPangularHub()` has two checks, both on by default:

| Check         | Option           | What it does                                                                                                                                          |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| One-time code | `auth`           | The server prints a code. A browser can read data only after it exchanges that code.                                                                  |
| Origin check  | `allowedOrigins` | Only loopback origins, the Pangular Inspector extension, or clients that send no `Origin`, can open the WebSocket. Pass a list to allow more origins. |

```ts {8}
// src/server.ts
import {initPangularHub} from '@pangular-inspector/devtools/hub';
import express from 'express';

const app = express();

const devtools = initPangularHub({
  allowedOrigins: ['https://tunnel.example'],
});
app.use(devtools.nodeMiddleware);
```

A list keeps loopback origins and the Pangular Inspector extension. See [Chrome extension](#chrome-extension).

<ngmd-callout type="warning" title="Turning the checks off">
  Pass <code>auth: false</code> only on a machine only you use. Keep it on when you allow a tunnel origin: the origin check does not tell who is on the other end of the tunnel. <code>allowedOrigins: false</code> turns the origin check off. Keep the check on for your own apps.
</ngmd-callout>

### Standalone CLI

The CLI server binds to `localhost` and asks for a one-time code. `--host` changes the bind address and `--no-auth` turns the code off. See [Standalone CLI](./getting-started/cli.md).

### MCP endpoint

The HTTP MCP endpoint answers only requests that carry a loopback `Origin` header. In the Vite plugin, the request must also come from a loopback address, like every devtools request.

While the one-time code is on, the endpoint also asks for a bearer token. That is the Express hub by default, and the Vite plugin when its code is on. The hub prints a generated token when it starts. Set `PANGULAR_MCP_TOKEN` to choose the token yourself. Requests without the right `Authorization: Bearer <token>` header get `401`. The stdio server needs no token. See [Send a token](./agents/mcp-server.md#send-a-token).

Without a token, the Express hub answers only requests from a loopback address. With a token, it also answers other addresses that send the right token and a loopback `Origin`. Any client can set that header, so treat the token like a password.

### Chrome extension

The extension has host permissions for loopback hosts only: `localhost` and its subdomains, `127.0.0.1` and `[::1]`, over HTTP and HTTPS. On those hosts, the panel looks for the devtools server as soon as it opens.

On any other host, the panel doesn't send a request until you click **Allow access**. Chrome then asks you to grant the extension that one host, on the scheme of the page and any port. The extension never asks for all hosts at once.

Granting the extension a host doesn't change what the devtools server accepts. The server still applies the checks on this page.

Every installed extension can send requests to a loopback host, with its own `chrome-extension://<id>` origin. So the Vite plugin and the Express hub accept one extension by default: `chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk`. The `key` in the extension manifest fixes that ID, so the unpacked extension and the store build share it. Every other extension origin is refused.

If you build the extension with another `key`, add its origin to `allowedOrigins`. Each entry names one extension. The ID is on the extension card in `chrome://extensions`. In the Vite plugin, an extension entry does not turn the one-time code on. See [Server origin](./getting-started/chrome-extension.md#server-origin).

## What is redacted

Live values leave the page. They are sent to the devtools server, shown in the panel and returned to agents. Redacted values are replaced with `[redacted]`.

### Forms

A field's value is replaced with `[redacted]` when the field:

- is a password field,
- has a password, one-time-code or credit-card `autocomplete`,
- sits inside `.sentry-mask`, `.rr-mask`, `[data-private]` or `[data-pangular="mask"]`,
- has a name that contains a secret word (password, token, card, cvv, apiKey and similar), or a name listed in `mask`, or
- sits inside a group or array whose name contains a secret word.

The Fields view says why a field is redacted: **name looks secret**, **password input**, **autocomplete is a secret kind**, **marked as mask**, **inside a secret group** or **listed in mask**. The field details say the same where the Set editor is hidden, with a link to this section.

Those values are also removed from error messages. The devtools don't write secret fields unless you unmask them (see [Opt fields in or out](#opt-fields-in-or-out)). Other values are sent as they are, so keep real credentials out of forms you inspect.

### Opt fields in or out

Mark a field in the template, or list keys on `window`:

```html
<input name="nickname" data-pangular="mask" /> <input name="cardHolder" data-pangular="unmask" />
```

```ts
window.__PANGULAR_FORMS__ = {mask: ['iban'], unmask: ['passport']};
```

`[data-pangular="unmask"]` opts a field back in. The `window` setting does the same by key.

The `mask` and `unmask` lists apply to every inspector on the page, not only forms: nested keys of an object-valued control, Signal Forms fields, form writes and restores, component inputs, signals, NgRx state, pipes and the Analog `load()` preview all follow them. Analog server call previews are recorded on the server, so they follow `redaction.secretNames` and `redaction.unmask` only.

You can also name secret and unmasked fields on the server, with the `redaction` option. `redaction.secretNames` adds secret names for forms, the router, components, signals, NgRx, pipes, Analog and SSR & HTTP URLs, and `redaction.unmask` joins the `window` list. See [Redaction options](./getting-started/configuration.md#redaction).

Unmasking also changes what the devtools can write. A key listed in `unmask` on `window` can be written. The element marker only lifts the checks that come from the element (password type, `autocomplete` and mask markers), so a field with a secret-looking name is still not written.

A refused write names the reason and the unmask that lifts it. The panel, `form-action` and `fill-form` show the same message.

<ngmd-accordion>
  <ngmd-accordion-item title="The full list of secret words">
    password, passwd, passphrase, passcode, pass, pwd, secret, token, otp, totp, pin, cvv, cvc, csc, ssn, iban, card, cc, credential, credentials, cookie, authorization and jwt. Names are split on camelCase and punctuation, so <code>userPassword</code> and <code>card_number</code> both match. The pairs apiKey, privateKey, secretKey, accessKey, ccNum, ccNumber, securityCode, sessionId and sessionKey match as well. Every inspector uses this list.
  </ngmd-accordion-item>
</ngmd-accordion>

### Router

These are replaced with `[redacted]` in URLs, params, data and messages:

- query, matrix and fragment keys that look secret (token, password, api key, code, sig, session, jwt and similar), including inside encoded return URLs,
- JWTs, bearer tokens and long opaque tokens,
- route params with secret-looking names.

A secret route param is only known once the route is recognized or found in the config. A navigation that fails before that (for example inside a lazy route that failed to load) can still show it in its URL.

<ngmd-alert severity="info">
  A navigation whose URL was redacted cannot be replayed.
</ngmd-alert>

### Components, signals, NgRx and pipes

Component inputs, signal values, NgRx state, and pipe inputs, outputs and async values use the same secret names and the same `mask` and `unmask` lists as forms. A value whose name looks secret is replaced with `[redacted]`. JWTs and bearer tokens inside strings and error messages are replaced too, NgRx strings and errors included.

### Analog

Server call previews and URLs are redacted: keys in JSON bodies that the forms rules treat as secret, secret query parameters, JWTs and bearer tokens. This covers form action validation errors and redirect targets too. Only JSON and plain text responses get a preview, and it is cut at 1000 characters. The devtools keep the first 16 KB of a body, and a cut JSON body still has its secret-looking keys redacted. The `load()` data preview on the open page redacts the same keys. Keys are matched by whole words, so `sessionId` and `apiKey` are redacted while `author` and `passengers` stay visible. JSON nested deeper than the preview reads is shown as `[Truncated]`.

### SSR & HTTP

Request URLs, page URLs and error messages in the [SSR & HTTP tab](./inspectors/ssr-http.md) are redacted like router URLs, in the page and again on the devtools server. This covers SSR and client calls, and `devframe_state_read`.

### Not redacted

Response previews and TransferState values in the [SSR & HTTP tab](./inspectors/ssr-http.md) are not redacted. They reach the devtools server unchanged, so don't expose the dev server beyond localhost.

## Checklist

<ngmd-workflow>
  <ngmd-step title="Keep it on your machine">
    Open the app on <code>localhost</code>. Add other hostnames or origins one by one, only when you need them.
  </ngmd-step>
  <ngmd-step title="Leave the checks on">
    Keep <code>auth</code> and the origin check on in the Express hub unless the machine is yours alone. In the Vite plugin, don't pass <code>auth: false</code> while a tunnel host or origin is allowed.
  </ngmd-step>
  <ngmd-step title="Use test data">
    Keep real credentials out of forms and API responses you inspect.
  </ngmd-step>
  <ngmd-step title="Mark extra secrets">
    Use <code>data-pangular="mask"</code>, <code>window.__PANGULAR_FORMS__</code> or <code>redaction.secretNames</code> for fields the secret words miss.
  </ngmd-step>
  <ngmd-step title="Block what you don't need">
    Set <code>agent.readOnly</code> or turn off <code>actions</code> to stop the panel and agents from writing to your app. See <a href="./getting-started/configuration.md#actions">Configuration</a>.
  </ngmd-step>
</ngmd-workflow>

## Related pages

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/vite" title="Vite and Analog"></ngmd-pill>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/inspectors/forms" title="Forms inspector"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
</ngmd-pill-row>
