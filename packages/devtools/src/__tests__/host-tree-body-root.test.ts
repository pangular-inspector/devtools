// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { angularRoots } from '../host-tree.ts';

describe('angularRoots', () => {
  it('returns only the body when the app is bootstrapped onto it', () => {
    document.body.setAttribute('ng-version', '20.0.0');
    document.body.innerHTML = '<app-a></app-a><app-b></app-b>';
    expect(angularRoots(document)).toEqual([document.body]);
    document.body.removeAttribute('ng-version');
  });

  it('still lists elements outside the Angular roots', () => {
    document.body.innerHTML = '<app-root ng-version="20.0.0"></app-root><footer></footer>';
    expect(angularRoots(document).map((el) => el.tagName.toLowerCase())).toEqual([
      'app-root',
      'footer',
    ]);
  });
});
