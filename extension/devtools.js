const PAGE_HAS_ANGULAR = `!!document.querySelector('[ng-version]') || typeof window.ng !== 'undefined'`;
const PAGE_CHECKS = 10;
const PAGE_CHECK_MS = 500;

let panelCreated = false;
let pageCheck;

// No content script runs in the page, so the inspected page is asked directly.
// `inspectedWindow.eval` needs no host permission and runs only while DevTools is open.
checkPage();

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

  chrome.devtools.panels.create('Pangular Inspector', 'icons/icon-128.png', 'panel.html');
}
