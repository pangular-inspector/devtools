// The toolbar popup: what Pangular Inspector sees on the active tab. Clicking the toolbar
// button grants `activeTab`, which lets it read that one tab once, with no install warning.
// Loaded after connection-probe.js (connectionCandidates, findConnection).

const summary = document.getElementById('summary');
const facts = document.getElementById('facts');
const next = document.getElementById('next');
const fact = (name) => document.getElementById(`fact-${name}`);

// Runs in the page, in the app's own world, so it sees `window.ng`.
function readPage() {
  const root = document.querySelector('[ng-version]');
  const ng = window.ng;
  return {
    origin: location.origin,
    version: root ? root.getAttribute('ng-version') : null,
    angular: !!root || typeof ng !== 'undefined',
    devMode: !!ng && typeof ng.getComponent === 'function',
    overlay: typeof window.__pangularPageId === 'string',
  };
}

function show(name, text, tone) {
  const cell = fact(name);
  cell.textContent = text;
  if (tone) cell.dataset.tone = tone;
  else delete cell.dataset.tone;
}

function say(text) {
  if (summary.textContent !== text) summary.textContent = text;
}

async function serverAnswer(origin) {
  const { found, probes } = await findConnection(connectionCandidates(origin));
  if (found) return { text: `Answers at ${new URL(found.base, origin).href}`, tone: 'ok' };
  const refused = probes.find(({ status }) => status === 401 || status === 403);
  if (refused) return { text: `Refused the request (${refused.status})`, tone: 'warn' };
  return { text: 'No answer', tone: 'warn' };
}

async function inspectTab() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    tab = undefined;
  }
  if (!tab?.id || !/^https?:/.test(tab.url ?? '')) {
    say(
      'Open your Angular app in this tab, on an http or https address, then click the button again.',
    );
    return;
  }
  let page;
  try {
    const [answer] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: readPage,
    });
    page = answer?.result;
  } catch {
    page = undefined;
  }
  if (!page) {
    say("Couldn't read this tab. Reload it, then click the button again.");
    return;
  }

  facts.hidden = false;
  show(
    'angular',
    page.angular ? (page.version ?? 'Found') : 'Not found',
    page.angular ? 'ok' : 'warn',
  );
  show(
    'build',
    !page.angular ? 'Not known' : page.devMode ? 'Development' : 'Production',
    page.devMode ? 'ok' : page.angular ? 'warn' : undefined,
  );
  show('overlay', page.overlay ? 'Connected' : 'Not loaded', page.overlay ? 'ok' : 'warn');
  show('server', 'Looking…');
  say(page.angular ? 'Angular found on this tab.' : 'No Angular app found on this tab.');

  const server = await serverAnswer(page.origin);
  show('server', server.text, server.tone);

  next.hidden = false;
  if (!page.angular) {
    next.textContent =
      'If the app is inside a frame, open Chrome DevTools: the panel looks in the frames too.';
  } else if (!page.devMode) {
    next.textContent =
      'This is a production build. Pangular Inspector reads Angular through its development debug API, so run a development build.';
  } else if (server.tone !== 'ok') {
    next.textContent =
      'Mount the devtools in your dev server (the Vite plugin, the Express hub or pangular dev), then reload the page.';
  } else {
    next.textContent = 'Open Chrome DevTools and pick the Pangular Inspector tab.';
  }
}

document.getElementById('site-access').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

inspectTab();
