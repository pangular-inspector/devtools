import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_POPUP_HOTKEY,
  PAGE_AGENT_ENTRIES,
  hotkeyLabel,
  matchesHotkey,
  normalizeHotkey,
  pangularConfigProblems,
  panelCommands,
  panelLinkHash,
  parsePanelLink,
  pickPangularConfig,
  resolvePangularConfig,
  summarizePangularConfig,
} from '../config.ts';
import pangular, { createPangular } from '../devframe.ts';
import { ALL_TOOLS_DOCK_ID } from '../hub-docks.ts';
import { registerHubCommands } from '../hub-commands.ts';
import { openInPanel } from '../rpc/open-in-panel.ts';

const key = (code: string, mods: Partial<Record<'ctrl' | 'meta' | 'alt' | 'shift', boolean>>) => ({
  key: code.replace(/^(Key|Digit)/, '').toLowerCase(),
  code,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
});

describe('popup.hotkey', () => {
  it('defaults to Alt+Shift+P', () => {
    expect(resolvePangularConfig().popup.hotkey).toBe(DEFAULT_POPUP_HOTKEY);
    expect(DEFAULT_POPUP_HOTKEY).toBe('Alt+Shift+P');
  });

  it('takes a shortcut in any case and spelling, and false to turn it off', () => {
    expect(resolvePangularConfig({ popup: { hotkey: 'shift+cmd+i' } }).popup.hotkey).toBe(
      'Meta+Shift+I',
    );
    expect(resolvePangularConfig({ popup: { hotkey: 'Mod+Shift+K' } }).popup.hotkey).toBe(
      'Mod+Shift+K',
    );
    expect(resolvePangularConfig({ popup: { hotkey: false } }).popup.hotkey).toBe(false);
  });

  it('keeps the default for a value that is not a shortcut, and says so', () => {
    for (const hotkey of ['P', 'Shift+P', 'Alt+Shift', 'Alt+P+Q', 'Mod+Ctrl+P', 'Alt+Enter', 7]) {
      expect(resolvePangularConfig({ popup: { hotkey } }).popup.hotkey).toBe(DEFAULT_POPUP_HOTKEY);
      expect(pangularConfigProblems({ popup: { hotkey } }).join('\n')).toMatch(/popup\.hotkey/);
    }
    expect(pangularConfigProblems({ popup: { hotkey: 'Alt+Shift+P' } })).toEqual([]);
    expect(pangularConfigProblems({ popup: { hotkey: false } })).toEqual([]);
    expect(pangularConfigProblems({ popup: { shortcut: 'x' } })).toEqual([
      'Unknown option `popup.shortcut` was ignored.',
    ]);
  });

  it('is part of the devtools config, so the hub and the Vite plugin publish it', () => {
    const { config, rest } = pickPangularConfig({ popup: { hotkey: false }, base: '/x/' });
    expect(config.popup).toEqual({ hotkey: false });
    expect(rest).toEqual({ base: '/x/' });
  });

  it('shows in the config summary only when changed', () => {
    expect(summarizePangularConfig(resolvePangularConfig())).toEqual([]);
    expect(summarizePangularConfig(resolvePangularConfig({ popup: { hotkey: false } }))).toEqual([
      { label: 'Popup shortcut', value: 'Off' },
    ]);
  });

  it('normalizes shortcuts and matches key presses by position', () => {
    expect(normalizeHotkey('alt + shift + p')).toBe('Alt+Shift+P');
    expect(normalizeHotkey('ctrl+F2')).toBe('Ctrl+F2');
    expect(matchesHotkey(key('KeyP', { alt: true, shift: true }), 'Alt+Shift+P', false)).toBe(true);
    // Option+Shift+P types another character on macOS; the key position still matches.
    expect(
      matchesHotkey({ ...key('KeyP', { alt: true, shift: true }), key: '∏' }, 'Alt+Shift+P', true),
    ).toBe(true);
    expect(matchesHotkey(key('KeyP', { alt: true }), 'Alt+Shift+P', false)).toBe(false);
    expect(matchesHotkey(key('KeyK', { meta: true }), 'Mod+K', true)).toBe(true);
    expect(matchesHotkey(key('KeyK', { meta: true }), 'Mod+K', false)).toBe(false);
    expect(matchesHotkey(key('KeyK', { ctrl: true }), 'Mod+K', false)).toBe(true);
    expect(hotkeyLabel('Mod+Shift+K', false)).toBe('Ctrl+Shift+K');
    expect(hotkeyLabel('Alt+Shift+P', true)).toBe('⌥⇧P');
  });
});

describe('panel deep links', () => {
  it('writes and reads a tab, an item and a page', () => {
    const hash = panelLinkHash({ tab: 'components', id: '12', page: 'k3 x' });
    expect(hash).toBe('#tab=components&id=12&page=k3+x');
    expect(parsePanelLink(hash)).toEqual({ tab: 'components', id: '12', page: 'k3 x' });
    expect(parsePanelLink('#tab=signals')).toEqual({ tab: 'signals' });
    expect(parsePanelLink('#id=1')).toBeNull();
    expect(parsePanelLink(`#tab=forms&id=${'x'.repeat(300)}`)).toEqual({ tab: 'forms' });
  });
});

