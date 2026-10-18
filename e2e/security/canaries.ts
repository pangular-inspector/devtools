/**
 * The leak corpus: one unique canary per place a collector reads.
 *
 * `masked` canaries must never reach any output channel (the docs promise
 * redaction for them). `visible` canaries are opted back in through a
 * documented escape hatch and must show up. `info` canaries are values the
 * docs say are sent as they are (plain values under harmless names, emails);
 * the harness reports where they appear without failing.
 *
 * Shared by the fixture app (bundled by Vite) and `scripts/e2e-security.mjs`
 * (loaded by Node with type stripping), so it holds plain data only.
 */

export type CanaryExpect = 'masked' | 'visible' | 'info';

export interface Canary {
  /** The planted value. */
  value: string;
  /** The text the harness looks for in every channel. */
  needle: string;
  expect: CanaryExpect;
  /** Where the fixture plants it. */
  where: string;
}

const HEADER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

function b64url(text: string): string {
  return btoa(text).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** A JWT whose signature carries the canary id, so the needle is greppable. */
function jwt(id: string): string {
  return `${HEADER}.${b64url(JSON.stringify({ sub: 'leak-corpus', id }))}.CNRYjwt${id}Sig0123456789abcdefXY`;
}

function plain(id: string, where: string, expect: CanaryExpect = 'masked'): Canary {
  const value = `CNRY_${id}_q7Zx`;
  return { value, needle: value, expect, where };
}

function token(id: string, where: string, expect: CanaryExpect = 'masked'): Canary {
  const value = jwt(id);
  return { value, needle: `CNRYjwt${id}Sig`, expect, where };
}

function bearer(id: string, where: string, expect: CanaryExpect = 'masked'): Canary {
  const secret = `CNRYbearer${id}Tok9a8b7c6`;
  return { value: `Bearer ${secret}`, needle: secret, expect, where };
}

function entropy(id: string, where: string): Canary {
  const value = `Q7xK2mP9vL4nR8sT1wY6zA3bC5dE0fGhCNRYent${id}`;
  return { value, needle: `CNRYent${id}`, expect: 'info', where };
}

function email(id: string, where: string): Canary {
  const value = `leak.canary.${id.toLowerCase()}@example.com`;
  return { value, needle: value, expect: 'info', where };
}

/** A JWT whose needle is its payload segment, to catch a cut that keeps the start. */
function jwtHead(id: string, where: string, expect: CanaryExpect = 'masked'): Canary {
  const value = jwt(id);
  return { value, needle: value.split('.')[1], expect, where };
}

export const C = {
  // Components: inputs, properties, nested, arrays, Map and Set.
  cmpInputPassword: plain('cmpInputPassword', 'component input `password`'),
  cmpNestedApiKey: plain('cmpNestedApiKey', 'component input `config.apiKey` (nested)'),
  cmpArrToken: plain('cmpArrToken', 'component input `config.items[0].token` (array)'),
  cmpPropRefresh: plain('cmpPropRefresh', 'component property `refresh_token`'),
  cmpCustomName: plain('cmpCustomName', 'component property `zorblaxCode` (redaction.secretNames)'),
  cmpJwt: token('cmpJwt', 'component property `notes` holding a JWT'),
  cmpBearer: bearer('cmpBearer', 'component property `header` holding a bearer token'),
  cmpEntropy: entropy('cmpEntropy', 'component property `blob` (high-entropy, harmless name)'),
  cmpMapPw: plain('cmpMapPw', 'component property Map entry `password`'),
  cmpMapSession: plain('cmpMapSession', 'component property Map entry `sessionId`'),
  cmpSetJwt: token('cmpSetJwt', 'component property Set holding a JWT'),
  // Signals, signal history and the signal graph.
  sigAuthToken: plain('sigAuthToken', 'signal `authToken`'),
  sigNestedSecret: plain('sigNestedSecret', 'signal `profile().secret`'),
  sigMfa: plain('sigMfa', 'signal `profile().mfaCode`'),
  sigHist1: plain('sigHist1', 'signal `apiKey` first value (history)'),
  sigHist2: plain('sigHist2', 'signal `apiKey` second value (history)'),
  sigComputedBearer: bearer('sigComputed', 'computed `authHeader` (signal graph)'),
  sigJwt: token('sigJwt', 'signal `message` holding a JWT'),
  sigLinkedPw: plain('sigLinkedPw', 'signal `draft` with nested `password` (graph)'),
  // NgRx signal store.
  ssPw: plain('ssPw', 'signal store state `credentials.password`'),
  ssAccess: plain('ssAccess', 'signal store state `accessToken`'),
  ssJwt: token('ssJwt', 'signal store state `note` holding a JWT'),
  ssPatched: plain('ssPatched', 'signal store `accessToken` after patchState (history)'),
  // Global @ngrx/store.
  storeToken: plain('storeToken', 'global store `session.token`'),
  storeApiKey: plain('storeApiKey', 'global store `session.apiKey`'),
  storeBearer: bearer('storeBearer', 'global store `session.log` holding a bearer token'),
  actPw: plain('actPw', 'action `[Auth] Login` payload `password`'),
  actOtp: plain('actOtp', 'action `[Auth] Login` payload `otp`'),
  actJwt: token('actJwt', 'action `[Auth] Login` payload `note` holding a JWT'),
  // Reactive form.
  rfPw: plain('rfPw', 'reactive form `password`'),
  rfApiKey: plain('rfApiKey', 'reactive form `apiKey`'),
  rfAuthz: plain('rfAuthz', 'reactive form `authorization`'),
  rfRefresh: plain('rfRefresh', 'reactive form `refresh_token`'),
  rfMfa: plain('rfMfa', 'reactive form `mfaCode`'),
  rfSecret: plain('rfSecret', 'reactive form `secret`'),
  rfToken: plain('rfToken', 'reactive form `token`'),
  rfCustom: plain('rfCustom', 'reactive form `zorblax` (redaction.secretNames)'),
  rfPwChanged: plain('rfPwChanged', 'reactive form `password` after an edit (event log)'),
  rfTokenChanged: plain('rfTokenChanged', 'reactive form `token` after an edit (event log)'),
  rfGroupInner: plain('rfGroupInner', 'reactive form `credentials.value` (inside a secret group)'),
  rfJwt: token('rfJwt', 'reactive form `notes` holding a JWT'),
  rfBearer: bearer('rfBearer', 'reactive form `comment` holding a bearer token'),
  rfEntropy: entropy('rfEntropy', 'reactive form `blob` (high-entropy, harmless name)'),
  rfMaskedAttr: plain('rfMaskedAttr', 'reactive form `nickname` with data-pangular="mask"'),
  rfWindowMask: plain('rfWindowMask', 'reactive form `iban2` listed in window mask'),
  rfAutocomplete: plain(
    'rfAutocomplete',
    'reactive form `oneTime` with autocomplete=one-time-code',
  ),
  // Escape hatches that the docs say show the value.
  rfUnmaskWindow: plain(
    'rfUnmaskWindow',
    'reactive form `recoveryKey` listed in window.__PANGULAR_FORMS__.unmask',
    'visible',
  ),
  rfUnmaskConfig: plain(
    'rfUnmaskConfig',
    'reactive form `legacyPin` listed in redaction.unmask',
    'visible',
  ),
  rfUnmaskAttr: plain(
    'rfUnmaskAttr',
    'reactive form `holder` type=password with data-pangular="unmask"',
    'visible',
  ),
  // The element marker on a secret-looking name: shown, but never written (docs).
  rfSecretNameUnmaskAttr: plain(
    'rfSecretNameUnmaskAttr',
    'reactive form `apiSecret` with data-pangular="unmask"',
    'info',
  ),
  // Template-driven form.
  tdToken: plain('tdToken', 'template form `token`'),
  tdPw: plain('tdPw', 'template form `password` (type=password)'),
  tdMasked: plain('tdMasked', 'template form `nick` with data-pangular="mask"'),
  // Signal Forms.
  sfPw: plain('sfPw', 'signal form `password`'),
  sfToken: plain('sfToken', 'signal form `token`'),
  sfApiKey: plain('sfApiKey', 'signal form `apiKey`'),
  sfJwt: token('sfJwt', 'signal form `note` holding a JWT'),
  // HTTP.
  httpAuth: bearer('httpAuth', 'request header Authorization'),
  httpXApiKey: plain('httpXApiKey', 'request header x-api-key'),
  httpCookie: plain('httpCookie', 'request header Cookie (set by the app)'),
  httpUrlToken: plain('httpUrlToken', 'request URL query `?token=`'),
  httpUrlEmail: email('httpUrlEmail', 'request URL query `?email=`'),
  httpBasicPw: plain('httpBasicPw', 'request URL basic-auth password user:pass@host'),
  httpRespSetCookie: plain('httpRespSetCookie', 'response header Set-Cookie'),
  httpRespHdrToken: plain('httpRespHdrToken', 'response header x-refresh-token'),
  httpRespAccess: plain('httpRespAccess', 'response body `access_token`'),
  httpRespPw: plain('httpRespPw', 'response body `password`'),
  httpRespJwt: token('httpRespJwt', 'response body `note` holding a JWT'),
  httpPostPw: plain('httpPostPw', 'POST request body `password`'),
  http401Jwt: token('http401Jwt', '401 error body and message holding a JWT'),
  httpErrUrlToken: plain('httpErrUrlToken', 'failing request URL `?access_token=`'),
  // Analog server calls (recorded by the Vite plugin's middleware).
  anReqAuth: bearer('anReqAuth', 'Analog API request header Authorization'),
  anReqPw: plain('anReqPw', 'Analog API POST body `password`'),
  anRespAccess: plain('anRespAccess', 'Analog API response `access_token`'),
  anRespJwt: token('anRespJwt', 'Analog API response `note` holding a JWT'),
  anUrlToken: plain('anUrlToken', 'Analog API URL `?token=`'),
  anSetCookie: plain('anSetCookie', 'Analog API response Set-Cookie'),
  // Analog load() data (route with Analog metadata).
  loadAccess: plain('loadAccess', 'Analog load() `accessToken`'),
  loadPw: plain('loadPw', 'Analog load() `profile.password`'),
  loadJwt: token('loadJwt', 'Analog load() `note` holding a JWT'),
  // Router.
  routeDataApiKey: plain('routeDataApiKey', 'route data `apiKey`'),
  routeDataJwt: token('routeDataJwt', 'route data `note` holding a JWT'),
  resolverToken: plain('resolverToken', 'resolver data `token`'),
  resolverSecret: plain('resolverSecret', 'resolver data `session.secret`'),
  resolverBearer: bearer('resolverBearer', 'resolver data `msg` holding a bearer token'),
  paramToken: plain('paramToken', 'route param `:token`'),
  queryCode: plain('queryCode', 'query param `code`'),
  queryEmail: email('queryEmail', 'query param `email`'),
  queryReturnToken: plain('queryReturnToken', 'encoded return URL `next=/x?token=`'),
  fragToken: plain('fragToken', 'fragment `#access_token=`'),
  queryJwt: token('queryJwt', 'query param `q` holding a JWT'),
  failNavToken: plain('failNavToken', 'URL `?token=` of a navigation that fails'),
  // Injector provider values.
  provApiKey: plain('provApiKey', 'provider value `apiKey`'),
  provClientSecret: plain('provClientSecret', 'provider value `clientSecret`'),
  provBasicPw: plain('provBasicPw', 'provider value URL with user:password@'),
  provJwt: token('provJwt', 'provider value `note` holding a JWT'),
  provSvcToken: plain('provSvcToken', 'service property `token`'),
  // Pipes.
  pipeJwtIn: token('pipeJwtIn', 'pipe input holding a JWT (slice)'),
  pipeBearerOut: bearer('pipeBearerOut', 'pipe output `Bearer …` (authHeader pipe)'),
  pipeJsonPw: plain('pipeJsonPw', 'json pipe of an object with `password`'),
  pipeAsyncPw: plain('pipeAsyncPw', 'async pipe value with `password`'),
  // Console and errors.
  conObjPw: plain('conObjPw', 'console.log object `password`'),
  conErrJwt: token('conErrJwt', 'console.error Error message holding a JWT'),
  conWarnBearer: bearer('conWarnBearer', 'console.warn `Authorization: Bearer …`'),
  conKv: plain('conKv', 'console.log `token=…`'),
  errThrownJwt: token('errThrownJwt', 'uncaught error message holding a JWT'),
  errThrownKv: plain('errThrownKv', 'uncaught error message `password=…`'),
  errRejectBearer: bearer('errRejectBearer', 'unhandled rejection `Bearer …`'),
  // TransferState (SSR payload script).
  tsBodyRefresh: plain('tsBodyRefresh', 'TransferState body `refresh_token`'),
  tsJwt: token('tsJwt', 'TransferState body `note` holding a JWT'),
  tsHdrBearer: bearer('tsHdrBearer', 'TransferState header authorization'),
  tsSetCookie: plain('tsSetCookie', 'TransferState header set-cookie'),
  tsUrlToken: plain('tsUrlToken', 'TransferState request URL `?token=`'),
  tsCustomPw: plain('tsCustomPw', 'TransferState custom key `password`'),
  // Literals in source, read by the source scan (static report, stdio MCP).
  srcProvSecret: plain('srcProvSecret', 'source literal provider `clientSecret`'),
  srcSignalToken: plain('srcSignalToken', 'source literal signal `authToken`'),
  srcPropPassword: plain('srcPropPassword', 'source literal property `password`'),
  srcRouteApiKey: plain('srcRouteApiKey', 'source literal route data `apiKey`'),
  // A password input whose name looks harmless.
  rfPwType: plain('rfPwType', 'reactive form `userWord` with type=password'),
  // 1.0 security review probes.
  uniKeyPw: plain('uniKeyPw', 'component property `пароль` (non-English secret name)', 'info'),
  uniValPw: {
    value: 'pässwört-ÿ-CNRY_uniValPw_q7Zx',
    needle: 'CNRY_uniValPw_q7Zx',
    expect: 'masked',
    where: 'component property `password` with a unicode value',
  },
  deepArrTok: plain('deepArrTok', 'component property `deep[0][0][0][0].token` (nested arrays)'),
  mapKeyPair: plain('mapKeyPair', 'component Map key `token=…`'),
  objKeyJwt: token('objKeyJwt', 'component property object key holding a JWT'),
  cut250: jwtHead('cut250', 'component string, JWT after 250 chars (cut inside the JWT?)'),
  cut290: jwtHead('cut290', 'component string, JWT after 290 chars'),
  cut480: jwtHead('cut480', 'component string, JWT after 480 chars'),
  cut990: jwtHead('cut990', 'component string, JWT after 990 chars'),
  sigCut: jwtHead('sigCut', 'signal string, JWT after 280 chars'),
  b64Basic: {
    value: btoa('ada:CNRY_b64Basic_q7Zx'),
    needle: btoa('ada:CNRY_b64Basic_q7Zx'),
    expect: 'info',
    where: 'component property `header2` holding base64 user:pass without the Basic scheme',
  },
  llmKey: {
    value: 'sk-proj-CNRYllmKey0123456789abcdefABCDEF',
    needle: 'CNRYllmKey0123456789',
    expect: 'masked',
    where: 'component property `openai` holding an OpenAI-style key',
  },
  errColon: plain('errColon', 'uncaught error `apiKey: …`'),
  errAmp: {
    value: 'Tr0ub&CNRYerrAmpTail',
    needle: 'CNRYerrAmpTail',
    expect: 'masked',
    where: 'uncaught error `password=Tr0ub&…` (special char in password)',
  },
  conPhrase: {
    value: 'correct CNRYconPhraseHorse battery',
    needle: 'CNRYconPhraseHorse',
    expect: 'masked',
    where: 'console.log `password: correct … battery` (passphrase with spaces)',
  },
  conQuote: {
    value: 'abc\\"CNRYconQuoteTail',
    needle: 'CNRYconQuoteTail',
    expect: 'masked',
    where: 'console.log JSON text with an escaped quote in the password',
  },
  errAxios: bearer('errAxios', 'console.error of an Error with config.headers.Authorization'),
  errObjKey: plain('errObjKey', 'console.error of an object with `apiKey` next to an Error'),
  httpFormBody: plain('httpFormBody', 'POST form-urlencoded body `password=`'),
  httpXmlResp: plain('httpXmlResp', 'XML response `<password>`'),
  httpLongResp: plain('httpLongResp', 'JSON response with `token` past 1990 chars'),
  httpUrlEncAuth: plain('httpUrlEncAuth', 'request URL `?redirect=…Authorization%3A%20Bearer%20…`'),
  qData: plain('qData', 'TanStack Query data `accessToken`'),
  qKeyObj: plain('qKeyObj', 'TanStack Query key `{ token }`'),
  qKeyPlain: plain('qKeyPlain', 'TanStack Query key plain string', 'info'),
  qErr: plain('qErr', 'TanStack Query error `password=…`'),
  qMutVar: plain('qMutVar', 'TanStack mutation variables `password`'),
  qMutPos: plain('qMutPos', 'TanStack mutation variables positional array (token-like string)'),
  qDataJwt: token('qDataJwt', 'TanStack Query data `note` holding a JWT'),
  // Write-back probes: values agents try to write into secret fields.
  writeProbe: plain('writeProbe', 'value an agent tries to write into a secret field'),
} satisfies Record<string, Canary>;

export type CanaryId = keyof typeof C;
