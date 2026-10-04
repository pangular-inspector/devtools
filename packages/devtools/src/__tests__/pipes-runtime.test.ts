// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Pipe, TemplateRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CurrencyPipe, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findPipeUsages,
  instrumentPipes,
  pipeSlotsIn,
  readBoundArg,
  scanPipeViews,
  staleCheckFor,
} from '../pipes-runtime.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

async function mount<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function ng(): any {
  return (globalThis as any).ng;
}

class Price {
  amount = 9.5;
  name = 'widget';
}
Component({
  selector: 'app-price',
  imports: [CurrencyPipe, UpperCasePipe],
  template: `<p>{{ amount | currency }}</p><p>{{ name | uppercase }}</p>`,
})(Price);

describe('pipe runtime discovery (real Angular render)', () => {
  it('finds the live CurrencyPipe and UpperCasePipe instances used in a rendered template', async () => {
    const fixture = await mount(Price);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    const names = usages.map((u) => u.name).sort();
    expect(names).toEqual(['currency', 'uppercase']);

    const currency = usages.find((u) => u.name === 'currency')!;
    expect(currency.className).toBe('CurrencyPipe');
    expect(currency.isPure).toBe(true);
    expect(typeof currency.instance.transform).toBe('function');
    expect(currency.component).toBe(fixture.componentInstance);
  });

  it('reads pipe defs and live instances straight off tView.data/lView at the same index', async () => {
    await mount(Price);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    const { lView } = usages[0];
    const slots = pipeSlotsIn(lView);
    expect(slots.map((s) => s.name).sort()).toEqual(['currency', 'uppercase']);
    for (const slot of slots) {
      expect(slot.lView[slot.index]).toBe(slot.instance);
    }
  });

  it('does not find pipes in an element tree with no Angular views', () => {
    document.body.innerHTML = '<div><span>plain html</span></div>';
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    expect(usages).toEqual([]);
  });

  it('patches a pipe prototype once and observes real transform calls', async () => {
    await mount(Price);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    const currencySlot = usages.find((u) => u.name === 'currency')!;
    const calls: unknown[] = [];
    const instrumentation = instrumentPipes((call) => calls.push(call));
    instrumentation.addPipe(currencySlot);
    instrumentation.addPipe(currencySlot); // idempotent: second add must not double-wrap

    const result = currencySlot.instance.transform(3);
    expect(typeof result).toBe('string');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ name: 'currency', args: [3], result });

    instrumentation.stop();
    currencySlot.instance.transform(4);
    expect(calls).toHaveLength(1); // no longer wrapped after stop()
  });
});

class Cart {
  items = signal<string[]>(['a', 'b']);
}
Component({
  selector: 'app-cart',
  imports: [UpperCasePipe],
  // json isn't imported here; slice the array to a single-string binding so
  // a pure pipe (uppercase) receives the array itself via a wrapper, letting
  // us mutate its contents in place without changing the array's reference.
  template: `<p>{{ items().join(',') | uppercase }}</p>`,
})(Cart);

describe('stale pure-pipe check (experimental, real Angular render)', () => {
  it('recovers a real binding slot and reads the last argument Angular compared', async () => {
    const fixture = await mount(Cart);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    const upper = usages.find((u) => u.name === 'uppercase')!;
    const check = staleCheckFor(upper);
    expect(check).not.toBeNull();
    expect(readBoundArg(upper, check!)).toBe('a,b');

    fixture.componentInstance.items.set(['c', 'd']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readBoundArg(upper, check!)).toBe('c,d');
  });

  it('returns null gracefully when the template source does not match the expected shape', () => {
    const fakeSlot = {
      name: 'uppercase',
      isPure: true,
      instance: {},
      lView: [null, { template: () => {}, bindingStartIndex: 10 }] as any,
    };
    expect(staleCheckFor(fakeSlot)).toBeNull();
  });

  it('returns null gracefully when the view has no usable tView', () => {
    const fakeSlot = { name: 'uppercase', isPure: true, instance: {}, lView: [] as any };
    expect(staleCheckFor(fakeSlot)).toBeNull();
  });
});

class Badge {}
Component({ selector: 'app-badge', template: `<b>badge</b>` })(Badge);

class Board {
  show = signal(true);
  items = signal(['x', 'y']);
  title = 'board';
}
Component({
  selector: 'app-board',
  imports: [Badge, UpperCasePipe],
  template: `<app-badge />@if (show()) {{{ title | uppercase }}}@for (item of items(); track item) {{{ item | uppercase }}}`,
})(Board);

class _ShoutPipe {
  transform(value: string) {
    return `${value}!`;
  }
}
Pipe({ name: 'shout' })(_ShoutPipe);

class _Shell {
  a = signal('one');
  b = signal('two');
}
Component({
  selector: 'app-shell',
  imports: [_ShoutPipe],
  template: `<p>{{ a() | shout }}</p><p>{{ b() | shout }}</p>`,
})(_Shell);

class _Frame {
  tpl: TemplateRef<unknown> | null = null;
}
Component({
  selector: 'app-frame',
  inputs: ['tpl'],
  imports: [NgTemplateOutlet],
  template: `<section><ng-container [ngTemplateOutlet]="tpl" /></section>`,
})(_Frame);

class _Declarer {
  label = 'row';
}
Component({
  selector: 'app-declarer',
  imports: [_Frame, UpperCasePipe],
  template: `<ng-template #cell><span>{{ label | uppercase }}</span></ng-template><app-frame [tpl]="cell" />`,
})(_Declarer);

describe('pipe discovery through the view tree', () => {
  it('attributes a template rendered by another component to the component that declares it', async () => {
    const fixture = await mount(_Declarer);
    for (const elements of [document.querySelectorAll('*'), document.querySelectorAll('span')]) {
      const usages = findPipeUsages(ng(), elements).filter((u) => u.name === 'uppercase');
      expect(usages).toHaveLength(1);
      expect(usages[0].component).toBe(fixture.componentInstance);
    }
  });

  it('finds pipes in views that hold only text nodes', async () => {
    await mount(Board);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    expect(usages.filter((u) => u.name === 'uppercase')).toHaveLength(3);
  });

  it('finds them from the root element alone, without walking the DOM', async () => {
    await mount(Board);
    const scan = scanPipeViews(ng(), document.querySelectorAll('[ng-version]'));
    expect(scan.usages.filter((u) => u.name === 'uppercase')).toHaveLength(3);
    expect(scan.entries).toHaveLength(1);
  });

  it('attributes a usage to the template it is written in, not a child host element', async () => {
    const fixture = await mount(Board);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    for (const usage of usages) expect(usage.component).toBe(fixture.componentInstance);
  });

  it('strips the bundler underscore prefix from pipe class names', async () => {
    await mount(_Shell);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'));
    expect(usages.map((u) => u.className)).toEqual(['ShoutPipe', 'ShoutPipe']);
  });

  it('recovers each binding slot when one pipe is used twice in a template', async () => {
    const fixture = await mount(_Shell);
    const usages = findPipeUsages(ng(), document.querySelectorAll('*'))
      .filter((u) => u.name === 'shout')
      .sort((x, y) => x.index - y.index);
    const [first, second] = usages.map((u) => staleCheckFor(u));
    expect(readBoundArg(usages[0], first!)).toBe('one');
    expect(readBoundArg(usages[1], second!)).toBe('two');

    fixture.componentInstance.b.set('three');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readBoundArg(usages[1], second!)).toBe('three');
  });
});
