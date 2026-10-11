import { TestBed } from '@angular/core/testing';
import { ThemeToggle } from './theme-toggle';

const KEY = 'pangular-demo-theme';

function create() {
  const fixture = TestBed.createComponent(ThemeToggle);
  fixture.detectChanges();
  return fixture;
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
    delete document.documentElement.dataset['theme'];
  });

  it('cycles system, light, dark and back', async () => {
    const fixture = create();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.textContent).toContain('System');
    expect(document.documentElement.dataset['theme']).toBeUndefined();

    button.click();
    fixture.detectChanges();
    expect(button.textContent).toContain('Light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem(KEY)).toBe('light');

    button.click();
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).toBe('dark');

    button.click();
    fixture.detectChanges();
    // Back to following the system, so the attribute is removed again.
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('restores a stored choice', () => {
    localStorage.setItem(KEY, 'dark');
    const fixture = create();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Dark');
  });

  it('still renders when storage throws', () => {
    const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!;
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    try {
      expect(() => create()).not.toThrow();
    } finally {
      Object.defineProperty(Storage.prototype, 'getItem', original);
    }
  });
});
