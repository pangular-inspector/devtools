import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  OPEN_SERVICE_PACKAGE,
  createOpenInEditor,
  defaultLauncher,
  resolveEditorFile,
} from '../open-in-editor.ts';
import { fixtureDir } from './fixture-dir.ts';

function project() {
  const base = realpathSync(fixtureDir('pangular-open-'));
  const root = join(base, 'app');
  const outside = join(base, 'secret');
  mkdirSync(join(root, 'src/app'), { recursive: true });
  mkdirSync(outside);
  writeFileSync(join(root, 'src/app/app.ts'), 'export class App {}\n');
  writeFileSync(join(outside, 'keys.txt'), 'secret\n');
  return { base, root, outside, app: join(root, 'src/app/app.ts') };
}

describe('resolveEditorFile', () => {
  it('resolves a project-relative, an absolute and a root-relative path', async () => {
    const { root, app } = project();
    expect(await resolveEditorFile('src/app/app.ts', [root])).toEqual({ ok: true, file: app });
    expect(await resolveEditorFile(app, [root])).toEqual({ ok: true, file: app });
    expect(await resolveEditorFile('/src/app/app.ts', [root])).toEqual({ ok: true, file: app });
  });

  it('refuses a path outside the root, absolute or through ..', async () => {
    const { root, outside } = project();
    for (const file of [
      join(outside, 'keys.txt'),
      '../secret/keys.txt',
      'src/../../secret/keys.txt',
    ]) {
      expect(await resolveEditorFile(file, [root]), file).toEqual({
        ok: false,
        error: `${file} is outside the project root.`,
      });
    }
  });

  it('refuses a symlink inside the root that points outside it', async () => {
    const { root, outside } = project();
    symlinkSync(join(outside, 'keys.txt'), join(root, 'src/keys.ts'));
    symlinkSync(outside, join(root, 'linked'));
    expect(await resolveEditorFile('src/keys.ts', [root])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/outside the project root/),
    });
    expect(await resolveEditorFile('linked/keys.txt', [root])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/outside the project root/),
    });
  });

  it('follows a symlink that stays inside the root', async () => {
    const { root, app } = project();
    symlinkSync(app, join(root, 'alias.ts'));
    expect(await resolveEditorFile('alias.ts', [root])).toEqual({ ok: true, file: app });
  });

  it('refuses a missing file, a directory and an empty or odd path', async () => {
    const { root } = project();
    expect(await resolveEditorFile('src/app/gone.ts', [root])).toEqual({
      ok: false,
      error: 'src/app/gone.ts was not found.',
    });
    expect(await resolveEditorFile('src/app', [root])).toEqual({
      ok: false,
      error: 'src/app is not a file.',
    });
    for (const file of ['', '   ', 'src/\0app.ts', 42, null, 'a'.repeat(5000)]) {
      expect(await resolveEditorFile(file, [root])).toEqual({
        ok: false,
        error: 'No file to open.',
      });
    }
  });

  it('accepts a file under any of several roots', async () => {
    const { root, outside } = project();
    expect(await resolveEditorFile('keys.txt', [root, outside])).toEqual({
      ok: true,
      file: join(outside, 'keys.txt'),
    });
  });
});

describe('createOpenInEditor', () => {
  it('launches the editor at the line and column of a file inside the root', async () => {
    const { root, app } = project();
    const launch = vi.fn();
    const open = createOpenInEditor({ roots: () => [root], launch });
    expect(await open({ file: 'src/app/app.ts', line: 3, column: 7 })).toEqual({
      ok: true,
      file: app,
    });
    expect(launch).toHaveBeenCalledWith(app, 3, 7);
  });

  it('drops a line or column that is not a positive integer', async () => {
    const { root, app } = project();
    const launch = vi.fn();
    const open = createOpenInEditor({ roots: () => [root], launch });
    await open({ file: 'src/app/app.ts', line: '3; rm -rf /', column: -1 });
    await open({ file: 'src/app/app.ts', line: 1.5 });
    expect(launch.mock.calls).toEqual([
      [app, undefined, undefined],
      [app, undefined, undefined],
    ]);
  });

  it('never launches for a refused path', async () => {
    const { root, outside } = project();
    const launch = vi.fn();
    const open = createOpenInEditor({ roots: () => [root], launch });
    expect(await open({ file: join(outside, 'keys.txt') })).toMatchObject({ ok: false });
    expect(await open(null)).toMatchObject({ ok: false });
    expect(launch).not.toHaveBeenCalled();
  });

  it('reports a launcher that throws', async () => {
    const { root } = project();
    const open = createOpenInEditor({
      roots: () => [root],
      launch: () => {
        throw new Error('no editor');
      },
    });
    expect(await open({ file: 'src/app/app.ts' })).toEqual({ ok: false, error: 'no editor' });
  });
});

describe('defaultLauncher', () => {
  it('goes through the open wire service when the host installed it', async () => {
    const openInEditor = vi.fn(async () => {});
    const get = vi.fn((id: string) => (id === OPEN_SERVICE_PACKAGE ? { openInEditor } : undefined));
    await defaultLauncher({ get })('/w/src/app.ts', 4, 2);
    expect(openInEditor).toHaveBeenCalledWith({ path: '/w/src/app.ts', line: 4, column: 2 });
  });
});