describe('panel commands', () => {
  it('lists a command per enabled tab and the actions of enabled inspectors', () => {
    const ids = panelCommands(resolvePangularConfig()).map((command) => command.id);
    expect(ids).toContain('tab:components');
    expect(ids).toContain('tab:network');
    expect(ids).toEqual(
      expect.arrayContaining([
        'settings',
        'pick-component',
        'cd-record-start',
        'cd-record-stop',
        'cd-clear',
        'theme:system',
        'theme:light',
        'theme:dark',
        'dock:float',
        'dock:bottom',
        'dock:right',
        'dock:reset-size',
        'popout',
        'popout:return',
      ]),
    );
    expect(ids).toContain('tab:timeline');
    const off = panelCommands(resolvePangularConfig({ inspectors: { components: false } }));
    expect(off.map((command) => command.id)).not.toContain('tab:components');
    expect(off.map((command) => command.id)).not.toContain('pick-component');
  });

  it('registers them in the hub palette, and runs them through the panels', () => {
    const register = vi.fn();
    const activate = vi.fn();
    const run = vi.fn();
    const ids = registerHubCommands(
      { commands: { register }, docks: { activate } },
      resolvePangularConfig(),
      run,
    );
    expect(ids).toContain('pangular:pick-component');
    expect(ids).not.toContain('pangular:dock:float');
    expect(ids).not.toContain('pangular:popout');
    expect(ids).not.toContain('pangular:popout:return');
    const inputs = register.mock.calls.map(([input]) => input);
    const tabs = inputs.find((input) => input.id === 'pangular:tabs');
    expect(tabs.children.map((child: { id: string }) => child.id)).toContain(
      'pangular:tab:signals',
    );
    tabs.children.find((child: { id: string }) => child.id === 'pangular:tab:signals').handler();
    expect(activate).toHaveBeenCalledWith(ALL_TOOLS_DOCK_ID);
    expect(run).toHaveBeenLastCalledWith({ command: 'tab:signals' });

    activate.mockClear();
    inputs.find((input) => input.id === 'pangular:theme:dark').handler();
    expect(activate).not.toHaveBeenCalled();
    expect(run).toHaveBeenLastCalledWith({ command: 'theme:dark' });
  });

  it('registers nothing outside a hub', () => {
    expect(registerHubCommands({}, resolvePangularConfig(), () => {})).toBeUndefined();
  });

  it('broadcasts a command run from the hub to the panels', async () => {
    const commands = new Map<string, { id: string; handler?: () => void }>();
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    Object.assign(ctx, {
      commands: {
        register: (input: { id: string; handler?: () => void }) => commands.set(input.id, input),
      },
    });
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    await createPangular().setup(ctx as never);
    commands.get('pangular:pick-component')!.handler!();
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'pangular:panel-command',
        args: [{ command: 'pick-component' }],
      }),
    );
  });
});

describe('open-in-panel', () => {
  const config = resolvePangularConfig();

  it('builds a full hub link from the page origin', () => {
    const result = openInPanel(
      { tab: 'components', id: '12', page: 'p1' },
      {
        config,
        panelBase: '/__devframes/pangular/',
        pageUrl: 'http://localhost:4200/trips?x=1',
        pages: ['p1'],
      },
    );
    expect(result.link).toEqual({ tab: 'components', id: '12', page: 'p1' });
    expect(result.markdown).toContain(
      '(http://localhost:4200/__devframes/pangular/#tab=components&id=12&page=p1)',
    );
    expect(result.markdown).toContain('It selects a component instance');
  });

  it('gives the hash when the panel address is unknown', () => {
    const result = openInPanel({ tab: 'signals', id: '3' }, { config, pages: [] });
    expect(result.link).toEqual({ tab: 'signals' });
    expect(result.markdown).toContain('Panel hash: `#tab=signals`');
    expect(result.markdown).toContain('has no item selection');
  });

  it('refuses an unknown tab or one whose inspector is off', () => {
    expect(openInPanel({ tab: 'nope' }, { config, pages: [] }).link).toBeUndefined();
    const off = resolvePangularConfig({ inspectors: { forms: false } });
    const result = openInPanel({ tab: 'forms', id: 'f1' }, { config: off, pages: [] });
    expect(result.link).toBeUndefined();
    expect(result.markdown).toMatch(/no panel tab `forms`/);
  });

  it('notes a page that does not report', () => {
    const result = openInPanel({ tab: 'forms', id: 'f1', page: 'gone' }, { config, pages: [] });
    expect(result.markdown).toContain('No page with id `gone` reports now');
  });

  it('is a read tool that asks the open panels to navigate', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    await pangular.setup(ctx as never);
    const tool = ctx.agent.list().tools.find((t) => t.id === 'pangular:open-in-panel');
    expect(tool?.safety).toBe('read');
    expect(PAGE_AGENT_ENTRIES).toContain('open-in-panel');
    const answer = (await ctx.agent.invoke('pangular:open-in-panel', {
      tab: 'injectors',
      id: 'c4',
    })) as { markdown: string };
    expect(answer.markdown).toContain('`#tab=injectors&id=c4`');
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'pangular:open-in-panel',
        args: [{ tab: 'injectors', id: 'c4' }],
      }),
    );
  });

  it('stays registered in read-only mode', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({ agent: { readOnly: true } }).setup(ctx as never);
    expect(ctx.agent.list().tools.map((t) => t.id)).toContain('pangular:open-in-panel');
  });
});
