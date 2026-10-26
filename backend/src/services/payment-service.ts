import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../db.js';
import { audit, type AuditContext } from '../lib/audit.js';
import { paymentStatus } from '../lib/domain.js';
import { ApiError, conflict, notFound } from '../lib/errors.js';

interface OrderPaymentRow extends RowDataPacket { id: string; totalCents: string; status: string; paidCents: string; }
interface PaymentRow extends RowDataPacket { id: string; orderId: string; amountCents: string; reversedAt: Date | null; }

async function lockedOrder(connection: Parameters<Parameters<typeof withTransaction>[1]>[0], orderId: number) {
  const [rows] = await connection.execute<OrderPaymentRow[]>(
    `SELECT o.id, o.total_cents AS totalCents, o.status,
            COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.order_id = o.id AND p.reversed_at IS NULL), 0) AS paidCents
     FROM orders o WHERE o.id = ? FOR UPDATE`, [orderId],
  );
  if (!rows[0]) throw notFound('Commande introuvable.');
  return rows[0];
}

export async function recordPayment(
  pool: Pool,
  input: {
    orderId: number;
    amountCents: number;
    method: 'cash' | 'bank' | 'other';
    reference?: string | null | undefined;
    notes?: string | null | undefined;
    receivedBy: number;
  },
  context: AuditContext,
) {
  return withTransaction(pool, async (connection) => {
    const order = await lockedOrder(connection, input.orderId);
    if (order.status === 'cancelled') throw conflict('Impossible de payer une commande annulée.');
    const total = Number(order.totalCents);
    const paidBefore = Number(order.paidCents);
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new ApiError(422, 'INVALID_AMOUNT', 'Montant invalide.');
    if (input.amountCents > total - paidBefore) throw conflict('Le paiement dépasse le solde dû.', { dueCents: total - paidBefore });
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO payments (order_id, amount_cents, method, reference, notes, received_by) VALUES (?, ?, ?, ?, ?, ?)',
      [input.orderId, input.amountCents, input.method, input.reference ?? null, input.notes ?? null, input.receivedBy],
    );
    await connection.execute(
      `INSERT INTO cash_movements (movement_type, amount_cents, label, source_type, source_id, created_by)
       VALUES ('income', ?, ?, 'payment', ?, ?)`,
      [input.amountCents, `Paiement commande #${input.orderId}`, result.insertId, input.receivedBy],
    );
    const paidCents = paidBefore + input.amountCents;
    const status = paymentStatus(total, paidCents);
    await connection.execute('UPDATE orders SET payment_status = ?, version = version + 1 WHERE id = ?', [status, input.orderId]);
    await audit(connection, context, 'payment.created', 'payment', result.insertId, null, { orderId: input.orderId, amountCents: input.amountCents });
    return { id: result.insertId, orderId: input.orderId, paidCents, dueCents: total - paidCents, paymentStatus: status };
  });
}

export async function reversePayment(pool: Pool, paymentId: number, actorId: number, reason: string, context: AuditContext) {
  return withTransaction(pool, async (connection) => {
    const [payments] = await connection.execute<PaymentRow[]>(
      'SELECT id, order_id AS orderId, amount_cents AS amountCents, reversed_at AS reversedAt FROM payments WHERE id = ? FOR UPDATE', [paymentId],
    );
    const payment = payments[0];
    if (!payment) throw notFound('Paiement introuvable.');
    if (payment.reversedAt) return { id: paymentId, reversed: true, idempotent: true };
    const order = await lockedOrder(connection, Number(payment.orderId));
    await connection.execute(
      'UPDATE payments SET reversed_at = NOW(3), reversed_by = ?, reversal_reason = ? WHERE id = ?', [actorId, reason, paymentId],
    );
    await connection.execute(
      `INSERT INTO cash_movements (movement_type, amount_cents, label, source_type, source_id, created_by)
       VALUES ('refund', ?, ?, 'payment_reversal', ?, ?)`,
      [-Number(payment.amountCents), `Contrepassation paiement #${paymentId}`, paymentId, actorId],
    );
    const paidCents = Number(order.paidCents) - Number(payment.amountCents);
    const status = paymentStatus(Number(order.totalCents), paidCents);
    await connection.execute('UPDATE orders SET payment_status = ?, version = version + 1 WHERE id = ?', [status, payment.orderId]);
    await audit(connection, context, 'payment.reversed', 'payment', paymentId, null, { reason, orderId: Number(payment.orderId) });
    return { id: paymentId, reversed: true, idempotent: false, orderId: Number(payment.orderId), paidCents, dueCents: Number(order.totalCents) - paidCents };
  });
}
