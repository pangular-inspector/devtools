const PANEL_ACTION_ID = /^[\w-]{1,64}$/;

function normalizeSourcePath(file) {
  return file
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '');
}

function resourcePath(url) {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url.split(/[?#]/)[0];
  }
}

function findSourceResource(urls, file) {
  const suffix = `/${normalizeSourcePath(file)}`;
  if (suffix === '/') return null;
  const hits = urls
    .filter((url) => typeof url === 'string' && resourcePath(url).endsWith(suffix))
    .sort((a, b) => resourcePath(a).length - resourcePath(b).length);
  return hits[0] ?? null;
}

function createPanelActions({ evalInPage, getResources, openResource }) {
  const inPage = (helper, pageId, id) =>
    `(() => {
  const target = window.${helper}?.(${JSON.stringify(pageId)}, ${JSON.stringify(id)});
  if (!target) return false;
  inspect(target);
  return true;
})()`;

  async function reveal({ pageId, id }) {
    if ((await evalInPage(inPage('__pangularHostOf', pageId, id))) === true) return { ok: true };
    return { ok: false, error: 'not-found' };
  }

  async function openSource({ pageId, id, file, line }) {
    if (typeof file === 'string' && Number.isInteger(line) && line > 0) {
      const resources = await getResources().catch(() => []);
      const url = findSourceResource(
        resources
          .filter((resource) => !/stylesheet$/.test(resource?.type ?? ''))
          .map((resource) => resource?.url),
        file,
      );
      if (url && (await openResource(url, line - 1))) return { ok: true, opened: 'file' };
    }
    if ((await evalInPage(inPage('__pangularClassOf', pageId, id))) === true) {
      return { ok: true, opened: 'class' };
    }
    return { ok: false, error: 'not-found' };
  }

  return async function handle(message) {
    if (!message || typeof message !== 'object') return null;
    const { type, requestId, pageId, id } = message;
    if (type !== 'pangular:reveal-element' && type !== 'pangular:open-source') return null;
    if (typeof requestId !== 'string' || !PANEL_ACTION_ID.test(requestId)) return null;
    const reply = (result) => ({ type: 'pangular:panel-action-result', requestId, ...result });
    if (typeof pageId !== 'string' || !PANEL_ACTION_ID.test(pageId)) {
      return reply({ ok: false, error: 'bad-request' });
    }
    if (typeof id !== 'string' || !PANEL_ACTION_ID.test(id)) {
      return reply({ ok: false, error: 'bad-request' });
    }
    try {
      return reply(
        type === 'pangular:reveal-element' ? await reveal(message) : await openSource(message),
      );
    } catch {
      return reply({ ok: false, error: 'failed' });
    }
  };
}
