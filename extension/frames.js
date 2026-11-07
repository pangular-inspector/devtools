// Finds Angular in the inspected page: in the top frame, or else in one of its frames, such as a
// Storybook preview or a micro-frontend shell. devtools.js and panel-bridge.js both load it.

const PAGE_HAS_ANGULAR = `!!document.querySelector('[ng-version]') || typeof window.ng !== 'undefined'`;
// A page with more frames than this is not searched past them.
const MAX_FRAMES = 20;

// `inspectedWindow.eval` in the top frame, or in the frame at `frameURL`. The callback gets
// `(result, error)`, as Chrome gives them.
function evalInFrame(expression, frameURL, callback) {
  if (frameURL) chrome.devtools.inspectedWindow.eval(expression, { frameURL }, callback);
  else chrome.devtools.inspectedWindow.eval(expression, callback);
}

function hasAngular(frameURL) {
  return new Promise((resolve) =>
    evalInFrame(PAGE_HAS_ANGULAR, frameURL, (result, error) => resolve(!error && result === true)),
  );
}

function topURL() {
  return new Promise((resolve) =>
    evalInFrame('location.href', null, (result, error) =>
      resolve(!error && typeof result === 'string' ? result : null),
    ),
  );
}

// The http and https documents DevTools lists for the page, other than `top`: its frames.
function frameURLs(top) {
  return new Promise((resolve) => {
    try {
      chrome.devtools.inspectedWindow.getResources((resources) => {
        const documents = (resources ?? [])
          .filter((resource) => resource?.type === 'document' && typeof resource.url === 'string')
          .map((resource) => resource.url)
          .filter((url) => url !== top && /^https?:/.test(url));
        resolve([...new Set(documents)].slice(0, MAX_FRAMES));
      });
    } catch {
      resolve([]);
    }
  });
}

// Where Angular runs: `{ found: true, frameURL: null }` for the top frame, `{ found: true,
// frameURL }` for a frame, or `{ found: false }`. The top frame is asked first.
async function findAngularFrame() {
  if (await hasAngular(null)) return { found: true, frameURL: null };
  for (const url of await frameURLs(await topURL())) {
    if (await hasAngular(url)) return { found: true, frameURL: url };
  }
  return { found: false };
}
