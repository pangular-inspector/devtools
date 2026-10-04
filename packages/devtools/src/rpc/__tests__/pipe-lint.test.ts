import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { describe, expect, it } from 'vitest';
import { lintPipes } from '../pipe-lint.ts';

function lintFor(source: string) {
  const dir = fixtureDir('pangular-pipe-lint-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.ts'), source);
  return lintPipes(dir);
}

describe('lintPipes', () => {
  describe('impure-pipe-in-for', () => {
    it('flags a built-in impure pipe used inside @for', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-list',
          imports: [SlicePipe],
          template: \`
            @for (item of items; track item.id) {
              <p>{{ item.tail | slice:1 }}</p>
            }
          \`,
        })
        export class ListView {}
      `);
      const finding = findings.find((f) => f.rule === 'impure-pipe-in-for');
      expect(finding).toMatchObject({ pipe: 'slice', severity: 'warning' });
    });

    it('flags a custom impure pipe used inside @for', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appLive', pure: false })
        export class LivePipe implements PipeTransform {
          transform(value: number) { return value; }
        }

        @Component({
          selector: 'app-list',
          imports: [LivePipe],
          template: \`
            @for (item of items; track item.id) {
              <p>{{ item.value | appLive }}</p>
            }
          \`,
        })
        export class ListView {}
      `);
      const finding = findings.find((f) => f.rule === 'impure-pipe-in-for');
      expect(finding).toMatchObject({ pipe: 'appLive', severity: 'warning' });
    });

    it('flags an impure pipe inside @let within @for', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-list',
          imports: [SlicePipe],
          template: \`
            @for (item of items; track item.id) {
              @let tail = item.tail | slice:1;
              <p>{{ tail }}</p>
            }
          \`,
        })
        export class ListView {}
      `);
      const finding = findings.find((f) => f.rule === 'impure-pipe-in-for');
      expect(finding).toMatchObject({ pipe: 'slice', severity: 'warning' });
    });

    it('does not flag a pure pipe inside @for', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-list',
          imports: [CurrencyPipe],
          template: \`
            @for (item of items; track item.id) {
              <p>{{ item.price | currency }}</p>
            }
          \`,
        })
        export class ListView {}
      `);
      expect(findings.filter((f) => f.rule === 'impure-pipe-in-for')).toEqual([]);
    });

    it('does not flag an impure pipe used outside @for', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-list',
          imports: [SlicePipe],
          template: '<p>{{ items | slice:1 }}</p>',
        })
        export class ListView {}
      `);
      expect(findings.filter((f) => f.rule === 'impure-pipe-in-for')).toEqual([]);
    });
  });

  describe('json-pipe-in-template', () => {
    it('flags | json usage', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-debug',
          imports: [JsonPipe],
          template: '<pre>{{ data | json }}</pre>',
        })
        export class Debug {}
      `);
      const finding = findings.find((f) => f.rule === 'json-pipe-in-template');
      expect(finding).toMatchObject({ pipe: 'json', severity: 'info' });
    });

    it('does not flag a template with no json usage', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-debug',
          imports: [UpperCasePipe],
          template: '<p>{{ name | uppercase }}</p>',
        })
        export class Debug {}
      `);
      expect(findings.filter((f) => f.rule === 'json-pipe-in-template')).toEqual([]);
    });
  });

  describe('async-on-call', () => {
    it('flags a method call piped to async', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-users',
          imports: [AsyncPipe],
          template: \`
            @for (u of getUsers() | async; track u.id) {
              <p>{{ u.name }}</p>
            }
            @let details = api.load(id) | async;
          \`,
        })
        export class Users {
          getUsers() { return this.http.get('/users'); }
        }
      `);
      const matches = findings.filter((f) => f.rule === 'async-on-call');
      expect(matches.map((f) => f.message.slice(0, 20))).toEqual([
        '`getUsers(…) | async',
        '`api.load(…) | async',
      ]);
      expect(matches[0]).toMatchObject({ pipe: 'async', severity: 'info', line: 6 });
    });

    it('skips signal fields, observable fields and casts', () => {
      const findings = lintFor(`
        @Component({
          selector: 'app-users',
          imports: [AsyncPipe],
          template: \`
            <p>{{ users$ | async }}</p>
            <p>{{ source() | async }}</p>
            <p>{{ fromInput() | async }}</p>
            <p>{{ derived() | async }}</p>
            <p>{{ bridged() | async }}</p>
            <p>{{ $any(x) | async }}</p>
            <p>{{ (users$ | async)?.length }}</p>
          \`,
        })
        export class Users {
          users$ = of([]);
          source = signal(of(1));
          fromInput = input.required<Observable<number>>();
          derived = computed(() => of(1));
          bridged = toSignal(of(of(1)));
        }
      `);
      expect(findings.filter((f) => f.rule === 'async-on-call')).toEqual([]);
    });
  });

  describe('signal-read-in-pure-pipe', () => {
    it('flags a pure pipe reading a signal field in transform()', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appScaled' })
        export class ScaledPipe implements PipeTransform {
          factor = signal(2);
          transform(value: number) {
            return value * this.factor();
          }
        }
      `);
      const finding = findings.find((f) => f.rule === 'signal-read-in-pure-pipe');
      expect(finding).toMatchObject({ pipe: 'appScaled' });
    });

    it.each([
      ['linkedSignal', 'factor = linkedSignal(() => 2);'],
      ['toSignal', 'factor = toSignal(of(2), { initialValue: 2 });'],
      ['model', 'factor = model(2);'],
      ['input.required', 'factor = input.required<number>();'],
    ])('flags a pure pipe reading a %s field in transform()', (_kind, field) => {
      const findings = lintFor(`
        @Pipe({ name: 'appScaled' })
        export class ScaledPipe implements PipeTransform {
          ${field}
          transform(value: number) {
            return value * this.factor();
          }
        }
      `);
      const finding = findings.find((f) => f.rule === 'signal-read-in-pure-pipe');
      expect(finding).toMatchObject({ pipe: 'appScaled', severity: 'warning' });
    });

    it('flags a zero-argument call on an inject() field as info', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appRate' })
        export class RatePipe implements PipeTransform {
          private readonly rates = inject(RatesService);
          transform(value: number) {
            return value * this.rates.current() + this.rates.convert(value);
          }
        }
      `);
      const matches = findings.filter((f) => f.rule === 'signal-read-in-pure-pipe');
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ pipe: 'appRate', severity: 'info' });
      expect(matches[0].message).toContain('this.rates.current()');
    });

    it('flags a zero-argument call on a constructor-injected field as info', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appRate' })
        export class RatePipe implements PipeTransform {
          constructor(private readonly rates: RatesService, other: Other) {}
          transform(value: number) {
            return value * this.rates.current();
          }
        }
      `);
      const finding = findings.find((f) => f.rule === 'signal-read-in-pure-pipe');
      expect(finding).toMatchObject({ pipe: 'appRate', severity: 'info' });
    });

    it('does not flag calls on fields that are not injected', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appPlain' })
        export class PlainPipe implements PipeTransform {
          private readonly helper = new Helper();
          transform(value: number) {
            return this.helper.scale() * value;
          }
        }
      `);
      expect(findings.filter((f) => f.rule === 'signal-read-in-pure-pipe')).toEqual([]);
    });

    it('does not flag an impure pipe reading a signal field', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appScaled', pure: false })
        export class ScaledPipe implements PipeTransform {
          factor = signal(2);
          transform(value: number) {
            return value * this.factor();
          }
        }
      `);
      expect(findings.filter((f) => f.rule === 'signal-read-in-pure-pipe')).toEqual([]);
    });

    it('does not flag a pure pipe that never reads a signal field', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appPlain' })
        export class PlainPipe implements PipeTransform {
          transform(value: number) {
            return value * 2;
          }
        }
      `);
      expect(findings.filter((f) => f.rule === 'signal-read-in-pure-pipe')).toEqual([]);
    });

    it('does not flag a pure pipe with a signal field it never reads in transform()', () => {
      const findings = lintFor(`
        @Pipe({ name: 'appUnused' })
        export class UnusedPipe implements PipeTransform {
          unused = signal(2);
          transform(value: number) {
            return value;
          }
        }
      `);
      expect(findings.filter((f) => f.rule === 'signal-read-in-pure-pipe')).toEqual([]);
    });
  });
});
