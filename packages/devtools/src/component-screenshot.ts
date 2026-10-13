// Component screenshots, on the page: a copy of one host element's subtree,
// with every computed style written inline, drawn through an SVG
// `<foreignObject>` onto a detached canvas. Nothing is added to the app's DOM:
// the copy lives in an inert document, so custom elements in it never
// upgrade and no app code runs, and secret fields are masked in the copy only.

import { elementById } from './element-id.ts';
import { MASK_MARKERS, UNMASK_MARKER, redactReason } from './forms-privacy.ts';
import { highlightBox } from './page-highlight.ts';
import { redactText } from './serialize.ts';

const XHTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';

/** Elements copied at most; the rest of a large subtree is left out and noted. */
export const MAX_SCREENSHOT_NODES = 3000;
/** The longest side of the image, in device pixels. */
export const MAX_SCREENSHOT_SIDE = 2000;
/** Base64 characters the page sends at most (about 4.5 MB of image). */
export const MAX_SCREENSHOT_DATA = 6_000_000;
/** Images inlined at most, so a long list of thumbnails can't stall the capture. */
const MAX_IMAGES = 60;
const IMAGE_TIMEOUT_MS = 5000;
const MASK_FILL = '#6b7280';
const MASKED_VALUE = '••••••••';

/** Not drawn, or drawn from their own source rather than the DOM. */
const SKIPPED_TAGS = new Set([
  'script',
  'style',
  'link',
  'template',
  'noscript',
  'meta',
  'base',
  'title',
  'head',
]);

/** Shown as a grey box with a label: their content isn't in this document. */
const OPAQUE_TAGS = new Set(['iframe', 'object', 'embed', 'portal']);

/**
 * Inherited properties: the copy only writes them where they differ from the
 * parent. A property missing here is written on every element, which costs
 * size, never correctness.
 */
const INHERITED = new Set([
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-variant-ligatures',
  'font-variant-caps',
  'font-variant-numeric',
  'font-variant-east-asian',
  'font-variant-alternates',
  'font-variant-position',
  'font-variant-emoji',
  'font-weight',
  'font-stretch',
  'font-size-adjust',
  'font-kerning',
  'font-feature-settings',
  'font-variation-settings',
  'font-optical-sizing',
  'font-palette',
  'font-synthesis-weight',
  'font-synthesis-style',
  'font-synthesis-small-caps',
  'letter-spacing',
  'line-height',
  'text-align',
  'text-align-last',
  'text-indent',
  'text-transform',
  'text-shadow',
  'text-rendering',
  'text-underline-position',
  'text-underline-offset',
  'text-decoration-skip-ink',
  'text-emphasis-color',
  'text-emphasis-position',
  'text-emphasis-style',
  'text-size-adjust',
  'text-wrap-mode',
  'text-wrap-style',
  'text-orientation',
  'text-spacing-trim',
  'text-autospace',
  'white-space-collapse',
  'word-break',
  'word-spacing',
  'overflow-wrap',
  'hyphens',
  'hyphenate-character',
  'hyphenate-limit-chars',
  'line-break',
  'tab-size',
  'direction',
  'writing-mode',
  'visibility',
  'list-style-image',
  'list-style-position',
  'list-style-type',
  'quotes',
  'border-collapse',
  'border-spacing',
  'caption-side',
  'empty-cells',
  'image-rendering',
  'image-orientation',
  'color-scheme',
  'accent-color',
  'paint-order',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'marker-start',
  'marker-mid',
  'marker-end',
  'shape-rendering',
  'text-anchor',
  'dominant-baseline',
  'clip-rule',
  'color-interpolation',
  'color-interpolation-filters',
  'color-rendering',
  'forced-color-adjust',
  'print-color-adjust',
  'ruby-position',
  'math-depth',
  'math-style',
  'math-shift',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  '-webkit-text-stroke-width',
  '-webkit-text-security',
  '-webkit-font-smoothing',
  '-webkit-locale',
  '-webkit-tap-highlight-color',
  '-webkit-rtl-ordering',
]);

/** Prefixed properties a static picture needs; other `-webkit-` ones are aliases or behavior. */
const WEBKIT_KEPT = new Set([
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  '-webkit-text-stroke-width',
  '-webkit-text-security',
  '-webkit-line-clamp',
  '-webkit-box-orient',
  '-webkit-box-align',
  '-webkit-box-pack',
  '-webkit-box-direction',
  '-webkit-box-flex',
  '-webkit-font-smoothing',
]);

