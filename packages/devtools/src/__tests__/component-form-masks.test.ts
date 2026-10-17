// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetMaskedFormValues, maskedFormValues } from '../component-form-masks.ts';
import { collectComponentTree, componentDetail, type ComponentDebugNg } from '../component-tree.ts';
import { createComponentValues, readComponentValue } from '../component-values.ts';
import { elementById, elementId } from '../element-id.ts';

function directive(selector: string, fields: Record<string, unknown>) {
  class Dir {}
  (Dir as unknown as Record<string, unknown>)['ɵdir'] = { selectors: [['', selector, '']] };
  return Object.assign(new Dir(), fields);
}

const control = (value: unknown) => ({ value });

class SecretsForm {
  group = {
    value: { username: 'ada', nickname: 'NICK-4711', oneTime: '845210', word: 'harmless-pw' },
  };
  model = { nick: 'TD-NICK-99', plain: 'visible' };
  note = 'repeats NICK-4711 in text';
}

function setup(instance = new SecretsForm()) {
  document.body.innerHTML = `
    <app-secrets>
      <input id="user" formControlName="username" />
      <input id="nick" formControlName="nickname" data-pangular="mask" />
      <input id="otp" formControlName="oneTime" autocomplete="one-time-code" />
      <input id="word" type="password" formControlName="word" />
      <input id="td" name="nick" data-pangular="mask" />
      <input id="sf" />
      <input id="open" type="password" formControlName="open" data-pangular="unmask" />
    </app-secrets>`;
  const host = document.querySelector('app-secrets')!;
  const at = (id: string) => document.getElementById(id)!;
  const directives = new Map<Element, object[]>([
    [at('user'), [directive('formControlName', { name: 'username', control: control('ada') })]],
    [
      at('nick'),
      [directive('formControlName', { name: 'nickname', control: control('NICK-4711') })],
    ],
    [at('otp'), [directive('formControlName', { name: 'oneTime', control: control('845210') })]],
    [at('word'), [directive('formControlName', { name: 'word', control: control('harmless-pw') })]],
    [
      at('td'),
      [
        directive('ngModel', {
          name: 'nick',
          model: 'TD-NICK-99',
          control: control('TD-NICK-99'),
        }),
      ],
    ],
    [
      at('sf'),
      [
        directive('formField', {
          state: () => ({ name: () => 'login.code', value: () => 'SF-CODE-123' }),
        }),
      ],
    ],
    [at('open'), [directive('formControlName', { name: 'open', control: control('OPEN-777') })]],
  ]);
  const ng: ComponentDebugNg = {
    getComponent: (el) => (el === host ? instance : null),
    getDirectives: (el) => directives.get(el) ?? [],
    getDirectiveMetadata: () => ({ inputs: {}, outputs: {} }),
  };
  return { ng, host, instance, at, directives };
}

