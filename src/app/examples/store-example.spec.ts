import { TestBed } from '@angular/core/testing';
import { StoreExample } from './store-example';

describe('StoreExample', () => {
  it('toggles items in its own store and hides packed ones through its signalState', async () => {
    const fixture = TestBed.createComponent(StoreExample);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const boxes = () => [...el.querySelectorAll<HTMLInputElement>('li input[type="checkbox"]')];
    expect(boxes().map((box) => box.checked)).toEqual([true, false, false]);

    boxes()[1].click();
    await fixture.whenStable();
    expect(el.textContent).toContain('2 of 3 packed');

    el.querySelector<HTMLInputElement>('.option input')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('li')).toHaveLength(1);

    el.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Extra item 1');
    expect(el.textContent).toContain('Items added: 1');
  });

  it('creates a new store for each instance', async () => {
    const first = TestBed.createComponent(StoreExample);
    await first.whenStable();
    (first.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    await first.whenStable();
    const second = TestBed.createComponent(StoreExample);
    await second.whenStable();
    expect((second.nativeElement as HTMLElement).querySelectorAll('li')).toHaveLength(3);
  });
});