/** Behavior, motion and logical aliases of physical properties: nothing a still picture shows. */
const SKIPPED_PROPERTY =
  /^(?:animation|transition|scroll-|overscroll|will-change|touch-action|user-select|pointer-events|cursor|caret|view-transition|anchor-|position-try|position-anchor|position-visibility|timeline-|view-timeline|container|contain-intrinsic|interactivity|interpolate-size|speak|page|break-|orphans|widows|app-region|-internal-|(?:margin|padding|inset|border)-(?:block|inline)|(?:min-|max-)?(?:inline|block)-size$|border-(?:start|end)-(?:start|end)-radius$|overflow-(?:block|inline)$)/;

/** Applied inside the snapshot so the user agent's own styles don't come back: the inline styles say everything. */
const RESET = '*:not(svg, svg *) { all: unset; }';

export interface ScreenshotOptions {
  maxNodes?: number;
  maxSide?: number;
  /** Device pixels per CSS pixel; the page's `devicePixelRatio` up to 2 by default. */
  scale?: number;
  /**
   * The image of an `<img>`, `<canvas>` or `<video>` as a data URL, or `null`
   * when it can't be read (a cross-origin image without CORS taints the canvas).
   */
  imageData?: (el: Element) => Promise<string | null>;
  /** A same-origin URL from a `background-image`, as a data URL, or `null`. */
  urlData?: (url: string) => Promise<string | null>;
  /** Copies `::before` and `::after` text; on by default. */
  pseudoElements?: boolean;
  /** Draws the SVG; the browser's canvas by default. Tests pass their own. */
  rasterize?: (snapshot: Snapshot, scale: number) => Promise<Raster>;
}

export interface Snapshot {
  svg: string;
  /** CSS pixels. */
  width: number;
  height: number;
  /** The colour behind the component, from its nearest ancestor that has one. */
  background: string;
  /** Fields and marked elements masked in the copy. */
  masked: number;
  /** Text nodes whose tokens were masked. */
  maskedText: number;
  /** What the copy could not show, for the answer. */
  notes: string[];
  nodes: number;
}

export interface Raster {
  mimeType: 'image/png' | 'image/jpeg';
  /** Base64, without the `data:` prefix. */
  data: string;
}

export type ScreenshotResult =
  | {
      ok: true;
      mimeType: Raster['mimeType'];
      data: string;
      /** Image pixels. */
      width: number;
      height: number;
      /** CSS pixels of the host. */
      cssWidth: number;
      cssHeight: number;
      masked: number;
      maskedText: number;
      notes: string[];
    }
  | { ok: false; error: string };

interface Walk {
  doc: Document;
  view: Window;
  count: number;
  maxNodes: number;
  truncated: boolean;
  masked: number;
  maskedText: number;
  images: { source: Element; target: Element; width: number; height: number }[];
  backgrounds: { target: Element; style: string }[];
  opaque: Set<string>;
  pseudo: boolean;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function closest(el: Element, selector: string): boolean {
  return safe(() => !!el.closest(selector), false);
}

/** The inline style for `el`: every property that a still picture needs and the parent doesn't already pass down. */
export function styleText(style: CSSStyleDeclaration, parent: CSSStyleDeclaration | null): string {
  let out = '';
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (!name || name.startsWith('--')) continue;
    if (name.startsWith('-webkit-') ? !WEBKIT_KEPT.has(name) : SKIPPED_PROPERTY.test(name)) {
      continue;
    }
    const value = style.getPropertyValue(name);
    if (!value) continue;
    if (parent && INHERITED.has(name) && parent.getPropertyValue(name) === value) continue;
    out += `${name}:${value};`;
  }
  return out;
}

function box(el: Element) {
  const rect = safe(() => el.getBoundingClientRect(), null);
  return { width: Math.max(0, rect?.width ?? 0), height: Math.max(0, rect?.height ?? 0) };
}

/** A grey block the size of `el`, in place of what must not be shown or can't be. */
function placeholder(walk: Walk, el: Element, style: CSSStyleDeclaration, label = ''): Element {
  const { width, height } = box(el);
  const block = walk.doc.createElementNS(XHTML, 'div');
  const display = /^(?:inline|contents)$/.test(style.display) ? 'inline-block' : style.display;
  block.setAttribute(
    'style',
    `display:${display};box-sizing:border-box;width:${width}px;height:${height}px;background:${MASK_FILL};color:#fff;font:12px sans-serif;overflow:hidden;border-radius:2px;vertical-align:${style.verticalAlign};margin:${style.margin};`,
  );
  if (label) block.textContent = label;
  return block;
}

