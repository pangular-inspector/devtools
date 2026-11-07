// Tap-to-pick and the box highlight on a device, with fakes in place of the
// device: a fake view tree, a fake UIKit and Android SDK, and a fake
// `@ng-native/fabric` engine. None of this ran on a simulator or a phone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementId } from '../element-id.ts';
import type { HostTree } from '../host-tree.ts';
import {
  clearNativeHighlight,
  registerNativePick,
  showNativeHighlight,
  startNativePick,
  viewAt,
  type NativeFrame,
  type NativeSurface,
} from '../native-pick.ts';
import { angularNativeSurface, isOverlayNode } from '../overlay-angular-native-surface.ts';
import { angularNativeTree, type AngularNativeNode } from '../overlay-angular-native-views.ts';
import {
  androidPlatform,
  iosPlatform,
  nativeScriptSurface,
} from '../overlay-nativescript-surface.ts';
import { nativeScriptTree, type NativeView } from '../overlay-nativescript-views.ts';

// ---------------------------------------------------------------------------
// A small view tree: root(app) > list > [card(Card) > label, card2(Card)]

interface Box {
  name: string;
  children: Box[];
  parent: Box | null;
  frame: NativeFrame | null;
}

function box(name: string, frame: NativeFrame | null, children: Box[] = []): Box {
  const node: Box = { name, children, parent: null, frame };
  for (const child of children) child.parent = node;
  return node;
}

function scene() {
  const label = box('label', { x: 10, y: 10, width: 50, height: 20 });
  const card = box('card', { x: 0, y: 0, width: 100, height: 50 }, [label]);
  const card2 = box('card2', { x: 0, y: 60, width: 100, height: 50 });
  // The list is a proxy container: no frame of its own.
  const list = box('list', null, [card, card2]);
  const root = box('root', { x: 0, y: 0, width: 320, height: 640 }, [list]);
  const tree: HostTree<Box> = {
    roots: () => [root],
    children: (node) => node.children,
    parent: (node) => node.parent,
    tag: (node) => node.name,
    connected: () => true,
    isHost: (value): value is Box => typeof value === 'object' && value !== null,
  };
  class App {}
  class Card {}
  const components = new Map<Box, object>([
    [root, new App()],
    [card, new Card()],
    [card2, new Card()],
  ]);
  const ng = { getComponent: (host: Box) => components.get(host) ?? null };
  return { root, list, card, card2, label, tree, ng };
}

function fakeSurface() {
  let tap: ((view: Box | null) => void) | null = null;
  const stop = vi.fn(() => {
    tap = null;
  });
  const surface: NativeSurface<Box> & { boxes: Box[] } = {
    boxes: [],
    captureTaps: vi.fn((onTap) => {
      tap = onTap;
      return stop;
    }),
    showBox: vi.fn((view: Box) => {
      surface.boxes.push(view);
      return true;
    }),
    hideBox: vi.fn(),
  };
  return { surface, stop, tap: (view: Box | null) => tap?.(view) };
}

describe('viewAt', () => {
  it('finds the deepest view under a point, looking through frameless containers', () => {
    const { tree, label, card2, root } = scene();
    const frame = (node: Box) => node.frame;
    expect(viewAt(tree, frame, { x: 20, y: 15 })).toBe(label);
    expect(viewAt(tree, frame, { x: 90, y: 70 })).toBe(card2);
    expect(viewAt(tree, frame, { x: 300, y: 600 })).toBe(root);
    expect(viewAt(tree, frame, { x: 400, y: 700 })).toBeNull();
  });
});

