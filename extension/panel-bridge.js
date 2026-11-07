// Bridge between the Chrome DevTools panel and the inspected Angular page.
// Finds the devframe connection, then loads the SPA scoped to the inspected page.
// Loaded after connection-probe.js (findConnection) and frames.js (findAngularFrame).

const frame = document.getElementById('devtools-frame');
const status = document.getElementById('status');
const statusMessage = document.getElementById('status-message');
const triedList = document.getElementById('status-tried');
const allowButton = document.getElementById('status-allow');
const retryButton = document.getElementById('status-retry');
const docsLink = document.getElementById('status-docs');
const docsLabel = docsLink.firstChild;
const SETUP_DOCS = { href: docsLink.href, text: docsLabel.textContent };
const REFUSED_DOCS = {
  href: 'https://pangular-inspector.dev/getting-started/vite/#answers-only-your-machine',
  text: 'Why the devtools server refuses requests',
};

// Keep in step with PANGULAR_EXTENSION_IDS in packages/devtools/src/extension-origin.ts.
const PINNED_ORIGINS = ['chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk'];
const PAGE_ID_WAIT_MS = 5000;
const PAGE_ID_POLL_MS = 250;
const OPEN_RESOURCE_TIMEOUT_MS = 3000;
// A page that just navigated has no execution context for a moment, so reading
// it fails; it is read again, like devtools.js checks for Angular.
const PAGE_READS = 10;
const PAGE_READ_RETRY_MS = 300;
// A page blocked by a dialog, such as the overlay's prompt for the one-time
// code, never answers until the dialog closes.
const EVAL_TIMEOUT_MS = 2000;
// How long the search for Angular in the page's frames may take before the top frame is used.
const FRAME_SEARCH_MS = 3000;
const BUSY_RETRY_MS = 2000;
// While no server answers, or it refuses, the panel looks again on its own, so it
// connects once the dev server starts, like the panel does.
const SERVER_RETRY_MS = 5000;
const DETECTING = 'Detecting Angular app…';
const BUSY =
  'The inspected page is not answering. If it shows a prompt for the one-time code, enter the code from the terminal of the dev server there, or close the prompt. The panel keeps checking.';
const UNREADABLE = "Couldn't read the inspected page. Reload it, then try again.";
const PAGE_ID = `typeof window.__pangularPageId === 'string' ? window.__pangularPageId : null`;
const STORED_PAGE_ID = `(() => {
  try {
    return sessionStorage.getItem('pangular-page-id');
  } catch {
    return null;
  }
})()`;

let detection = 0;
// The frame Angular runs in, when it is not the top frame: every read of the page goes there,
// and the server is searched on its origin.
let frameURL = null;
let busyRetry;
let serverRetry;
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

// `{ok, value}`, or `{ok: false, reason}` when the page threw or had no
// execution context ('error'), or did not answer in time ('timeout').
function evalPage(expression, timeoutMs = EVAL_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs);
    evalInFrame(expression, frameURL, (result, error) => {
      clearTimeout(timer);
      resolve(error ? { ok: false, reason: 'error' } : { ok: true, value: result });
    });
  });
}

