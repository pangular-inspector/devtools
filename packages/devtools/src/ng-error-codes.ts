/**
 * Angular error codes (`NG0100`, `NG01203`, `NG8001`) and the pages of
 * Angular's error reference. Titles follow the reference's index; the notes
 * paraphrase the first lines of each page, so they stay short and factual.
 */

export const ERROR_REFERENCE_URL = 'https://angular.dev/errors';

interface CodeInfo {
  title: string;
  note?: string;
}

/** Every code with a page in Angular's error reference (https://angular.dev/errors). */
const CODES: Record<string, CodeInfo> = {
  NG0100: {
    title: 'Expression Changed After Checked',
    note: 'A binding changed after change detection finished. Angular checks this only in development mode. Common causes: a getter or method that returns a different value on each call, or a child or lifecycle hook (ngAfterViewInit, ngOnChanges) that changes a value the parent already rendered.',
  },
  NG0200: {
    title: 'Circular Dependency in DI',
    note: 'A service depends, directly or through other services, on itself. The error lists the chain of tokens.',
  },
  NG0201: {
    title: 'No Provider Found',
    note: 'Something injects a token that no injector on its path provides. Provide it (providedIn, a providers array or the app config) or make the injection optional.',
  },
  NG0203: {
    title: '`inject()` must be called from an injection context',
    note: 'inject() ran outside an injection context. It works in a constructor, a field initializer, a factory, or inside runInInjectionContext.',
  },
  NG0204: {
    title: 'Invalid Injection Token',
    note: 'Angular could not resolve a dependency of a class, most often because the class is missing @Injectable (or @Service) or a constructor parameter has no usable type.',
  },
  NG0205: {
    title: 'Injector has already been destroyed',
    note: 'Code asked a destroyed injector for a service, typically an async callback that runs after its component or module was destroyed.',
  },
  NG0207: {
    title: 'EnvironmentProviders in wrong context',
    note: 'EnvironmentProviders (such as provideHttpClient()) were used where only regular providers are allowed, such as a component providers array.',
  },
  NG0209: {
    title: 'Invalid multi provider',
    note: 'A token meant for multi: true providers was found with a single value instead of an array.',
  },
  NG0300: {
    title: 'Selector Collision',
    note: 'Two or more components match the same element. Component selectors must be unique.',
  },
  NG0301: {
    title: 'Export Not Found',
    note: 'A template reference uses an exportAs name that no directive on the element exports. Often a missing import such as FormsModule.',
  },
  NG0302: {
    title: 'Pipe Not Found',
    note: 'A template uses a pipe that is not imported or declared where the template is compiled.',
  },
  NG0318: {
    title: 'Invalid style property binding value',
    note: 'A style property binding got a value of an unsupported type. Use strings, numbers, SafeValue, null or undefined.',
  },
  NG0401: {
    title: 'Missing platform',
    note: 'bootstrapApplication ran on the server without a BootstrapContext. Pass it from main.server.ts.',
  },
  NG0403: {
    title: "Bootstrapped NgModule doesn't specify which component to initialize",
    note: 'The bootstrapped NgModule has no bootstrap components and no ngDoBootstrap method.',
  },
  NG0500: {
    title: 'Hydration Node Mismatch',
    note: 'During hydration the DOM on the client did not match what the server rendered. Usually direct DOM manipulation, innerHTML or outerHTML in a component.',
  },
  NG0501: {
    title: 'Hydration Missing Siblings',
    note: 'Hydration expected more sibling nodes than it found, for example an @if or @for that renders differently on the server and on the client.',
  },
  NG0502: {
    title: 'Hydration Missing Node',
    note: 'Hydration expected a node at a place in the DOM and found none. See NG0500 for the usual causes.',
  },
  NG0503: {
    title: 'Hydration Unsupported Projection of DOM Nodes',
    note: 'Nodes created outside Angular (native DOM APIs) were passed as projectable nodes, which hydration does not support.',
  },
  NG0504: {
    title: 'Skip hydration flag is applied to an invalid node',
    note: 'ngSkipHydration is on a node that is not a component host. It only works on component hosts.',
  },
  NG0505: {
    title: 'No hydration info in server response',
    note: 'Hydration is on in the client, but the server response has no hydration data. Check that the server enables hydration too.',
  },
  NG0506: {
    title: 'NgZone remains unstable',
    note: 'The app did not become stable within 10 seconds during hydration, usually because of pending timers or microtasks.',
  },
  NG0507: {
    title: 'HTML content was altered after SSR',
    note: 'The server-rendered HTML changed before hydration, for example a CDN that strips whitespace and comment nodes.',
  },
  NG0600: {
    title: 'Signal write in a disallowed context',
    note: 'A signal was set or updated while a computed or a template was being evaluated. Both may only read signals.',
  },
  NG0602: {
    title: 'Disallowed function call inside reactive context',
    note: 'A function that must not run in a reactive context, such as effect(), was called from a computed, a template or a running effect.',
  },
  NG0750: {
    title: '@defer dependencies failed to load',
    note: 'Loading the dependencies of a @defer block failed and the block has no @error block.',
  },
  NG0751: { title: '@defer behavior when HMR is enabled' },
  NG0904: {
    title: 'Unsafe value used in a resource URL context',
    note: 'A binding set a resource URL (such as iframe src) to a value that was not marked as trusted.',
  },
  NG0910: {
    title: 'Unsafe bindings on an iframe element',
    note: 'An iframe has a binding on a security-sensitive attribute such as sandbox or allow. Set them as static attributes.',
  },
  NG0912: {
    title: 'Component ID generation collision',
    note: 'Two components have the same generated id because their metadata is identical, often the same selector.',
  },
  NG0913: { title: 'Runtime Performance Warnings' },
  NG0919: {
    title: 'Circular Dependency Detected',
    note: 'Components, directives or pipes import each other in a cycle, so Angular cannot read their metadata.',
  },
  NG0950: {
    title: 'Required input is accessed before a value is set',
    note: 'A required input was read before Angular bound a value, often during class construction.',
  },
  NG0951: {
    title: 'Child query result is required but no value is available',
    note: 'A required viewChild or contentChild was read before its results were calculated, or it has no match.',
  },
  NG0955: {
    title: 'Track expression resulted in duplicated keys for a given collection',
    note: 'The track expression of a @for block gives the same key to more than one item.',
  },
  NG0956: {
    title: 'Tracking expression caused re-creation of the DOM structure',
    note: 'A @for block tracked by identity re-created the DOM of every item, common with immutable data. Track by a unique id.',
  },
  NG0991: {
    title: 'Resource completed before producing a value',
    note: 'An rxResource or httpResource Observable completed without a value or an error.',
  },
  NG01002: {
    title: 'Missing Control Value',
    note: 'setValue on a FormGroup or FormArray got a value without an entry for one of its controls. Use patchValue to update only some.',
  },
  NG01101: {
    title: 'Wrong Async Validator Return Type',
    note: 'An async validator must return a Promise or an Observable.',
  },
  NG01203: {
    title: 'Missing value accessor',
    note: 'A form directive is on an element or component with no ControlValueAccessor. Custom controls must provide NG_VALUE_ACCESSOR.',
  },
  NG01902: {
    title: 'Orphan field in signal forms',
    note: 'A signal forms field no longer resolves in the model, often because its value was set to undefined.',
  },
  NG02200: {
    title: 'Missing Iterable Differ',
    note: 'NgFor got a value that is not iterable. Pass an array or another iterable, or use the keyvalue pipe for an object.',
  },
  NG02800: {
    title: 'JSONP support in HttpClient configuration',
    note: 'A JSONP request was made without JSONP support. Add withJsonpSupport() to provideHttpClient().',
  },
  NG02802: {
    title: 'Headers not transferred by HttpTransferCache',
    note: 'Client code read a header that the HTTP transfer cache did not transfer. List it in includeHeaders.',
  },
  NG02825: {
    title: 'Fetch response body exceeds the configured limit',
    note: 'During SSR a response body passed maxResponseBodySize (1 MB by default).',
  },
  NG05000: { title: 'Hydration with unsupported Zone.js instance.' },
  NG05104: {
    title: 'Root element was not found.',
    note: 'Angular could not find the element of a bootstrapped component, usually a selector that does not match the tag in index.html.',
  },
  NG05106: {
    title: 'Insertion reference node not found',
    note: 'Code outside Angular moved or removed a DOM node Angular tracks, so it could not insert next to it.',
  },
  NG05703: { title: 'Suspicious URL origin change during SSR' },
  NG1001: { title: 'Argument Not Literal' },
  NG2003: { title: 'Missing Token' },
  NG2009: { title: 'Invalid Shadow DOM selector' },
  NG3003: { title: 'Import Cycle Detected' },
  NG6100: { title: 'NgModule.id Set to module.id anti-pattern' },
  NG8001: { title: 'Invalid Element' },
  NG8002: { title: 'Invalid Attribute' },
  NG8003: { title: 'Missing Reference Target' },
  NG8011: { title: 'Control Flow Preventing Content Projection' },
  NG8023: { title: 'Multiple Components Match Same Element' },
  NG8024: { title: 'Conflicting Host Directive Binding' },
};

