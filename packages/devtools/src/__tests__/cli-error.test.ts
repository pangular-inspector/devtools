import { describe, expect, it } from 'vitest';
import { cliErrorText } from '../cli-error.ts';

describe('cli error text', () => {
  it('prints nothing for a devframe diagnostic, which printed itself with its fix', () => {
    const busy = Object.assign(new Error('Failed to listen on localhost:6701: EADDRINUSE'), {
      code: 'DF0052',
      fix: 'The port is likely already taken.',
    });
    expect(cliErrorText(busy)).toBeNull();
  });

  it('keeps a fix the error carries instead of the --help hint', () => {
    const error = Object.assign(new Error('No project here'), { fix: 'Run it in the app folder.' });
    expect(cliErrorText(error)).toBe('[pangular] No project here. Run it in the app folder.');
  });

  it('points at --help for any other error, and leaves [pangular] messages alone', () => {
    expect(cliErrorText(new Error('Unknown option `--x`'))).toBe(
      '[pangular] Unknown option `--x`. Run pangular --help for the commands and flags.',
    );
    expect(cliErrorText(new Error('[pangular] Already said.'))).toBe('[pangular] Already said.');
  });
});
