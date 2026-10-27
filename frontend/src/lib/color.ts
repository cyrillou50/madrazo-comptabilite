// Calculs de couleur pour l'apparence : espace OKLCH (luminosité perçue) et contraste WCAG.
// Permet d'ajuster automatiquement une couleur choisie pour qu'un texte reste lisible.

export interface Oklch { l: number; c: number; h: number }

const HEX = /^#?([0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value.trim());
}

function parseHex(hex: string): [number, number, number] {
  const match = HEX.exec(hex.trim());
  if (!match) throw new Error(`Couleur invalide : ${hex}`);
  const value = parseInt(match[1]!, 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const fromLinear = (channel: number) => (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function toOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const lp = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const mp = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const sp = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
    -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
    -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
  ];
}

/** Couleur OKLCH vers hexadécimal ; la saturation est réduite si la teinte sort de l'espace d'écran. */
export function fromOklch(color: Oklch): string {
  const target = { ...color, l: Math.min(1, Math.max(0, color.l)) };
  const inGamut = (candidate: Oklch) => oklchToLinear(candidate).every((channel) => channel >= -0.0001 && channel <= 1.0001);
  if (!inGamut(target)) {
    let low = 0;
    let high = target.c;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      if (inGamut({ ...target, c: middle })) low = middle; else high = middle;
    }
    target.c = low;
  }
  return toHex(oklchToLinear(target).map(fromLinear) as [number, number, number]);
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Distance perçue entre deux couleurs (OKLab × 100). */
export function colorDistance(first: string, second: string): number {
  const toLab = (hex: string) => { const { l, c, h } = toOklch(hex); return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]; };
  const [a, b] = [toLab(first), toLab(second)];
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!) * 100;
}

/** Éclaircit la couleur jusqu'à atteindre le contraste demandé sur le fond indiqué. */
export function ensureContrast(hex: string, background: string, minimum: number): string {
  if (contrast(hex, background) >= minimum) return `#${HEX.exec(hex.trim())![1]!.toLowerCase()}`;
  const color = toOklch(hex);
  let result = fromOklch(color);
  while (contrast(result, background) < minimum && color.l < 0.98) {
    color.l = Math.min(0.98, color.l + 0.02);
    result = fromOklch(color);
  }
  return result;
}

/** Texte le plus lisible sur un fond donné : blanc ou quasi-noir. */
export function readableTextOn(background: string): string {
  return contrast('#ffffff', background) >= contrast('#0b0b0b', background) ? '#ffffff' : '#0b0b0b';
}

export function shiftLightness(hex: string, delta: number, chromaFactor = 1): string {
  const color = toOklch(hex);
  return fromOklch({ l: Math.min(0.97, Math.max(0.12, color.l + delta)), c: color.c * chromaFactor, h: color.h });
}