function evalInPage(expression) {
  return evalPage(expression).then((answer) => (answer.ok ? answer.value : null));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The page's origin, read again while the page has no execution context yet.
async function readPageOrigin(run) {
  for (let read = 1; ; read++) {
    const answer = await evalPage('location.origin');
    if (run !== detection || answer.ok || answer.reason === 'timeout' || read >= PAGE_READS) {
      return answer;
    }
    await wait(PAGE_READ_RETRY_MS);
    if (run !== detection) return answer;
  }
}

function toURL(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

async function detectConnection({ quiet = false } = {}) {
  const run = ++detection;
  clearTimeout(busyRetry);
  clearTimeout(serverRetry);
  frameURL = null;
  if (!quiet) showStatus(DETECTING, { help: false });
  const answer = await readPageOrigin(run);
  if (run !== detection) return;
  if (!answer.ok) {
    if (answer.reason === 'timeout') {
      showStatus(BUSY, { retry: true, help: false });
      busyRetry = setTimeout(() => {
        if (run === detection) detectConnection({ quiet: true });
      }, BUSY_RETRY_MS);
    } else {
      showStatus(UNREADABLE, { retry: true, help: false });
    }
    return;
  }
  // An app in a frame (Storybook, a micro-frontend shell) is read in that frame, and its
  // server is searched on the frame's origin.
  const angular = await Promise.race([
    findAngularFrame(),
    wait(FRAME_SEARCH_MS).then(() => ({ found: false })),
  ]);
  if (run !== detection) return;
  if (angular.found && angular.frameURL) frameURL = angular.frameURL;
  const page = toURL(frameURL ?? answer.value);
  if (!page || !['http:', 'https:'].includes(page.protocol)) {
    showStatus('Pangular Inspector connects to pages served over http or https.', {
      retry: true,
    });
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
      retry: true,
    });
    return;
  }

  const { found, probes } = await findConnection(connectionCandidates(page));
  if (run !== detection) return;
  if (!found) {
    const refused = probes.find(({ status }) => status === 401 || status === 403);
    const tried = probes.map(({ url, status }) => `${url} (${status ?? 'no answer'})`);
    if (refused) {
      const reason = refused.text ? ` It said: "${refused.text}"` : '';
      const extension = chrome.runtime.getURL('').replace(/\/$/, '');
      const hint =
        refused.status === 403 && !PINNED_ORIGINS.includes(extension)
          ? ` If the page runs on this machine, add ${extension} to allowedOrigins to trust this extension. That does not change the rule that the server only answers this machine.`
          : '';
      showStatus(
        `The devtools server on ${page.origin} refused the request (${refused.status}).${reason}${hint} Tried:`,
        { tried, retry: true, docs: REFUSED_DOCS },
      );
    } else {
      showStatus(`No devtools server answered on ${page.origin}. Tried:`, { tried, retry: true });
    }
    serverRetry = setTimeout(() => {
      if (run === detection) detectConnection({ quiet: true });
    }, SERVER_RETRY_MS);
    return;
  }

  const pageId = await waitForPageId(run);
  if (run === detection) loadPanel(new URL(found.base, page), pageId);
}

// The overlay sets the id once it claims it, which can be well after the app renders.
// A page blocked by a dialog doesn't count toward the wait: its overlay claims the id
// once the dialog closes.
async function waitForPageId(run) {
  let deadline = Date.now() + PAGE_ID_WAIT_MS;
  let busy = false;
  for (;;) {
    const answer = await evalPage(PAGE_ID);
    if (run !== detection) return null;
    if (answer.ok && typeof answer.value === 'string' && answer.value) return answer.value;
    if (!answer.ok && answer.reason === 'timeout') {
      if (!busy) showStatus(BUSY, { retry: true, help: false });
      busy = true;
      deadline = Date.now() + PAGE_ID_WAIT_MS;
      continue;
    }
    if (busy) showStatus(DETECTING, { help: false });
    busy = false;
    if (Date.now() >= deadline) return evalInPage(STORED_PAGE_ID);
    await wait(PAGE_ID_POLL_MS);
  }
}

function showStatus(
  message,
  { tried = [], allow = null, retry = false, docs = SETUP_DOCS, help = true } = {},
) {
  frame.style.display = 'none';
  status.classList.remove('hidden');
  // Only the message is a live region. Setting the same text again would make
  // screen readers repeat it on every quiet retry.
  if (statusMessage.textContent !== message) statusMessage.textContent = message;
  triedList.replaceChildren(
    ...tried.map((url) => Object.assign(document.createElement('li'), { textContent: url })),
  );
  triedList.hidden = !tried.length;
  allowButton.onclick = allow;
  allowButton.hidden = !allow;
  retryButton.hidden = !retry;
  docsLink.href = docs.href;
  docsLabel.textContent = docs.text;
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

detectConnection();

chrome.devtools.network.onNavigated.addListener(() => detectConnection());
