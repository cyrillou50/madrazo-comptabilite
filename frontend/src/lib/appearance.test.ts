import { describe, expect, it } from 'vitest';
import { applyPalette, defaultAppearance, fundColorsTooClose, resolvePalette, sanitizeAppearance } from './appearance';
import { contrast, ensureContrast, fromOklch, readableTextOn, toOklch } from './color';

const SITE_TEXT = '#f4f4f5';

describe('calculs de couleur', () => {
  it('mesure le contraste comme la norme WCAG', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#ab1e25', '#ab1e25')).toBe(1);
  });

  it('retrouve la même couleur après conversion OKLCH', () => {
    for (const hex of ['#ab1e25', '#3987e5', '#d95926', '#08090a']) expect(fromOklch(toOklch(hex))).toBe(hex);
  });

  it('éclaircit une couleur trop sombre jusqu’au contraste demandé, et laisse intacte une couleur lisible', () => {
    expect(contrast(ensureContrast('#1a0033', '#121518', 4.5), '#121518')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#E14A51', '#121518', 3)).toBe('#e14a51');
  });

  it('choisit un texte blanc ou noir selon le fond', () => {
    expect(readableTextOn('#ab1e25')).toBe('#ffffff');
    expect(readableTextOn('#ffe066')).toBe('#0b0b0b');
  });
});

describe('apparence du site', () => {
  it('reprend exactement les couleurs d’origine par défaut', () => {
    const palette = resolvePalette(defaultAppearance);
    expect(palette.ink).toEqual({ 950: '#08090a', 900: '#0d0f11', 850: '#121518', 800: '#171a1e' });
    expect(palette.accent[600]).toBe('#ab1e25');
    expect(palette.onAccent).toBe('#ffffff');
  });

  it('garde un fond sombre même si on choisit du blanc : les textes restent lisibles', () => {
    const palette = resolvePalette({ ...defaultAppearance, background: '#ffffff' });
    for (const surface of Object.values(palette.ink)) expect(contrast(SITE_TEXT, surface)).toBeGreaterThanOrEqual(12);
  });

  it('rend lisibles une couleur principale très sombre comme très claire', () => {
    const dark = resolvePalette({ ...defaultAppearance, accent: '#140014' });
    expect(contrast(dark.accent[400], dark.ink[850])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.accent[600], dark.ink[950])).toBeGreaterThanOrEqual(2.2);
    expect(contrast(dark.onAccent, dark.accent[600])).toBeGreaterThanOrEqual(4.5);

    const light = resolvePalette({ ...defaultAppearance, accent: '#ffe066' });
    expect(light.onAccent).toBe('#0b0b0b');
    expect(contrast(light.onAccent, light.accent[600])).toBeGreaterThanOrEqual(4.5);
  });

  it('rend les couleurs des graphiques visibles sur les panneaux et signale les couleurs trop proches', () => {
    const palette = resolvePalette({ ...defaultAppearance, clean: '#050505', dirty: '#050505' });
    expect(contrast(palette.fund.clean, palette.ink[850])).toBeGreaterThanOrEqual(3);
    expect(fundColorsTooClose(palette)).toBe(true);
    expect(fundColorsTooClose(resolvePalette(defaultAppearance))).toBe(false);
  });

  it('ignore les valeurs invalides', () => {
    expect(sanitizeAppearance({ accent: 'rouge', background: '#0B0906', clean: 12 })).toEqual({ ...defaultAppearance, background: '#0b0906' });
  });

  it('applique la palette aux variables CSS du site', () => {
    const root = document.createElement('div');
    applyPalette(resolvePalette({ ...defaultAppearance, accent: '#2563eb' }), root);
    expect(root.style.getPropertyValue('--color-blood-600')).toBe('#2563eb');
    expect(root.style.getPropertyValue('--color-on-accent')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--color-ink-950')).toBe('#08090a');
  });
});
