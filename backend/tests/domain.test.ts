import { describe, expect, it } from 'vitest';
import { applyStockMovement, assertDelivery, assertOrderCancellable, calculateOrder, paymentStatus } from '../src/lib/domain.js';

describe('calcul de commande multi-articles', () => {
  it('calcule exactement CA, coût, remises et marge en centimes', () => {
    expect(calculateOrder([
      { itemId: 1, quantity: 3, unitPriceCents: 12_500, unitCostCents: 7_000, discountCents: 2_500 },
      { itemId: 2, quantity: 2, unitPriceCents: 40_000, unitCostCents: 25_000 },
    ], 5_000)).toEqual({ subtotalCents: 117_500, discountCents: 7_500, totalCents: 110_000, costCents: 71_000, marginCents: 39_000 });
  });
  it('refuse une remise dépassant le sous-total', () => {
    expect(() => calculateOrder([{ itemId:1,quantity:1,unitPriceCents:100,unitCostCents:20 }],101)).toThrowError(/remise dépasse/i);
  });
});

describe('paiements partiels', () => {
  it('fait progresser la dette sans dépasser le dû', () => {
    expect(paymentStatus(100_000, 0)).toBe('unpaid');
    expect(paymentStatus(100_000, 40_000)).toBe('partial');
    expect(paymentStatus(100_000, 70_000)).toBe('partial');
    expect(paymentStatus(100_000, 100_000)).toBe('paid');
    expect(() => paymentStatus(100_000, 100_001)).toThrowError(/dépasse/i);
  });
});

describe('stock et livraison', () => {
  it('déduit uniquement la quantité livrée et refuse la double livraison', () => {
    expect(assertDelivery(4, 10, 0)).toBe(6);
    expect(assertDelivery(6, 10, 4)).toBe(0);
    expect(() => assertDelivery(1, 10, 10)).toThrowError(/reste que 0/i);
  });
  it('conserve un stock non négatif', () => {
    expect(applyStockMovement(12, -5)).toBe(7);
    expect(() => applyStockMovement(4, -5)).toThrowError(/négatif/i);
  });
});

describe('annulation', () => {
  it('exige le retour des livraisons et la contrepassation des paiements', () => {
    expect(() => assertOrderCancellable(0, 0)).not.toThrow();
    expect(() => assertOrderCancellable(1, 0)).toThrowError(/déjà livrée/i);
    expect(() => assertOrderCancellable(0, 1)).toThrowError(/contrepassés/i);
  });
});
