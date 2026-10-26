export interface PriceableLine { quantity: number; unitPrice?: number; discount?: number }

export function lineTotal(line: PriceableLine): number {
  const subtotal = Math.max(0, line.quantity) * Math.max(0, line.unitPrice ?? 0);
  const discount = Math.min(100, Math.max(0, line.discount ?? 0));
  return Math.round(subtotal * (1 - discount / 100));
}

export function orderPreviewTotal(lines: PriceableLine[]): number {
  return lines.reduce((total, line) => total + lineTotal(line), 0);
}
