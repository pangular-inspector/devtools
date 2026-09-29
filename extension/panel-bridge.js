// Bridge between the Chrome DevTools panel and the inspected Angular page.
// Finds the devframe connection, then loads the SPA scoped to the inspected page.

const frame = document.getElementById('devtools-frame');
const status = document.getElementById('status');
const statusMessage = document.getElementById('status-message');
const triedList = document.getElementById('status-tried');
const allowButton = document.getElementById('status-allow');
const docsLink = document.getElementById('status-docs');

// Where devframe may be mounted.
const PATHS = ['/__ng-devtools/', '/__devframes/ng-devtools/', '/__devframe/', '/'];
const CONNECTION_FILES = ['__devframe/__connection.json', '__connection.json'];
const PROBE_TIMEOUT_MS = 1500;
const DETECTING = 'Detecting Angular app…';
const PAGE_ID = `(() => {
  try {
    return sessionStorage.getItem('ng-devtools-page-id');
  } catch {
    return null;
  }
})()`;

let detection = 0;

function evalInPage(expression) {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, error) =>
      resolve(error ? null : result),
    );
  });
}

function toURL(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

async function detectConnection() {
  const run = ++detection;
  showStatus(DETECTING, { help: false });
  const page = toURL(await evalInPage('location.origin'));
  if (run !== detection) return;
  if (!page || !['http:', 'https:'].includes(page.protocol)) {
    showStatus('Angular DevTools connects to pages served over http or https.');
    return;
  }

  // Loopback hosts are granted on install; the user opts in to any other host.
  const access = { origins: [`${page.protocol}//${page.hostname}/*`] };
  const granted = await chrome.permissions.contains(access);
  if (run !== detection) return;
  if (!granted) {
    showStatus(`Allow Angular DevTools to reach the devtools server on ${page.host}.`, {
      allow: async () => {
        if (await chrome.permissions.request(access)) detectConnection();
      },
    });
    return;
  }

  const candidates = PATHS.flatMap((base) =>
    CONNECTION_FILES.map((file) => ({ base, url: new URL(base + file, page).href })),
  ).filter((candidate, index, all) => all.findIndex(({ url }) => url === candidate.url) === index);
  const found = await findConnection(candidates);
  if (run !== detection) return;
  if (!found) {
    showStatus(`No devtools server answered on ${page.origin}. Tried:`, {
      tried: candidates.map(({ url }) => url),
    });
    return;
  }

  const pageId = await evalInPage(PAGE_ID);
  if (run === detection) loadPanel(new URL(found.base, page), pageId);
}

// The first candidate that answers with a connection file, or null.
async function findConnection(candidates) {
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, {
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      await response.json();
      return candidate;
    } catch {
      // Not mounted here; try the next one.
    }
  }
  return null;
}

function showStatus(message, { tried = [], allow = null, help = true } = {}) {
  frame.style.display = 'none';
  status.classList.remove('hidden');
  statusMessage.textContent = message;
  triedList.replaceChildren(
    ...tried.map((url) => Object.assign(document.createElement('li'), { textContent: url })),
  );
  triedList.hidden = !tried.length;
  allowButton.onclick = allow;
  allowButton.hidden = !allow;
  docsLink.hidden = !help;
}

function loadPanel(baseURL, pageId) {
  const src = new URL(chrome.runtime.getURL('ui/index.html'));
  src.searchParams.set('baseURL', baseURL.href);
  if (typeof pageId === 'string' && pageId) src.searchParams.set('pageId', pageId);
  frame.src = src.href;
  status.classList.add('hidden');
  frame.style.display = 'block';
}

chrome.devtools.panels.elements.onSelectionChanged.addListener(async () => {
  const id = await evalInPage('window.__ngDevtoolsComponentOf?.($0) ?? null');
  if (typeof id !== 'string') return;
  frame.contentWindow?.postMessage({ type: 'ng-devtools:inspect-component', id }, location.origin);
});

// Start detection after a short delay to let the page settle
setTimeout(detectConnection, 500);

chrome.devtools.network.onNavigated.addListener(() => {
  detection++;
  showStatus(DETECTING, { help: false });
  setTimeout(detectConnection, 1000);
});
