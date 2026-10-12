import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CdRecording, type CdPage } from '../pages/cd-recording';

let fixture: ComponentFixture<CdRecording>;
let saved: { name: string; blob: Blob }[];

function page(): CdPage {
  return {
    pageId: 'p1',
    supported: true,
    recording: false,
    startedAt: 1000,
    dropped: 0,
    hosts: { e1: 2 },
    components: [{ name: 'Cart', checks: 2, ms: 3, maxMs: 2, cycles: 2 }],
    hooks: [{ name: 'Cart', hook: 'ngDoCheck', calls: 4, ms: 1.25, maxMs: 0.5 }],
    outputs: [{ name: 'Cart', listener: 'onAdd', calls: 1, ms: 0.5, maxMs: 0.5 }],
    afterRender: { runs: 2, ms: 0.75, maxMs: 0.5 },
    spanNames: ['Cart'],
    cycles: [
      {
        id: 1,
        at: 1010,
        t: 10,
        ms: 2,
        passes: 1,
        checks: 2,
        components: [{ name: 'Cart', checks: 2, ms: 1 }],
        hookMs: 0.5,
        afterRenderMs: 0.25,
        spans: [[0, 0, 1, 0, 'c']],
      },
    ],
  };
}

const host = () => fixture.nativeElement as HTMLElement;
const button = (text: string) =>
  [...host().querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
const live = () => host().querySelector('[role="status"]')!.textContent!;

async function settle() {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

async function importFile(content: string, name = 'recording.json') {
  const input = host().querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  await settle();
}

async function saveWith(text: string): Promise<unknown> {
  saved = [];
  button(text)!.click();
  await settle();
  expect(saved).toHaveLength(1);
  return JSON.parse(await saved[0]!.blob.text());
}

describe('CdRecording export and import', () => {
  beforeEach(async () => {
    saved = [];
    let last: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      last = blob as Blob;
      return 'blob:x';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ name: this.download, blob: last! });
    });
    const client = { scope: () => ({ rpc: { call: vi.fn(() => Promise.resolve()) } }) };
    fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('pageId', 'p1');
    fixture.componentRef.setInput('rpc', client as unknown as DevframeRpcClient);
    fixture.componentRef.setInput('page', page());
    await settle();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows hook, output and afterRender time', () => {
    const text = host().textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Lifecycle hooks');
    expect(text).toContain('Cart.ngDoCheck');
    expect(text).toContain('Cart (onAdd)');
    expect(text).toContain('afterRender callbacks ran 2 times, 0.75 ms in total, slowest 0.50 ms.');
    expect(text).toContain('hooks 0.50 ms');
    expect(text).toContain('afterRender 0.25 ms');
  });

  it('exports the recording as JSON and as a Perfetto trace', async () => {
    const file = (await saveWith('Export JSON')) as {
      format: string;
      pageId: string;
      recording: { hosts: object; hooks: unknown[] };
    };
    expect(saved[0]?.name).toBe('change-detection-p1.json');
    expect(file.format).toBe('pangular-inspector/change-detection');
    expect(file.recording.hosts).toEqual({});
    expect(file.recording.hooks).toHaveLength(1);

    const trace = (await saveWith('Export trace (Perfetto)')) as {
      traceEvents: { ph: string; name: string }[];
    };
    expect(saved[0]?.name).toBe('change-detection-p1.trace.json');
    const complete = trace.traceEvents.filter((e) => e.ph === 'X').map((e) => e.name);
    expect(complete).toEqual(['Change detection #1', 'Cart']);
  });

  it('shows an imported recording, marked as imported, and goes back to the live one', async () => {
    const hostile = {
      ...page(),
      pageId: 'other',
      recording: true,
      components: [
        { name: '<img src=x onerror="alert(1)">', checks: 1, ms: 9, maxMs: 9, cycles: 1 },
      ],
      script: '<script>alert(1)</script>',
      cycles: [...page().cycles, { ...page().cycles[0]!, id: 2, trigger: 'x'.repeat(1000) }],
    };
    await importFile(JSON.stringify(hostile), 'hand-edited.json');

    expect(host().querySelector('.imported')!.textContent).toContain('Imported recording');
    expect(host().querySelector('.imported')!.textContent).toContain('hand-edited.json');
    expect(host().querySelector('.status')!.textContent!.trim()).toBe('2 cycles imported.');
    expect(live()).toContain('Imported hand-edited.json: 2 cycles.');
    expect(button('Record')).toBeUndefined();
    expect(button('Stop recording')).toBeUndefined();
    // Names are text, never markup, and long strings are cut by the shared sanitizer.
    expect(host().querySelector('img, script')).toBeNull();
    expect(host().textContent).toContain('<img src=x onerror="alert(1)">');
    expect(host().querySelector('.trigger .mono')!.textContent).toHaveLength(300);

    button('Back to live recording')!.click();
    await settle();
    expect(host().querySelector('.imported')).toBeNull();
    expect(button('Record')).toBeDefined();
    expect(live()).toBe('Showing the live recording.');
  });

  it('says why a file cannot be imported and keeps the live recording', async () => {
    await importFile('{"navigations": []}', 'routes.json');
    expect(host().querySelector('[role="alert"]')!.textContent).toBe(
      'routes.json: The file has no change detection cycles.',
    );
    expect(host().querySelector('.imported')).toBeNull();

    await importFile('not json', 'broken.json');
    expect(host().querySelector('[role="alert"]')!.textContent).toBe(
      'broken.json: The file is not valid JSON.',
    );

    await importFile(JSON.stringify(page()));
    expect(host().querySelector('[role="alert"]')).toBeNull();
  });

  it('turns the export buttons off when there is nothing to export', async () => {
    fixture.componentRef.setInput('page', { ...page(), cycles: [] });
    await settle();
    expect(button('Export JSON')!.disabled).toBe(true);
    expect(button('Export trace (Perfetto)')!.disabled).toBe(true);
    expect(button('Import')!.disabled).toBe(false);
  });
});
