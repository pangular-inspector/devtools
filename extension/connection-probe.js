// Finds the devframe connection file on a page's origin. The panel (panel-bridge.js) and the
// toolbar popup (popup.js) both load it.

// Where devframe may be mounted.
const PATHS = ['/__pangular/', '/__devframes/pangular/', '/__devframe/', '/'];
const CONNECTION_FILES = ['__devframe/__connection.json', '__connection.json'];
const PROBE_TIMEOUT_MS = 1500;
// The first path gets this long on its own before the rest are sent.
const PROBE_HEAD_START_MS = 150;
const REFUSED_TEXT_LIMIT = 200;

// Each place the connection file may be on the page's origin, in PATHS order, without repeats.
function connectionCandidates(page) {
  return PATHS.flatMap((base) =>
    CONNECTION_FILES.map((file) => ({ base, url: new URL(base + file, page).href })),
  ).filter((candidate, index, all) => all.findIndex(({ url }) => url === candidate.url) === index);
}

// The first candidate, in PATHS order, that answers with a connection file, and the
// status of each probe. The first candidate gets a short head start; then the rest run at
// once, so a missing server costs one timeout. Probes still running once a winner is
// known are aborted.
async function findConnection(candidates) {
  const probes = candidates.map((candidate) => ({ url: candidate.url, status: null, text: '' }));
  const losers = new AbortController();
  const answers = [probe(candidates[0], probes[0], losers.signal)];
  const headStart = await Promise.race([
    answers[0],
    new Promise((resolve) => setTimeout(() => resolve(null), PROBE_HEAD_START_MS)),
  ]);
  if (headStart) return { found: candidates[0], probes: probes.slice(0, 1) };
  for (let index = 1; index < candidates.length; index++) {
    answers.push(probe(candidates[index], probes[index], losers.signal));
  }
  try {
    for (const [index, answer] of answers.entries()) {
      if (await answer) {
        return { found: candidates[index], probes: probes.slice(0, index + 1) };
      }
    }
    return { found: null, probes };
  } finally {
    losers.abort();
  }
}

// Whether `candidate` answers with a connection file; records its status in `result`.
async function probe(candidate, result, cancel) {
  try {
    const response = await fetch(candidate.url, {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([cancel, AbortSignal.timeout(PROBE_TIMEOUT_MS)]),
    });
    result.status = response.status;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        result.text = (await response.text()).trim().slice(0, REFUSED_TEXT_LIMIT);
      }
      return false;
    }
    await response.json();
    return true;
  } catch {
    // Not mounted here.
    return false;
  }
}
