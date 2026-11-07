// Loaded after frames.js, which finds Angular in the page or in one of its frames.
const PAGE_CHECKS = 10;
const PAGE_CHECK_MS = 500;
const SIDEBAR_TITLE = 'Angular component';

// What the Elements sidebar shows for the selected element. The overlay answers with the
// component that owns it, masked like everything else it sends.
const SELECTED_COMPONENT = `(() => {
  const read = window.__pangularComponentDetail;
  if (typeof read !== 'function') {
    return { note: 'Pangular Inspector is not connected on this page. Load the overlay in a development build to see the selected component here.' };
  }
  return read($0) ?? { note: 'No Angular component owns the selected element.' };
})()`;

let panelCreated = false;
let pageCheck;
let checking = 0;

// No content script runs in the page, so the inspected page is asked directly.
// `inspectedWindow.eval` needs no host permission and runs only while DevTools is open.
checkPage();

chrome.devtools.network.onNavigated.addListener(() => checkPage());

async function checkPage(remaining = PAGE_CHECKS) {
  clearTimeout(pageCheck);
  if (panelCreated) return;
  const run = ++checking;
  const { found } = await findAngularFrame();
  if (run !== checking || panelCreated) return;
  if (found) createPanel();
  else if (remaining > 1) pageCheck = setTimeout(() => checkPage(remaining - 1), PAGE_CHECK_MS);
}

function createPanel() {
  if (panelCreated) return;
  panelCreated = true;
  clearTimeout(pageCheck);

  chrome.devtools.panels.create('Pangular Inspector', 'icons/icon-128.png', 'panel.html');
  createSidebar();
}

// A pane next to Styles in the Elements panel with the component of the selected element.
function createSidebar() {
  const elements = chrome.devtools.panels.elements;
  if (typeof elements?.createSidebarPane !== 'function') return;
  elements.createSidebarPane(SIDEBAR_TITLE, (pane) => {
    const show = () => pane.setExpression(SELECTED_COMPONENT, SIDEBAR_TITLE);
    show();
    elements.onSelectionChanged.addListener(show);
  });
}
