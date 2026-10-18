// The leak-corpus fixture app: every place a collector reads holds a canary
// from ../canaries.ts. scripts/e2e-security.mjs serves it with the Vite
// plugin and greps every output channel for the canaries.
import '@angular/compiler';
import {
  Component,
  inject,
  viewChild,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { HttpClient, HttpHeaders, provideHttpClient } from '@angular/common/http';
import {
  ActivatedRoute,
  provideRouter,
  Router,
  RouterOutlet,
  type ResolveFn,
  type Routes,
} from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideExperimentalWebMcpForms } from '@angular/forms/signals';
import { providePangularHttp, withPangular } from '@pangular-inspector/devtools/http';
import { QueryClient } from '@tanstack/query-core';
import { C } from '../canaries';
import { SecretCard, sessionReducer } from './secrets';
import { ReactiveSecrets, SignalSecrets, TemplateSecrets } from './forms';
import { literalRoutes } from './source-literals';
// Empty, or a static import of the `/overlay` entry for the production run
// that checks a static import starts nothing (see `stopImportPlugin`).
import 'virtual:devtools-stop';

const queryClient = new QueryClient();

const ANALOG_META = Symbol('@analogjs/router Analog Route Metadata Key');

@Component({ selector: 'app-home', template: '<p>Home</p>' })
class HomePage {}

@Component({
  selector: 'app-reset',
  template: '<p>Reset {{ route.snapshot.paramMap.get("token")?.length }}</p>',
})
class ResetPage {
  protected readonly route = inject(ActivatedRoute);
}

@Component({ selector: 'app-account', imports: [RouterOutlet], template: '<router-outlet />' })
class AccountShell {}

const sessionResolver: ResolveFn<unknown> = () => ({
  token: C.resolverToken.value,
  session: { secret: C.resolverSecret.value, user: 'ada' },
  msg: C.resolverBearer.value,
});

const loadResolver: ResolveFn<unknown> = () => ({
  accessToken: C.loadAccess.value,
  profile: { name: 'ada', password: C.loadPw.value },
  note: C.loadJwt.value,
});

const accountRoute = {
  path: 'acct',
  component: AccountShell,
  resolve: { load: loadResolver },
  children: [
    {
      path: 'reset/:token',
      component: ResetPage,
      data: { apiKey: C.routeDataApiKey.value, note: C.routeDataJwt.value },
      resolve: { session: sessionResolver },
    },
  ],
} as Routes[number];
// What Analog's file router puts on a page route, so the Analog collector reads load().
(accountRoute as Record<symbol, unknown>)[ANALOG_META] = {
  endpoint: '/acct',
  endpointKey: '/src/app/pages/acct.server.ts',
};

const routes: Routes = [{ path: '', component: HomePage }, accountRoute, ...literalRoutes];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SecretCard, ReactiveSecrets, TemplateSecrets, SignalSecrets],
  template: `
    <main>
      <h1>Leak corpus</h1>
      <app-secret-card [password]="password" [config]="config" />
      <app-reactive-secrets />
      <app-template-secrets />
      <app-signal-secrets />
      <router-outlet />
    </main>
  `,
})
class App {
  private readonly card = viewChild.required(SecretCard);
  private readonly reactive = viewChild.required(ReactiveSecrets);
  protected readonly password = C.cmpInputPassword.value;
  protected readonly config = {
    apiKey: C.cmpNestedApiKey.value,
    items: [{ token: C.cmpArrToken.value }],
  };
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly queries = inject(QueryClient);

  constructor() {
    setTimeout(() => void this.run(), 200);
    // The harness calls this once the overlay reports, so history and logs see it.
    (window as unknown as Record<string, unknown>)['__corpusLate'] = () => this.late();
  }

  private late() {
    this.card().late();
    this.reactive().late();
    console.log('login attempt', { user: 'ada', password: C.conObjPw.value });
    console.error(new Error(`auth failed for ${C.conErrJwt.value}`));
    console.warn(`retrying with Authorization: ${C.conWarnBearer.value}`);
    console.log(`debug token=${C.conKv.value}`);
    setTimeout(() => {
      throw new Error(
        `Session expired for ${C.errThrownJwt.value} password=${C.errThrownKv.value}`,
      );
    }, 100);
    setTimeout(
      () => void Promise.reject(new Error(`upstream said ${C.errRejectBearer.value}`)),
      200,
    );
    void this.calls();
    this.probes();
  }

