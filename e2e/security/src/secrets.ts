// Components, signals, pipes, providers and stores that hold the leak corpus.
import {
  Component,
  Injectable,
  InjectionToken,
  Pipe,
  type PipeTransform,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { AsyncPipe, JsonPipe, SlicePipe } from '@angular/common';
import { createAction, createReducer, on, props, Store } from '@ngrx/store';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { of } from 'rxjs';
import { C } from '../canaries';

export const API_CONFIG = new InjectionToken<Record<string, unknown>>('API_CONFIG');

export const apiConfig = {
  endpoint: `https://admin:${C.provBasicPw.value}@api.example.com/v1`,
  apiKey: C.provApiKey.value,
  clientSecret: C.provClientSecret.value,
  note: C.provJwt.value,
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly token = C.provSvcToken.value;
  readonly user = 'ada';
}

// Global @ngrx/store.
export const login = createAction(
  '[Auth] Login',
  props<{ user: string; password: string; otp: string; note: string }>(),
);

export interface SessionState {
  user: string;
  token: string;
  apiKey: string;
  log: string;
}

export const sessionReducer = createReducer<SessionState>(
  { user: 'anon', token: '', apiKey: C.storeApiKey.value, log: C.storeBearer.value },
  on(login, (state, { user }) => ({ ...state, user, token: C.storeToken.value })),
);

// NgRx signal store.
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState({
    user: { name: 'ada', email: 'ada@example.com' },
    credentials: { password: C.ssPw.value },
    accessToken: C.ssAccess.value,
    note: C.ssJwt.value,
  }),
  withMethods((store) => ({
    rotate(token: string) {
      patchState(store, { accessToken: token });
    },
  })),
);

@Pipe({ name: 'authHeader' })
export class AuthHeaderPipe implements PipeTransform {
  transform(token: string, scheme: string): string {
    return `${scheme} ${token}`;
  }
}

@Component({
  selector: 'app-secret-card',
  imports: [AsyncPipe, JsonPipe, SlicePipe, AuthHeaderPipe],
  providers: [{ provide: API_CONFIG, useValue: apiConfig }],
  template: `
    <section aria-label="Secret card">
      <p>User {{ session.user }}</p>
      <p>{{ pipeToken | authHeader: 'Bearer' }}</p>
      <p>{{ pipeJwt | slice: 0 : 400 }}</p>
      <p>{{ creds | json }}</p>
      <p>{{ creds$ | async | json }}</p>
      <p>{{ authHeader().length }} {{ profile().secret.length }} {{ draft().password.length }}</p>
    </section>
  `,
})
export class SecretCard {
  readonly password = input('');
  readonly config = input<{ apiKey: string; items: { token: string }[] }>();

  protected readonly session = inject(SessionService);
  protected readonly api = inject(API_CONFIG);
  protected readonly store = inject(AuthStore);

  refresh_token = C.cmpPropRefresh.value;
  zorblaxCode = C.cmpCustomName.value;
  notes = C.cmpJwt.value;
  header = C.cmpBearer.value;
  blob = C.cmpEntropy.value;
  vault = new Map<string, string>([
    ['password', C.cmpMapPw.value],
    ['sessionId', C.cmpMapSession.value],
  ]);
  tokens = new Set<string>([C.cmpSetJwt.value]);

  readonly authToken = signal(C.sigAuthToken.value);
  readonly profile = signal({
    name: 'ada',
    secret: C.sigNestedSecret.value,
    mfaCode: C.sigMfa.value,
  });
  readonly apiKey = signal(C.sigHist1.value);
  readonly message = signal(C.sigJwt.value);
  readonly draft = signal({ title: 'x', password: C.sigLinkedPw.value });
  private readonly sessionToken = signal(C.sigComputedBearer.value.replace('Bearer ', ''));
  readonly authHeader = computed(() => `Bearer ${this.sessionToken()}`);

  protected readonly pipeToken = C.pipeBearerOut.value.replace('Bearer ', '');
  protected readonly pipeJwt = C.pipeJwtIn.value;
  protected readonly creds = { user: 'ada', password: C.pipeJsonPw.value };
  protected readonly creds$ = of({ user: 'ada', password: C.pipeAsyncPw.value });

  private readonly global = inject(Store);

  /** Changes that the collectors record as history, run once the overlay is attached. */
  late() {
    this.apiKey.set(C.sigHist2.value);
    this.store.rotate(C.ssPatched.value);
    this.global.dispatch(
      login({ user: 'ada', password: C.actPw.value, otp: C.actOtp.value, note: C.actJwt.value }),
    );
  }
}
