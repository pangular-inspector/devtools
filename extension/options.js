// The site access page: the hosts the user allowed from the panel, outside the loopback hosts
// the manifest grants on install, each with a Remove button.

const list = document.getElementById('hosts');
const empty = document.getElementById('empty');
const status = document.getElementById('status');
// Granted on install and not removable, so they are not listed.
const INSTALLED = new Set(chrome.runtime.getManifest().host_permissions ?? []);

// `https://example.com/*` reads as `https://example.com`.
function siteOf(pattern) {
  return pattern.replace(/\/\*$/, '');
}

function say(text) {
  // The same text again would not be announced, so it gets a no-break space.
  status.textContent = status.textContent === text ? `${text} ` : text;
}

async function granted() {
  try {
    const { origins = [] } = await chrome.permissions.getAll();
    return origins.filter((origin) => !INSTALLED.has(origin)).sort();
  } catch {
    return [];
  }
}

async function render(focusIndex = -1) {
  const origins = await granted();
  list.replaceChildren(
    ...origins.map((origin) => {
      const item = document.createElement('li');
      const name = document.createElement('code');
      name.textContent = siteOf(origin);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove access to ${siteOf(origin)}`);
      remove.addEventListener('click', () => removeAccess(origin, origins.indexOf(origin)));
      item.append(name, remove);
      return item;
    }),
  );
  list.hidden = !origins.length;
  empty.hidden = !!origins.length;
  if (focusIndex >= 0) {
    const buttons = list.querySelectorAll('button');
    const target = buttons[Math.min(focusIndex, buttons.length - 1)];
    // With the last one gone, focus goes to the message that says so.
    (target ?? empty).focus();
  }
}

async function removeAccess(origin, index) {
  let removed = false;
  try {
    removed = await chrome.permissions.remove({ origins: [origin] });
  } catch {
    removed = false;
  }
  say(
    removed
      ? `Removed access to ${siteOf(origin)}.`
      : `Couldn't remove access to ${siteOf(origin)}. Remove it in Chrome's site settings.`,
  );
  await render(index);
}

render();
