import { Service } from '@angular/core';

export interface SourceLocation {
  file: string;
  line: number;
}

export interface PanelActionResult {
  ok: boolean;
  opened?: 'file' | 'class';
  error?: string;
}

type BridgeWindow = Pick<
  Window,
  'location' | 'parent' | 'addEventListener' | 'removeEventListener' | 'setTimeout' | 'clearTimeout'
>;

const RESULT = 'pangular:panel-action-result';
const TIMEOUT_MS = 6000;
let seq = 0;

export function insideExtension(win: BridgeWindow = window): boolean {
  return win.location.protocol === 'chrome-extension:' && win.parent !== (win as unknown);
}

export function requestPanelAction(
  message: Record<string, unknown>,
  win: BridgeWindow = window,
): Promise<PanelActionResult> {
  const requestId = `pa-${Date.now().toString(36)}-${++seq}`;
  return new Promise((resolve) => {
    const done = (result: PanelActionResult) => {
      win.clearTimeout(timer);
      win.removeEventListener('message', onMessage);
      resolve(result);
    };
    const onMessage = ({ source, origin, data }: MessageEvent<unknown>) => {
      if (source !== win.parent || origin !== win.location.origin) return;
      const reply = data as { type?: unknown; requestId?: unknown; ok?: unknown } | null;
      if (reply?.type !== RESULT || reply.requestId !== requestId) return;
      const { opened, error } = data as { opened?: unknown; error?: unknown };
      done({
        ok: reply.ok === true,
        ...(opened === 'file' || opened === 'class' ? { opened } : {}),
        ...(typeof error === 'string' ? { error } : {}),
      });
    };
    const timer = win.setTimeout(() => done({ ok: false, error: 'timeout' }), TIMEOUT_MS);
    win.addEventListener('message', onMessage);
    win.parent.postMessage({ ...message, requestId }, win.location.origin);
  });
}

@Service()
export class ExtensionBridge {
  readonly available = insideExtension();

  reveal(pageId: string, id: string): Promise<PanelActionResult> {
    return requestPanelAction({ type: 'pangular:reveal-element', pageId, id });
  }

  openSource(
    pageId: string,
    id: string,
    source: SourceLocation | null,
  ): Promise<PanelActionResult> {
    return requestPanelAction({
      type: 'pangular:open-source',
      pageId,
      id,
      ...(source ? { file: source.file, line: source.line } : {}),
    });
  }
}