/** The attributes that name a field: its control name, `name` and `id`. */
const FIELD_KEY_ATTRIBUTES = ['formcontrolname', 'ng-reflect-name', 'name', 'id'] as const;

/** Every key a field's value can be masked by, in {@link FIELD_KEY_ATTRIBUTES} order. */
function fieldKeys(el: Element): string[] {
  return FIELD_KEY_ATTRIBUTES.map((name) => el.getAttribute(name)).filter(
    (key): key is string => !!key,
  );
}

/** A native field (input, textarea, select) is masked when any of its keys, or the element, says so. */
function isMaskedField(el: Element): boolean {
  const keys = fieldKeys(el);
  if (!keys.length) return redactReason('', el) !== null;
  return keys.some((key) => redactReason(key, el) !== null);
}

/**
 * Any other element named like a secret field, such as a custom form control
 * `<app-pin formControlName="pin">` or `<my-secret name="password">`. It is
 * drawn as a placeholder, so the value it renders and the unnamed inputs
 * inside it never reach the image. Only the names decide here: a wrapper
 * around a password input keeps its other content.
 */
function isSecretHost(el: Element): boolean {
  if (closest(el, UNMASK_MARKER)) return false;
  return fieldKeys(el).some((key) => redactReason(key) !== null);
}

/** Fields whose value {@link copyFieldState} masks in place. */
const VALUE_FIELDS = new Set(['input', 'textarea', 'option']);

/** HTML attributes the picture depends on; styles carry everything else. */
const HTML_ATTRIBUTES = new Set([
  'type',
  'colspan',
  'rowspan',
  'span',
  'alt',
  'dir',
  'lang',
  'open',
  'rows',
  'cols',
  'size',
  'multiple',
  'start',
  'reversed',
  'width',
  'height',
  'disabled',
  'placeholder',
  'value',
  'checked',
  'selected',
]);

function copyAttributes(source: Element, target: Element, html: boolean) {
  for (const attr of Array.from(source.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || name === 'style') continue;
    if (html && !HTML_ATTRIBUTES.has(name)) continue;
    // An SVG reference to another document never loads inside an image.
    if (!html && /href$/.test(name) && !attr.value.startsWith('#')) continue;
    const value = name === 'placeholder' || name === 'alt' ? redactText(attr.value) : attr.value;
    safe(() => {
      if (attr.namespaceURI) target.setAttributeNS(attr.namespaceURI, attr.name, value);
      else target.setAttribute(attr.name, value);
    }, undefined);
  }
}

/** The current value of a form control, set as an attribute so the copy shows it. */
function copyFieldState(source: Element, target: Element, walk: Walk) {
  const tag = source.localName;
  if (tag === 'input') {
    const input = source as HTMLInputElement;
    const type = (input.type || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      if (input.checked) target.setAttribute('checked', '');
      else target.removeAttribute('checked');
      return;
    }
    if (type === 'file' || type === 'hidden') return;
    const masked = input.value && isMaskedField(source);
    if (masked) walk.masked++;
    // A masked text field shows dots of a fixed length, not the length of the secret.
    if (masked) target.setAttribute('type', 'text');
    target.setAttribute('value', masked ? MASKED_VALUE : redactText(input.value));
    return;
  }
  if (tag === 'textarea') {
    const area = source as HTMLTextAreaElement;
    const masked = area.value && isMaskedField(source);
    if (masked) walk.masked++;
    target.textContent = masked ? MASKED_VALUE : redactText(area.value);
    return;
  }
  if (tag === 'option') {
    if ((source as HTMLOptionElement).selected) target.setAttribute('selected', '');
    else target.removeAttribute('selected');
  }
}

/** A `::before` or `::after` with plain text content, as a span. */
function pseudoElement(
  walk: Walk,
  el: Element,
  which: '::before' | '::after',
  parent: CSSStyleDeclaration,
): Element | null {
  if (!walk.pseudo) return null;
  const style = safe(() => walk.view.getComputedStyle(el, which), null);
  const content = style?.content;
  if (!style || !content || content === 'none' || content === 'normal') return null;
  const text = /^"(.*)"$/s.exec(content)?.[1];
  if (text === undefined) return null;
  const span = walk.doc.createElementNS(XHTML, 'span');
  span.setAttribute('style', styleText(style, parent));
  span.textContent = redactText(text.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  return span;
}

/** The nodes an element renders: its shadow root's when it has one, with slots filled in. */
function renderedChildren(el: Element): Node[] {
  const root = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  if (!root) return Array.from(el.childNodes);
  const out: Node[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node instanceof Element && node.localName === 'slot') {
      const assigned = safe(
        () => (node as HTMLSlotElement).assignedNodes({ flatten: true }),
        [] as Node[],
      );
      out.push(...(assigned.length ? assigned : Array.from(node.childNodes)));
    } else {
      out.push(node);
    }
  }
  return out;
}