/** `NG0` and 3 or 4 digits at runtime, `NG1` to `NG9` and 3 digits from the compiler. */
const CODE_IN_TEXT = /(?<![\w-])NG(?:0\d{3,4}|[1-9]\d{3})(?!\d)/;

/** Upper-cases and checks a code someone typed, such as `ng100` or `NG0100`. */
export function normalizeNgCode(text: string): string | undefined {
  const match = /^\s*NG(\d{3,5})\s*$/i.exec(text);
  if (!match) return undefined;
  const digits = match[1]!;
  // Runtime codes start with 0 (`NG0100`); a bare `NG100` means the same page.
  if (digits.length === 3) return `NG0${digits}`;
  return `NG${digits}`;
}

/**
 * The Angular error code of an error or a message. A `RuntimeError` carries
 * its number in `code` (negative for codes with a page in the reference);
 * other errors only have it in the message.
 */
export function ngCodeOf(error: unknown, message = ''): string | undefined {
  let code: unknown;
  try {
    code = (error as { code?: unknown } | null)?.code;
  } catch {
    code = undefined;
  }
  if (typeof code === 'number' && Number.isInteger(code) && code !== 0) {
    // The same formatting as Angular's `formatRuntimeErrorCode`.
    return `NG0${Math.abs(code)}`;
  }
  return CODE_IN_TEXT.exec(message)?.[0];
}

/** Whether Angular's error reference has a page for the code. */
export function isDocumentedCode(code: string): boolean {
  return Object.hasOwn(CODES, code);
}

/** The reference page of a code, or `undefined` when the reference has none. */
export function ngCodeUrl(code: string): string | undefined {
  return isDocumentedCode(code) ? `${ERROR_REFERENCE_URL}/${code}` : undefined;
}

/** The title and the short note on a code, when the reference documents it. */
export function ngCodeInfo(code: string): (CodeInfo & { url: string }) | undefined {
  const info = CODES[code];
  return info ? { ...info, url: `${ERROR_REFERENCE_URL}/${code}` } : undefined;
}
