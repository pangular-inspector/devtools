// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parentOf, walkElements } from '../dom-walk.ts';

describe('walkElements', () => {
  it('visits elements in document order, into open shadow roots', () => {
    document.body.innerHTML =
      '<a-root><b-shell><i-light></i-light></b-shell><e-tail></e-tail></a-root>';
    const shell = document.querySelector('b-shell')!;
    shell.attachShadow({ mode: 'open' }).innerHTML = '<c-child><d-leaf></d-leaf></c-child>';
    const names = [...walkElements(document.body)].map((el) =>
      (el as Element).tagName.toLowerCase(),
    );
    expect(names).toEqual(['body', 'a-root', 'b-shell', 'i-light', 'c-child', 'd-leaf', 'e-tail']);
    const leaf = shell.shadowRoot!.querySelector('d-leaf')!;
    expect(parentOf(parentOf(leaf)!)).toBe(shell);
  });

  it('includes comment nodes only when asked', () => {
    document.body.innerHTML = '<div><!--container--><span></span></div>';
    expect([...walkElements(document.body)].some((n) => n.nodeType === 8)).toBe(false);
    const all = [...walkElements(document.body, true)];
    expect(all.map((n) => n.nodeName)).toEqual(['BODY', 'DIV', '#comment', 'SPAN']);
  });
});