function copyNode(
  walk: Walk,
  node: Node,
  parent: CSSStyleDeclaration | null,
  root = false,
): Node | null {
  if (node.nodeType === 3) {
    const text = node.nodeValue ?? '';
    const masked = redactText(text);
    if (masked !== text) walk.maskedText++;
    return walk.doc.createTextNode(masked);
  }
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  const tag = el.localName;
  if (SKIPPED_TAGS.has(tag)) return null;
  if (walk.count >= walk.maxNodes) {
    walk.truncated = true;
    return null;
  }
  walk.count++;
  const style = safe(() => walk.view.getComputedStyle(el), null);
  if (!style || style.display === 'none') return null;
  if (closest(el, MASK_MARKERS) && !closest(el, UNMASK_MARKER)) {
    walk.masked++;
    return placeholder(walk, el, style);
  }
  if (OPAQUE_TAGS.has(tag)) {
    walk.opaque.add(tag);
    return placeholder(walk, el, style, `<${tag}>`);
  }
  const html = el.namespaceURI === XHTML || !el.namespaceURI;
  if (tag === 'select' ? isMaskedField(el) : !VALUE_FIELDS.has(tag) && isSecretHost(el)) {
    walk.masked++;
    return placeholder(walk, el, style);
  }
  const replaced = tag === 'img' || tag === 'canvas' || tag === 'video';
  const target = walk.doc.createElementNS(
    replaced ? XHTML : (el.namespaceURI ?? XHTML),
    replaced ? 'img' : tag,
  );
  copyAttributes(el, target, html);
  let css = styleText(style, parent);
  if (root) {
    // The copy is drawn at the origin of the image, whatever moved the original.
    const display = style.display === 'inline' ? 'block' : style.display;
    css = css.replace(/(^|;)display:[^;]*;/, '$1');
    css += `display:${display};margin:0;position:relative;inset:auto;transform:none;`;
  }
  if (/url\(/.test(style.backgroundImage)) walk.backgrounds.push({ target, style: css });
  target.setAttribute('style', css);
  if (replaced) {
    const { width, height } = box(el);
    walk.images.push({ source: el, target, width, height });
    return target;
  }
  if (html) copyFieldState(el, target, walk);
  if (tag === 'textarea') return target;
  const before = html ? pseudoElement(walk, el, '::before', style) : null;
  if (before) target.appendChild(before);
  for (const child of renderedChildren(el)) {
    const copy = copyNode(walk, child, style);
    if (copy) target.appendChild(copy);
  }
  const after = html ? pseudoElement(walk, el, '::after', style) : null;
  if (after) target.appendChild(after);
  return target;
}

function backgroundBehind(el: Element, view: Window): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const color = safe(() => view.getComputedStyle(node!).backgroundColor, '');
    if (color && color !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
  }
  return '#ffffff';
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = IMAGE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** Reads an image, canvas or video frame through a detached canvas; `null` when it is tainted or empty. */
export async function defaultImageData(el: Element): Promise<string | null> {
  if (el instanceof HTMLCanvasElement) return safe(() => el.toDataURL('image/png'), null);
  const media = el as HTMLImageElement | HTMLVideoElement;
  const width =
    el instanceof HTMLVideoElement ? el.videoWidth : (el as HTMLImageElement).naturalWidth;
  const height =
    el instanceof HTMLVideoElement ? el.videoHeight : (el as HTMLImageElement).naturalHeight;
  if (!width || !height) return null;
  const fit = Math.min(1, 1024 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * fit));
  canvas.height = Math.max(1, Math.round(height * fit));
  const context = canvas.getContext('2d');
  if (!context) return null;
  return safe(() => {
    context.drawImage(media, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }, null);
}

/** Fetches a same-origin URL as a data URL; other origins are left out, since the page can't read them without CORS. */
export async function defaultUrlData(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url, location.href);
  } catch {
    return null;
  }
  if (parsed.protocol === 'data:') return url;
  if (parsed.origin !== location.origin) return null;
  const response = await fetch(parsed.href, { credentials: 'same-origin' });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (blob.size > 2_000_000) return null;
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Copies `el` into a standalone SVG. Reads only: computed styles, form values
 * and image pixels the page may read. Password fields, fields whose name,
 * `type` or `autocomplete` look secret, and elements marked with the mask
 * markers of `forms-privacy.ts` are masked, and tokens in text are masked
 * with the server's redaction.
 */