  private probes() {
    setTimeout(() => {
      throw new Error(`Config invalid apiKey: ${C.errColon.value}`);
    }, 300);
    setTimeout(() => {
      throw new Error(`Login rejected password=${C.errAmp.value}`);
    }, 400);
    console.log(`retry password: ${C.conPhrase.value}`);
    console.log(`payload {"password":"${C.conQuote.value}"}`);
    const axiosLike = Object.assign(new Error('Request failed with status code 401'), {
      config: { headers: { Authorization: C.errAxios.value } },
    });
    console.error(axiosLike);
    console.error('save failed', { apiKey: C.errObjKey.value }, new Error('boom'));
    const quiet = { error: () => undefined };
    this.http
      .post('/svc/form', `user=ada&password=${C.httpFormBody.value}`, {
        headers: new HttpHeaders({ 'content-type': 'application/x-www-form-urlencoded' }),
      })
      .subscribe(quiet);
    this.http.get('/svc/xml', { responseType: 'text' }).subscribe(quiet);
    this.http.get('/svc/long').subscribe(quiet);
    this.http
      .get(
        `/svc/basic?redirect=${encodeURIComponent('/x?h=Authorization: Bearer ' + C.httpUrlEncAuth.value)}`,
      )
      .subscribe(quiet);
    // TanStack Query cache.
    this.queries.setQueryData(['user', { token: C.qKeyObj.value }], {
      user: 'ada',
      accessToken: C.qData.value,
      note: C.qDataJwt.value,
    });
    this.queries.setQueryData(['session', C.qKeyPlain.value], { ok: true });
    void this.queries
      .fetchQuery({
        queryKey: ['failing'],
        retry: false,
        queryFn: () => Promise.reject(new Error(`upstream password=${C.qErr.value}`)),
      })
      .catch(() => undefined);
    const cache = this.queries.getMutationCache();
    void cache
      .build(this.queries, { mutationFn: async (v: unknown) => v })
      .execute({ user: 'ada', password: C.qMutVar.value });
    void cache
      // Returns a count, so only the variables carry the canary.
      .build(this.queries, { mutationFn: async (v: unknown[]) => v.length })
      .execute(['ada', C.qMutPos.value]);
  }

  private async run() {
    await this.calls();
    await this.navigate();
  }

  private async calls() {
    const quiet = { error: () => undefined };
    const headers = new HttpHeaders({
      Authorization: C.httpAuth.value,
      'x-api-key': C.httpXApiKey.value,
      Cookie: `sid=${C.httpCookie.value}`,
    });
    this.http
      .get('/svc/profile', {
        headers,
        params: { token: C.httpUrlToken.value, email: C.httpUrlEmail.value },
      })
      .subscribe(quiet);
    this.http
      .post('/svc/login', { user: 'ada', password: C.httpPostPw.value }, { headers })
      .subscribe(quiet);
    this.http
      .get(`${location.protocol}//ada:${C.httpBasicPw.value}@${location.host}/svc/basic`)
      .subscribe(quiet);
    this.http.get(`/svc/fail?access_token=${C.httpErrUrlToken.value}`).subscribe(quiet);
    void fetch(`/api/v1/secure?token=${C.anUrlToken.value}`, {
      headers: { Authorization: C.anReqAuth.value },
    }).catch(() => undefined);
    void fetch('/api/v1/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'ada', password: C.anReqPw.value }),
    }).catch(() => undefined);
  }

  private async navigate() {
    await this.router.navigateByUrl(`/?q=${C.queryJwt.value}`);
    await this.router.navigateByUrl(`/nope?token=${C.failNavToken.value}`).catch(() => undefined);
    const next = encodeURIComponent(`/x?token=${C.queryReturnToken.value}`);
    await this.router.navigateByUrl(
      `/acct/reset/${C.paramToken.value}?code=${C.queryCode.value}&email=${C.queryEmail.value}&next=${next}#access_token=${C.fragToken.value}`,
    );
  }
}

bootstrapApplication(App, {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withPangular()),
    providePangularHttp(),
    provideStore({ session: sessionReducer }),
    provideStoreDevtools({ maxAge: 25 }),
    provideExperimentalWebMcpForms(),
    { provide: QueryClient, useValue: queryClient },
  ],
}).catch((error) => console.error(error));
