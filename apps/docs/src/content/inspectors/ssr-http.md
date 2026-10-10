---
title: SSR & HTTP
description: An HTTP timeline for SSR and client calls, fault injection, hydration stats and the TransferState payload.
---

<ngmd-hero title="SSR & HTTP" gradient>
  Every HttpClient call made while rendering on the server and in the browser. Fault injection, hydration stats and the TransferState payload, in one tab.
</ngmd-hero>

# SSR & HTTP

The SSR & HTTP tab shows the HTTP calls your app makes during server rendering and in the browser. It also shows the hydration result and the TransferState payload, and it can inject faults into requests. Pick the page at the top. The tab shows that page's data.

## Setup

The timeline and fault rules need the interceptor. The hydration warnings need the provider. Add both to the app config, with `withPangular()` before your own interceptors:

```ts {9-10}
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withFetch, withInterceptors} from '@angular/common/http';
import {providePangularHttp, withPangular} from '@pangular-inspector/devtools/http';
import {authInterceptor} from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch(), withPangular(), withInterceptors([authInterceptor])),
    providePangularHttp(),
  ],
};
```

<ngmd-callout type="warning" title="withPangular() first">
  Put <code>withPangular()</code> before your own interceptors. Then it records requests as the app makes them, and fault rules apply before anything else. The full setup is in the <a href="../guides/ssr-http.md">SSR & HTTP guide</a>.
</ngmd-callout>

SSR must run in the same Node process as the devtools server, such as the Express server with the hub mounted, or the Vite dev server with the plugin. The [overlay](../getting-started/overlay.md) must be loaded, because client calls, hydration and the payload reach the tab through it.

To trace each server render, add `ssrMiddleware` after the hub and before the Angular handler:

```ts {7}
// src/server.ts
const devtools = initPangularHub({
  ws: {sidecar: true},
});
app.use(devtools.nodeMiddleware);
// ... your API routes and static files
app.use(devtools.ssrMiddleware);
```

## What it shows

### SSR requests

Each document request that `ssrMiddleware` traced, newest first. A request is traced when it is a `GET` or `HEAD` that accepts `text/html`, and the answer is HTML or a redirect. Each row shows:

