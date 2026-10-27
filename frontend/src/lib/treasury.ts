import type { Fund } from '../types';

export const fundLabels: Record<Fund, string> = { clean: 'Argent propre', dirty: 'Argent sale' };

// Couleurs d'identité des deux caisses (graphiques, pastilles) : vérifiées sur le fond sombre
// des panneaux (#111416) — contraste ≥ 3:1, écart daltonisme ΔE 26,8, vision normale ΔE 31,8.
export const fundColors: Record<Fund, string> = { clean: '#3987e5', dirty: '#d95926' };

/** Argent propre obtenu pour un montant d'argent sale, commission déduite, arrondi au centime. */
export function launderedAmount(dirtyAmount: number, feePercent: number): number {
  const fee = Math.min(100, Math.max(0, feePercent || 0));
  return Math.round(Math.max(0, dirtyAmount || 0) * (100 - fee)) / 100;
}

/** Commission correspondant à un montant propre saisi à la main, arrondie au centième de pour cent. */
export function launderingFee(dirtyAmount: number, cleanAmount: number): number {
  if (!dirtyAmount || dirtyAmount <= 0) return 0;
  return Math.round((1 - cleanAmount / dirtyAmount) * 10_000) / 100;
}
