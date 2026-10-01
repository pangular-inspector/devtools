const tabId = chrome.devtools.inspectedWindow.tabId;
const PAGE_HAS_ANGULAR = `!!document.querySelector('[ng-version]') || typeof window.ng !== 'undefined'`;
const PAGE_CHECKS = 10;
const PAGE_CHECK_MS = 500;

let panelCreated = false;
let pageCheck;

// The worker forgets its tabs when Chrome stops it, so the page is asked directly as well.
chrome.runtime.sendMessage({ type: 'is-angular-page', tabId }, (response) => {
  void chrome.runtime.lastError;
  if (response?.isAngular) createPanel();
  else checkPage();
});

// Also listen for late detection (SPA navigation after devtools open)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'angular-detected' && message.tabId === tabId) {
    createPanel();
  }
});

chrome.devtools.network.onNavigated.addListener(() => checkPage());

function checkPage(remaining = PAGE_CHECKS) {
  clearTimeout(pageCheck);
  if (panelCreated) return;
  chrome.devtools.inspectedWindow.eval(PAGE_HAS_ANGULAR, (result, error) => {
    if (!error && result === true) createPanel();
    else if (remaining > 1) pageCheck = setTimeout(() => checkPage(remaining - 1), PAGE_CHECK_MS);
  });
}

function createPanel() {
  if (panelCreated) return;
  panelCreated = true;
  clearTimeout(pageCheck);

  chrome.devtools.panels.create('Angular DevTools', 'icons/icon-128.png', 'panel.html');
}