describe('startNativePick', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    clearNativeHighlight();
    vi.useRealTimers();
  });

  it('answers with the component around the tapped view and stops catching taps', async () => {
    const { tree, ng, card, label } = scene();
    const { surface, stop, tap } = fakeSurface();
    const pick = startNativePick({ getNg: () => ng, tree, surface });
    tap(label);
    expect(await pick.result).toEqual({ ok: true, id: elementId(card), name: 'Card', tag: 'card' });
    expect(stop).toHaveBeenCalled();
  });

  it('says so when the tap is outside any component, on cancel and on timeout', async () => {
    const { tree, ng } = scene();
    const outside = startNativePick({ getNg: () => ng, tree, surface: fakeSurface().surface });
    outside.cancel();
    expect(await outside.result).toEqual({ ok: false, error: 'Picking cancelled.' });

    const late = startNativePick({ getNg: () => ng, tree, surface: fakeSurface().surface });
    vi.advanceTimersByTime(15_000);
    expect(await late.result).toEqual({ ok: false, error: 'No component was picked.' });

    const lonely = box('lonely', { x: 0, y: 0, width: 1, height: 1 });
    const fake = fakeSurface();
    const stray = startNativePick({ getNg: () => ng, tree, surface: fake.surface });
    fake.tap(lonely);
    expect(await stray.result).toEqual({
      ok: false,
      error: 'That view is not inside an Angular component.',
    });
  });

  it('refuses when the device cannot catch a tap', async () => {
    const { tree, ng } = scene();
    const surface: NativeSurface<Box> = {
      captureTaps: () => null,
      showBox: () => false,
      hideBox: () => {},
    };
    expect(await startNativePick({ getNg: () => ng, tree, surface }).result).toEqual({
      ok: false,
      error: 'This device cannot catch a tap for picking.',
    });
  });

  it('moves with the keys from the panel and draws the box on the shown component', async () => {
    const { tree, ng, root, card, card2 } = scene();
    const { surface } = fakeSurface();
    const pick = startNativePick({ getNg: () => ng, tree, surface });
    expect(pick.move('next')).toMatchObject({ moved: true, id: elementId(root), name: 'App' });
    expect(pick.move('child')).toMatchObject({ moved: true, id: elementId(card) });
    expect(pick.move('next')).toMatchObject({ moved: true, id: elementId(card2) });
    expect(pick.move('next')).toEqual({ moved: false, error: 'This is the last component.' });
    expect(pick.move('parent')).toMatchObject({ moved: true, id: elementId(root) });
    expect(surface.boxes).toEqual([root, card, card2, root]);
    expect(pick.move('pick')).toMatchObject({ moved: true, picked: true, id: elementId(root) });
    expect(await pick.result).toMatchObject({ ok: true, id: elementId(root) });
    expect(surface.hideBox).toHaveBeenCalled();
  });
});

describe('registerNativePick', () => {
  afterEach(() => clearNativeHighlight());

  it('answers component-pick requests, moves and cancels like the browser overlay', async () => {
    const { tree, ng, card, label } = scene();
    const { surface, tap } = fakeSurface();
    const handlers = new Map<string, (request: unknown) => void>();
    const calls: [string, unknown][] = [];
    const rpc = {
      call: async (name: string, arg?: unknown) => void calls.push([name, arg]),
      register: (definition: { name: string; handler: (request: unknown) => void }) =>
        handlers.set(definition.name, definition.handler),
    };
    const picked = vi.fn();
    registerNativePick(rpc, 'app1', { getNg: () => ng, tree, surface, picked });
    const request = handlers.get('component-pick')!;

    request({ requestId: 'x', pageId: 'other' });
    expect(surface.captureTaps).not.toHaveBeenCalled();

    request({ requestId: 'm1', pageId: 'app1', move: 'next' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]![1]).toMatchObject({ result: { moved: false, error: 'No pick is running.' } });

    request({ requestId: 'p1', pageId: 'app1' });
    tap(label);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual([
      'component-pick-result',
      {
        requestId: 'p1',
        pageId: 'app1',
        result: { ok: true, id: elementId(card), name: 'Card', tag: 'card' },
      },
    ]);
    expect(picked).toHaveBeenCalledWith(elementId(card));

    request({ requestId: 'p2', pageId: 'app1' });
    request({ pageId: 'app1', cancel: true });
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2]![1]).toMatchObject({ result: { ok: false, error: 'Picking cancelled.' } });
  });
});