| Column       | Value                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Request      | The method and URL.                                                                                           |
| Status       | The status sent to the browser.                                                                               |
| Render mode  | What the response was. See [Render modes](#render-modes).                                                     |
| Render       | Time from the request arriving to the status and headers being sent.                                          |
| Server calls | How many `HttpClient` calls the render made, and their total time.                                            |
| Notes        | **this page** on the request that served the selected page, and **aborted** when the connection closed early. |

The request that served the selected page opens on its own. Click another row to open it. The detail lists the request id, the total time, the bytes sent, the browser page that loaded the response, the router during the render, and each server call. **Fetched again in the browser** lists calls that ran on the server and then again after hydration, instead of reading the transfer cache, each with the reason.

The middleware gives each request an id. The id reaches the render in the `x-pangular-ssr-id` request header, so the interceptor tags each server call with it. It goes back to the browser in a `Server-Timing` header (`pangular;desc="<id>"`, `render;dur=...`, `fetch;dur=...`, and `guards;dur=...` and `resolve;dur=...` when the router ran them), so the overlay links the page to the render, and the browser's own Network panel shows the same times.

#### Render modes

The tab reads the render mode from the HTML first, then from the status:

| Render mode      | When                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Server**       | The HTML has `ng-server-context="ssr"`, whatever the status. A not-found page Angular rendered with status 404 counts as Server.         |
| **Prerender**    | The HTML has `ng-server-context="ssg"`.                                                                                                  |
| **Client**       | The engine sent the `index.csr.html` shell, an empty root element and the app's module script, for a `RenderMode.Client` route.          |
| **Redirect**     | A 3xx with no page, from `redirectTo` in the routes or a guard that returned a `UrlTree` during the render.                              |
| **Not rendered** | A status of 400 or more with no Angular markup. Angular gave up, for example because a guard rejected, and the server sent its own page. |
| **Unknown**      | None of the above.                                                                                                                       |

A redirect or a rejected guard can still have run the router on the server. **Router during the render** shows what it did.

#### Router during the render

Up to five navigations the router ran while rendering. Most renders have one, plus one for each redirect. It shows the URL and outcome, the time spent in guards and whether they passed, redirected or rejected, the time spent in resolvers, the total, and the redirect or cancel reason. The times cover each phase as a whole, not each guard. This part needs `providePangularHttp()` in the app config.

To see it in the demo app, load `/examples/ssr/product/3` with a full page load. Its guard calls an access API and its resolver loads the product from a slow API. Product 2 is sold out, so its guard redirects, and product 9 is unknown, so its guard rejects the navigation.

#### Transfer cache outcome

Each server call is marked **cached** when Angular's transfer cache stored its response for hydration, or **not cached** with the first reason that applies:

| Reason                 | When                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `transferCache: false` | The request opts out.                                                                                                    |
| POST                   | A POST, unless `includePostRequests` is set or the request sets `transferCache`.                                         |
| Method                 | Any method other than GET, HEAD and POST.                                                                                |
| Auth headers           | The request sends `Authorization`, `Proxy-Authorization` or `Cookie`.                                                    |
| Credentials            | `withCredentials`, or `credentials` set to `include` or `same-origin`.                                                   |
| Request cache          | The request has `Cache-Control` `no-store`, `no-cache` or `private`, or `cache` set to `no-store` or `no-cache`.         |
| Failed response        | The call failed. Errors are never stored.                                                                                |
| Response cache         | The response has `Cache-Control` `no-store`, `no-cache` or `private`.                                                    |
| Set-Cookie             | The response sets a cookie.                                                                                              |
| Fault rule             | A fault rule answered on the server, before the transfer cache ran.                                                      |
| Cache off or filter    | None of the above. The transfer cache is off, or `filter` or another `withHttpTransferCacheOptions` setting left it out. |

The tab checks the TransferState after each server response, so **cached** is what Angular stored. The reason is worked out from the request and the response, in the order Angular checks them, with its default options. Options such as `includePostRequests` or `includeRequestsWithAuthHeaders` let a call through, so a skipped call only lists a reason that still applies.

### HTTP timeline

Every `HttpClient` request, tagged **SSR** or **Client**. Each row shows the method, the URL, the page that made it, the status, the time, and notes:

- **transfer cache**: the TransferState cache answered it. A client request counts as a hit only when its method, response type, URL, body and params match the entry Angular stored.
- **delayed N ms**: a fault rule held it back.
- **mocked**: a fault rule answered it with a status below 400.
- **faulted**: a fault rule failed it with a status of 400 or more.
- **rule**: the pattern of the fault rule that matched it.

A request that was unsubscribed before its response, for example by `switchMap`, a route change or a destroyed component, shows **cancelled** as its status. **ERR** marks a request that failed without a status, such as when the browser is offline or CORS blocks it.

Click a row for a response preview. The preview opens under the timeline and takes focus. **Close** or `Escape` returns focus to the row. A long timeline scrolls inside its own box. The timeline shows the page's client calls and the SSR calls made while rendering its first URL. **Clear timeline** empties it.

### Fault injection

Add a rule with these fields:

- **URL pattern**: a substring, or a glob where `*` matches anything. `/api/*` matches both relative and absolute URLs.
- **Method**: any, or one method.
- **Apply on**: SSR + client, SSR only, or client only.
- **Status**: **None**, or a status from the list. The list has the standard 2xx to 5xx statuses, plus `499` (nginx) and `520` to `524` (Cloudflare). Type the code, for example `503`, to jump to it.
- **Delay (ms)** up to 10000, and an optional JSON body.

A status of 400 or more fails the request with an `HttpErrorResponse`. A lower status returns the body as a mocked response. A body with the status on **None** returns it with status 200. A stored rule with a status outside the list loses that status, and is dropped when nothing else is left to change. A rule with only a delay passes the request through, later. A rule needs a status, a delay or a body, so **Add rule** stays off until it has one. The form clears after each added rule. The first enabled rule that matches wins.

The body follows the request's `responseType`. A `json` request gets the parsed JSON (or the raw string when it does not parse) with `content-type: application/json`. A `text` request gets the string with `text/plain`. A `blob` request gets a `Blob`, and an `arraybuffer` request an `ArrayBuffer`, both with `application/octet-stream`. The same value is the `error` of an injected failure.

### SSR overrides

Development-only changes to what the server sends for matching pages. Each one applies from the next full page load. The request that got one is marked **overridden**, and its detail lists **Overrides from the panel** with what each one did. They need `ssrMiddleware` and the `actions.http` write action, and they live in the memory of the server process, so a restart clears them.

| Override                | What it does                                                                                                        | Needs                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Render error**        | Throws while the server renders a matching page, so you see what users get, such as a 500 page from your server.    | `providePangularHttp()`, and a page the engine renders. |
| **Force Client render** | Serves `index.csr.html` instead of rendering, as `RenderMode.Client` would, without editing `app.routes.server.ts`. | `browserDistFolder` in `initPangularHub()`.             |
| **Edit TransferState**  | Sets an entry of the `{APP_ID}-state` script to a JSON value, or removes it, before the HTML is sent.               | A page that has a TransferState script.                 |

Override HTTP calls the server makes with [Fault injection](#fault-injection) instead, on **SSR only**.

To edit an entry without typing its key, open it in **TransferState payload** and click **Edit in SSR overrides**. The form switches to **Edit TransferState entry** with the key, and the page path as the pattern, filled in. Focus moves to **New JSON value**. On the site root the pattern stays empty and gets focus instead, because `/` would match every page. The value starts empty because the panel only has a redacted copy of the entry. Type the full JSON the server should send, since an empty value removes the entry. HttpClient entries hold `b` (body), `s` (status), `st` (status text), `u` (URL) and `rt` (response type), so a changed body keeps the other fields.

The Prerender fallback mode can't be forced. The engine reads render modes from your server bundle, which the devtools can't change.

### Hydration

- Whether hydration is on.
- **App stable after**: the time from navigation start until the app first became stable, which is when hydration is done. It needs `providePangularHttp()`.
- Hydrated components and nodes, skipped components, and incremental defer blocks.
- DOM nodes hydrated and skipped, and `ngSkipHydration` hosts.
- Mismatched components, with the expected and actual DOM.
- The hydration warnings (NG05xx) Angular logged in the browser.

### TransferState payload

Each entry in the page's `{APP_ID}-state` script, with its size. The tab decodes HttpClient and Analog cache entries to status, URL and body. It labels `__nghData__` and `__nghDeferData__` as hydration annotations, and Analog server function results seeded during server rendering by function name.

Open an entry to see its cache key, even when the row shows the request URL. **Copy** puts the key on the clipboard. If the `actions.http` write action is on, **Edit in SSR overrides** opens the [SSR overrides](#ssr-overrides) form for that key. The button is hidden for keys longer than 200 characters, the most an override keeps, and for keys with spaces at either end, which an override would trim.

## Where the data comes from

<ngmd-card-grid columns="3">
  <ngmd-card icon="terminal" title="Server">
    The interceptor on the server hands SSR calls to the devtools through the shared Node process.
  </ngmd-card>
  <ngmd-card icon="zap" title="Browser">
    The overlay reports client calls, hydration stats and the payload.
  </ngmd-card>
  <ngmd-card icon="settings" title="Rules">
    Fault rules live on the devtools server, which sends them to every page.
  </ngmd-card>
</ngmd-card-grid>

### What each part needs

| Part                  | Needs                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| SSR requests          | `ssrMiddleware`, plus `withPangular()` for the server calls and the overlay for the linked page. |
| Router timings        | `ssrMiddleware` and `providePangularHttp()`.                                                     |
| HTTP timeline         | `withPangular()` and the overlay.                                                                |
| Fault injection       | `withPangular()`.                                                                                |
| Hydration stats       | The overlay.                                                                                     |
| Hydration warnings    | `providePangularHttp()`.                                                                         |
| App stable after      | `providePangularHttp()`.                                                                         |
| SSR overrides         | `ssrMiddleware` and `actions.http`. See [SSR overrides](#ssr-overrides) for each kind.           |
| TransferState payload | The overlay, on a server-rendered page.                                                          |

### Development builds

The interceptor works in development builds only. In production it passes requests through untouched.

## How to use it

### Test an error state

<ngmd-workflow>
  <ngmd-step title="Add a rule">
    Enter the URL pattern, pick <strong>Client only</strong>, and pick <strong>500 Internal Server Error</strong> as the status. Click <strong>Add rule</strong>.
  </ngmd-step>
  <ngmd-step title="Use the page">
    Trigger the request. The row is marked <strong>faulted</strong>.
  </ngmd-step>
  <ngmd-step title="Check the UI">
    Your error handling runs against a real <code>HttpErrorResponse</code>.
  </ngmd-step>
  <ngmd-step title="Remove the rule">
    Click <strong>Remove</strong> when you are done.
  </ngmd-step>
</ngmd-workflow>

### Test a slow API

<ngmd-workflow>
  <ngmd-step title="Add a delay-only rule">
    Enter the URL pattern, leave the status on <strong>None</strong> and the body empty, and set a delay, for example 3000 ms. Click <strong>Add rule</strong>.
  </ngmd-step>
  <ngmd-step title="Watch the loading state">
    The request still reaches the API, only later. Its row is marked <strong>delayed 3000 ms</strong>.
  </ngmd-step>
</ngmd-workflow>

### Check that TransferState works

<ngmd-workflow>
  <ngmd-step title="Load a server-rendered page">
    Use a route with <code>RenderMode.Server</code>.
  </ngmd-step>
  <ngmd-step title="Read the timeline">
    Each GET should show an SSR row, and a Client row marked <strong>transfer cache</strong>.
  </ngmd-step>
  <ngmd-step title="Read the payload">
    The matching entry should appear in <strong>TransferState payload</strong>.
  </ngmd-step>
</ngmd-workflow>

### Find calls the transfer cache missed

<ngmd-workflow>
  <ngmd-step title="Add the middleware">
    Add <code>app.use(devtools.ssrMiddleware)</code> before the Angular handler in <code>server.ts</code>.
  </ngmd-step>
  <ngmd-step title="Load a server-rendered page">
    Use a route with <code>RenderMode.Server</code>. Its request opens in <strong>SSR requests</strong>, marked <strong>this page</strong>.
  </ngmd-step>
  <ngmd-step title="Read the detail">
    Calls under <strong>Fetched again in the browser</strong> ran twice. Each one says why the transfer cache left it out, such as a POST or <code>transferCache: false</code>.
  </ngmd-step>
</ngmd-workflow>

## Agent tools

| Tool                           | What it answers                                                                                                                                                                                                                        | Arguments   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `pangular:list-ssr-requests`   | Recent traced SSR requests: id, URL, status, render mode, render time, server calls, and whether a connected page loaded the response.                                                                                                 | `limit`     |
| `pangular:explain-ssr-request` | One request end to end: timings, kept response headers, the router's guard and resolver times, each server call with its transfer cache outcome, then the browser page with its hydration result and the calls the browser made again. | `id`, `url` |

For the rest of this tab, agents read the `pangular:http` key with the `devframe_state_read` tool. See [Resources](../agents/resources.md).

Two router tools cover related ground:

| Tool                           | What it does                                                  |
| ------------------------------ | ------------------------------------------------------------- |
| `pangular:explain-render-mode` | Which render mode a URL gets, from `*.routes.server.ts`.      |
| `pangular:explain-navigation`  | Each navigation's story, including the HTTP requests it made. |

## Limits and gotchas

<ngmd-callout type="warning" title="Only secrets that match a rule are redacted">
  Request URLs, page URLs, error messages, response previews and TransferState entries are redacted on the devtools server: secret-looking keys, JWTs, bearer tokens and secret query values. Other values are shown as they are, so don't expose the dev server beyond localhost. See <a href="../security.md">Security</a>.
</ngmd-callout>

### Static files are not traced

Prerendered pages that `express.static` serves as files never reach the Angular handler, so they have no SSR request. Pages that the engine serves from its prerender output are traced with the **Prerender** render mode.

The middleware records a request only while the `http` inspector is on. When it is off, `ssrMiddleware` passes every request through untouched and adds no header.

### Prerendered routes make no requests

Routes prerendered at build time make no requests at runtime and ignore SSR rules. For pages you want to test this way, use `RenderMode.Server` in `app.routes.server.ts`.

### SSR mocks are not transferred

The devtools don't write SSR mocks to TransferState, so the browser requests the URL again. To mock both, apply the rule on **SSR + client**.

### When rules apply

Client rules apply right away. SSR rules apply from the next page load, so the panel asks for a reload only when a rule applies on SSR. The page also keeps client rules in `sessionStorage`, so they apply on reload before the overlay connects. Rules live in the memory of the server process. They survive a Vite restart in the same process, such as after a config edit, and the **SSR & HTTP** tab keeps showing them. A new process starts with none.

If the `http` inspector or `actions.http` is off, the server clears its rules when it starts. SSR rules apply only while the devtools server runs, so they stop when it closes, for example after a config edit that removes the Vite plugin. When the overlay connects with the `http` inspector or `actions.http` off, it removes the stored client rules and the page stops applying client rules until a later load turns both back on. Requests made before the overlay connects on that load can still fail once.

### Timeline and rule caps

The timeline keeps the last 200 SSR calls in total, and the last 200 client calls of each page. Set both with [`limits.httpCalls`](../getting-started/configuration.md#limits). Once older calls are dropped, the timeline says how many and which limit to raise. You can add up to 50 fault rules. At 50, **Add rule** stays off until you remove one.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why are there no SSR rows?">
    SSR runs in a different process from the devtools, or the route is prerendered. Mount the hub in the same server, and use <code>RenderMode.Server</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does Warnings say not captured?">
    <code>providePangularHttp()</code> is missing from the app providers.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why did my client calls disappear?">
    Client calls live in the page, so a reload clears them. SSR calls stay until <strong>Clear timeline</strong> or a server restart.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="wrench" title="Set up SSR & HTTP" link="/guides/ssr-http" cta="Guide">
    The providers, their order, and the server setup.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Angular CLI and Express" link="/getting-started/express" cta="Set up">
    Mount the hub in <code>server.ts</code>.
  </ngmd-card>
  <ngmd-card icon="compass" title="Router" link="/inspectors/router" cta="Open">
    HTTP requests per navigation, and render modes.
  </ngmd-card>
  <ngmd-card icon="shield" title="Security" link="/security" cta="Read">
    What is redacted, and what is not.
  </ngmd-card>
</ngmd-card-grid>
