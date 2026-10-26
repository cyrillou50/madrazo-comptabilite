import { describe, expect, it } from 'vitest';
import { lineTotal, orderPreviewTotal } from './order';

describe('calcul estimatif de commande', () => {
  it('calcule une ligne avec remise en pourcentage', () => {
    expect(lineTotal({ quantity: 4, unitPrice: 2_500, discount: 10 })).toBe(9_000);
  });

  it('borne une remise invalide et refuse implicitement les quantités négatives', () => {
    expect(lineTotal({ quantity: -2, unitPrice: 100, discount: 0 })).toBe(0);
    expect(lineTotal({ quantity: 2, unitPrice: 100, discount: 150 })).toBe(0);
  });

  it('additionne plusieurs articles sans flottants monétaires persistés', () => {
    expect(orderPreviewTotal([
      { quantity: 2, unitPrice: 10_000, discount: 0 },
      { quantity: 3, unitPrice: 5_000, discount: 20 },
    ])).toBe(32_000);
  });
});
