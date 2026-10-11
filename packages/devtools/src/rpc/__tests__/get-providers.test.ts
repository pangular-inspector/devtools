import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getProviders } from '../get-providers.ts';

async function providersFor(source: string) {
  const dir = fixtureDir('pangular-providers-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.ts'), source);
  return scan(getProviders, dir);
}

describe('get-providers', () => {
  it('reads a providers array', async () => {
    const providers = await providersFor(`
      @Component({
        providers: [{ provide: PANEL_TITLE, useValue: 'a title' }, FeatureCatalog],
      })
      class Panel {}
    `);
    expect(providers.map((p) => p.token)).toEqual(['PANEL_TITLE', 'FeatureCatalog']);
  });

  it('reads the whole providers array when one entry holds an array', async () => {
    const providers = await providersFor(
      [
        '@Component({',
        '  providers: [{ provide: TOKENS, useValue: [1, 2] }, LateService],',
        '})',
        'class Panel {}',
      ].join('\n'),
    );
    expect(providers.map((p) => p.token)).toEqual(['TOKENS', 'LateService']);
  });

  it('reads a decorator whose argument list holds a comment', async () => {
    const providers = await providersFor(
      ['@Injectable({', '  /** docs */', "  providedIn: 'root',", '})', 'class Api {}'].join('\n'),
    );
    expect(providers).toEqual([
      expect.objectContaining({ token: 'Api', providedIn: 'root', line: 1 }),
    ]);
  });

  it('does not read identifiers quoted inside a string', async () => {
    const providers = await providersFor(`
      @Component({
        providers: [{ provide: PANEL_TITLE, useValue: 'Element level providers' }],
      })
      class Panel {}
    `);
    expect(providers.map((p) => p.token)).toEqual(['PANEL_TITLE']);
  });

  it('does not read commented out providers', async () => {
    const providers = await providersFor(`
      @Component({
        providers: [
          // { provide: OldToken, useValue: 1 },
          NewToken,
        ],
      })
      class Panel {}
    `);
    expect(providers.map((p) => p.token)).toEqual(['NewToken']);
  });

  it('reads every providers array in a file, with each token on its own line', async () => {
    const providers = await providersFor(
      [
        '@Component({',
        '  providers: [',
        '    FirstToken,',
        '  ],',
        '})',
        'class First {}',
        '',
        '@Component({',
        '  providers: [SecondToken],',
        '})',
        'class Second {}',
      ].join('\n'),
    );
    expect(providers.map((p) => [p.token, p.line])).toEqual([
      ['FirstToken', 3],
      ['SecondToken', 9],
    ]);
  });

  it('keeps providedIn and the line of each entry', async () => {
    const providers = await providersFor(
      `
@Injectable({ providedIn: 'root' })
class Settings {}`,
    );
    expect(providers).toEqual([
      expect.objectContaining({ token: 'Settings', providedIn: 'root', line: 2 }),
    ]);
  });

  it('reads inject() calls', async () => {
    const providers = await providersFor(`
      class Panel {
        readonly settings = inject(ExampleSettings);
      }
    `);
    expect(providers).toContainEqual(
      expect.objectContaining({ token: 'ExampleSettings', source: 'settings' }),
    );
  });

  it('reads the stable zoneless and check-no-changes providers', async () => {
    const providers = await providersFor(`
      export const appConfig = {
        providers: [provideZonelessChangeDetection(), provideCheckNoChangesConfig({ exhaustive: true })],
      };
    `);
    expect(providers.map((p) => p.token)).toEqual(['ChangeDetection (zoneless)', 'CheckNoChanges']);
  });

  it('reads only the provided token of each providers entry', async () => {
    const providers = await providersFor(`
      @Component({
        providers: [
          { provide: API_URL, useFactory: (config: AppConfig) => config.url, deps: [AppConfig] },
          { provide: Logger, useClass: ConsoleLogger },
          { provide: Parent, useExisting: forwardRef(() => Child) },
          { provide: forwardRef(() => Late), useValue: 1 },
          ...FEATURE_PROVIDERS,
          APP_PROVIDERS,
          importProvidersFrom(SomeModule),
          Store,
        ],
        viewProviders: [ViewOnly],
      })
      class Panel {}
    `);
    expect(providers.map((p) => [p.token, p.type])).toEqual([
      ['API_URL', 'provider'],
      ['Logger', 'provider'],
      ['Parent', 'provider'],
      ['Late', 'provider'],
      ['Store', 'provider'],
      ['ViewOnly', 'provider'],
    ]);
  });

  it('reads a root signalStore and a tree-shakable InjectionToken as providers', async () => {
    const providers = await providersFor(`
      export const CartStore = signalStore({ providedIn: 'root' }, withState({ items: [] }));
      export const LocalStore = signalStore(withState({ open: false }));
      export const API_URL = new InjectionToken<string>('api', {
        providedIn: 'root',
        factory: () => '/api',
      });
      export const PLAIN = new InjectionToken<string>('plain');
    `);
    expect(providers.map((p) => [p.token, p.source, p.providedIn, p.type])).toEqual([
      ['CartStore', 'signalStore', 'root', 'injectable'],
      ['API_URL', 'InjectionToken', 'root', 'injectable'],
    ]);
  });

  it('tells inject() consumers apart from provider declarations', async () => {
    const providers = await providersFor(`
      @Injectable({ providedIn: 'root' })
      export class Api {}
      export class Panel {
        api = inject(Api);
        other = inject(Api);
      }
    `);
    expect(providers.filter((p) => p.type !== 'injection').map((p) => p.token)).toEqual(['Api']);
    expect(providers.filter((p) => p.type === 'injection')).toHaveLength(2);
  });

  it('reads typed constructor parameters of decorated classes', async () => {
    const providers = await providersFor(`
      @Injectable()
      export class Repo {
        constructor(
          private http: HttpClient,
          private store: Store<AppState>,
          @Optional() @Inject(API_URL) readonly url: string,
          name: string,
        ) {}
      }
      export class Plain {
        constructor(private http: HttpClient) {}
      }
    `);
    expect(providers.filter((p) => p.type === 'injection').map((p) => [p.token, p.source])).toEqual(
      [
        ['HttpClient', 'http'],
        ['Store', 'store'],
        ['API_URL', 'url'],
      ],
    );
  });

  it('reads the real token of inject() for forwardRef, dotted references and options', async () => {
    const providers = await providersFor(`
      class Panel {
        a = inject(forwardRef(() => Foo));
        b = inject(Tokens.API_URL);
        c = inject(Api, { optional: true });
        d = inject(this.token);
        e = inject(getToken());
        f = inject(forwardRef(() => Foo()));
      }
    `);
    expect(providers.filter((p) => p.type === 'injection').map((p) => [p.token, p.source])).toEqual(
      [
        ['Foo', 'a'],
        ['Tokens.API_URL', 'b'],
        ['Api', 'c'],
      ],
    );
  });

  it('does not report a constructor param under its type when @Inject names another token', async () => {
    const providers = await providersFor(`
      @Injectable()
      export class Repo {
        constructor(
          @Inject('APP_CONFIG') private cfg: AppConfig,
          @Inject(API_URL) readonly url: string,
          private http: HttpClient,
        ) {}
      }
    `);
    expect(providers.filter((p) => p.type === 'injection').map((p) => [p.token, p.source])).toEqual(
      [
        ['API_URL', 'url'],
        ['HttpClient', 'http'],
      ],
    );
  });

  it('reads inject() with nested generic arguments', async () => {
    const providers = await providersFor(`
      class Panel {
        private readonly cache = inject<Map<string, Foo>>(CACHE);
        private http: HttpClient = inject(HttpClient);
      }
    `);
    expect(providers.map((p) => [p.token, p.source])).toEqual([
      ['CACHE', 'cache'],
      ['HttpClient', 'http'],
    ]);
  });

  it('credits bare inject() calls to the function or class around them', async () => {
    const providers = await providersFor(`
      export const authGuard: CanActivateFn = () => inject(Auth).ok();
      export const redirect = (route) => {
        return inject(Router).parseUrl('/');
      };
      export function resolveUser() {
        return inject(Users).current();
      }
      class Panel {
        go() {
          inject(Router).navigate([]);
        }
      }
      const other = TestBed.inject(Ignored);
    `);
    expect(providers.map((p) => [p.token, p.source])).toEqual([
      ['Auth', 'authGuard'],
      ['Router', 'redirect'],
      ['Users', 'resolveUser'],
      ['Router', 'Panel'],
    ]);
  });

  it('leaves out providedIn when it is null', async () => {
    const providers = await providersFor(`
      @Injectable({ providedIn: null })
      class Local {}
      @Service({ providedIn: null })
      class AlsoLocal {}
    `);
    expect(providers.map((p) => [p.token, p.providedIn])).toEqual([
      ['Local', undefined],
      ['AlsoLocal', undefined],
    ]);
  });
});
