import { colorDistance, ensureContrast, fromOklch, isHexColor, readableTextOn, shiftLightness, toOklch } from './color';

/** Couleurs choisies par l'organisation ; tout le reste de la palette en est dérivé. */
export interface Appearance {
  accent: string;
  background: string;
  clean: string;
  dirty: string;
}

export const defaultAppearance: Appearance = { accent: '#ab1e25', background: '#08090a', clean: '#3987e5', dirty: '#d95926' };

export const appearancePresets: Array<{ id: string; label: string; appearance: Appearance }> = [
  { id: 'madrazo', label: 'Madrazo', appearance: defaultAppearance },
  { id: 'cartel', label: 'Cartel doré', appearance: { accent: '#b8860b', background: '#0b0906', clean: '#3987e5', dirty: '#d95926' } },
  { id: 'emeraude', label: 'Émeraude', appearance: { accent: '#0f8a5f', background: '#060d0a', clean: '#3987e5', dirty: '#d95926' } },
  { id: 'nuit', label: 'Nuit bleue', appearance: { accent: '#2563eb', background: '#070a12', clean: '#1baf7a', dirty: '#d95926' } },
  { id: 'violet', label: 'Violet', appearance: { accent: '#7c3aed', background: '#0a0710', clean: '#3987e5', dirty: '#d95926' } },
  { id: 'neon', label: 'Néon rose', appearance: { accent: '#db2777', background: '#0d070a', clean: '#3987e5', dirty: '#eda100' } },
];

export interface Palette {
  ink: { 950: string; 900: string; 850: string; 800: string };
  accent: { 300: string; 400: string; 500: string; 600: string; 700: string; 900: string };
  onAccent: string;
  fund: { clean: string; dirty: string };
  chart: { grid: string; axis: string; text: string; muted: string; tooltip: string; tooltipBorder: string };
}

// Palette d'origine du site, reprise telle quelle avec les couleurs par défaut.
const originalInk = { 950: '#08090a', 900: '#0d0f11', 850: '#121518', 800: '#171a1e' };
const originalAccent = { 300: '#ef7a80', 400: '#e14a51', 500: '#c52a32', 600: '#ab1e25', 700: '#8d151b', 900: '#4a0b0e' };

/** Valide une apparence reçue (API, stockage local) en retombant sur les couleurs d'origine. */
export function sanitizeAppearance(value: unknown): Appearance {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const pick = (key: keyof Appearance) => (isHexColor(source[key]) ? String(source[key]).trim().toLowerCase().replace(/^([0-9a-f])/, '#$1') : defaultAppearance[key]);
  return { accent: pick('accent'), background: pick('background'), clean: pick('clean'), dirty: pick('dirty') };
}

/**
 * Le fond garde la teinte choisie mais reste toujours sombre : les textes clairs du site
 * restent lisibles quelle que soit la couleur demandée.
 */
function inkFrom(background: string): Palette['ink'] {
  if (background === defaultAppearance.background) return originalInk;
  const { c, h } = toOklch(background);
  const chroma = Math.min(c, 0.035);
  const [ink950, ink900, ink850, ink800] = [0.135, 0.163, 0.187, 0.211].map((l) => fromOklch({ l, c: chroma, h })) as [string, string, string, string];
  return { 950: ink950, 900: ink900, 850: ink850, 800: ink800 };
}

/** Nuances de la couleur principale, avec contraste vérifié pour les textes et les boutons. */
function accentFrom(accent: string, ink: Palette['ink']): Palette['accent'] {
  if (accent === defaultAppearance.accent && ink === originalInk) return originalAccent;
  const base = ensureContrast(accent, ink[950], 2.2);
  return {
    300: ensureContrast(shiftLightness(base, 0.2), ink[850], 4.5),
    400: ensureContrast(shiftLightness(base, 0.12), ink[850], 4.5),
    500: shiftLightness(base, 0.06),
    600: base,
    700: shiftLightness(base, -0.08, 0.95),
    900: shiftLightness(base, -0.2, 0.8),
  };
}

export function resolvePalette(appearance: Partial<Appearance> | null | undefined): Palette {
  const chosen = sanitizeAppearance(appearance);
  const ink = inkFrom(chosen.background);
  const accent = accentFrom(chosen.accent, ink);
  return {
    ink,
    accent,
    onAccent: readableTextOn(accent[600]),
    // Les couleurs des graphiques doivent rester visibles sur les panneaux (contraste ≥ 3:1).
    fund: { clean: ensureContrast(chosen.clean, ink[850], 3), dirty: ensureContrast(chosen.dirty, ink[850], 3) },
    chart: { grid: 'rgba(255,255,255,.045)', axis: '#52525b', text: '#e4e4e7', muted: '#a1a1aa', tooltip: ink[850], tooltipBorder: 'rgba(255,255,255,.09)' },
  };
}

/** Applique la palette aux variables CSS : toutes les classes du site suivent immédiatement. */
export function applyPalette(palette: Palette, root: HTMLElement = document.documentElement): void {
  for (const [step, value] of Object.entries(palette.ink)) root.style.setProperty(`--color-ink-${step}`, value);
  for (const [step, value] of Object.entries(palette.accent)) root.style.setProperty(`--color-blood-${step}`, value);
  root.style.setProperty('--color-on-accent', palette.onAccent);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.ink[950]);
}

/** Avertit quand les couleurs des deux caisses sont trop proches pour être distinguées (écart perçu < 15). */
export function fundColorsTooClose(palette: Palette): boolean {
  return colorDistance(palette.fund.clean, palette.fund.dirty) < 15;
}

const storageKey = 'madrazo.apparence';

/** Dernière apparence vue sur cet appareil, pour colorer la page de connexion avant identification. */
export function readCachedAppearance(): Appearance | null {
  try { const raw = window.localStorage.getItem(storageKey); return raw ? sanitizeAppearance(JSON.parse(raw)) : null; }
  catch { return null; }
}

export function cacheAppearance(appearance: Appearance): void {
  try { window.localStorage.setItem(storageKey, JSON.stringify(appearance)); } catch { /* stockage indisponible : sans effet */ }
}
