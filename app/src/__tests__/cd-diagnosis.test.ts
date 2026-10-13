import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { CdDiagnosis as Diagnosis } from '@pangular-inspector/devtools/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CdDiagnosis } from '../pages/cd-diagnosis';
import { CdRecording, type CdPage } from '../pages/cd-recording';

const diagnosis: Diagnosis = {
  triggers: true,
  waste: true,
  major: 22,
  causes: { signal: 4, event: 2, zone: 1 },
  components: [
    { name: 'Banner', refreshed: 20, unchanged: 19, strategy: 'Eager' },
    { name: 'Cart', refreshed: 5, unchanged: 0, strategy: 'OnPush' },
  ],
  inputs: [{ name: 'Row', input: 'items', parent: 'List', inPlace: 3, sameContents: 1 }],
  zone: [{ name: 'Clock', ticks: 1, tasks: ['setTimeout'] }],
};

function page(extra: Partial<CdPage> = {}): CdPage {
  return {
    pageId: 'p1',
    supported: true,
    recording: false,
    startedAt: 1000,
    dropped: 0,
    cycles: [
      {
        id: 1,
        at: 1001,
        ms: 1,
        passes: 1,
        checks: 2,
        components: [{ name: 'Cart', checks: 1, ms: 0.5 }],
        trigger: 'Cart (add)',
        cause: {
          kind: 'event',
          event: 'click',
          target: 'button',
          component: 'Cart',
          listener: 'add',
        },
        refreshed: 2,
        unchanged: 1,
      },
    ],
    components: [{ name: 'Cart', checks: 2, ms: 1, maxMs: 1, cycles: 1 }],
    hosts: {},
    diagnosis,
    ...extra,
  };
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** A table row's cells, joined with spaces. */
const cells = (row: Element | null) =>
  [...(row?.querySelectorAll('td') ?? [])].map((cell) => text(cell)).join(' ');

describe('CdDiagnosis', () => {
  let fixture: ComponentFixture<CdDiagnosis>;
  const host = () => fixture.nativeElement as HTMLElement;
  const section = (heading: string) =>
    [...host().querySelectorAll('h4')].find((h) => text(h) === heading)?.nextElementSibling ?? null;

  beforeEach(() => {
    fixture = TestBed.createComponent(CdDiagnosis);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  async function show(value: CdPage | null) {
    fixture.componentRef.setInput('page', value);
    await fixture.whenStable();
  }

  it('shows nothing for a recording without a diagnosis', async () => {
    await show(page({ diagnosis: undefined }));
    expect(host().querySelector('section')).toBeNull();
  });

  it('lists causes in a fixed order, zone.js dependents, wasted checks, inputs and hints', async () => {
    await show(page());
    const heading = host().querySelector('section')!.getAttribute('aria-labelledby')!;
    expect(text(host().querySelector(`#${heading}`))).toBe('Why it ran and what it wasted');
    const causes = [...section('What started the cycles')!.querySelectorAll('tbody tr')].map(cells);
    expect(causes).toEqual(['Event 2', 'Signal write 4', 'zone.js only 1']);
    expect(cells(section('Depends on zone.js')!.querySelector('tbody tr'))).toBe(
      'Clock 1 setTimeout',
    );
    const wasted = [...section('Wasted checks')!.querySelectorAll('tbody tr')].map(cells);
    expect(wasted).toEqual(['Banner 20 19 (95%) Eager']);
    expect(cells(section('Inputs that break OnPush')!.querySelector('tbody tr'))).toBe(
      'Row.items List 3 1',
    );
    const hints = [...section('Hints')!.querySelectorAll('li')].map(text);
    expect(hints[0]).toContain('Banner was refreshed 20 times and changed something in 1');
    expect(hints[0]).toContain('default from Angular 22');
    expect(
      hints.some((h) => h.includes('Input items of Row set by List changed in place 3 times')),
    ).toBe(true);
    expect(
      hints.some((h) => h.startsWith('Clock changed in 1 tick that only zone.js started')),
    ).toBe(true);
  });

  it('says why causes or wasted checks are missing', async () => {
    await show(
      page({ diagnosis: { ...diagnosis, triggers: false, waste: false, zone: undefined } }),
    );
    expect(text(section('What started the cycles'))).toContain('needs Angular 18 or later');
    expect(text(section('Wasted checks'))).toContain("can't watch DOM updates");
    expect(section('Depends on zone.js')).toBeNull();
  });

  it('says when zone.js ticks changed nothing', async () => {
    await show(page({ diagnosis: { ...diagnosis, zone: undefined } }));
    expect(text(section('Depends on zone.js'))).toBe(
      '1 tick came from zone.js alone, and no component changed in them.',
    );
  });
});

describe('CdDiagnosis and the zoneJs flag', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function zoneSection(zoneJs: boolean) {
    const fixture = TestBed.createComponent(CdDiagnosis);
    fixture.componentRef.setInput(
      'page',
      page({ diagnosis: { ...diagnosis, causes: { signal: 4 }, zone: [], zoneJs } }),
    );
    await fixture.whenStable();
    const h4 = [...(fixture.nativeElement as HTMLElement).querySelectorAll('h4')].find(
      (h) => h.textContent?.trim() === 'Depends on zone.js',
    );
    return h4?.parentElement ?? null;
  }

  it('shows the zone.js block on a zone.js page even when zone.js started no tick', async () => {
    expect((await zoneSection(true))?.textContent).toContain(
      'No component changed in a tick only zone.js started.',
    );
  });

  it('hides it on a zoneless page', async () => {
    expect(await zoneSection(false)).toBeNull();
  });
});

describe('CdDiagnosis on a zoneless page', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('hides the zone.js block when no tick came from zone.js', async () => {
    const fixture = TestBed.createComponent(CdDiagnosis);
    fixture.componentRef.setInput(
      'page',
      page({ diagnosis: { ...diagnosis, causes: { signal: 4, event: 2 }, zone: [] } }),
    );
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const headings = [...host.querySelectorAll('h4')].map((h) => text(h));
    expect(headings).toContain('What started the cycles');
    expect(headings).not.toContain('Depends on zone.js');
    expect(host.textContent).not.toContain('zone.js started');
    fixture.destroy();
  });
});

describe('CdRecording latest cycles', () => {
  it('names what started a cycle and how many checks changed nothing', async () => {
    const fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('page', page());
    await fixture.whenStable();
    const row = (fixture.nativeElement as HTMLElement).querySelector('.cycles li');
    expect(text(row)).toContain('from click on button in Cart (add)');
    expect(text(row)).toContain('1 changed nothing');
    expect(text(row)).not.toContain('after Cart (add)');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-cd-diagnosis section'),
    ).not.toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