describe('showNativeHighlight', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws the box for the duration asked, and clears it', () => {
    const { card } = scene();
    const { surface } = fakeSurface();
    expect(showNativeHighlight(surface, card, 5000)).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(surface.hideBox).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(surface.hideBox).toHaveBeenCalledTimes(1);
    const none: NativeSurface<Box> = { ...surface, showBox: () => false };
    expect(showNativeHighlight(none, card)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NativeScript: fake views with frames, and fake UIKit and Android classes.

interface FakeNsView extends NativeView {
  frame: NativeFrame | null;
  kids: FakeNsView[];
}

function nsView(typeName: string, frame: NativeFrame | null, kids: FakeNsView[] = []) {
  const view: FakeNsView = {
    typeName,
    frame,
    kids,
    parent: null,
    eachChildView(callback) {
      for (const kid of kids) callback(kid);
    },
    getLocationInWindow: () => (view.frame ? { x: view.frame.x, y: view.frame.y } : undefined),
    getActualSize: () =>
      view.frame ? { width: view.frame.width, height: view.frame.height } : { width: 0, height: 0 },
  };
  for (const kid of kids) kid.parent = view;
  return view;
}

function fakeUIKit() {
  const added: Record<string, unknown>[] = [];
  const window = {
    bounds: { w: 320, h: 640 },
    addSubview: vi.fn((view: Record<string, unknown>) => added.push(view)),
  };
  const makeView = (proto: Record<string, unknown> = {}) => ({
    alloc: () => ({
      initWithFrame(frame: unknown) {
        const view: Record<string, unknown> = {
          ...proto,
          frame,
          layer: {},
          removeFromSuperview: vi.fn(() => added.splice(added.indexOf(view), 1)),
        };
        return view;
      },
    }),
  });
  const g = {
    UIView: {
      ...makeView(),
      extend: (proto: Record<string, unknown>) => makeView(proto),
    },
    CGRectMake: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
    UIColor: {
      clearColor: 'clear',
      colorWithRedGreenBlueAlpha: (r: number, gr: number, b: number) => ({ CGColor: [r, gr, b] }),
      colorWithWhiteAlpha: () => 'almost-clear',
    },
  };
  return { g, window, added };
}

function fakeAndroid() {
  const decor = { views: [] as Record<string, unknown>[] };
  const decorView = {
    addView: vi.fn((view: Record<string, unknown>) => decor.views.push(view)),
    removeView: vi.fn((view: Record<string, unknown>) =>
      decor.views.splice(decor.views.indexOf(view), 1),
    ),
  };
  class View {
    props: Record<string, unknown> = {};
    setBackground(value: unknown) {
      this.props['background'] = value;
    }
    setClickable(value: boolean) {
      this.props['clickable'] = value;
    }
    setFocusable(value: boolean) {
      this.props['focusable'] = value;
    }
    setLayoutParams(value: unknown) {
      this.props['params'] = value;
    }
    setX(value: number) {
      this.props['x'] = value;
    }
    setY(value: number) {
      this.props['y'] = value;
    }
    setOnTouchListener(value: { onTouch(view: unknown, event: unknown): boolean }) {
      this.props['touch'] = value;
    }
    static OnTouchListener = class {
      constructor(impl: object) {
        Object.assign(this, impl);
      }
    };
  }
  const android = {
    view: {
      View,
      ViewGroup: { LayoutParams: { MATCH_PARENT: -1 } },
      MotionEvent: { ACTION_UP: 1 },
    },
    widget: {
      FrameLayout: {
        LayoutParams: class {
          constructor(
            public width: number,
            public height: number,
          ) {}
        },
      },
    },
    graphics: {
      Color: { parseColor: (value: string) => value },
      drawable: {
        GradientDrawable: class {
          stroke: unknown[] = [];
          setColor() {}
          setStroke(...args: unknown[]) {
            this.stroke = args;
          }
        },
      },
    },
  };
  const activity = { getWindow: () => ({ getDecorView: () => decorView }) };
  return { g: { android }, activity, decor, decorView };
}

describe('NativeScript surface', () => {
  function nsScene() {
    const label = nsView('Label', { x: 20, y: 30, width: 80, height: 20 });
    const proxy = nsView('ProxyViewContainer', null, [label]);
    const root = nsView('StackLayout', { x: 0, y: 0, width: 320, height: 640 }, [proxy]);
    const ng = {
      getComponent: (view: NativeView) => (view === proxy ? { constructor: class Card {} } : null),
    };
    const tree = nativeScriptTree(
      () => ng,
      () => root,
    );
    return { label, proxy, root, tree };
  }

  it('draws the box over the first view that draws on iOS, as a UIView that ignores touches', () => {
    const { proxy, tree } = nsScene();
    const kit = fakeUIKit();
    const surface = nativeScriptSurface(
      tree,
      iosPlatform(kit.g, () => kit.window),
    );
    expect(surface.showBox(proxy)).toBe(true);
    expect(kit.added).toHaveLength(1);
    expect(kit.added[0]).toMatchObject({
      frame: { x: 20, y: 30, w: 80, h: 20 },
      userInteractionEnabled: false,
      layer: { borderWidth: 2 },
    });
    surface.hideBox();
    expect(kit.added).toHaveLength(0);
  });

  it('catches a tap over the window on iOS and finds the view under it', () => {
    const { label, tree } = nsScene();
    const kit = fakeUIKit();
    const surface = nativeScriptSurface(
      tree,
      iosPlatform(kit.g, () => kit.window),
    );
    const onTap = vi.fn();
    const stop = surface.captureTaps(onTap)!;
    const catcher = kit.added[0] as Record<string, unknown> & {
      touchesEndedWithEvent(touches: unknown): void;
      locationInView?: unknown;
    };
    catcher.touchesEndedWithEvent.call(catcher, {
      anyObject: () => ({ locationInView: () => ({ x: 30, y: 35 }) }),
    });
    expect(onTap).toHaveBeenCalledWith(label);
    stop();
    expect(kit.added).toHaveLength(0);
  });

  it('places the box and reads taps in pixels on Android', () => {
    const { label, proxy, tree } = nsScene();
    const fake = fakeAndroid();
    const surface = nativeScriptSurface(
      tree,
      androidPlatform(
        fake.g,
        () => fake.activity,
        () => 2,
      ),
    );
    expect(surface.showBox(proxy)).toBe(true);
    const drawn = fake.decor.views[0]!['props'] as Record<string, unknown>;
    expect(drawn).toMatchObject({
      x: 40,
      y: 60,
      clickable: false,
      params: { width: 160, height: 40 },
    });
    expect((drawn['background'] as { stroke: unknown[] }).stroke).toEqual([4, '#68b6ff']);
    surface.hideBox();
    expect(fake.decor.views).toHaveLength(0);

    const onTap = vi.fn();
    const stop = surface.captureTaps(onTap)!;
    const listener = (fake.decor.views[0]!['props'] as Record<string, unknown>)['touch'] as {
      onTouch(view: unknown, event: unknown): boolean;
    };
    const event = (action: number) => ({ getAction: () => action, getX: () => 60, getY: () => 70 });
    expect(listener.onTouch(null, event(0))).toBe(true);
    expect(onTap).not.toHaveBeenCalled();
    expect(listener.onTouch(null, event(1))).toBe(true);
    expect(onTap).toHaveBeenCalledWith(label);
    stop();
    expect(fake.decor.views).toHaveLength(0);
  });

  it('draws nothing and catches nothing without a platform', () => {
    const { proxy, tree } = nsScene();
    const surface = nativeScriptSurface(tree, null);
    expect(surface.showBox(proxy)).toBe(false);
    expect(surface.captureTaps(() => {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Angular Native: a fake `@ng-native/fabric` engine.

interface EngineNode {
  kind: string;
  name: string;
  children: EngineNode[];
  parent: EngineNode | null;
  props: Record<string, unknown>;
  host?: unknown;
}

function fakeEngine(frames: Map<EngineNode, NativeFrame>) {
  let responder: Record<string, (...args: unknown[]) => unknown> | null = null;
  const engine = {
    setProp: vi.fn((node: EngineNode, key: string, value: unknown) => {
      node.props[key] = value;
    }),
    createElement: vi.fn((name: string): EngineNode => ({
      kind: 'element',
      name,
      children: [],
      parent: null,
      props: {},
      host: engine,
    })),
    appendChild: vi.fn((parent: EngineNode, child: EngineNode) => {
      parent.children.push(child);
      child.parent = parent;
    }),
    removeChild: vi.fn((parent: EngineNode | null, child: EngineNode) => {
      parent?.children.splice(parent.children.indexOf(child), 1);
      child.parent = null;
    }),
    measure: vi.fn((node: EngineNode, into: (frame: NativeFrame) => void) => {
      const frame = frames.get(node);
      if (frame) into(frame);
    }),
    setResponder: vi.fn((_node: EngineNode, handlers: Record<string, never>) => {
      responder = handlers;
      return () => {
        responder = null;
      };
    }),
    commit: vi.fn(() => true),
  };
  const touch = (target: EngineNode) => {
    const claimed = responder?.['onStartShouldSetResponderCapture']?.({}, target);
    if (claimed) responder?.['onResponderRelease']?.({});
    return claimed;
  };
  return { engine, touch, hasResponder: () => responder !== null };
}

function engineScene() {
  const frames = new Map<EngineNode, NativeFrame>();
  const fake = fakeEngine(frames);
  const make = (name: string, children: EngineNode[] = []): EngineNode => {
    const node: EngineNode = {
      kind: 'element',
      name,
      children,
      parent: null,
      props: {},
      host: fake.engine,
    };
    for (const child of children) child.parent = node;
    return node;
  };
  const label = make('text');
  const row = make('app-row', [label]);
  const root = make('root', [make('view', [row])]);
  frames.set(root, { x: 0, y: 40, width: 320, height: 600 });
  frames.set(row, { x: 10, y: 100, width: 300, height: 44 });
  const asNode = (node: EngineNode) => node as unknown as AngularNativeNode;
  return { ...fake, root, row, label, asNode, getRoot: () => asNode(root) };
}

describe('Angular Native surface', () => {
  it('adds a box node over the measured view, in the root coordinates, and removes it', () => {
    const { engine, root, row, asNode, getRoot } = engineScene();
    const surface = angularNativeSurface(getRoot);
    expect(surface.showBox(asNode(row))).toBe(true);
    const node = root.children.at(-1)!;
    expect(isOverlayNode(node)).toBe(true);
    expect(node.props).toMatchObject({
      pointerEvents: 'none',
      style: {
        position: 'absolute',
        left: 10,
        top: 60,
        width: 300,
        height: 44,
        borderWidth: 2,
        borderColor: '#68b6ff',
      },
    });
    expect(row.props).toEqual({});
    expect(engine.commit).toHaveBeenCalled();
    surface.hideBox();
    expect(root.children.some((child) => isOverlayNode(child))).toBe(false);
  });

  it('keeps the box node out of the tree the collectors walk', () => {
    const { root, row, asNode, getRoot } = engineScene();
    const surface = angularNativeSurface(getRoot);
    surface.showBox(asNode(row));
    const tree = angularNativeTree(getRoot, () => undefined);
    expect(tree.children(asNode(root))).toEqual([asNode(root.children[0]!)]);
    surface.hideBox();
  });

  it('draws nothing for a view the engine has not measured', () => {
    const { root, label, asNode, getRoot } = engineScene();
    const surface = angularNativeSurface(getRoot);
    surface.showBox(asNode(label));
    expect(root.children.some((child) => isOverlayNode(child))).toBe(false);
  });

  it('claims every touch with a capturing responder on the root while a pick runs', () => {
    const { touch, label, asNode, getRoot, hasResponder } = engineScene();
    const surface = angularNativeSurface(getRoot);
    const onTap = vi.fn();
    const stop = surface.captureTaps(onTap)!;
    expect(touch(label)).toBe(true);
    expect(onTap).toHaveBeenCalledWith(asNode(label));
    stop();
    expect(hasResponder()).toBe(false);
  });

  it('answers false and null when the engine lacks the calls', () => {
    const node = {
      kind: 'element',
      name: 'root',
      children: [],
      parent: null,
      props: {},
      host: { setProp: () => {} },
    } as unknown as AngularNativeNode;
    const surface = angularNativeSurface(() => node);
    expect(surface.showBox(node)).toBe(false);
    expect(surface.captureTaps(() => {})).toBeNull();
  });
});