export async function snapshotElement(
  el: Element,
  options: ScreenshotOptions = {},
): Promise<Snapshot | { error: string }> {
  const view = el.ownerDocument.defaultView;
  if (!view) return { error: 'The element is not in a window.' };
  const area = highlightBox(el);
  if (!area || area.width < 1 || area.height < 1) {
    return {
      error:
        'The element has no size on the page (hidden, collapsed or not rendered), so there is nothing to draw.',
    };
  }
  const width = Math.ceil(area.width);
  const height = Math.ceil(area.height);
  // An inert document: elements made in it never upgrade, so no custom element constructor runs.
  const doc = el.ownerDocument.implementation.createHTMLDocument('');
  const walk: Walk = {
    doc,
    view,
    count: 0,
    maxNodes: options.maxNodes ?? MAX_SCREENSHOT_NODES,
    truncated: false,
    masked: 0,
    maskedText: 0,
    images: [],
    backgrounds: [],
    opaque: new Set(),
    pseudo: options.pseudoElements !== false,
  };
  const copy = copyNode(walk, el, null, true);
  if (!copy) return { error: 'The element is not displayed (display: none).' };
  const notes: string[] = [];
  const imageData = options.imageData ?? defaultImageData;
  let unreadable = 0;
  for (const [index, image] of walk.images.entries()) {
    const data = index < MAX_IMAGES ? await withTimeout(imageData(image.source), null) : null;
    if (data) {
      image.target.setAttribute('src', data);
      continue;
    }
    unreadable++;
    const style = image.target.getAttribute('style') ?? '';
    image.target.removeAttribute('src');
    image.target.setAttribute(
      'style',
      `${style}background:${MASK_FILL};width:${image.width}px;height:${image.height}px;`,
    );
  }
  if (unreadable) {
    notes.push(
      `${unreadable} image(s), canvas(es) or video(s) could not be read (another origin without CORS, not loaded yet, or over ${MAX_IMAGES}) and show as grey boxes.`,
    );
  }
  const urlData = options.urlData ?? defaultUrlData;
  let droppedBackgrounds = 0;
  for (const background of walk.backgrounds.slice(0, MAX_IMAGES)) {
    const urls = [...background.style.matchAll(/url\("?([^")]+)"?\)/g)].map((m) => m[1]!);
    let style = background.style;
    for (const url of urls) {
      const data = await withTimeout(urlData(url), null);
      if (!data) droppedBackgrounds++;
      style = style.split(url).join(data ?? '');
    }
    // A URL the image can't load is dropped instead of breaking the whole background.
    style = style.replace(/url\(""\)|url\(\)/g, 'none');
    background.target.setAttribute('style', style);
  }
  if (droppedBackgrounds) {
    notes.push(`${droppedBackgrounds} background image(s) from another origin were left out.`);
  }
  if (walk.truncated) {
    notes.push(
      `The component has more than ${walk.maxNodes} elements; the ones after that are left out.`,
    );
  }
  if (walk.opaque.size) {
    notes.push(
      `${[...walk.opaque].map((tag) => `<${tag}>`).join(', ')} content is not part of this page and shows as a grey box.`,
    );
  }
  const wrapper = doc.createElementNS(XHTML, 'div');
  wrapper.setAttribute(
    'style',
    `width:${width}px;height:${height}px;overflow:hidden;position:relative;display:block;`,
  );
  wrapper.appendChild(copy);
  const body = new XMLSerializer().serializeToString(wrapper);
  const svg =
    `<svg xmlns="${SVG}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<style>${RESET}</style>` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${body}</foreignObject></svg>`;
  return {
    svg,
    width,
    height,
    background: backgroundBehind(el, view),
    masked: walk.masked,
    maskedText: walk.maskedText,
    notes,
    nodes: walk.count,
  };
}

/** Draws the SVG on a detached canvas and encodes it, PNG first, JPEG when the PNG is too large. */
export async function defaultRasterize(snapshot: Snapshot, scale: number): Promise<Raster> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error('The browser could not draw the copy of the component.'));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshot.svg)}`;
  await loaded;
  const encode = (factor: number): Raster => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(snapshot.width * factor));
    canvas.height = Math.max(1, Math.round(snapshot.height * factor));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The page has no 2D canvas.');
    context.fillStyle = snapshot.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    if (png.length - 22 <= MAX_SCREENSHOT_DATA) {
      return { mimeType: 'image/png', data: png.slice(png.indexOf(',') + 1) };
    }
    const jpeg = canvas.toDataURL('image/jpeg', 0.85);
    return { mimeType: 'image/jpeg', data: jpeg.slice(jpeg.indexOf(',') + 1) };
  };
  let raster = encode(scale);
  // Still too large: half the size, once.
  if (raster.data.length > MAX_SCREENSHOT_DATA) raster = encode(scale / 2);
  return raster;
}

