import { Router } from 'express';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { conflict, notFound } from '../lib/errors.js';
import { asyncHandler, idSchema, paginationMeta, paginationSchema, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';
import { cancelOrder, createOrder, deliverOrder } from '../services/order-service.js';

const orderSchema = z.object({
  groupId: idSchema.nullish(), contactId: idSchema.nullish(), notes: z.string().max(10000).nullish(),
  status: z.enum(['draft', 'pending', 'confirmed']).default('pending'), discountCents: z.number().int().nonnegative().default(0),
  reserveStock: z.boolean().optional(),
  items: z.array(z.object({
    itemId: idSchema, quantity: z.number().int().positive().max(1_000_000),
    discountPercent: z.number().min(0).max(100).multipleOf(0.01).optional(),
    discountCents: z.number().int().nonnegative().optional(),
  })).min(1).max(100),
});

export function ordersRouter(pool: Pool) {
  const router = Router();
  router.get('/', requirePermission('orders:read'), asyncHandler(async (request, response) => {
    const q = parse(paginationSchema.extend({ status: z.string().max(30).optional(), paymentStatus: z.string().max(30).optional(), groupId: idSchema.optional(), from: z.iso.datetime().optional(), to: z.iso.datetime().optional() }), request.query);
    const clauses = ['1=1']; const params: Array<string | number> = [];
    if (q.search) { clauses.push('(o.reference LIKE ? OR g.name LIKE ?)'); const t = `%${q.search}%`; params.push(t, t); }
    if (q.status) { clauses.push('o.status=?'); params.push(q.status); } if (q.paymentStatus) { clauses.push('o.payment_status=?'); params.push(q.paymentStatus); }
    if (q.groupId) { clauses.push('o.group_id=?'); params.push(q.groupId); } if (q.from) { clauses.push('o.order_date>=?'); params.push(q.from); } if (q.to) { clauses.push('o.order_date<=?'); params.push(q.to); }
    const where = clauses.join(' AND '), offset = (q.page - 1) * q.limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.id,o.reference,o.group_id groupId,g.name groupName,o.contact_id contactId,
              CONCAT_WS(' ',c.first_name,c.last_name) contactName,u.display_name sellerName,o.order_date orderDate,
              o.total_cents totalCents,o.cost_cents costCents,o.margin_cents marginCents,o.status,o.payment_status paymentStatus,
              COALESCE(p.paid,0) paidCents,o.total_cents-COALESCE(p.paid,0) dueCents
       FROM orders o LEFT JOIN \`groups\` g ON g.id=o.group_id LEFT JOIN contacts c ON c.id=o.contact_id JOIN users u ON u.id=o.seller_id
       LEFT JOIN (SELECT order_id,SUM(amount_cents) paid FROM payments WHERE reversed_at IS NULL GROUP BY order_id)p ON p.order_id=o.id
       WHERE ${where} ORDER BY o.order_date DESC LIMIT ? OFFSET ?`, [...params, q.limit, offset],
    );
    const [count] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM orders o LEFT JOIN \`groups\` g ON g.id=o.group_id WHERE ${where}`, params);
    response.json({ data: rows, meta: paginationMeta(q.page, q.limit, Number(count[0]?.total ?? 0)) });
  }));
  router.get('/:id', requirePermission('orders:read'), asyncHandler(async (request, response) => {
    const id = parse(idSchema, request.params.id);
    const [orders] = await pool.execute<RowDataPacket[]>(
      `SELECT o.id,o.reference,o.group_id groupId,o.contact_id contactId,o.seller_id sellerId,
              o.order_date orderDate,o.subtotal_cents subtotalCents,o.discount_cents discountCents,
              o.total_cents totalCents,o.cost_cents costCents,o.margin_cents marginCents,
              o.notes,o.status,o.payment_status paymentStatus,o.version,o.created_at createdAt,o.updated_at updatedAt,
              g.name groupName,CONCAT_WS(' ',c.first_name,c.last_name) contactName,u.display_name sellerName,
              COALESCE(p.paid,0) paidCents,o.total_cents-COALESCE(p.paid,0) dueCents
       FROM orders o LEFT JOIN \`groups\` g ON g.id=o.group_id LEFT JOIN contacts c ON c.id=o.contact_id JOIN users u ON u.id=o.seller_id
       LEFT JOIN (SELECT order_id,SUM(amount_cents) paid FROM payments WHERE reversed_at IS NULL GROUP BY order_id)p ON p.order_id=o.id WHERE o.id=?`, [id],
    );
    if (!orders[0]) throw notFound('Commande introuvable.');
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT oi.id,oi.item_id itemId,oi.item_name_snapshot itemName,oi.quantity,oi.unit_price_cents unitPriceCents,
              oi.unit_cost_cents unitCostCents,oi.discount_cents discountCents,oi.line_total_cents lineTotalCents,COALESCE(d.delivered,0) deliveredQuantity
       FROM order_items oi LEFT JOIN (SELECT order_item_id,SUM(quantity)delivered FROM delivery_items GROUP BY order_item_id)d ON d.order_item_id=oi.id WHERE oi.order_id=?`, [id],
    );
    const [payments] = await pool.execute<RowDataPacket[]>('SELECT id,amount_cents amountCents,method,reference,notes,paid_at paidAt,reversed_at reversedAt FROM payments WHERE order_id=? ORDER BY paid_at DESC', [id]);
    const [deliveries] = await pool.execute<RowDataPacket[]>('SELECT id,idempotency_key idempotencyKey,notes,delivered_at deliveredAt FROM deliveries WHERE order_id=? ORDER BY delivered_at DESC', [id]);
    response.json({ data: { ...orders[0], items, payments, deliveries } });
  }));
  router.post('/', requirePermission('orders:write'), asyncHandler(async (request, response) => {
    const input = parse(orderSchema, request.body);
    let reserveStock = input.reserveStock;
    if (reserveStock === undefined) {
      const [settingRows] = await pool.execute<RowDataPacket[]>(
        "SELECT value_json AS value FROM settings WHERE setting_key = 'stockReservationEnabled' LIMIT 1",
      );
      const raw = settingRows[0]?.value;
      if (typeof raw === 'boolean') reserveStock = raw;
      else if (typeof raw === 'number') reserveStock = raw !== 0;
      else if (typeof raw === 'string') {
        try { reserveStock = Boolean(JSON.parse(raw)); } catch { reserveStock = raw !== 'false' && raw !== '0'; }
      }
    }
    const data = await createOrder(pool, {
      groupId: input.groupId, contactId: input.contactId, sellerId: request.principal!.id, notes: input.notes,
      status: input.status, discountCents: input.discountCents, reserveStock: reserveStock ?? true,
      lines: input.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity, discountCents: item.discountCents, discountPercent: item.discountPercent })),
      allowBlockedGroup: request.principal!.permissions.has('groups:override_block'),
    }, { actorId: request.principal!.id, ip: request.ip, userAgent: request.get('user-agent') });
    response.status(201).json({ data });
  }));
  router.patch('/:id/status', requirePermission('orders:write'), asyncHandler(async (request, response) => {
    const id = parse(idSchema, request.params.id); const input = parse(z.object({ status: z.enum(['draft','pending','confirmed']) }), request.body);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE orders SET status=?,version=version+1 WHERE id=? AND status IN ('draft','pending','confirmed')`, [input.status, id],
    );
    if (!result.affectedRows) throw conflict('Transition de statut impossible.'); response.json({ data: { id, status: input.status } });
  }));
  router.post('/:id/deliveries', requirePermission('orders:deliver'), asyncHandler(async (request, response) => {
    const orderId = parse(idSchema, request.params.id);
    const input = parse(z.object({ idempotencyKey: z.string().min(8).max(100), notes: z.string().max(500).nullish(), items: z.array(z.object({ orderItemId: idSchema, quantity: z.number().int().positive() })).min(1) }), request.body);
    const data = await deliverOrder(pool, orderId, { idempotencyKey: input.idempotencyKey, notes: input.notes, deliveredBy: request.principal!.id, lines: input.items }, { actorId: request.principal!.id, ip: request.ip, userAgent: request.get('user-agent') });
    response.status(data.idempotent ? 200 : 201).json({ data });
  }));
  router.post('/:id/cancel', requirePermission('orders:cancel'), asyncHandler(async (request, response) => {
    const id = parse(idSchema, request.params.id); const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(500) }), request.body);
    const data = await cancelOrder(pool, id, request.principal!.id, reason, { actorId: request.principal!.id, ip: request.ip, userAgent: request.get('user-agent') });
    response.json({ data });
  }));
  return router;
}
