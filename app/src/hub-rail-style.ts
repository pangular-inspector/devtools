function activeDockStyle(theme: 'dark' | 'light'): string {
  const bg = theme === 'light' ? '#ffffff' : '#0b0b0e';
  const accent = theme === 'light' ? '#92400e' : '#f5a524';
  const accentSoft = theme === 'light' ? 'rgba(146, 64, 14, 0.12)' : 'rgba(245, 165, 36, 0.16)';
  const accentGlow = theme === 'light' ? 'rgba(146, 64, 14, 0.50)' : 'rgba(245, 165, 36, 0.60)';
  return `
  .devframes-dock-entry button {
    transition: background-color 0.2s, transform 0.3s;
  }
  /* Dim the icon of an inactive dock, never its badge, so the count keeps
     its contrast. hub-ui's own dim classes would fade the whole button. */
  .devframes-dock-entry button.op50,
  .devframes-dock-entry button.saturate-0 {
    opacity: 1;
    filter: none;
  }
  .devframes-dock-entry button > * {
    transition: opacity 0.2s, filter 0.2s;
  }
  .devframes-dock-entry button:not(.scale-120) > :not(.absolute) {
    opacity: 0.45;
    filter: saturate(0);
  }
  .devframes-dock-entry button:not(.scale-120):hover > :not(.absolute),
  .devframes-dock-entry button:not(.scale-120):focus-visible > :not(.absolute) {
    opacity: 1;
    filter: none;
  }
  /* hub-ui's badge palette (blue-500 and red-500 on a pale tint) is below
     4.5:1, and it sets the colors inline, hence the attribute selectors and
     !important. blue-600 and red-600 with white text pass. */
  .devframes-dock-entry .absolute[style*="59, 130, 246"] {
    background-color: #2563eb !important;
    color: #ffffff !important;
  }
  .devframes-dock-entry .absolute[style*="239, 68, 68"] {
    background-color: #dc2626 !important;
    color: #ffffff !important;
  }
  .devframes-dock-entry button:focus-visible {
    outline: 2px solid ${accent};
    outline-offset: 2px;
  }
  .devframes-dock-entry button.scale-120 {
    transform: none;
    background: ${accentSoft};
    box-shadow: inset 0 0 0 1px ${accentGlow};
  }
  iframe {
    background: ${bg};
    color-scheme: ${theme};
  }
  @media (prefers-reduced-motion: reduce) {
    .devframes-dock-entry button,
    .devframes-dock-entry button > * {
      transition: none;
    }
  }
`;
}

const pendingRetries = new Map<Document, ReturnType<typeof setTimeout>>();

export function styleHubRail(
  doc: Document | null | undefined,
  theme: 'dark' | 'light' = 'dark',
  attempts = 50,
): void {
  const root = doc?.querySelector('devframes-dock-standalone')?.shadowRoot;
  if (root) {
    if (doc) {
      const existing = pendingRetries.get(doc);
      if (existing !== undefined) {
        clearTimeout(existing);
        pendingRetries.delete(doc);
      }
    }
    let style = root.querySelector<HTMLStyleElement>('style[data-pangular]');
    if (!style) {
      style = doc!.createElement('style');
      style.dataset['pangular'] = '';
      root.append(style);
    }
    style.textContent = activeDockStyle(theme);
    return;
  }
  if (attempts > 0 && doc) {
    const existing = pendingRetries.get(doc);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      pendingRetries.delete(doc);
      styleHubRail(doc, theme, attempts - 1);
    }, 100);
    pendingRetries.set(doc, timer);
  }
}
