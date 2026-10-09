// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { componentSource, installSourceHelpers } from '../component-source.ts';
import { componentDetail, type ComponentDebugNg } from '../component-tree.ts';
import { elementId } from '../element-id.ts';

function withDebugInfo<T extends new () => object>(type: T, debugInfo: unknown): T {
  Object.defineProperty(type, 'ɵcmp', { value: { debugInfo }, configurable: true });
  return type;
}

const Card = withDebugInfo(class Card {}, {
  className: 'Card',
  filePath: 'src/app/card.ts',
  lineNumber: 12,
});
const Bare = withDebugInfo(class Bare {}, { className: 'Bare' });

function fakeNg(instances: Map<Element, object>): ComponentDebugNg {
  return { getComponent: (el) => instances.get(el) ?? null };
}

describe('componentSource', () => {
  it('reads the file and 1-based line from the dev-mode debug info', () => {
    expect(componentSource(new Card())).toEqual({ file: 'src/app/card.ts', line: 12 });
  });

  it('is undefined without a file path, a valid line or a component def', () => {
    expect(componentSource(new Bare())).toBeUndefined();
    const Zero = withDebugInfo(class {}, { className: 'Zero', filePath: 'a.ts', lineNumber: 0 });
    expect(componentSource(new Zero())).toBeUndefined();
    const Text = withDebugInfo(class {}, { className: 'T', filePath: 'a.ts', lineNumber: '3' });
    expect(componentSource(new Text())).toBeUndefined();
    expect(componentSource(new (class Plain {})())).toBeUndefined();
    expect(componentSource(null)).toBeUndefined();
  });

  it('survives a throwing def getter', () => {
    class Hostile {}
    Object.defineProperty(Hostile, 'ɵcmp', {
      get() {
        throw new Error('no');
      },
    });
    expect(componentSource(new Hostile())).toBeUndefined();
  });
});

describe('componentDetail source', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('adds the source when Angular has it and leaves it out otherwise', () => {
    document.body.innerHTML = '<app-card></app-card><app-bare></app-bare>';
    const card = document.querySelector('app-card')!;
    const bare = document.querySelector('app-bare')!;
    const ng = fakeNg(
      new Map<Element, object>([
        [card, new Card()],
        [bare, new Bare()],
      ]),
    );
    expect(componentDetail(ng, card)?.source).toEqual({ file: 'src/app/card.ts', line: 12 });
    expect(componentDetail(ng, bare)).not.toHaveProperty('source');
  });
});

describe('installSourceHelpers', () => {
  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    stop = undefined;
    document.body.innerHTML = '';
  });

  it('returns the host and class of an instance id on its own page only', () => {
    document.body.innerHTML = '<app-card></app-card>';
    const card = document.querySelector('app-card')!;
    const html = document.body.innerHTML;
    stop = installSourceHelpers('page-1', () => fakeNg(new Map([[card, new Card()]])));
    const id = elementId(card);

    expect(window.__pangularHostOf?.('page-1', id)).toBe(card);
    expect(window.__pangularClassOf?.('page-1', id)).toBe(Card);
    expect(window.__pangularHostOf?.('page-2', id)).toBeNull();
    expect(window.__pangularClassOf?.('page-2', id)).toBeNull();
    expect(window.__pangularHostOf?.('page-1', 'missing')).toBeNull();
    expect(window.__pangularHostOf?.('page-1', 42)).toBeNull();
    expect(document.body.innerHTML).toBe(html);
  });

  it('answers null for a removed host and for a host without a component', () => {
    document.body.innerHTML = '<app-card></app-card><div></div>';
    const card = document.querySelector('app-card')!;
    const div = document.querySelector('div')!;
    stop = installSourceHelpers('page-1', () => fakeNg(new Map([[card, new Card()]])));
    const cardId = elementId(card);
    expect(window.__pangularClassOf?.('page-1', elementId(div))).toBeNull();
    card.remove();
    expect(window.__pangularHostOf?.('page-1', cardId)).toBeNull();
  });

  it('removes only its own helpers on cleanup', () => {
    const first = installSourceHelpers('page-1', () => undefined);
    const helper = window.__pangularHostOf;
    first();
    expect(window.__pangularHostOf).toBeUndefined();
    expect(window.__pangularClassOf).toBeUndefined();

    const older = installSourceHelpers('page-1', () => undefined);
    stop = installSourceHelpers('page-1', () => undefined);
    const current = window.__pangularHostOf;
    expect(current).not.toBe(helper);
    older();
    expect(window.__pangularHostOf).toBe(current);
  });
});
