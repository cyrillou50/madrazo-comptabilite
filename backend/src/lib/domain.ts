import { ApiError } from './errors.js';

export interface PricedLine {
  itemId: number;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  discountCents?: number;
}

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  costCents: number;
  marginCents: number;
}

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new ApiError(422, 'UNSAFE_AMOUNT', `${label} dépasse la plage autorisée.`);
  return value;
}

export function calculateOrder(lines: PricedLine[], orderDiscountCents = 0): OrderTotals {
  if (lines.length === 0) throw new ApiError(422, 'EMPTY_ORDER', 'Une commande doit contenir au moins un article.');
  if (!Number.isSafeInteger(orderDiscountCents) || orderDiscountCents < 0) throw new ApiError(422, 'INVALID_DISCOUNT', 'Remise invalide.');
  let subtotalCents = 0;
  let lineDiscountCents = 0;
  let costCents = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new ApiError(422, 'INVALID_QUANTITY', 'Quantité invalide.');
    if (!Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0) throw new ApiError(422, 'INVALID_PRICE', 'Prix invalide.');
    const discount = line.discountCents ?? 0;
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > line.unitPriceCents * line.quantity) {
      throw new ApiError(422, 'INVALID_DISCOUNT', 'La remise de ligne est invalide.');
    }
    subtotalCents = safeInteger(subtotalCents + line.unitPriceCents * line.quantity, 'Sous-total');
    lineDiscountCents = safeInteger(lineDiscountCents + discount, 'Remise');
    costCents = safeInteger(costCents + line.unitCostCents * line.quantity, 'Coût');
  }
  const discountCents = safeInteger(lineDiscountCents + orderDiscountCents, 'Remise');
  if (discountCents > subtotalCents) throw new ApiError(422, 'INVALID_DISCOUNT', 'La remise dépasse le sous-total.');
  const totalCents = subtotalCents - discountCents;
  return { subtotalCents, discountCents, totalCents, costCents, marginCents: totalCents - costCents };
}

export function paymentStatus(totalCents: number, paidCents: number): 'unpaid' | 'partial' | 'paid' {
  if (paidCents < 0 || paidCents > totalCents) throw new ApiError(422, 'PAYMENT_OUT_OF_RANGE', 'Le paiement dépasse le solde dû.');
  if (paidCents === 0) return 'unpaid';
  return paidCents === totalCents ? 'paid' : 'partial';
}

export function assertDelivery(requested: number, ordered: number, alreadyDelivered: number): number {
  if (!Number.isInteger(requested) || requested <= 0) throw new ApiError(422, 'INVALID_QUANTITY', 'Quantité livrée invalide.');
  const remaining = ordered - alreadyDelivered;
  if (requested > remaining) throw new ApiError(409, 'OVER_DELIVERY', `Il ne reste que ${remaining} unité(s) à livrer.`);
  return remaining - requested;
}

export function applyStockMovement(current: number, delta: number): number {
  if (!Number.isInteger(current) || !Number.isInteger(delta) || delta === 0) throw new ApiError(422, 'INVALID_QUANTITY', 'Mouvement de stock invalide.');
  const next = current + delta;
  if (next < 0) throw new ApiError(409, 'NEGATIVE_STOCK', 'Ce mouvement rendrait le stock négatif.');
  return next;
}

export function assertOrderCancellable(deliveryCount: number, activePaymentCount: number): void {
  if (deliveryCount > 0) throw new ApiError(409, 'DELIVERED_ORDER', 'Une commande déjà livrée doit être corrigée par un retour.');
  if (activePaymentCount > 0) throw new ApiError(409, 'ACTIVE_PAYMENTS', 'Les paiements actifs doivent être contrepassés avant l’annulation.');
}