/** Captures `el` as an image. Never throws: a failure is an answer with the reason. */
export async function captureElement(
  el: Element,
  options: ScreenshotOptions = {},
): Promise<ScreenshotResult> {
  try {
    const snapshot = await snapshotElement(el, options);
    if ('error' in snapshot) return { ok: false, error: snapshot.error };
    const maxSide = options.maxSide ?? MAX_SCREENSHOT_SIDE;
    const ratio =
      options.scale ??
      Math.min(2, Math.max(1, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1));
    const scale = Math.min(ratio, maxSide / Math.max(snapshot.width, snapshot.height));
    const raster = await (options.rasterize ?? defaultRasterize)(snapshot, scale);
    if (raster.data.length > MAX_SCREENSHOT_DATA) {
      return {
        ok: false,
        error:
          'The image is too large to send. Pick a smaller component, such as a child of this one.',
      };
    }
    if (scale < ratio) {
      snapshot.notes.push(
        `Scaled down to fit ${maxSide} pixels on its longest side, so small text may be hard to read. Pick a child component for more detail.`,
      );
    }
    return {
      ok: true,
      mimeType: raster.mimeType,
      data: raster.data,
      width: Math.round(snapshot.width * scale),
      height: Math.round(snapshot.height * scale),
      cssWidth: snapshot.width,
      cssHeight: snapshot.height,
      masked: snapshot.masked,
      maskedText: snapshot.maskedText,
      notes: snapshot.notes,
    };
  } catch (error) {
    return {
      ok: false,
      error: redactText(String((error as Error)?.message ?? error)).slice(0, 500),
    };
  }
}

interface ScreenshotRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    handler: (message: never) => unknown;
  }): void;
}

/** Finds the element a request names: a host by its stable id, or the first match of a CSS selector. */
export function screenshotTarget(request: { id?: unknown; selector?: unknown }): Element | null {
  if (typeof request.id === 'string' && request.id) return elementById(request.id);
  if (typeof request.selector !== 'string' || !request.selector) return null;
  // The selector comes from an agent, so it may not be valid CSS.
  return safe(() => document.querySelector(request.selector as string), null);
}

/** A `component-screenshot` event from the server. */
export interface ScreenshotRequest {
  requestId?: unknown;
  pageId?: unknown;
  id?: unknown;
  selector?: unknown;
}

/**
 * Answers one `component-screenshot` event meant for this page with an image
 * of the element it names, through `component-screenshot-result`.
 */
export function answerScreenshotRequest(
  rpc: Pick<ScreenshotRpc, 'call'>,
  pageId: string,
  message: ScreenshotRequest | null,
  options: ScreenshotOptions = {},
) {
  if (!message || typeof message.requestId !== 'string' || message.pageId !== pageId) return;
  const requestId = message.requestId;
  const el = screenshotTarget(message);
  const answer = el
    ? captureElement(el, options)
    : Promise.resolve<ScreenshotResult>({
        ok: false,
        error:
          typeof message.id === 'string'
            ? 'That instance is no longer on the page. Read the component tree again for a current id.'
            : 'No element on the page matches the selector.',
      });
  void answer.then((result) =>
    rpc.call('component-screenshot-result', { requestId, pageId, result }).catch(() => {}),
  );
}

/** Registers the `component-screenshot` handler for this page. */
export function registerComponentScreenshot(
  rpc: ScreenshotRpc,
  pageId: string,
  options: ScreenshotOptions = {},
) {
  rpc.register({
    name: 'component-screenshot',
    type: 'event',
    jsonSerializable: true,
    handler: (message: ScreenshotRequest | null) =>
      answerScreenshotRequest(rpc, pageId, message, options),
  });
}
