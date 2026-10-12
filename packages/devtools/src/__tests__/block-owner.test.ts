// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { blockOwnerOf, type BlockOwnerDebugNg } from '../block-owner.ts';
import { elementById } from '../element-id.ts';

class _SignalsExample {}
class _ExamplePanel {}
class _Card {}

function page() {
  document.body.innerHTML = `
    <app-root>
      <app-example-panel><div class="panel"><app-card></app-card></div></app-example-panel>
    </app-root>`;
  const root = document.querySelector('app-root')!;
  const panel = document.querySelector('app-example-panel')!;
  const card = document.querySelector('app-card')!;
  const anchor = document.createComment('container');
  panel.querySelector('.panel')!.appendChild(anchor);
  const instances = new Map<Element, object>([
    [root, new _SignalsExample()],
    [panel, new _ExamplePanel()],
    [card, new _Card()],
  ]);
  const hosts = new Map([...instances].map(([el, instance]) => [instance, el]));
  return { root, panel, card, anchor, instances, hosts };
}

describe('blockOwnerOf', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('names the component that declared a projected block', () => {
    const { root, anchor, instances, hosts } = page();
    const ng: BlockOwnerDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      getOwningComponent: (node) => (node === anchor ? instances.get(root) : null),
      getHostElement: (instance) => hosts.get(instance) ?? null,
    };
    const owner = blockOwnerOf(ng, anchor)!;
    expect(owner).toMatchObject({ name: 'SignalsExample', tag: 'app-root' });
    expect(elementById(owner.id)).toBe(root);
    expect(blockOwnerOf(ng, anchor)!.id).toBe(owner.id);
  });

  it('falls back to the nearest host above the node without getOwningComponent', () => {
    const { anchor, instances } = page();
    const ng: BlockOwnerDebugNg = { getComponent: (el) => instances.get(el) ?? null };
    expect(blockOwnerOf(ng, anchor)).toMatchObject({ name: 'ExamplePanel' });
  });

  it('falls back when the utils throw or give no host element', () => {
    const { anchor, instances } = page();
    const throwing: BlockOwnerDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      getOwningComponent: () => {
        throw new Error('not in a view');
      },
    };
    expect(blockOwnerOf(throwing, anchor)).toMatchObject({ name: 'ExamplePanel' });
    const hostless: BlockOwnerDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      getOwningComponent: () => ({}),
      getHostElement: () => null,
    };
    expect(blockOwnerOf(hostless, anchor)).toMatchObject({ name: 'ExamplePanel' });
  });

  it('starts the fallback above a root node that is a component host', () => {
    const { card, instances } = page();
    const ng: BlockOwnerDebugNg = { getComponent: (el) => instances.get(el) ?? null };
    expect(blockOwnerOf(ng, card)).toMatchObject({ name: 'ExamplePanel' });
    expect(blockOwnerOf(ng, null)).toBeUndefined();
  });
});
