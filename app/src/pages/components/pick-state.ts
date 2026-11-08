import { Injectable, computed, inject, signal } from '@angular/core';
import { PICK_KEY_NAMES, type PickResult } from './component-model';
import { TreeState } from './tree-state';

/**
 * Picking a component on the page: the pick button's state, the keys that move a running pick,
 * and what happens when the page answers. Provided by the Components page.
 */
@Injectable()
export class PickState {
  private readonly tree = inject(TreeState);

  readonly picking = signal(false);
  private pickPageId: string | null = null;
  private pickSeq = 0;
  readonly pickLabel = computed(() =>
    this.picking()
      ? 'Cancel pick'
      : this.tree.native()
        ? 'Pick component on device'
        : 'Pick component on page',
  );

  /** Stops a running pick when the shown page is no longer the one it runs on. */
  followPage(shown: string | null) {
    if (this.picking() && shown !== this.pickPageId) this.dropPick();
  }

  async pick() {
    const client = this.tree.rpc();
    if (!client || this.picking()) return;
    const seq = ++this.pickSeq;
    this.pickPageId = this.tree.page()?.pageId ?? null;
    this.picking.set(true);
    this.tree.say(
      this.tree.native()
        ? 'Tap a component on the device, or use the arrow keys to move between components and Enter to pick one. Press Escape to cancel.'
        : 'Click a component in the app, or use the arrow keys to move between components and Enter to pick one. Press Escape to cancel.',
    );
    const result = (await client
      .scope('pangular')
      .rpc.call('request-component-pick', { pageId: this.pickPageId ?? undefined })
      .catch(() => ({ ok: false, error: 'Could not reach the devtools server.' }))) as PickResult;
    if (seq !== this.pickSeq) return;
    this.picking.set(false);
    if (!result?.ok || !result.id) {
      this.tree.say(result?.error ?? 'No component was picked.');
      return;
    }
    if (result.pageId && result.pageId !== this.tree.page()?.pageId) {
      this.tree.selectPage(result.pageId);
    }
    this.tree.say(`Picked ${result.name ?? 'a component'}.`);
    this.tree.destroyed.set(null);
    if (this.tree.index().map.has(result.id)) this.tree.reveal(result.id);
    else this.tree.selectedId.set(result.id);
  }

  /**
   * Moves a running pick with the keyboard: down and up go through the components in page
   * order, left to the one around, right to the first one inside, and Enter picks.
   */
  pickKey(event: KeyboardEvent) {
    const key = PICK_KEY_NAMES[event.key];
    if (!this.picking() || !key || event.altKey || event.ctrlKey || event.metaKey) return;
    // Enter would press the focused button, which cancels the pick.
    event.preventDefault();
    const client = this.tree.rpc();
    if (!client) return;
    const seq = this.pickSeq;
    void client
      .scope('pangular')
      .rpc.call('request-component-pick-move', { pageId: this.pickPageId ?? undefined, key })
      .then((answer) => {
        const result = answer as { moved?: boolean; name?: string; tag?: string; error?: string };
        if (seq !== this.pickSeq || !this.picking() || key === 'pick') return;
        this.tree.say(
          result?.moved
            ? `${result.name ?? 'Component'} <${result.tag ?? ''}>. Press Enter to pick it.`
            : (result?.error ?? 'The page did not move.'),
        );
      })
      .catch(() => {});
  }

  cancelPick() {
    const client = this.tree.rpc();
    if (!client || !this.picking()) return;
    void client
      .scope('pangular')
      .rpc.call('cancel-component-pick', { pageId: this.pickPageId ?? undefined })
      .catch(() => {});
  }

  private dropPick() {
    this.cancelPick();
    this.pickSeq++;
    this.picking.set(false);
    this.tree.say('Picking stopped because the page changed.');
  }
}