describe('component values and form masks', () => {
  afterEach(() => forgetMaskedFormValues());

  it('collects the values of fields masked by their element', () => {
    const { ng, host } = setup();
    const masked = maskedFormValues(ng, host);
    expect([...masked].sort()).toEqual(['845210', 'NICK-4711', 'TD-NICK-99', 'harmless-pw'].sort());
  });

  it('masks a code field by its name too', () => {
    const { ng, host, at, directives } = setup();
    directives.set(at('sf'), [
      directive('formField', {
        state: () => ({ name: () => 'login.password', value: () => 'SF-PW-123' }),
      }),
    ]);
    expect(maskedFormValues(ng, host).has('SF-PW-123')).toBe(true);
  });

  it('hides masked field values in the component detail', () => {
    const { ng, host } = setup();
    const detail = componentDetail(ng, host)!;
    const text = JSON.stringify(detail.properties);
    for (const secret of ['NICK-4711', '845210', 'harmless-pw', 'TD-NICK-99']) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('visible');
    expect(text).toContain('repeats [redacted] in text');
  });

  it('hides masked field values in a value level read by path', () => {
    const { ng, host } = setup();
    const result = readComponentValue(ng, host, { id: elementId(host), path: ['model'] });
    expect(result).toMatchObject({ ok: true, value: { nick: '[redacted]', plain: 'visible' } });
    const group = readComponentValue(ng, host, {
      id: elementId(host),
      path: ['group', 'value'],
    });
    expect(group).toMatchObject({
      ok: true,
      value: { username: 'ada', nickname: '[redacted]', oneTime: '[redacted]' },
    });
  });

  it('keeps hiding a masked value after the field changes', () => {
    const instance = new SecretsForm();
    const { ng, host, at, directives } = setup(instance);
    maskedFormValues(ng, host);
    directives.set(at('nick'), [
      directive('formControlName', { name: 'nickname', control: control('NICK-NEW') }),
    ]);
    instance.group.value.nickname = 'NICK-NEW';
    instance.note = 'old was NICK-4711';
    const text = JSON.stringify(componentDetail(ng, host)!.properties);
    expect(text).not.toContain('NICK-4711');
    expect(text).not.toContain('NICK-NEW');
  });

  it('leaves values alone on a host without a DOM', () => {
    const { ng } = setup();
    expect(maskedFormValues(ng as never, {} as never).size).toBe(0);
  });

  it('scans the component once per collect, however many levels are open', async () => {
    const { ng, host, instance } = setup();
    const id = elementId(host);
    const values = createComponentValues({ getNg: () => ng, find: (key) => elementById(key) });
    const paths = [['group'], ['group', 'value'], ['model'], ['note'], ['group', 'value', 'word']];
    for (const path of paths) values.handle({ id, path, watch: true });
    // The page changed since the levels were opened, so this collect scans again.
    host.appendChild(document.createElement('span'));
    const scans = vi.spyOn(host, 'querySelectorAll');
    const getDirectives = vi.spyOn(ng, 'getDirectives');

    const tree = collectComponentTree(ng, { selectedId: id, withDetail: values.attach });
    expect(Object.keys(tree.detail!.expanded!)).toHaveLength(paths.length);
    expect(JSON.stringify(tree.detail)).not.toContain('NICK-4711');
    expect(scans.mock.calls.filter(([selector]) => selector === '*')).toHaveLength(1);
    const scanned = getDirectives.mock.calls.length;

    // Nothing in the DOM changed: the next collect reads the known fields only.
    instance.model.nick = 'TD-NICK-99';
    collectComponentTree(ng, { selectedId: id, withDetail: values.attach });
    expect(scans.mock.calls.filter(([selector]) => selector === '*')).toHaveLength(1);
    expect(getDirectives.mock.calls.length - scanned).toBeLessThan(scanned);

    // A field added to the component is found after the DOM change.
    const added = document.createElement('input');
    added.setAttribute('type', 'password');
    host.appendChild(added);
    const directives = new Map<Element, object[]>([
      [added, [directive('ngModel', { name: 'pin', model: 'PIN-90210' })]],
    ]);
    const before = ng.getDirectives!;
    ng.getDirectives = (el) => directives.get(el) ?? before(el);
    instance.note = 'pin is PIN-90210';
    await Promise.resolve();
    const next = collectComponentTree(ng, { selectedId: id, withDetail: values.attach });
    expect(scans.mock.calls.filter(([selector]) => selector === '*')).toHaveLength(2);
    expect(JSON.stringify(next.detail)).not.toContain('PIN-90210');
  });

  it('does not keep the prefixes of a masked value being typed', () => {
    const instance = new SecretsForm();
    const { ng, host, at, directives } = setup(instance);
    for (let i = 3; i <= 'Secret123'.length; i++) {
      directives.set(at('word'), [
        directive('formControlName', { name: 'word', control: control('Secret123'.slice(0, i)) }),
      ]);
      maskedFormValues(ng, host);
    }
    const masked = maskedFormValues(ng, host);
    expect(masked.has('Secret123')).toBe(true);
    for (const prefix of ['Sec', 'Secr', 'Secret12']) expect(masked.has(prefix)).toBe(false);
    instance.note = 'Section and Security';
    expect(JSON.stringify(componentDetail(ng, host)!.properties)).toContain('Section and Security');
  });
});
