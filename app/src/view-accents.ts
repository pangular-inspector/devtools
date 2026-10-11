// Brand colors for the hub views that are not plain Angular. `accent` replaces
// `--accent` on that view; `text` replaces `--accent-text`, the color for text on
// an accent tint (pills, badges), chosen to keep 4.5:1 on hovered and selected rows.
export type BrandView = 'ngrx' | 'analog' | 'angular-native' | 'nativescript' | 'capacitor';

export interface ViewAccent {
  accent: string;
  text: string;
}

export const VIEW_ACCENTS: Record<'dark' | 'light', Record<BrandView, ViewAccent>> = {
  dark: {
    ngrx: { accent: '#d770e8', text: '#f0abfc' },
    analog: { accent: '#ff5470', text: '#fda4af' },
    'angular-native': { accent: '#ff4d6d', text: '#fda4af' },
    nativescript: { accent: '#8196ff', text: '#a5b4fc' },
    capacitor: { accent: '#53b9ff', text: '#7dd3fc' },
  },
  light: {
    ngrx: { accent: '#a21caf', text: '#701a75' },
    analog: { accent: '#be123c', text: '#881337' },
    'angular-native': { accent: '#be123c', text: '#881337' },
    nativescript: { accent: '#3448c5', text: '#3730a3' },
    capacitor: { accent: '#0369a1', text: '#0c4a6e' },
  },
};

export function viewAccent(view: string | null, theme: 'dark' | 'light'): ViewAccent | null {
  const accents: Partial<Record<string, ViewAccent>> = VIEW_ACCENTS[theme];
  return (view && accents[view]) || null;
}
