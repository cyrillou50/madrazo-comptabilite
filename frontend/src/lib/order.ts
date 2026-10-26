export interface PriceableLine { quantity: number; unitPrice?: number; discount?: number }

export function lineTotal(line: PriceableLine): number {
  const subtotal = Math.max(0, line.quantity) * Math.max(0, line.unitPrice ?? 0);
  const discount = Math.min(100, Math.max(0, line.discount ?? 0));
  return Math.round(subtotal * (1 - discount / 100));
}

export function orderPreviewTotal(lines: PriceableLine[]): number {
  return lines.reduce((total, line) => total + lineTotal(line), 0);
}

/** Prix négocié saisi dans le formulaire, en centimes ; un champ vide laisse le tarif normal s'appliquer. */
export function negotiatedPriceCents(price: string | undefined): number | undefined {
  return price ? Math.round(Number(price) * 100) : undefined;
}

export function isBelowMinimum(price: string | undefined, minimumPrice = 0): boolean {
  return !!price && Number(price) < minimumPrice;
}
