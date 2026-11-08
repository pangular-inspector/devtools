/** The docs on finding the server, linked when the popup finds none. */
export const TROUBLESHOOTING_URL =
  'https://pangular-inspector.dev/getting-started/troubleshooting/#no-devtools-server-found';

/** A link that opens `href` in a new tab and says so to screen readers. */
export function newTabLink(href: string, text: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  const newTab = document.createElement('span');
  newTab.classList.add('sr-only');
  newTab.textContent = ' (opens in a new tab)';
  link.append(newTab);
  return link;
}
