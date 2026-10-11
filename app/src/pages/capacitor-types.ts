// The `capacitor` shared state, as the server publishes it
// (packages/devtools/src/rpc/capacitor-tools.ts).

export interface CapacitorPluginInfo {
  name: string;
  available: boolean;
  registered: boolean;
  native: boolean;
  methods: string[];
}

export interface CapacitorInfo {
  platform: string;
  native: boolean;
  bridge: boolean;
  webCalls: boolean;
  env: {
    serverUrl: string;
    debug: boolean;
    logging: boolean;
    capacitorHttp: boolean;
    userAgent: string;
  };
  plugins: CapacitorPluginInfo[];
}

export interface CapacitorCall {
  id: number;
  plugin: string;
  method: string;
  kind: 'promise' | 'callback';
  via: 'native' | 'web';
  args: unknown;
  status: 'pending' | 'ok' | 'error';
  result?: unknown;
  error?: { message: string; code?: string };
  startedAt: number;
  durationMs?: number;
  callbacks?: number;
}

export interface CapacitorListener {
  id: string;
  plugin: string;
  event: string;
  addedAt: number;
  events: number;
  lastEventAt?: number;
  removed?: boolean;
}

export interface CapacitorPage {
  pageId: string;
  url: string;
  title: string;
  reportedAt: number;
  info: CapacitorInfo;
  calls: CapacitorCall[];
  listeners: CapacitorListener[];
  dropped: number;
}

/** Pages from the shared state, newest first, skipping anything malformed. */
export function capacitorPages(value: unknown): CapacitorPage[] {
  const pages = (value as { pages?: unknown } | null | undefined)?.pages;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages as Record<string, CapacitorPage>)
    .filter((page) => page && typeof page.pageId === 'string' && !!page.info)
    .sort((a, b) => b.reportedAt - a.reportedAt);
}

export function isUnimplemented(call: CapacitorCall): boolean {
  const error = call.error;
  return !!error && (error.code === 'UNIMPLEMENTED' || /not implemented/i.test(error.message));
}
