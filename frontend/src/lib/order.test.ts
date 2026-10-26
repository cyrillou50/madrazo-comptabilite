import { describe, expect, it } from 'vitest';
import { isBelowMinimum, lineTotal, negotiatedPriceCents, orderPreviewTotal } from './order';

describe('calcul estimatif de commande', () => {
  it('calcule une ligne avec remise en pourcentage', () => {
    expect(lineTotal({ quantity: 4, unitPrice: 2_500, discount: 10 })).toBe(9_000);
  });

  it('borne une remise invalide et refuse implicitement les quantités négatives', () => {
    expect(lineTotal({ quantity: -2, unitPrice: 100, discount: 0 })).toBe(0);
    expect(lineTotal({ quantity: 2, unitPrice: 100, discount: 150 })).toBe(0);
  });

  it('n’envoie un prix négocié que s’il a été saisi', () => {
    expect(negotiatedPriceCents('')).toBeUndefined();
    expect(negotiatedPriceCents(undefined)).toBeUndefined();
    expect(negotiatedPriceCents('4500')).toBe(450_000);
  });

  it('signale un prix saisi sous le prix minimum', () => {
    expect(isBelowMinimum('3999', 4000)).toBe(true);
    expect(isBelowMinimum('4000', 4000)).toBe(false);
    expect(isBelowMinimum('', 4000)).toBe(false);
  });

  it('additionne plusieurs articles sans flottants monétaires persistés', () => {
    expect(orderPreviewTotal([
      { quantity: 2, unitPrice: 10_000, discount: 0 },
      { quantity: 3, unitPrice: 5_000, discount: 20 },
    ])).toBe(32_000);
  });
});
