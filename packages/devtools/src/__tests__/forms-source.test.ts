import { describe, expect, it } from 'vitest';
import { formSourceIn, sourceText } from '../rpc/forms-source.ts';

const file = `import { form, required, min } from '@angular/forms/signals';

// class Signup is mentioned in a comment
export class Signup {
  model = signal({ name: '', age: 0 });
  signup = form(this.model, (p) => {
    required(p.name, { message: 'Name is required' });
    min(p.age, 13);
  });
}

export class Account {
  account = new FormGroup({
    username: new FormControl('', Validators.required),
  });
}
`;

describe('form source scan', () => {
  it('finds the form property and the rules of a Signal Forms field', () => {
    const found = formSourceIn(file, 'src/signup.ts', 'Signup', 'signup', 'name');
    expect(found?.form).toMatchObject({ file: 'src/signup.ts', line: 6 });
    expect(found?.rules.map((r) => r.line)).toEqual([7]);
    expect(sourceText(found)).toContain('Defined at src/signup.ts:6: signup = form(this.model');
  });

  it('finds reactive control declarations and ignores array indexes', () => {
    const found = formSourceIn(file, 'a.ts', 'Account', 'account', 'username');
    expect(found?.form?.line).toBe(13);
    expect(found?.rules.map((r) => r.text)).toEqual([
      "username: new FormControl('', Validators.required),",
    ]);
    expect(formSourceIn(file, 'a.ts', 'Account', 'account', '0')?.rules).toEqual([]);
    expect(formSourceIn(file, 'a.ts', 'Missing', 'x', '')).toBeNull();
  });

  it('follows schema constants declared outside the class, in the file or elsewhere', () => {
    const page = `import { ADDRESS } from './address';
const PROFILE = schema<Profile>((p) => {
  required(p.email);
  apply(p.address, ADDRESS);
});

export class ProfilePage {
  profile = form(this.model, PROFILE);
}
`;
    const other = `export const ADDRESS = schema<Address>((a) => {
  required(a.city);
});
`;
    const lookup = (name: string) =>
      name === 'ADDRESS' ? { content: other, file: 'src/address.ts' } : null;
    const email = formSourceIn(page, 'src/profile.ts', 'ProfilePage', 'profile', 'email', lookup);
    expect(email?.schemas?.map((s) => [s.name, s.file, s.line])).toEqual([
      ['PROFILE', 'src/profile.ts', 2],
      ['ADDRESS', 'src/address.ts', 1],
    ]);
    expect(email?.rules.map((r) => [r.file, r.line])).toEqual([['src/profile.ts', 3]]);
    const city = formSourceIn(
      page,
      'src/profile.ts',
      'ProfilePage',
      'profile',
      'address.city',
      lookup,
    );
    expect(city?.rules.map((r) => [r.file, r.line])).toEqual([['src/address.ts', 2]]);
    expect(sourceText(city)).toContain('Schema ADDRESS at src/address.ts:1');
  });
});
