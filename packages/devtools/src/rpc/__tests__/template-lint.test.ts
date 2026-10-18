import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { fixtureDir } from './fixture-dir.ts';
import {
  lintTemplates,
  projectCompiler,
  templateLintText,
  type TemplateCompiler,
  type TemplateLintFinding,
} from '../template-lint.ts';
import { templateLintTool } from '../template-lint-tool.ts';

const REPO = fileURLToPath(new URL('../../../../../', import.meta.url));

let compiler: TemplateCompiler;
beforeAll(async () => {
  // The workspace's own @angular/compiler, loaded the way the tool loads a project's.
  const found = await projectCompiler(REPO);
  if (!found) throw new Error('@angular/compiler is not installed in the workspace');
  compiler = found;
});

function project(files: Record<string, string>): string {
  const dir = fixtureDir('pangular-template-lint-');
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function component(template: string): string {
  return `import { Component } from '@angular/core';

@Component({
  selector: 'app-view',
  template: \`${template}\`,
})
export class View {}
`;
}

async function lint(template: string, using: TemplateCompiler = compiler) {
  const dir = project({ 'src/view.ts': component(template) });
  return (await lintTemplates(dir, { compiler: using })).findings;
}

const rules = (findings: TemplateLintFinding[]) => findings.map((f) => f.rule);

describe('lintTemplates', () => {
  describe('template-parse-error', () => {
    it('reports an expression error at its line in an inline template', async () => {
      const findings = await lint('\n  <p>ok</p>\n  <p>{{ total( }}</p>\n');
      expect(findings).toHaveLength(1);
      // The template starts on line 5 of view.ts; the error is two lines in.
      expect(findings[0]).toMatchObject({
        rule: 'template-parse-error',
        severity: 'error',
        file: join('src', 'view.ts'),
        line: 7,
      });
      expect(findings[0]!.message).not.toMatch(/@\d+:\d+$/);
    });

    it('reports @for without track', async () => {
      const findings = await lint('@for (item of items) { <p>{{ item }}</p> }');
      expect(findings).toEqual([
        expect.objectContaining({
          rule: 'template-parse-error',
          message: expect.stringContaining('track'),
        }),
      ]);
    });

    it('reports an unclosed element in a templateUrl file at the html line', async () => {
      const dir = project({
        'src/card.ts': `@Component({ selector: 'app-card', templateUrl: './card.html' })
export class Card {}
`,
        'src/card.html': '<section>\n  <h2>Title</h2>\n  </div>\n</section>\n',
      });
      const { findings, templates } = await lintTemplates(dir, { compiler });
      expect(templates).toBe(1);
      expect(findings).toEqual([
        expect.objectContaining({
          rule: 'template-parse-error',
          file: join('src', 'card.html'),
          line: 3,
        }),
      ]);
    });

    it('reads escaped quotes in a quoted inline template without an error', async () => {
      const dir = project({
        'src/view.ts': `@Component({ selector: 'app-v', template: '<p title=\\'hi\\'>{{ a }}</p>' })
export class V {}
`,
      });
      const result = await lintTemplates(dir, { compiler });
      expect(result.templates).toBe(1);
      expect(result.findings).toEqual([]);
    });

    it('skips a backtick template built with ${}', async () => {
      const dir = project({
        'src/view.ts':
          "const body = '<p>';\n@Component({ selector: 'app-v', template: `${body}{{ a( }}` })\nexport class V {}\n",
      });
      expect(await lintTemplates(dir, { compiler })).toMatchObject({ templates: 0, findings: [] });
    });
  });

  describe('legacy-control-flow', () => {
    it('reports *ngIf, *ngFor and *ngSwitchCase', async () => {
      const findings = await lint(`
  <div *ngIf="open">a</div>
  <li *ngFor="let x of xs">{{ x }}</li>
  <div [ngSwitch]="mode"><p *ngSwitchCase="'a'">a</p></div>`);
      const legacy = findings.filter((f) => f.rule === 'legacy-control-flow');
      expect(legacy.map((f) => [f.line, f.severity])).toEqual([
        [6, 'info'],
        [7, 'info'],
        [8, 'info'],
      ]);
      expect(legacy[1]!.message).toContain('`*ngFor`');
      expect(legacy[1]!.message).toContain('`@for`');
      expect(legacy[2]!.message).toContain('`@switch`');
    });

    it('leaves @if blocks and explicit <ng-template [ngIf]> alone', async () => {
      const findings = await lint(`
  @if (open) { <p>a</p> }
  <ng-template [ngIf]="open"><p>b</p></ng-template>`);
      expect(rules(findings)).not.toContain('legacy-control-flow');
    });

    it('is skipped for an Angular without control flow blocks', async () => {
      const old = { ...compiler, VERSION: { major: '16' } } as TemplateCompiler;
      expect(rules(await lint('<div *ngIf="open">a</div>', old))).toEqual([]);
    });
  });

  describe('track-by-index', () => {
    it('reports tracking by $index when the body reads fields of the item', async () => {
      const findings = await lint(
        '@for (user of users; track $index) { <li>{{ user.name }}</li> }',
      );
      expect(findings).toEqual([
        expect.objectContaining({ rule: 'track-by-index', severity: 'warning', line: 5 }),
      ]);
      expect(findings[0]!.fix).toContain('track user.id');
    });

    it('reports tracking by an alias of $index', async () => {
      const findings = await lint(
        "@for (user of users; let i = $index; track i) { <li>{{ user?.['name'] }}</li> }",
      );
      expect(rules(findings)).toEqual(['track-by-index']);
    });

    it('leaves form array rows alone, which are found by position', async () => {
      expect(
        await lint(
          '@for (phone of phones.controls; track $index) { <input [formControlName]="$index" [class.bad]="phone.invalid"> }',
        ),
      ).toEqual([]);
      expect(
        await lint('@for (tag of form.tags; track $index) { <input [formField]="tag.label"> }'),
      ).toEqual([]);
    });

    it('leaves a stable key and a list of plain values alone', async () => {
      expect(
        await lint('@for (user of users; track user.id) { <li>{{ user.name }}</li> }'),
      ).toEqual([]);
      expect(await lint('@for (tag of tags; track $index) { <li>{{ tag }}</li> }')).toEqual([]);
      expect(
        await lint('@for (tag of tags; track $index) { <li>{{ this.tag.length }}</li> }'),
      ).toEqual([]);
    });
  });

  describe('ngclass-ngstyle', () => {
    it('reports [ngClass] and a static ngStyle', async () => {
      const findings = await lint(`
  <p [ngClass]="{ active: on }">a</p>
  <p ngStyle="color: red">b</p>`);
      expect(findings.map((f) => [f.rule, f.severity, f.line])).toEqual([
        ['ngclass-ngstyle', 'info', 6],
        ['ngclass-ngstyle', 'info', 7],
      ]);
      expect(findings[0]!.fix).toContain('[class]');
      expect(findings[1]!.fix).toContain('[style]');
    });

    it('leaves class and style bindings alone', async () => {
      expect(await lint('<p [class.active]="on" [style.color]="c" class="x">a</p>')).toEqual([]);
    });
  });

  describe('img-missing-alt', () => {
    it('reports an <img> without alt', async () => {
      const findings = await lint('<img src="a.png"><img [ngSrc]="src" width="1" height="1">');
      expect(findings.map((f) => [f.rule, f.severity])).toEqual([
        ['img-missing-alt', 'warning'],
        ['img-missing-alt', 'warning'],
      ]);
    });

    it('accepts empty, bound and attr alt, and hidden images', async () => {
      expect(
        await lint(`
  <img src="a.png" alt="">
  <img src="a.png" [alt]="label">
  <img src="a.png" [attr.alt]="label">
  <img src="a.png" role="presentation">
  <img src="a.png" aria-hidden="true">`),
      ).toEqual([]);
    });
  });

  describe('click-without-key', () => {
    it('reports (click) on a <div> without a key handler', async () => {
      const findings = await lint('<div class="card" (click)="open()">Open</div>');
      expect(findings).toEqual([
        expect.objectContaining({ rule: 'click-without-key', severity: 'warning', line: 5 }),
      ]);
      expect(findings[0]!.message).toContain('`<div>`');
    });

    it('leaves buttons, key handlers, components and hidden elements alone', async () => {
      expect(
        await lint(`
  <button (click)="open()">Open</button>
  <a routerLink="/x" (click)="track()">Go</a>
  <div (click)="open()" (keydown.enter)="open()" tabindex="0" role="button">Open</div>
  <app-card (click)="open()"></app-card>
  <span aria-hidden="true" (click)="open()">x</span>`),
      ).toEqual([]);
    });
  });

  it('reads nodes inside blocks and structural templates', async () => {
    const findings = await lint(`
  @if (open) {
    @for (u of users; track u.id) {
      <section *ngIf="u.visible"><img src="a.png"></section>
    }
  }`);
    expect(rules(findings).sort()).toEqual(['img-missing-alt', 'legacy-control-flow']);
  });

  it('says so when the project has no @angular/compiler', async () => {
    const dir = project({ 'src/view.ts': component('<p>a</p>') });
    const result = await lintTemplates(dir);
    expect(result).toEqual({ parsed: false, templates: 0, findings: [] });
    expect(templateLintText(result)).toContain('no `@angular/compiler`');
  });

  it('does not parse an unchanged template again, and parses an edited one', async () => {
    let parses = 0;
    const counting = {
      ...compiler,
      parseTemplate: (...args: Parameters<TemplateCompiler['parseTemplate']>) => {
        parses++;
        return compiler.parseTemplate(...args);
      },
    } as TemplateCompiler;
    const dir = project({
      'src/a.ts': component('<img src="a.png">'),
      'src/b.ts': component('<p>b</p>'),
    });
    expect(rules((await lintTemplates(dir, { compiler: counting })).findings)).toEqual([
      'img-missing-alt',
    ]);
    expect(parses).toBe(2);
    await lintTemplates(dir, { compiler: counting });
    expect(parses).toBe(2);
    writeFileSync(join(dir, 'src', 'a.ts'), component('<img src="a.png" alt="A">'));
    expect((await lintTemplates(dir, { compiler: counting })).findings).toEqual([]);
    expect(parses).toBe(3);
  });
});

describe('templateLintText', () => {
  async function many() {
    const dir = project({
      'src/cart/cart.ts': component('<img src="a.png"><div *ngIf="a">a</div>'),
      'src/home/home.ts': component('<p>{{ a( }}</p>'),
      'src/home/list.ts': component(
        '@for (u of users; track $index) { <div (click)="pick(u)">{{ u.name }}</div> }',
      ),
    });
    return lintTemplates(dir, { compiler });
  }

  it('lists findings errors first with rule, severity, file:line and a fix', async () => {
    const text = templateLintText(await many());
    expect(text).toMatch(/^5 findings \(1 error, 3 warning, 1 info\) in 3 templates\./);
    const items = text.split('\n').filter((line) => line.startsWith('- '));
    expect(items[0]).toMatch(/^- \*\*error\*\* template-parse-error at `src.home.home\.ts:5`: /);
    expect(items.at(-1)).toMatch(/^- \*\*info\*\* legacy-control-flow at `src.cart.cart\.ts:5`/);
    for (const item of items) expect(item).toContain(' Fix: ');
  });

  it('filters by rule, file and severity', async () => {
    const result = await many();
    expect(templateLintText(result, { rule: 'img-missing-alt' })).toMatch(/^1 finding /);
    const inHome = templateLintText(result, { file: 'home/' });
    expect(inHome).toMatch(/^3 findings/);
    expect(inHome).not.toContain('cart.ts');
    expect(templateLintText(result, { severity: 'info' })).toContain('legacy-control-flow');
    expect(templateLintText(result, { rule: 'ngclass-ngstyle' })).toBe(
      'No template problems found by the lint rules in 3 templates with these filters.',
    );
  });

  it('refuses an unknown rule or severity', async () => {
    const result = await many();
    expect(templateLintText(result, { rule: 'nope' })).toContain('Unknown rule "nope"');
    expect(templateLintText(result, { severity: 'fatal' })).toContain('Unknown severity');
  });

  it('cuts the list at limit and says how many are left', async () => {
    const text = templateLintText(await many(), { limit: 2 });
    expect(text.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(2);
    expect(text).toContain('3 more not shown.');
  });

  it('says when nothing was found and when there are no templates', () => {
    expect(templateLintText({ parsed: true, templates: 2, findings: [] })).toBe(
      'No template problems found by the lint rules in 2 templates.',
    );
    expect(templateLintText({ parsed: true, templates: 0, findings: [] })).toBe(
      'No component templates found in source.',
    );
  });
});

describe('scan-templates tool', () => {
  it('answers markdown for the arguments it gets', async () => {
    const dir = project({ 'src/view.ts': component('<img src="a.png">') });
    const tool = templateLintTool(dir, { compiler });
    expect(tool.id).toBe('pangular:scan-templates');
    expect(tool.description.length).toBeLessThanOrEqual(600);
    const answer = await tool.handler({ rule: 'img-missing-alt' });
    expect(answer.markdown).toContain('img-missing-alt at `src');
  });
});
