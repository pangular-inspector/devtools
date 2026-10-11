// Bridge between the Chrome DevTools panel and the inspected Angular page.
// Finds the devframe connection, then loads the SPA scoped to the inspected page.

const frame = document.getElementById('devtools-frame');
const status = document.getElementById('status');
const statusMessage = document.getElementById('status-message');
const triedList = document.getElementById('status-tried');
const allowButton = document.getElementById('status-allow');
const retryButton = document.getElementById('status-retry');
const docsLink = document.getElementById('status-docs');
const SETUP_DOCS = { href: docsLink.href, text: docsLink.textContent };
const REFUSED_DOCS = {
  href: 'https://github.com/pangular-inspector/devtools/blob/main/apps/docs/src/content/getting-started/vite.md#answers-only-your-machine',
  text: 'Why the devtools server refuses requests',
};

// Where devframe may be mounted.
const PATHS = ['/__pangular/', '/__devframes/pangular/', '/__devframe/', '/'];
const CONNECTION_FILES = ['__devframe/__connection.json', '__connection.json'];
const PROBE_TIMEOUT_MS = 1500;
const PINNED_ORIGIN = 'chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk';
const REFUSED_TEXT_LIMIT = 200;
const PAGE_ID_WAIT_MS = 5000;
const PAGE_ID_POLL_MS = 250;
const OPEN_RESOURCE_TIMEOUT_MS = 3000;
const DETECTING = 'Detecting Angular app…';
const PAGE_ID = `typeof window.__pangularPageId === 'string' ? window.__pangularPageId : null`;
const STORED_PAGE_ID = `(() => {
  try {
    return sessionStorage.getItem('pangular-page-id');
  } catch {
    return null;
  }
})()`;

let detection = 0;
let themeName = chrome.devtools.panels.themeName || 'dark';

function applyTheme(name) {
  themeName = name;
  document.documentElement.dataset.theme = name === 'dark' ? 'dark' : 'light';
}

applyTheme(themeName);
chrome.devtools.panels.setThemeChangeHandler?.((name) => {
  applyTheme(name);
  frame.contentWindow?.postMessage(
    { type: 'pangular:theme-change', theme: name },
    chrome.runtime.getURL(''),
  );
});

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
    showStatus('Pangular Inspector connects to pages served over http or https.');
    return;
  }

  // Loopback hosts are granted on install; the user opts in to any other host.
  const access = { origins: [`${page.protocol}//${page.hostname}/*`] };
  const granted = await chrome.permissions.contains(access);
  if (run !== detection) return;
  if (!granted) {
    showStatus(`Allow Pangular Inspector to reach the devtools server on ${page.host}.`, {
      allow: async () => {
        if (await chrome.permissions.request(access)) detectConnection();
      },
    });
    return;
  }

  const candidates = PATHS.flatMap((base) =>
    CONNECTION_FILES.map((file) => ({ base, url: new URL(base + file, page).href })),
  ).filter((candidate, index, all) => all.findIndex(({ url }) => url === candidate.url) === index);
  const { found, probes } = await findConnection(candidates);
  if (run !== detection) return;
  if (!found) {
    const refused = probes.find(({ status }) => status === 401 || status === 403);
    const tried = probes.map(({ url, status }) => `${url} (${status ?? 'no answer'})`);
    if (refused) {
      const reason = refused.text ? ` It said: "${refused.text}"` : '';
      const extension = chrome.runtime.getURL('').replace(/\/$/, '');
      const hint =
        refused.status === 403 && extension !== PINNED_ORIGIN
          ? ` If the page runs on this machine, add ${extension} to allowedOrigins to trust this extension. That does not change the rule that the server only answers this machine.`
          : '';
      showStatus(
        `The devtools server on ${page.origin} refused the request (${refused.status}).${reason}${hint} Tried:`,
        { tried, retry: true, docs: REFUSED_DOCS },
      );
    } else {
      showStatus(`No devtools server answered on ${page.origin}. Tried:`, { tried, retry: true });
    }
    return;
  }

  const pageId = await waitForPageId(run);
  if (run === detection) loadPanel(new URL(found.base, page), pageId);
}

// The overlay sets the id once it claims it, which can be well after the app renders.
async function waitForPageId(run) {
  for (let waited = 0; ; waited += PAGE_ID_POLL_MS) {
    const id = await evalInPage(PAGE_ID);
    if (run !== detection) return null;
    if (typeof id === 'string' && id) return id;
    if (waited >= PAGE_ID_WAIT_MS) return evalInPage(STORED_PAGE_ID);
    await new Promise((resolve) => setTimeout(resolve, PAGE_ID_POLL_MS));
  }
}

// The first candidate that answers with a connection file, and the status of each probe.
async function findConnection(candidates) {
  const probes = [];
  for (const candidate of candidates) {
    const probe = { url: candidate.url, status: null, text: '' };
    probes.push(probe);
    try {
      const response = await fetch(candidate.url, {
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      probe.status = response.status;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          probe.text = (await response.text()).trim().slice(0, REFUSED_TEXT_LIMIT);
        }
        continue;
      }
      await response.json();
      return { found: candidate, probes };
    } catch {
      // Not mounted here; try the next one.
    }
  }
  return { found: null, probes };
}

function showStatus(
  message,
  { tried = [], allow = null, retry = false, docs = SETUP_DOCS, help = true } = {},
) {
  frame.style.display = 'none';
  status.classList.remove('hidden');
  statusMessage.textContent = message;
  triedList.replaceChildren(
    ...tried.map((url) => Object.assign(document.createElement('li'), { textContent: url })),
  );
  triedList.hidden = !tried.length;
  allowButton.onclick = allow;
  allowButton.hidden = !allow;
  retryButton.hidden = !retry;
  docsLink.href = docs.href;
  docsLink.textContent = docs.text;
  docsLink.hidden = !help;
}

retryButton.addEventListener('click', () => detectConnection());

function loadPanel(baseURL, pageId) {
  const src = new URL(chrome.runtime.getURL('ui/index.html'));
  src.searchParams.set('baseURL', baseURL.href);
  if (typeof pageId === 'string' && pageId) src.searchParams.set('pageId', pageId);
  src.searchParams.set('theme', themeName);
  frame.src = src.href;
  status.classList.add('hidden');
  frame.style.display = 'block';
}

chrome.devtools.panels.elements.onSelectionChanged.addListener(async () => {
  const id = await evalInPage('window.__pangularComponentOf?.($0) ?? null');
  if (typeof id !== 'string') return;
  frame.contentWindow?.postMessage({ type: 'pangular:inspect-component', id }, location.origin);
});

const handlePanelAction = createPanelActions({
  evalInPage,
  getResources: () =>
    new Promise((resolve) => chrome.devtools.inspectedWindow.getResources(resolve)),
  openResource: (url, line) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), OPEN_RESOURCE_TIMEOUT_MS);
      chrome.devtools.panels.openResource(url, line, (response) => {
        clearTimeout(timer);
        resolve(!response?.isError);
      });
    }),
});

window.addEventListener('message', async (event) => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  const reply = await handlePanelAction(event.data);
  if (reply) frame.contentWindow?.postMessage(reply, location.origin);
});

// Start detection after a short delay to let the page settle
setTimeout(detectConnection, 500);

chrome.devtools.network.onNavigated.addListener(() => {
  detection++;
  showStatus(DETECTING, { help: false });
  setTimeout(detectConnection, 1000);
});
