import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getPipes, pipeUsesIn } from '../get-pipes.ts';

async function pipesFor(source: string, angularVersion?: string) {
  const dir = fixtureDir('pangular-pipes-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.ts'), source);
  if (angularVersion) {
    const coreDir = join(dir, 'node_modules', '@angular', 'core');
    mkdirSync(coreDir, { recursive: true });
    writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ version: angularVersion }));
  }
  return scan(getPipes, dir);
}

describe('get-pipes', () => {
  it('reports a pure, standalone pipe by default', async () => {
    const [pipe] = await pipesFor(`
      @Pipe({ name: 'appTruncate' })
      export class TruncatePipe implements PipeTransform {
        transform(value: string) { return value; }
      }
    `);
    expect(pipe).toEqual(
      expect.objectContaining({
        name: 'appTruncate',
        className: 'TruncatePipe',
        isPure: true,
        isStandalone: true,
      }),
    );
  });

  it('reads an impure pipe', async () => {
    const [pipe] = await pipesFor(`
      @Pipe({ name: 'appTimeAgo', pure: false })
      export class TimeAgoPipe implements PipeTransform {
        transform(value: number) { return value; }
      }
    `);
    expect(pipe.isPure).toBe(false);
  });

  it('defaults standalone from the Angular major of the project', async () => {
    const source = `
      @Pipe({ name: 'plain' })
      export class PlainPipe {}
      @Pipe({ name: 'on', standalone: true })
      export class OnPipe {}
      @Pipe({ name: 'off', standalone: false })
      export class OffPipe {}
    `;
    const flags = async (version?: string) =>
      (await pipesFor(source, version)).map((p) => [p.name, p.isStandalone]);
    expect(await flags('18.2.0')).toEqual([
      ['plain', false],
      ['on', true],
      ['off', false],
    ]);
    expect(await flags('19.0.0')).toEqual([
      ['plain', true],
      ['on', true],
      ['off', false],
    ]);
    expect(await flags()).toEqual([
      ['plain', true],
      ['on', true],
      ['off', false],
    ]);
  });

  it('reads a non-standalone pipe', async () => {
    const [pipe] = await pipesFor(`
      @Pipe({ name: 'legacyFormat', standalone: false })
      export class LegacyFormatPipe implements PipeTransform {
        transform(value: string) { return value; }
      }
    `);
    expect(pipe.isStandalone).toBe(false);
  });

  it('reads a non-standalone pipe declared and exported by its NgModule', async () => {
    const pipes = await pipesFor(`
      @Pipe({ name: 'appLegacyFormat', standalone: false })
      export class LegacyFormatPipe implements PipeTransform {
        transform(value: string) { return value; }
      }

      @NgModule({
        declarations: [LegacyFormatPipe],
        exports: [LegacyFormatPipe],
      })
      export class LegacyFormatModule {}
    `);
    // The NgModule itself carries no @Pipe decorator, so only the pipe is
    // reported: a class merely declaring or exporting one is not one.
    expect(pipes.map((p) => [p.name, p.className, p.isStandalone])).toEqual([
      ['appLegacyFormat', 'LegacyFormatPipe', false],
    ]);
  });

  it('reads a non-standalone pipe whatever order it and its NgModule come in', async () => {
    const pipes = await pipesFor(`
      @NgModule({
        declarations: [LegacyFormatPipe],
        exports: [LegacyFormatPipe],
      })
      export class LegacyFormatModule {}

      @Pipe({ name: 'appLegacyFormat', standalone: false })
      export class LegacyFormatPipe implements PipeTransform {
        transform(value: string) { return value; }
      }
    `);
    expect(pipes.map((p) => p.name)).toEqual(['appLegacyFormat']);
  });

  it('reports every pipe in a file', async () => {
    const pipes = await pipesFor(`
      @Pipe({ name: 'appTruncate' })
      export class TruncatePipe implements PipeTransform {
        transform(value: string) { return value; }
      }

      @Pipe({ name: 'appTimeAgo', pure: false })
      export class TimeAgoPipe implements PipeTransform {
        transform(value: number) { return value; }
      }
    `);
    expect(pipes.map((p) => p.name)).toEqual(['appTruncate', 'appTimeAgo']);
  });

  it('does not report a component or directive as a pipe', async () => {
    const pipes = await pipesFor(`
      @Component({ selector: 'app-card', template: '' })
      export class Card {}

      @Directive({ selector: '[appHighlight]' })
      export class Highlight {}
    `);
    expect(pipes).toEqual([]);
  });

  it('ignores a pipe that is commented out', async () => {
    const pipes = await pipesFor(`
      // @Pipe({ name: 'appOld' })
      // export class OldPipe {}

      @Pipe({ name: 'appNew' })
      export class NewPipe implements PipeTransform {
        transform(value: string) { return value; }
      }
    `);
    expect(pipes.map((p) => p.name)).toEqual(['appNew']);
  });

  it('ignores a decorator quoted inside a template', async () => {
    const pipes = await pipesFor(
      '@Component({\n' +
        "  selector: 'app-docs',\n" +
        "  template: `<pre>@Pipe({ name: 'fake' })</pre>`,\n" +
        '})\n' +
        'export class Docs {}\n' +
        '\n' +
        "@Pipe({ name: 'appReal' })\n" +
        'export class RealPipe implements PipeTransform {\n' +
        '  transform(value: string) { return value; }\n' +
        '}\n',
    );
    expect(pipes.map((p) => p.name)).toEqual(['appReal']);
  });

  it('reports the file and line of the pipe class', async () => {
    const [pipe] = await pipesFor(
      [
        '/**',
        ' * Formats things.',
        ' */',
        "@Pipe({ name: 'appFormat' })",
        'export class FormatPipe {',
        '}',
      ].join('\n'),
    );
    expect(pipe.file).toBe('src/app.ts');
    expect(pipe.line).toBe(5);
  });

  describe('built-in pipes', () => {
    it('finds a built-in pipe used in an inline template', async () => {
      const pipes = await pipesFor(`
        @Component({
          selector: 'app-price',
          imports: [CurrencyPipe],
          template: '<p>{{ price | currency }}</p>',
        })
        export class Price {}
      `);
      expect(pipes).toEqual([
        expect.objectContaining({
          name: 'currency',
          className: 'CurrencyPipe',
          isStandalone: true,
          isPure: true,
          builtin: true,
          usageCount: 1,
        }),
      ]);
    });

    it('finds pipes in @let, @else if and @defer triggers', () => {
      const template = `
        @let user = user$ | async;
        @if (a) {
          <p>a</p>
        } @else if (flag$ | async) {
          <p>{{ d | date }}</p>
        }
        @defer (on viewport; when ready$ | async; prefetch when soon$ | async) {
          <p>{{ map | keyvalue }}</p>
        }
        @let label = 'a;b' | uppercase;
        <p>not | lowercase</p>
      `;
      const names = pipeUsesIn(template).map((u) => u.name);
      expect(names.sort()).toEqual(
        ['async', 'async', 'async', 'async', 'date', 'keyvalue', 'uppercase'].sort(),
      );
    });

    it('reports the offset of a pipe inside @let', () => {
      const template = '@let user = user$ | async;';
      const [use] = pipeUsesIn(template);
      expect(template.slice(use.index, use.index + 5)).toBe('async');
    });

    it('marks AsyncPipe as impure', async () => {
      const [pipe] = await pipesFor(`
        @Component({
          selector: 'app-latest',
          template: '<p>{{ value$ | async }}</p>',
        })
        export class Latest {}
      `);
      expect(pipe).toEqual(expect.objectContaining({ name: 'async', isPure: false }));
    });

    it('reports the file and line of each usage', async () => {
      const dir = fixtureDir('pangular-pipes-');
      mkdirSync(join(dir, 'src'));
      writeFileSync(
        join(dir, 'src', 'app.ts'),
        [
          '@Component({',
          "  selector: 'app-price',",
          '  template: `',
          '    <p>{{ price | currency }}</p>',
          '  `,',
          '})',
          'export class Price {}',
        ].join('\n'),
      );
      const [pipe] = await scan(getPipes, dir);
      expect(pipe.file).toBe('src/app.ts');
      expect(pipe.line).toBe(4);
    });

    it('reads a template from templateUrl, relative to the component file', async () => {
      const dir = fixtureDir('pangular-pipes-');
      mkdirSync(join(dir, 'src'));
      writeFileSync(
        join(dir, 'src', 'price.ts'),
        [
          '@Component({',
          "  selector: 'app-price',",
          "  templateUrl: './price.html',",
          '})',
          'export class Price {}',
        ].join('\n'),
      );
      writeFileSync(join(dir, 'src', 'price.html'), '<p>{{ price | currency }}</p>\n');
      const [pipe] = await scan(getPipes, dir);
      expect(pipe.name).toBe('currency');
      expect(pipe.file).toBe('src/price.html');
      expect(pipe.line).toBe(1);
    });

    it('counts every usage across files', async () => {
      const pipes = await pipesFor(`
        @Component({
          selector: 'app-a',
          template: '<p>{{ a | date }} {{ b | date:"short" }}</p>',
        })
        export class A {}

        @Component({
          selector: 'app-b',
          template: '<p>{{ c | date }}</p>',
        })
        export class B {}
      `);
      const date = pipes.find((p) => p.name === 'date');
      expect(date?.usageCount).toBe(3);
      expect(date?.usages).toHaveLength(3);
    });

    it('does not mistake logical OR for a pipe', async () => {
      const pipes = await pipesFor(`
        @Component({
          selector: 'app-flag',
          template: '<p>{{ isLoading || json }}</p>',
        })
        export class Flag {}
      `);
      expect(pipes).toEqual([]);
    });

    it('does not report a custom pipe as built-in', async () => {
      const pipes = await pipesFor(`
        @Pipe({ name: 'appTruncate' })
        export class TruncatePipe implements PipeTransform {
          transform(value: string) { return value; }
        }

        @Component({
          selector: 'app-card',
          imports: [TruncatePipe],
          template: '<p>{{ text | appTruncate }}</p>',
        })
        export class Card {}
      `);
      expect(pipes.map((p) => p.name)).toEqual(['appTruncate']);
    });

    it('finds a built-in pipe used inside a bound attribute', async () => {
      const pipes = await pipesFor(`
        @Component({
          selector: 'app-thing',
          template: '<div [attr.aria-label]="label | uppercase"></div>',
        })
        export class Thing {}
      `);
      expect(pipes.map((p) => p.name)).toEqual(['uppercase']);
    });

    it('ignores prose that reads like a pipe expression, in an inline template', async () => {
      const pipes = await pipesFor(`
        @Component({
          selector: 'app-docs',
          template: \`
            <p>Use the <code>| json</code> pipe for debugging.</p>
            <p>{{ value | uppercase }}</p>
          \`,
        })
        export class Docs {}
      `);
      expect(pipes.map((p) => p.name)).toEqual(['uppercase']);
    });

    it('ignores prose that reads like a pipe expression, in an external template', async () => {
      const dir = fixtureDir('pangular-pipes-');
      mkdirSync(join(dir, 'src'));
      writeFileSync(
        join(dir, 'src', 'docs.ts'),
        [
          '@Component({',
          "  selector: 'app-docs',",
          "  templateUrl: './docs.html',",
          '})',
          'export class Docs {}',
        ].join('\n'),
      );
      writeFileSync(
        join(dir, 'src', 'docs.html'),
        '<p>Use the <code>| json</code> pipe for debugging.</p>\n<p>{{ value | uppercase }}</p>\n',
      );
      const pipes = await scan(getPipes, dir);
      expect(pipes.map((p) => p.name)).toEqual(['uppercase']);
    });

    it('ignores a pipe-shaped attribute name followed by a literal quote', async () => {
      // `title` here is a plain (unbound) attribute, not an expression, even
      // though its value contains a `|`.
      const pipes = await pipesFor(`
        @Component({
          selector: 'app-thing',
          template: '<div title="a | b"></div>',
        })
        export class Thing {}
      `);
      expect(pipes).toEqual([]);
    });

    it('refuses a templateUrl that resolves outside the workspace', async () => {
      const dir = fixtureDir('pangular-pipes-');
      mkdirSync(join(dir, 'src'));
      const outside = fixtureDir('pangular-pipes-outside-');
      writeFileSync(join(outside, 'secret.html'), '<p>{{ value | currency }}</p>\n');
      writeFileSync(
        join(dir, 'src', 'app.ts'),
        [
          '@Component({',
          "  selector: 'app-thing',",
          `  templateUrl: '${join(outside, 'secret.html').replace(/\\/g, '\\\\')}',`,
          '})',
          'export class Thing {}',
        ].join('\n'),
      );
      const pipes = await scan(getPipes, dir);
      expect(pipes).toEqual([]);
    });
  });
});
