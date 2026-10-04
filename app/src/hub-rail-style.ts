function activeDockStyle(theme: 'dark' | 'light'): string {
  const bg = theme === 'light' ? '#ffffff' : '#0b0b0e';
  const accent = theme === 'light' ? '#92400e' : '#f5a524';
  const accentSoft = theme === 'light' ? 'rgba(146, 64, 14, 0.12)' : 'rgba(245, 165, 36, 0.16)';
  const accentGlow = theme === 'light' ? 'rgba(146, 64, 14, 0.50)' : 'rgba(245, 165, 36, 0.60)';
  return `
  .devframes-dock-entry button {
    transition: opacity 0.2s, filter 0.2s, background-color 0.2s, transform 0.3s;
  }
  .devframes-dock-entry button:not(.scale-120) {
    opacity: 0.45;
    filter: saturate(0);
  }
  .devframes-dock-entry button:not(.scale-120):hover,
  .devframes-dock-entry button:not(.scale-120):focus-visible {
    opacity: 1;
    filter: none;
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
    .devframes-dock-entry button {
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
