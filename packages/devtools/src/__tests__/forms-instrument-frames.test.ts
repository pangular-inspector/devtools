import { describe, expect, it } from 'vitest';
import { callerFrom } from '../forms-instrument.ts';

const framework =
  '    at FormControl.setValue (http://localhost/node_modules/@angular/forms/forms.mjs:1:1)';

describe('callerFrom framework filter', () => {
  it('keeps user frames whose file name only contains a framework word', () => {
    for (const file of ['timezone-form.component.ts', 'rxjs-demo.ts', 'signup-forms-actions.ts']) {
      const stack = `Error\n${framework}\n    at TzComponent.save (http://localhost/src/app/${file}:10:5)`;
      expect(callerFrom(stack, new Set(['TzComponent']))).toContain('TzComponent.save');
    }
  });

  it('still drops real framework frames', () => {
    const stack = [
      'Error',
      framework,
      '    at Subscriber.next (http://localhost/node_modules/rxjs/dist/esm/Subscriber.js:1:1)',
      '    at ZoneDelegate.invoke (http://localhost/node_modules/zone.js/fesm2015/zone.js:1:1)',
      '    at Object.onInvoke (http://localhost/polyfills/zone-evergreen.js:1:1)',
    ].join('\n');
    expect(callerFrom(stack)).toBeUndefined();
  });
});
